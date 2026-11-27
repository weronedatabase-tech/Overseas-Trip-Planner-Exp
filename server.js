import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================================================
// LOAD SHARED ENVIRONMENT CONFIG FROM backend/config.js
// =========================================================
function loadAppConfig() {
  const cfgPath = path.join(__dirname, "backend", "config.js");
  const src = fs.readFileSync(cfgPath, "utf8");
  const ctx = {};
  vm.runInNewContext(
    src +
      "\n;globalThis.__CFG = { ENV, API_URL, GAS_BACKEND_URL: typeof GAS_BACKEND_URL !== 'undefined' ? GAS_BACKEND_URL : API_URL, REALTIME_SERVER_URL: typeof REALTIME_SERVER_URL !== 'undefined' ? REALTIME_SERVER_URL : '', Drive_Folder_ID, Fallback_Sheet_ID };",
    ctx,
  );
  return ctx.__CFG;
}

const appConfig = loadAppConfig();
const GAS_BACKEND_URL = process.env.GAS_BACKEND_URL || appConfig.GAS_BACKEND_URL || appConfig.API_URL;
const PORT = Number(process.env.PORT) || 3000;
const CORS_ORIGIN_ENV = (process.env.CORS_ORIGINS || "").trim();
const ALLOWED_CORS_ORIGINS = CORS_ORIGIN_ENV
  ? new Set(CORS_ORIGIN_ENV.split(",").map((s) => s.trim()).filter(Boolean))
  : null;

const ALLOWED_ROOT_FILES = new Set([
  "index.html",
  "register.html",
  "dashboard.html",
  "roster.html",
  "logistics.html",
  "attendance.html",
  "finance.html",
  "minutes.html",
  "files.html",
  "settings.html",
  "diet.html",
  "expired.html",
  "medical.html",
  "other.html",
  "manifest.json",
  "favicon.svg",
]);

// =========================================================
// IN-MEMORY AUTHORITATIVE STATE CACHE (TTL + ZERO-CLONE)
// =========================================================
class StateCache {
  constructor(defaultTtlMs = 60000) {
    this.defaultTtlMs = defaultTtlMs;
    this.store = new Map();
    this.sweeper = setInterval(() => this.sweep(), 20000);
    if (this.sweeper.unref) this.sweeper.unref();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key) {
    this.store.delete(key);
  }

  deleteByPrefix(prefix) {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }

  deleteMatching(predicate) {
    for (const k of this.store.keys()) {
      if (predicate(k)) this.store.delete(k);
    }
  }

  clear() {
    this.store.clear();
  }

  sweep() {
    const now = Date.now();
    for (const [k, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(k);
    }
  }

  get size() {
    return this.store.size;
  }
}

const cache = new StateCache(60000);
const inFlightReads = new Map();

// =========================================================
// FIFO BACKGROUND WRITE QUEUE (PROTECTS GAS LOCKS & QUOTA)
// =========================================================
class AsyncQueue {
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
    this.drainWaiters = [];
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await task());
        } catch (e) {
          reject(e);
        }
      });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      if (this.running === 0 && this.queue.length === 0 && this.drainWaiters.length > 0) {
        const waiters = this.drainWaiters.splice(0);
        waiters.forEach((fn) => fn());
      }
      return;
    }
    this.running++;
    const task = this.queue.shift();
    try {
      await task();
    } finally {
      this.running--;
      this.process();
    }
  }

  get pendingCount() {
    return this.running + this.queue.length;
  }

  waitForDrain(timeoutMs = 15000) {
    if (this.running === 0 && this.queue.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      this.drainWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

const writeQueue = new AsyncQueue(1);

// Track mutations applied optimistically in memory while still queued/in-flight to GAS
const pendingMutations = [];
let mutationSeq = 1;

function addPendingMutation(action, payload) {
  const id = mutationSeq++;
  pendingMutations.push({ id, action, payload, ts: Date.now() });
  return id;
}

function removePendingMutation(id) {
  const idx = pendingMutations.findIndex((m) => m.id === id);
  if (idx !== -1) pendingMutations.splice(idx, 1);
}

// =========================================================
// AUTH TOKEN & USER SCOPE CACHE (ZERO PII LEAKS)
// =========================================================
const tokenAuthCache = new Map(); // token -> { nric, role, name, isMainAdmin, expiresAt }
const userScopeCache = new Map(); // nric -> { pocNric, familyNrics: Set, isGroupIC, logisticsGroup, groupMembersNrics: Set, expiresAt }

const AUTH_CACHE_TTL_MS = 10 * 60 * 1000;
const SCOPE_CACHE_TTL_MS = 5 * 60 * 1000;

function cacheVerifiedAuth(token, authObj) {
  if (!token || !authObj || !authObj.nric) return;
  tokenAuthCache.set(token, {
    nric: String(authObj.nric).trim().toUpperCase(),
    role: String(authObj.role || "user"),
    name: String(authObj.name || ""),
    isMainAdmin: Boolean(authObj.isMainAdmin || String(authObj.nric).trim().toUpperCase() === "ADMIN"),
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  });
}

function getCachedAuth(token) {
  if (!token) return null;
  const entry = tokenAuthCache.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokenAuthCache.delete(token);
    return null;
  }
  return entry;
}

function invalidateAllUserScopes() {
  userScopeCache.clear();
}

async function verifyAuthWithGAS(token) {
  if (!token || typeof token !== "string") return null;
  const cached = getCachedAuth(token);
  if (cached) return cached;

  try {
    const res = await callGAS({ action: "getSyncState", authToken: token, sinceSeq: 0 }, 2);
    if (res && res.status === "success" && res.authInfo && res.authInfo.nric) {
      cacheVerifiedAuth(token, res.authInfo);
      return getCachedAuth(token);
    }
  } catch (e) {}

  // Fallback for older GAS deployments without authInfo on getSyncState
  try {
    const parts = token.split(".");
    if (parts.length === 2) {
      const payloadJson = Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
      const decoded = JSON.parse(payloadJson);
      if (decoded && decoded.nric) {
        const probe = await callGAS({ action: "getSettings", authToken: token }, 1);
        if (probe && probe.status !== "error") {
          cacheVerifiedAuth(token, decoded);
          return getCachedAuth(token);
        }
      }
    }
  } catch (e) {}

  return null;
}

function buildScopeFromProfileResponse(nric, profRes) {
  const cleanNric = String(nric || "").trim().toUpperCase();
  const familyNrics = new Set([cleanNric]);
  let pocNric = cleanNric;
  if (profRes && Array.isArray(profRes.family)) {
    profRes.family.forEach((f) => {
      if (f && f.nric) familyNrics.add(String(f.nric).trim().toUpperCase());
      if (f && String(f.nric || "").trim().toUpperCase() === cleanNric && f.pocNric) {
        pocNric = String(f.pocNric).trim().toUpperCase();
      }
    });
  }
  const groupMembersNrics = new Set();
  const isGroupIC = Boolean(profRes && profRes.isGroupIC === true);
  const logisticsGroup = String((profRes && profRes.logisticsGroup) || "").trim();
  if (isGroupIC && Array.isArray(profRes.groupMembers)) {
    profRes.groupMembers.forEach((m) => {
      if (m && m.nric) groupMembersNrics.add(String(m.nric).trim().toUpperCase());
    });
  }
  const scope = {
    pocNric,
    familyNrics,
    isGroupIC,
    logisticsGroup,
    groupMembersNrics,
    expiresAt: Date.now() + SCOPE_CACHE_TTL_MS,
  };
  userScopeCache.set(cleanNric, scope);
  return scope;
}

async function resolveUserScope(auth, token) {
  if (!auth) return null;
  if (auth.role === "admin") {
    return {
      role: "admin",
      pocNric: "ADMIN",
      familyNrics: new Set(),
      isGroupIC: false,
      logisticsGroup: "",
      groupMembersNrics: new Set(),
    };
  }

  const cleanNric = String(auth.nric || "").trim().toUpperCase();
  const cached = userScopeCache.get(cleanNric);
  if (cached && Date.now() <= cached.expiresAt) {
    return { role: "user", ...cached };
  }

  // First try deriving scope at 0ms from cached admin roster if warm
  const cachedRosterRes = cache.get("live::admin::fetchAdminRoster::{}");
  if (cachedRosterRes && Array.isArray(cachedRosterRes.roster)) {
    const self = cachedRosterRes.roster.find(
      (r) => String(r.nric || "").trim().toUpperCase() === cleanNric,
    );
    if (self) {
      const pocNric = String(self.pocNric || self.nric).trim().toUpperCase();
      const familyNrics = new Set([cleanNric]);
      const groupMembersNrics = new Set();
      const isGroupIC = Boolean(self.isGroupIC);
      const logisticsGroup = String(self.logisticsGroup || "").trim();
      cachedRosterRes.roster.forEach((r) => {
        const rn = String(r.nric || "").trim().toUpperCase();
        const rpoc = String(r.pocNric || r.nric || "").trim().toUpperCase();
        if (rpoc === pocNric) familyNrics.add(rn);
        if (isGroupIC && logisticsGroup && String(r.logisticsGroup || "").trim() === logisticsGroup) {
          groupMembersNrics.add(rn);
        }
      });
      const scope = {
        pocNric,
        familyNrics,
        isGroupIC,
        logisticsGroup,
        groupMembersNrics,
        expiresAt: Date.now() + SCOPE_CACHE_TTL_MS,
      };
      userScopeCache.set(cleanNric, scope);
      return { role: "user", ...scope };
    }
  }

  // Self-scoped lookup using the user's own token (works even before any admin logs in)
  if (token) {
    try {
      const profRes = await callGAS({ action: "getProfile", nric: cleanNric, authToken: token }, 2);
      if (profRes && profRes.status === "success") {
        const scope = buildScopeFromProfileResponse(cleanNric, profRes);
        return { role: "user", ...scope };
      }
    } catch (e) {}
  }

  return {
    role: "user",
    pocNric: cleanNric,
    familyNrics: new Set([cleanNric]),
    isGroupIC: false,
    logisticsGroup: "",
    groupMembersNrics: new Set(),
  };
}

// =========================================================
// GAS HTTP BRIDGE (WITH RETRIES & TIMEOUT)
// =========================================================
async function callGAS(reqBody, maxAttempts = 3) {
  const payloadStr = JSON.stringify(reqBody);
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    try {
      const resp = await fetch(GAS_BACKEND_URL, {
        method: "POST",
        body: payloadStr,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        redirect: "follow",
        signal: controller.signal,
      });
      const text = await resp.text();
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        lastError = new Error("Invalid JSON from GAS: " + text.slice(0, 140));
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt * 900));
        }
      }
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, attempt * 900));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("GAS request failed");
}

// =========================================================
// AUTHORITATIVE IN-MEMORY STATE PATCHING (0ms CONSISTENCY)
// =========================================================
function patchAttendanceCacheObject(attObj, updates) {
  if (!attObj || attObj.status === "error" || !Array.isArray(updates)) return false;
  if (!attObj.data || typeof attObj.data !== "object") attObj.data = {};
  let changed = false;
  updates.forEach((u) => {
    if (!u || !u.nric) return;
    const nric = String(u.nric).trim().toUpperCase();
    const ts = Number(u.ts) || Date.now();
    const status = Boolean(u.status);
    const existing = attObj.data[nric];
    if (!existing || ts >= (Number(existing.ts) || 0)) {
      attObj.data[nric] = { status, ts };
      changed = true;
    }
  });
  return changed;
}

function patchAllAttendanceCaches(juncture, updates) {
  if (!juncture || !Array.isArray(updates)) return;
  const suffix = `::fetchAttendanceData::${JSON.stringify({ juncture })}`;
  for (const [key, entry] of cache.store.entries()) {
    if (key.startsWith("live::") && key.endsWith(suffix)) {
      patchAttendanceCacheObject(entry.value, updates);
    }
  }
}

function patchPairingList(list, updates) {
  if (!Array.isArray(list) || !Array.isArray(updates)) return false;
  let changed = false;
  updates.forEach((u) => {
    if (!u || !u.traineeNric || !u.volNric) return;
    const tNric = String(u.traineeNric).trim().toUpperCase();
    const vNric = String(u.volNric).trim().toUpperCase();
    const ts = Number(u.ts) || Date.now();
    const status = u.status || (u.action === "ADD" ? "ACTIVE" : "UNPAIRED");
    const existing = list.find(
      (p) =>
        String(p.traineeNric || "").trim().toUpperCase() === tNric &&
        String(p.volNric || "").trim().toUpperCase() === vNric,
    );
    if (existing) {
      if (ts >= (Number(existing.ts) || 0)) {
        existing.status = status;
        existing.ts = ts;
        changed = true;
      }
    } else {
      list.push({ traineeNric: tNric, volNric: vNric, status, ts });
      changed = true;
    }
  });
  return changed;
}

function patchAllPairingCaches(updates) {
  for (const [key, entry] of cache.store.entries()) {
    if (!key.startsWith("live::")) continue;
    if (key.includes("::fetchPairingsOnly::") && entry.value && Array.isArray(entry.value.pairings)) {
      patchPairingList(entry.value.pairings, updates);
    } else if (key.includes("::fetchLogistics::") && entry.value && Array.isArray(entry.value.pairings)) {
      if (key.startsWith("live::admin::")) {
        patchPairingList(entry.value.pairings, updates);
      } else {
        // Scoped user logistics cache may now gain/lose paired contact details -> invalidate so next read is exact
        cache.delete(key);
      }
    }
  }
}

function patchRoomList(list, updates) {
  if (!Array.isArray(list) || !Array.isArray(updates)) return false;
  let changed = false;
  updates.forEach((u) => {
    if (!u || !u.id) return;
    const ts = Number(u.ts) || Date.now();
    const existing = list.find((r) => r.id === u.id);
    if (existing) {
      if (ts >= (Number(existing.ts) || 0)) {
        if (u.name !== undefined) existing.name = u.name;
        if (u.capacity !== undefined) existing.capacity = u.capacity;
        if (u.occupants !== undefined) existing.occupants = u.occupants;
        if (u.isDeleted !== undefined) existing.isDeleted = Boolean(u.isDeleted);
        existing.ts = ts;
        changed = true;
      }
    } else {
      list.push({
        id: u.id,
        name: u.name || "",
        capacity: Number(u.capacity) || 2,
        occupants: Array.isArray(u.occupants) ? u.occupants : [],
        isDeleted: Boolean(u.isDeleted),
        ts,
      });
      changed = true;
    }
  });
  return changed;
}

function patchAllRoomCaches(updates) {
  for (const [key, entry] of cache.store.entries()) {
    if (!key.startsWith("live::")) continue;
    if (key.includes("::fetchRoomsOnly::") && entry.value && Array.isArray(entry.value.rooms)) {
      patchRoomList(entry.value.rooms, updates);
    } else if (key.includes("::fetchLogistics::") && entry.value && Array.isArray(entry.value.rooms)) {
      if (key.startsWith("live::admin::")) {
        patchRoomList(entry.value.rooms, updates);
      } else {
        cache.delete(key);
      }
    }
  }
}

function patchAssignmentParticipants(list, updates, column) {
  if (!Array.isArray(list) || !Array.isArray(updates)) return false;
  let changed = false;
  updates.forEach((u) => {
    if (!u || !u.nric) return;
    const nric = String(u.nric).trim().toUpperCase();
    const p = list.find((x) => String(x.nric || "").trim().toUpperCase() === nric);
    if (!p) return;
    if (column === "logisticsGroup") {
      p.logisticsGroup = u.value || "";
      if (u.isGroupIC !== undefined) p.isGroupIC = Boolean(u.isGroupIC);
      changed = true;
    } else if (column === "bus") {
      p.bus = u.value || "";
      changed = true;
    } else if (column === "isGroupIC") {
      p.isGroupIC = Boolean(u.value);
      changed = true;
    }
  });
  return changed;
}

function patchAllAssignmentCaches(updates, column) {
  invalidateAllUserScopes();
  for (const [key, entry] of cache.store.entries()) {
    if (!key.startsWith("live::")) continue;
    if (key.startsWith("live::admin::fetchLogistics::") && entry.value && Array.isArray(entry.value.participants)) {
      patchAssignmentParticipants(entry.value.participants, updates, column);
    } else if (key.startsWith("live::admin::fetchAdminRoster::") && entry.value && Array.isArray(entry.value.roster)) {
      patchAssignmentParticipants(entry.value.roster, updates, column);
    } else if (key.includes("::getProfile::") || key.includes("::fetchLogistics::")) {
      cache.delete(key);
    }
  }
}

function patchFinanceCacheObject(finRes, payload) {
  if (!finRes || finRes.status === "error" || !payload) return false;
  if (!finRes.data) finRes.data = { options: [], config: {} };
  let changed = false;

  if (payload.config && payload.config.ts) {
    const curTs = Number(finRes.data.config?.ts || 0);
    if (payload.config.ts >= curTs) {
      finRes.data.config = payload.config;
      changed = true;
    }
  }
  if (Array.isArray(payload.updates)) {
    if (!Array.isArray(finRes.data.options)) finRes.data.options = [];
    payload.updates.forEach((u) => {
      if (!u || !u.id) return;
      const idx = finRes.data.options.findIndex((o) => o.id === u.id);
      if (idx === -1) {
        finRes.data.options.push(u);
        changed = true;
      } else if (!u.ts || u.ts >= Number(finRes.data.options[idx].ts || 0)) {
        finRes.data.options[idx] = u;
        changed = true;
      }
    });
  }
  return changed;
}

function patchAllFinanceCaches(payload) {
  for (const [key, entry] of cache.store.entries()) {
    if (!key.startsWith("live::")) continue;
    if (key.startsWith("live::admin::fetchFinance::")) {
      patchFinanceCacheObject(entry.value, payload);
    } else if (key.includes("::fetchFinance::")) {
      // Invalidate scoped participant finance caches so next read gets exact scoped config
      cache.delete(key);
    }
  }
}

function patchMinutesList(list, updates) {
  if (!Array.isArray(list) || !Array.isArray(updates)) return false;
  let changed = false;
  updates.forEach((u) => {
    if (!u || !u.id) return;
    const ts = Number(u.ts) || Date.now();
    const idx = list.findIndex((m) => m.id === u.id);
    if (idx === -1) {
      list.push({ ...u, ts });
      changed = true;
    } else if (ts >= Number(list[idx].ts || 0)) {
      list[idx] = { ...list[idx], ...u, ts };
      changed = true;
    }
  });
  return changed;
}

function patchAllMinutesCaches(updates) {
  for (const [key, entry] of cache.store.entries()) {
    if (key.startsWith("live::admin::fetchMinutes::") && entry.value && Array.isArray(entry.value.minutes)) {
      patchMinutesList(entry.value.minutes, updates);
    }
  }
}

function patchReceiptsList(list, updates) {
  if (!Array.isArray(list) || !Array.isArray(updates)) return false;
  let changed = false;
  updates.forEach((u) => {
    if (!u || !u.id) return;
    const ts = Number(u.ts) || Date.now();
    const idx = list.findIndex((r) => r.id === u.id);
    if (idx === -1) {
      list.push({ ...u, ts });
      changed = true;
    } else if (ts >= Number(list[idx].ts || 0)) {
      list[idx] = { ...list[idx], ...u, ts };
      changed = true;
    }
  });
  return changed;
}

function patchAllReceiptCaches(updates) {
  if (!Array.isArray(updates) || updates.length === 0) return;
  for (const [key, entry] of cache.store.entries()) {
    if (!key.startsWith("live::")) continue;
    if (key.includes("::fetchReceipts::") && entry.value && Array.isArray(entry.value.receipts)) {
      if (key.startsWith("live::admin::")) {
        patchReceiptsList(entry.value.receipts, updates);
      } else {
        // Re-fetch scoped user receipts cleanly on next read so no cross-family receipt ever enters user cache
        cache.delete(key);
      }
    }
  }
}

function patchParticipantInList(list, member, deletedNric) {
  if (!Array.isArray(list)) return false;
  let changed = false;
  if (deletedNric) {
    const target = String(deletedNric).trim().toUpperCase();
    for (let i = list.length - 1; i >= 0; i--) {
      if (String(list[i].nric || "").trim().toUpperCase() === target) {
        list.splice(i, 1);
        changed = true;
      }
    }
    return changed;
  }
  if (!member || !member.nric) return false;
  const target = String(member.nric).trim().toUpperCase();
  const p = list.find((x) => String(x.nric || "").trim().toUpperCase() === target);
  if (!p) return false;
  const fields = [
    "email", "role", "fullName", "relatedTrainee", "relationship", "group",
    "gender", "contact", "address", "nationality", "passportNo", "passportExpiry",
    "dob", "diet", "emergencyName", "emergencyContact", "emergencyRelation",
    "sleeping", "otherPoints", "shortName", "medical",
  ];
  fields.forEach((f) => {
    if (member[f] !== undefined) p[f] = member[f];
  });
  if (member.fullName !== undefined && p.name !== undefined) {
    p.name = member.fullName;
  }
  changed = true;
  return changed;
}

function patchAllRosterCaches(member, deletedNric = "") {
  invalidateAllUserScopes();
  for (const [key, entry] of cache.store.entries()) {
    if (!key.startsWith("live::")) continue;
    if (key.startsWith("live::admin::fetchAdminRoster::") && entry.value && Array.isArray(entry.value.roster)) {
      patchParticipantInList(entry.value.roster, member, deletedNric);
    } else if (key.startsWith("live::admin::fetchLogistics::") && entry.value && Array.isArray(entry.value.participants)) {
      patchParticipantInList(entry.value.participants, member, deletedNric);
    } else if (key.includes("::getProfile::") || key.includes("::fetchLogistics::") || key.includes("::getPublicTrainees::")) {
      cache.delete(key);
    }
  }
}

function patchSettingsObject(cfg, action, body) {
  if (!cfg || typeof cfg !== "object") return false;
  if (action === "toggleEdits") {
    cfg.allowEdits = Boolean(body.status);
    return true;
  }
  if (action === "saveTripSettings") {
    if (body.title !== undefined && body.title !== "") cfg.tripName = body.title;
    if (body.year !== undefined && body.year !== "") cfg.tripYear = body.year;
    if (body.start !== undefined && body.start !== null) cfg.tripStartDate = String(body.start || "").trim();
    if (body.end !== undefined && body.end !== null) cfg.tripEndDate = String(body.end || "").trim();
    return true;
  }
  if (action === "addProjectGroup") {
    const g = String(body.groupName || "").trim();
    if (!Array.isArray(cfg.projectGroups)) cfg.projectGroups = [];
    if (!cfg.projectColors || typeof cfg.projectColors !== "object") cfg.projectColors = {};
    if (g && !cfg.projectGroups.includes(g)) cfg.projectGroups.push(g);
    if (g && body.colorClass) cfg.projectColors[g] = body.colorClass;
    return true;
  }
  if (action === "removeProjectGroup") {
    const g = String(body.groupName || "").trim();
    if (Array.isArray(cfg.projectGroups)) cfg.projectGroups = cfg.projectGroups.filter((x) => x !== g);
    if (cfg.projectColors && g) delete cfg.projectColors[g];
    return true;
  }
  if (action === "modifyJunctures") {
    if (!Array.isArray(cfg.junctures)) cfg.junctures = ["Morning Assembly"];
    const { actionType, oldName, newName } = body;
    if (actionType === "add" && newName && !cfg.junctures.includes(newName)) cfg.junctures.push(newName);
    else if (actionType === "remove" && oldName) cfg.junctures = cfg.junctures.filter((j) => j !== oldName);
    else if (actionType === "edit" && oldName && newName) {
      const idx = cfg.junctures.indexOf(oldName);
      if (idx > -1) cfg.junctures[idx] = newName;
    }
    return true;
  }
  if (action === "saveSortingRules") {
    cfg.sortingRules = body.rules;
    return true;
  }
  if (action === "saveCustomViewsOrder") {
    cfg.customViewsOrder = body.order;
    return true;
  }
  if (action === "addCommittee") {
    if (!Array.isArray(cfg.committee)) cfg.committee = [];
    const nric = String(body.nric || "").trim().toUpperCase();
    if (nric && !cfg.committee.find((c) => c.nric === nric)) {
      cfg.committee.push({
        nric,
        name: String(body.name || "").trim().toUpperCase(),
        phone: String(body.phone || "").trim(),
      });
    }
    return true;
  }
  if (action === "removeCommittee") {
    const nric = String(body.nric || "").trim().toUpperCase();
    if (Array.isArray(cfg.committee)) cfg.committee = cfg.committee.filter((c) => c.nric !== nric);
    return true;
  }
  if (action === "addHelpline") {
    if (!Array.isArray(cfg.helpline)) cfg.helpline = [];
    const id = String(body.id || "").trim();
    if (id && !cfg.helpline.find((c) => c.id === id)) {
      cfg.helpline.push({
        id,
        name: String(body.name || "").trim().toUpperCase(),
        phone: String(body.phone || "").trim(),
      });
    }
    return true;
  }
  if (action === "removeHelpline") {
    const id = String(body.id || "").trim();
    if (Array.isArray(cfg.helpline)) cfg.helpline = cfg.helpline.filter((c) => c.id !== id);
    return true;
  }
  return false;
}

function patchAllSettingsCaches(action, body) {
  let latestAdminSettings = null;
  for (const [key, entry] of cache.store.entries()) {
    if (!key.startsWith("live::")) continue;
    if (key.includes("::getSettings::") && entry.value && typeof entry.value === "object") {
      patchSettingsObject(entry.value, action, body);
      if (key.startsWith("live::admin::")) {
        latestAdminSettings = entry.value;
      }
    } else if (action === "modifyICJunctures" && key.includes("::getProfile::")) {
      cache.delete(key);
    }
  }
  return latestAdminSettings;
}

function replayPendingMutationsOnRead(action, reqData, freshRes) {
  if (!freshRes || freshRes.status === "error" || pendingMutations.length === 0) return freshRes;
  for (const m of pendingMutations) {
    if (action === "fetchAttendanceData" && m.action === "syncAttendanceUpdate") {
      if (String(reqData.juncture || "") === String(m.payload.juncture || "")) {
        patchAttendanceCacheObject(freshRes, m.payload.updates);
      }
    } else if ((action === "fetchPairingsOnly" || action === "fetchLogistics") && m.action === "syncPairingUpdates") {
      patchPairingList(freshRes.pairings, m.payload.updates);
    } else if ((action === "fetchRoomsOnly" || action === "fetchLogistics") && m.action === "syncRoomUpdates") {
      patchRoomList(freshRes.rooms, m.payload.updates);
    } else if ((action === "fetchLogistics" || action === "fetchAdminRoster") && m.action === "syncAssignments") {
      patchAssignmentParticipants(freshRes.participants || freshRes.roster, m.payload.updates, m.payload.column);
    } else if (action === "fetchFinance" && m.action === "saveFinance") {
      // Only replay full config onto admin finance response
      if (freshRes.data && freshRes.data.config && freshRes.data.config.ts !== undefined) {
        patchFinanceCacheObject(freshRes, m.payload.payload);
      }
    } else if (action === "fetchMinutes" && m.action === "syncMinutes") {
      patchMinutesList(freshRes.minutes, m.payload.updates);
    } else if (action === "fetchReceipts" && m.action === "syncReceipts") {
      if (Array.isArray(freshRes.receipts)) {
        patchReceiptsList(freshRes.receipts, m.payload.updates);
      }
    } else if ((action === "fetchAdminRoster" || action === "fetchLogistics") && (m.action === "adminUpdateParticipant" || m.action === "updateProfile")) {
      patchParticipantInList(freshRes.roster || freshRes.participants, m.payload.member, "");
    } else if ((action === "fetchAdminRoster" || action === "fetchLogistics") && m.action === "deleteParticipant") {
      patchParticipantInList(freshRes.roster || freshRes.participants, null, m.payload.nric);
    } else if (action === "getSettings") {
      patchSettingsObject(freshRes, m.action, m.payload);
    }
  }
  return freshRes;
}

const ACTION_DOMAINS = {
  syncAttendanceUpdate: ["attendance"],
  syncPairingUpdates: ["pairings", "logistics"],
  syncRoomUpdates: ["rooms", "logistics"],
  syncAssignments: ["logistics", "roster", "attendance"],
  saveFinance: ["finance"],
  syncReceipts: ["receipts", "finance"],
  uploadReceipt: ["receipts", "finance"],
  syncMinutes: ["minutes"],
  updateProfile: ["roster", "logistics", "finance"],
  adminUpdateParticipant: ["roster", "logistics", "finance"],
  submitRegistration: ["roster", "logistics", "finance"],
  deleteParticipant: ["roster", "logistics", "finance"],
  toggleRegistration: ["settings"],
  toggleEdits: ["settings"],
  addCommittee: ["settings"],
  removeCommittee: ["settings"],
  addHelpline: ["settings"],
  removeHelpline: ["settings"],
  addProjectGroup: ["settings", "roster", "logistics"],
  removeProjectGroup: ["settings", "roster", "logistics"],
  modifyJunctures: ["settings", "attendance"],
  modifyICJunctures: ["settings", "attendance"],
  saveSortingRules: ["settings", "roster", "logistics"],
  saveCustomViewsOrder: ["settings"],
  saveTripSettings: ["settings"],
  addDriveAccess: ["settings"],
  removeDriveAccess: ["settings"],
  massDriveAccess: ["settings"],
  setTripFile: ["settings", "files"],
  uploadDriveFile: ["files"],
  createDriveFolder: ["files"],
  createGoogleDoc: ["files"],
  renameDriveItem: ["files"],
  deleteDriveItem: ["files"],
  bulkDriveOperation: ["files"],
  extractData: ["files"],
  deleteArchivedTrip: ["settings"],
  archiveAndReset: ["all", "roster", "logistics", "pairings", "rooms", "attendance", "finance", "receipts", "minutes", "settings", "files"],
  clearCache: ["all", "roster", "logistics", "pairings", "rooms", "attendance", "finance", "receipts", "minutes", "settings", "files"],
};

function invalidateCachesForDomains(domains) {
  const set = new Set(Array.isArray(domains) ? domains : [domains]);
  if (set.has("all")) {
    cache.clear();
    invalidateAllUserScopes();
    return;
  }
  if (set.has("roster") || set.has("logistics")) {
    invalidateAllUserScopes();
  }
  const matchers = [];
  if (set.has("roster")) matchers.push("::fetchAdminRoster::", "::fetchLogistics::", "::getProfile::", "::getPublicTrainees::", "::fetchFinance::");
  if (set.has("logistics")) matchers.push("::fetchLogistics::", "::fetchAdminRoster::", "::getProfile::");
  if (set.has("pairings")) matchers.push("::fetchPairingsOnly::", "::fetchLogistics::", "::getProfile::");
  if (set.has("rooms")) matchers.push("::fetchRoomsOnly::", "::fetchLogistics::", "::getProfile::");
  if (set.has("attendance")) matchers.push("::fetchAttendanceData::");
  if (set.has("finance")) matchers.push("::fetchFinance::");
  if (set.has("receipts")) matchers.push("::fetchReceipts::", "::fetchFinance::");
  if (set.has("minutes")) matchers.push("::fetchMinutes::");
  if (set.has("settings")) matchers.push("::getSettings::", "::getProfile::");
  if (set.has("files")) matchers.push("::getSettings::");

  if (matchers.length > 0) {
    cache.deleteMatching((k) => k.startsWith("live::") && matchers.some((m) => k.includes(m)));
  }
}

// =========================================================
// EXPRESS APP + HTTP SERVER + WEBSOCKET SERVER
// =========================================================
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 2 * 1024 * 1024 });

app.disable("x-powered-by");

// CORS middleware for GitHub Pages / AI Studio / local cross-origin access
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    if (!ALLOWED_CORS_ORIGINS || ALLOWED_CORS_ORIGINS.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

app.use(express.text({ type: "*/*", limit: "50mb" }));

// =========================================================
// AUTHENTICATED SCOPED WEBSOCKET PRESENCE & BROADCAST ENGINE
// =========================================================
const wsClients = new Map(); // ws -> { clientId, auth, scope, view, label, joined, joinedAt, lastSeen }
let serverSyncSeq = 1;

function nextServerSeq() {
  serverSyncSeq += 1;
  return serverSyncSeq;
}

function evictDuplicateClientId(clientId, currentWs) {
  if (!clientId) return;
  for (const [otherWs, otherMeta] of Array.from(wsClients.entries())) {
    if (otherWs !== currentWs && otherMeta.clientId === clientId) {
      wsClients.delete(otherWs);
      try {
        otherWs.close(1000, "duplicate-tab-session");
      } catch (e) {}
    }
  }
}

function removeClientSocket(ws, shouldBroadcast = true) {
  const existed = wsClients.delete(ws);
  if (existed && shouldBroadcast) {
    broadcastPresence();
  }
}

function broadcastPresence() {
  const deduped = new Map();
  for (const [ws, meta] of wsClients.entries()) {
    if (ws.readyState !== 1 || !meta.joined || !meta.auth) continue;
    deduped.set(meta.clientId, meta);
  }

  let adminOnline = 0;
  let icOnline = 0;
  let participantOnline = 0;
  const adminUsers = [];

  for (const meta of deduped.values()) {
    if (meta.auth.role === "admin") {
      adminOnline++;
      adminUsers.push({
        clientId: meta.clientId,
        name: meta.auth.name || "Admin",
        role: "admin",
        view: meta.view,
      });
    } else if (meta.scope && meta.scope.isGroupIC) {
      icOnline++;
      adminUsers.push({
        clientId: meta.clientId,
        name: meta.auth.name || "Group IC",
        role: "group_ic",
        group: meta.scope.logisticsGroup,
        view: meta.view,
      });
    } else {
      participantOnline++;
    }
  }

  const totalOnline = deduped.size;

  for (const [ws, meta] of wsClients.entries()) {
    if (ws.readyState !== 1 || !meta.joined || !meta.auth) continue;
    try {
      if (meta.auth.role === "admin") {
        const viewOnline = Array.from(deduped.values()).filter(
          (m) => m.auth.role === "admin" && m.view === meta.view,
        ).length;
        ws.send(
          JSON.stringify({
            type: "presence:state",
            totalOnline,
            staffOnline: adminOnline + icOnline,
            adminOnline,
            icOnline,
            participantOnline,
            viewOnline,
            users: adminUsers,
          }),
        );
      } else if (meta.scope && meta.scope.isGroupIC) {
        ws.send(
          JSON.stringify({
            type: "presence:state",
            totalOnline: adminOnline + icOnline,
            staffOnline: adminOnline + icOnline,
            adminOnline,
            icOnline,
          }),
        );
      } else {
        // Regular participants only get lightweight connection ack (no user list!)
        ws.send(
          JSON.stringify({
            type: "presence:state",
            connected: true,
          }),
        );
      }
    } catch (e) {}
  }
}

function sendJsonSafe(ws, obj) {
  if (ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify(obj));
  } catch (e) {}
}

/**
 * Strictly room-scoped WebSocket broadcast:
 * - Admin sockets receive full rich deltas (0ms DOM patch).
 * - Group IC sockets receive group-filtered attendance deltas + scoped invalidations.
 * - Regular Participant sockets NEVER receive other users' PII or admin-only domains.
 */
function broadcastScopedDelta(opts) {
  const {
    type,
    action,
    domains,
    senderClientId,
    excludeWs = null,
    adminPayload = {},
    affectedNrics = null, // optional Set/Array of uppercase NRICs
    juncture = "",
    groupName = "",
    broadcastToParticipants = false,
  } = opts;

  const seq = nextServerSeq();
  const ts = Date.now();
  const domainList = Array.isArray(domains) ? domains : [domains];
  const nricSet =
    affectedNrics && affectedNrics.length > 0
      ? new Set(affectedNrics.map((n) => String(n || "").trim().toUpperCase()).filter(Boolean))
      : null;

  for (const [ws, meta] of wsClients.entries()) {
    if (ws.readyState !== 1 || !meta.joined || !meta.auth) continue;
    if (excludeWs && ws === excludeWs) continue;
    if (senderClientId && meta.clientId === senderClientId) continue;

    // 1. ADMIN CLIENTS -> full rich 0ms delta
    if (meta.auth.role === "admin") {
      sendJsonSafe(ws, {
        type,
        action,
        domain: domainList[0],
        domains: domainList,
        senderId: senderClientId || "",
        syncSeq: seq,
        ts,
        ...adminPayload,
      });
      continue;
    }

    // Admin-only domains (minutes, admin files) -> NEVER sent to non-admins
    const isAdminOnly =
      domainList.every((d) => d === "minutes" || d === "files") &&
      !domainList.includes("all") &&
      !domainList.includes("settings");
    if (isAdminOnly) continue;

    const scope = meta.scope || {
      familyNrics: new Set([meta.auth.nric]),
      isGroupIC: false,
      logisticsGroup: "",
      groupMembersNrics: new Set(),
    };

    // 2. ATTENDANCE DELTA -> Group ICs ONLY, strictly filtered to their own groupMembersNrics
    if (type === "delta:attendance") {
      if (!scope.isGroupIC || !Array.isArray(adminPayload.updates)) continue;
      const filteredUpdates = adminPayload.updates.filter((u) =>
        u && u.nric && scope.groupMembersNrics.has(String(u.nric).trim().toUpperCase()),
      );
      if (filteredUpdates.length > 0) {
        sendJsonSafe(ws, {
          type: "delta:attendance",
          action,
          domain: "attendance",
          domains: ["attendance"],
          juncture: juncture || adminPayload.juncture || "",
          updates: filteredUpdates,
          senderId: senderClientId || "",
          syncSeq: seq,
          ts,
        });
      }
      continue;
    }

    // 3. SETTINGS -> public settings ping to all authenticated users (or group-scoped IC juncture)
    if (domainList.includes("settings") || domainList.includes("all")) {
      if (action === "modifyICJunctures" && groupName) {
        if (!scope.isGroupIC || scope.logisticsGroup !== groupName) continue;
      }
      sendJsonSafe(ws, {
        type: "sync:remote",
        action,
        domain: domainList[0],
        domains: domainList,
        senderId: senderClientId || "",
        syncSeq: seq,
        ts,
      });
      continue;
    }

    // 4. TARGETED PARTICIPANT / GROUP IC INVALIDATION (ZERO OTHER-USER PII IN WS PAYLOAD!)
    let relevant = broadcastToParticipants;
    if (!relevant && nricSet) {
      for (const n of nricSet) {
        if (scope.familyNrics.has(n) || (scope.isGroupIC && scope.groupMembersNrics.has(n))) {
          relevant = true;
          break;
        }
      }
    } else if (!relevant && !nricSet) {
      // Broad mutation where specific NRICs aren't enumerable (e.g. finance config / pairings / rooms / roster edit)
      relevant =
        domainList.includes("finance") ||
        domainList.includes("receipts") ||
        domainList.includes("roster") ||
        domainList.includes("logistics") ||
        domainList.includes("pairings") ||
        domainList.includes("rooms");
    }

    if (relevant) {
      sendJsonSafe(ws, {
        type: "sync:remote",
        action,
        domain: domainList[0],
        domains: domainList,
        senderId: senderClientId || "",
        syncSeq: seq,
        ts,
      });
    }
  }
  return seq;
}

// WebSocket heartbeat & stale socket sweeper
const wsHeartbeatInterval = setInterval(() => {
  const now = Date.now();
  let pruned = false;
  for (const [ws, meta] of Array.from(wsClients.entries())) {
    const stale = now - (meta.lastSeen || meta.joinedAt) > 45000;
    const unannounced = !meta.joined && now - meta.joinedAt > 15000;
    if (ws.readyState !== 1 || stale || unannounced) {
      removeClientSocket(ws, false);
      pruned = true;
      try {
        ws.terminate();
      } catch (e) {}
      continue;
    }
    try {
      ws.ping();
    } catch (e) {
      removeClientSocket(ws, false);
      pruned = true;
      try {
        ws.terminate();
      } catch (err) {}
    }
  }
  if (pruned) broadcastPresence();
}, 15000);
if (wsHeartbeatInterval.unref) wsHeartbeatInterval.unref();

wss.on("close", () => clearInterval(wsHeartbeatInterval));

wss.on("connection", (ws) => {
  const now = Date.now();
  wsClients.set(ws, {
    clientId: "u_" + Math.random().toString(36).slice(2, 10),
    auth: null,
    scope: null,
    view: "index",
    joined: false,
    joinedAt: now,
    lastSeen: now,
  });

  ws.on("pong", () => {
    const meta = wsClients.get(ws);
    if (meta) meta.lastSeen = Date.now();
  });

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      return;
    }
    const meta = wsClients.get(ws);
    if (!meta) return;
    meta.lastSeen = Date.now();

    if (msg.type === "ping") {
      sendJsonSafe(ws, { type: "pong", ts: Date.now() });
      return;
    }

    if (msg.type === "presence:leave") {
      removeClientSocket(ws, true);
      try {
        ws.close(1000, "leave");
      } catch (e) {}
      return;
    }

    if (msg.type === "presence:join" || msg.type === "presence:update") {
      if (msg.clientId) meta.clientId = String(msg.clientId).slice(0, 64);
      if (msg.view) meta.view = String(msg.view).slice(0, 48);

      if (!meta.auth && msg.authToken) {
        const verified = await verifyAuthWithGAS(msg.authToken);
        if (!verified) {
          sendJsonSafe(ws, { type: "auth:error", message: "Invalid or expired session token" });
          try {
            ws.close(4001, "unauthorized");
          } catch (e) {}
          return;
        }
        meta.auth = verified;
        meta.scope = await resolveUserScope(verified, msg.authToken);
      }

      if (!meta.auth) return;
      meta.joined = true;
      evictDuplicateClientId(meta.clientId, ws);
      sendJsonSafe(ws, {
        type: "presence:ack",
        role: meta.auth.role,
        isGroupIC: Boolean(meta.scope && meta.scope.isGroupIC),
        syncSeq: serverSyncSeq,
      });
      broadcastPresence();
      return;
    }

    // All live:* optimistic broadcasts require an authenticated joined socket
    if (!meta.joined || !meta.auth) return;

    // 1. Instant 0ms Attendance Delta (Admin or Group IC)
    if (msg.type === "live:attendance") {
      const { juncture, updates } = msg;
      if (!juncture || !Array.isArray(updates) || updates.length === 0) return;

      let allowedUpdates = updates;
      if (meta.auth.role !== "admin") {
        if (!meta.scope || !meta.scope.isGroupIC) return;
        allowedUpdates = updates.filter(
          (u) => u && u.nric && meta.scope.groupMembersNrics.has(String(u.nric).trim().toUpperCase()),
        );
        if (allowedUpdates.length === 0) return;
      }

      patchAllAttendanceCaches(juncture, allowedUpdates);
      broadcastScopedDelta({
        type: "delta:attendance",
        action: "syncAttendanceUpdate",
        domains: ["attendance"],
        senderClientId: msg.senderId || meta.clientId,
        excludeWs: ws,
        juncture,
        adminPayload: { juncture, updates: allowedUpdates },
      });
      return;
    }

    // Admin-only instant 0ms collaborative deltas
    if (meta.auth.role !== "admin") return;

    if (msg.type === "live:pairings" && Array.isArray(msg.updates)) {
      patchAllPairingCaches(msg.updates);
      const affected = [];
      msg.updates.forEach((u) => {
        if (u && u.traineeNric) affected.push(u.traineeNric);
        if (u && u.volNric) affected.push(u.volNric);
      });
      broadcastScopedDelta({
        type: "delta:pairings",
        action: "syncPairingUpdates",
        domains: ["pairings", "logistics"],
        senderClientId: msg.senderId || meta.clientId,
        excludeWs: ws,
        affectedNrics: affected,
        adminPayload: { updates: msg.updates },
      });
    } else if (msg.type === "live:rooms" && Array.isArray(msg.updates)) {
      patchAllRoomCaches(msg.updates);
      const affected = [];
      msg.updates.forEach((u) => {
        if (u && Array.isArray(u.occupants)) affected.push(...u.occupants);
      });
      broadcastScopedDelta({
        type: "delta:rooms",
        action: "syncRoomUpdates",
        domains: ["rooms", "logistics"],
        senderClientId: msg.senderId || meta.clientId,
        excludeWs: ws,
        affectedNrics: affected.length > 0 ? affected : null,
        broadcastToParticipants: true,
        adminPayload: { updates: msg.updates },
      });
    } else if (msg.type === "live:assignments" && Array.isArray(msg.updates)) {
      patchAllAssignmentCaches(msg.updates, msg.column);
      refreshConnectedUserScopesFromCache();
      const affected = msg.updates.map((u) => u && u.nric).filter(Boolean);
      broadcastScopedDelta({
        type: "delta:assignments",
        action: "syncAssignments",
        domains: ["logistics", "roster", "attendance"],
        senderClientId: msg.senderId || meta.clientId,
        excludeWs: ws,
        affectedNrics: affected,
        adminPayload: { updates: msg.updates, column: msg.column },
      });
    } else if (msg.type === "live:logistics_lists" && msg.listType) {
      broadcastScopedDelta({
        type: "delta:logistics_lists",
        action: "syncAssignments",
        domains: ["logistics"],
        senderClientId: msg.senderId || meta.clientId,
        excludeWs: ws,
        adminPayload: {
          listType: msg.listType,
          listAction: msg.action,
          action: msg.action,
          name: msg.name,
          oldName: msg.oldName,
        },
      });
    } else if (msg.type === "live:finance" && msg.payload) {
      patchAllFinanceCaches(msg.payload);
      broadcastScopedDelta({
        type: "delta:finance",
        action: "saveFinance",
        domains: ["finance"],
        senderClientId: msg.senderId || meta.clientId,
        excludeWs: ws,
        broadcastToParticipants: Boolean(msg.payload.config),
        adminPayload: { payload: msg.payload },
      });
    } else if (msg.type === "live:receipts" && Array.isArray(msg.updates)) {
      patchAllReceiptCaches(msg.updates);
      const affected = [];
      msg.updates.forEach((u) => {
        if (u && u.uploaderNric) affected.push(u.uploaderNric);
        if (u && u.paidByNric) affected.push(u.paidByNric);
      });
      broadcastScopedDelta({
        type: "delta:receipts",
        action: "syncReceipts",
        domains: ["receipts", "finance"],
        senderClientId: msg.senderId || meta.clientId,
        excludeWs: ws,
        affectedNrics: affected.length > 0 ? affected : null,
        broadcastToParticipants: affected.length === 0,
        adminPayload: { updates: msg.updates },
      });
    } else if (msg.type === "live:minutes" && Array.isArray(msg.updates)) {
      patchAllMinutesCaches(msg.updates);
      broadcastScopedDelta({
        type: "delta:minutes",
        action: "syncMinutes",
        domains: ["minutes"],
        senderClientId: msg.senderId || meta.clientId,
        excludeWs: ws,
        adminPayload: { updates: msg.updates },
      });
    }
  });

  ws.on("close", () => removeClientSocket(ws, true));
  ws.on("error", () => removeClientSocket(ws, true));
});

// =========================================================
// HTTP API ROUTES (/health, /api/presence/leave, /api)
// =========================================================
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    env: appConfig.ENV,
    wsClients: wsClients.size,
    cacheEntries: cache.size,
    writeQueuePending: writeQueue.pendingCount,
    syncSeq: serverSyncSeq,
  });
});

app.post("/api/presence/leave", (req, res) => {
  try {
    const parsed = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const clientId = parsed && parsed.clientId ? String(parsed.clientId) : "";
    if (clientId) {
      let removed = false;
      for (const [ws, meta] of Array.from(wsClients.entries())) {
        if (meta.clientId === clientId) {
          removeClientSocket(ws, false);
          removed = true;
          try {
            ws.close(1000, "beacon-leave");
          } catch (e) {}
        }
      }
      if (removed) broadcastPresence();
    }
  } catch (e) {}
  res.status(204).end();
});

const READ_ACTIONS = new Set([
  "getSettings",
  "fetchAdminRoster",
  "fetchLogistics",
  "fetchPairingsOnly",
  "fetchRoomsOnly",
  "fetchAttendanceData",
  "fetchFinance",
  "fetchReceipts",
  "fetchMinutes",
  "getProfile",
  "getPublicTrainees",
  "listArchivedTrips",
  "getArchivedTripMeta",
  "getCommittee",
]);

function refreshConnectedUserScopesFromCache() {
  const cachedRosterRes = cache.get("live::admin::fetchAdminRoster::{}");
  const cachedLogRes = cache.get("live::admin::fetchLogistics::{}");
  const list =
    (cachedLogRes && Array.isArray(cachedLogRes.participants) && cachedLogRes.participants) ||
    (cachedRosterRes && Array.isArray(cachedRosterRes.roster) && cachedRosterRes.roster) ||
    null;
  if (!list) return;

  let presenceChanged = false;
  for (const [, meta] of wsClients.entries()) {
    if (!meta.joined || !meta.auth || meta.auth.role === "admin") continue;
    const cleanNric = String(meta.auth.nric || "").trim().toUpperCase();
    const self = list.find((r) => String(r.nric || "").trim().toUpperCase() === cleanNric);
    if (!self) continue;
    const prevIsIc = Boolean(meta.scope && meta.scope.isGroupIC);
    const prevGrp = String((meta.scope && meta.scope.logisticsGroup) || "").trim();
    const pocNric = String(self.pocNric || self.nric).trim().toUpperCase();
    const familyNrics = new Set([cleanNric]);
    const groupMembersNrics = new Set();
    const isGroupIC = Boolean(self.isGroupIC);
    const logisticsGroup = String(self.logisticsGroup || "").trim();
    list.forEach((r) => {
      const rn = String(r.nric || "").trim().toUpperCase();
      const rpoc = String(r.pocNric || r.nric || "").trim().toUpperCase();
      if (rpoc === pocNric) familyNrics.add(rn);
      if (isGroupIC && logisticsGroup && String(r.logisticsGroup || "").trim() === logisticsGroup) {
        groupMembersNrics.add(rn);
      }
    });
    const nextScope = {
      role: "user",
      pocNric,
      familyNrics,
      isGroupIC,
      logisticsGroup,
      groupMembersNrics,
      expiresAt: Date.now() + SCOPE_CACHE_TTL_MS,
    };
    meta.scope = nextScope;
    userScopeCache.set(cleanNric, nextScope);
    if (prevIsIc !== isGroupIC || prevGrp !== logisticsGroup) {
      presenceChanged = true;
    }
  }
  if (presenceChanged) broadcastPresence();
}

const OPTIMISTIC_BG_WRITE_ACTIONS = new Set([
  "syncAttendanceUpdate",
  "syncPairingUpdates",
  "syncRoomUpdates",
  "syncAssignments",
  "syncMinutes",
  "saveFinance",
  "syncReceipts",
  "adminUpdateParticipant",
  "updateProfile",
  "deleteParticipant",
  "toggleEdits",
  "saveTripSettings",
  "addProjectGroup",
  "removeProjectGroup",
  "modifyJunctures",
  "saveSortingRules",
  "saveCustomViewsOrder",
  "addCommittee",
  "removeCommittee",
  "addHelpline",
  "removeHelpline",
]);

function getCacheKeyForRead(action, parsedBody, auth) {
  const scopePrefix = parsedBody.archiveId ? `archive:${parsedBody.archiveId}` : "live";
  const roleTag =
    auth && auth.role === "admin"
      ? "admin"
      : auth && auth.nric
        ? `user:${auth.nric}`
        : "anon";

  const keyParams = {};
  if (parsedBody.juncture) keyParams.juncture = parsedBody.juncture;
  if (parsedBody.nric) keyParams.nric = String(parsedBody.nric).trim().toUpperCase();
  if (parsedBody.archiveId) keyParams.archiveId = parsedBody.archiveId;

  return `${scopePrefix}::${roleTag}::${action}::${JSON.stringify(keyParams)}`;
}

app.post("/api", async (req, res) => {
  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ status: "error", message: "Invalid JSON body" });
  }

  const action = body && body.action ? String(body.action) : "";
  if (!action) {
    return res.status(400).json({ status: "error", message: "Missing action" });
  }

  // Fast 0ms local getSyncState when running against persistent Node server
  if (action === "getSyncState") {
    const auth = body.authToken ? await verifyAuthWithGAS(body.authToken) : null;
    if (!auth) {
      return res.json({ status: "error", message: "AUTH_REQUIRED: Session expired or unauthorized." });
    }
    const clientSeq = Number(body.sinceSeq) || 0;
    return res.json({
      status: "success",
      changed: clientSeq === 0 || serverSyncSeq > clientSeq,
      seq: serverSyncSeq,
      global: Date.now(),
      authInfo: { nric: auth.nric, role: auth.role, name: auth.name, isMainAdmin: auth.isMainAdmin },
    });
  }

  // Login -> proxy directly to GAS and cache verified auth token immediately
  if (action === "login") {
    try {
      const gasRes = await callGAS(body, 2);
      if (gasRes && gasRes.status === "success" && gasRes.token) {
        cacheVerifiedAuth(gasRes.token, gasRes);
      }
      return res.json(gasRes);
    } catch (err) {
      return res.status(502).json({ status: "error", message: err.message || "Login failed" });
    }
  }

  const forceRefresh = Boolean(body.force || body.forceRebuild || body.refreshRates);
  const auth = body.authToken ? getCachedAuth(body.authToken) : null;

  // =========================================================
  // READ ACTIONS (0ms Authoritative In-Memory Cache + Collapsing)
  // =========================================================
  if (READ_ACTIONS.has(action)) {
    // Ensure we know user's auth role before building cache key (prevents admin/user cache collision!)
    const resolvedAuth = body.authToken ? (auth || (await verifyAuthWithGAS(body.authToken))) : null;
    const cacheKey = getCacheKeyForRead(action, body, resolvedAuth);
    const ttlMs = body.archiveId ? 5 * 60 * 1000 : action === "fetchFinance" ? 120000 : 60000;

    if (!forceRefresh) {
      const cachedVal = cache.get(cacheKey);
      if (cachedVal) {
        return res.json(cachedVal);
      }
      if (inFlightReads.has(cacheKey)) {
        try {
          const shared = await inFlightReads.get(cacheKey);
          return res.json(shared);
        } catch (err) {
          return res.status(502).json({ status: "error", message: err.message || "Upstream error" });
        }
      }
    }

    const fetchPromise = (async () => {
      const fresh = await callGAS(body, 3);
      if (fresh && fresh.status !== "error") {
        if (!body.archiveId) {
          replayPendingMutationsOnRead(action, body, fresh);
        }
        cache.set(cacheKey, fresh, ttlMs);
        if (action === "getProfile" && resolvedAuth && resolvedAuth.role !== "admin") {
          const targetNric = String(body.nric || resolvedAuth.nric || "").trim().toUpperCase();
          if (targetNric === resolvedAuth.nric) {
            buildScopeFromProfileResponse(targetNric, fresh);
          }
        }
      }
      return fresh;
    })();

    if (!forceRefresh) inFlightReads.set(cacheKey, fetchPromise);

    try {
      const result = await fetchPromise;
      return res.json(result);
    } catch (err) {
      return res.status(502).json({ status: "error", message: err.message || "Backend read failed" });
    } finally {
      if (!forceRefresh) inFlightReads.delete(cacheKey);
    }
  }

  // =========================================================
  // OPTIMISTIC COLLABORATIVE WRITES (0ms Patch + <20ms WS Push + Async FIFO GAS Queue)
  // =========================================================
  const settingsListActions = new Set([
    "addProjectGroup",
    "removeProjectGroup",
    "modifyJunctures",
    "addCommittee",
    "removeCommittee",
    "addHelpline",
    "removeHelpline",
  ]);
  const canRunOptimistic =
    OPTIMISTIC_BG_WRITE_ACTIONS.has(action) &&
    !body.archiveId &&
    (!settingsListActions.has(action) || Boolean(cache.get("live::admin::getSettings::{}")));

  if (canRunOptimistic) {
    const verifiedAuth = body.authToken ? await verifyAuthWithGAS(body.authToken) : null;
    if (!verifiedAuth) {
      return res.json({ status: "error", message: "AUTH_REQUIRED: Session expired or unauthorized." });
    }

    // Enforce authorization before optimistic patch & broadcast
    if (action === "syncAttendanceUpdate") {
      if (verifiedAuth.role !== "admin") {
        const scope = await resolveUserScope(verifiedAuth, body.authToken);
        if (!scope || !scope.isGroupIC) {
          return res.json({ status: "error", message: "FORBIDDEN: Only Group ICs or Admins can update attendance." });
        }
        const unauthorized = (body.updates || []).some(
          (u) => !scope.groupMembersNrics.has(String(u.nric || "").trim().toUpperCase()),
        );
        if (unauthorized) {
          return res.json({ status: "error", message: "FORBIDDEN: You can only update attendance for your own group." });
        }
      }
    } else if (action === "modifyICJunctures") {
      if (verifiedAuth.role !== "admin") {
        const scope = await resolveUserScope(verifiedAuth, body.authToken);
        const cleanGroup = String(body.groupName || "").trim();
        if (!scope || !scope.isGroupIC || scope.logisticsGroup !== cleanGroup) {
          return res.json({ status: "error", message: "FORBIDDEN: Only this group IC or Admin can modify custom junctures." });
        }
      }
    } else if (action === "updateProfile") {
      if (verifiedAuth.role !== "admin") {
        const cachedCfg = cache.get("live::admin::getSettings::{}") || cache.get(`live::user:${verifiedAuth.nric}::getSettings::{}`);
        if (cachedCfg && cachedCfg.allowEdits === false) {
          return res.json({ status: "error", message: "Editing locked." });
        }
        const scope = await resolveUserScope(verifiedAuth, body.authToken);
        const targetNric = String((body.member && body.member.nric) || "").trim().toUpperCase();
        if (!targetNric || !scope || !scope.familyNrics.has(targetNric)) {
          return res.json({ status: "error", message: "Unauthorized: you can only edit your own family members." });
        }
      }
    } else if (action === "syncReceipts") {
      if (verifiedAuth.role !== "admin") {
        const scope = await resolveUserScope(verifiedAuth, body.authToken);
        const valid =
          Array.isArray(body.updates) &&
          body.updates.every((u) => u && u.isDeleted === true);
        if (!scope || !valid) {
          return res.json({ status: "error", message: "FORBIDDEN: Admin access required." });
        }
      }
    } else if (action === "addProjectGroup" || action === "removeProjectGroup") {
      if (!verifiedAuth.isMainAdmin) {
        return res.json({ status: "error", message: "Unauthorized" });
      }
    } else if (verifiedAuth.role !== "admin") {
      return res.json({ status: "error", message: "FORBIDDEN: Admin access required." });
    }

    const senderClientId = body.clientId ? String(body.clientId) : "";
    let syncSeq = serverSyncSeq;
    let patchedSettingsObj = null;

    // 1. Authoritative 0ms in-memory patch + instant scoped WebSocket push
    if (action === "syncAttendanceUpdate") {
      patchAllAttendanceCaches(body.juncture, body.updates || []);
      syncSeq = broadcastScopedDelta({
        type: "delta:attendance",
        action,
        domains: ["attendance"],
        senderClientId,
        juncture: body.juncture,
        adminPayload: { juncture: body.juncture, updates: body.updates || [] },
      });
    } else if (action === "syncPairingUpdates") {
      patchAllPairingCaches(body.updates || []);
      const affected = [];
      (body.updates || []).forEach((u) => {
        if (u && u.traineeNric) affected.push(u.traineeNric);
        if (u && u.volNric) affected.push(u.volNric);
      });
      syncSeq = broadcastScopedDelta({
        type: "delta:pairings",
        action,
        domains: ["pairings", "logistics"],
        senderClientId,
        affectedNrics: affected,
        adminPayload: { updates: body.updates || [] },
      });
    } else if (action === "syncRoomUpdates") {
      patchAllRoomCaches(body.updates || []);
      const affected = [];
      (body.updates || []).forEach((u) => {
        if (u && Array.isArray(u.occupants)) affected.push(...u.occupants);
      });
      syncSeq = broadcastScopedDelta({
        type: "delta:rooms",
        action,
        domains: ["rooms", "logistics"],
        senderClientId,
        affectedNrics: affected.length > 0 ? affected : null,
        broadcastToParticipants: true,
        adminPayload: { updates: body.updates || [] },
      });
    } else if (action === "syncAssignments") {
      patchAllAssignmentCaches(body.updates || [], body.column);
      refreshConnectedUserScopesFromCache();
      const affected = (body.updates || []).map((u) => u && u.nric).filter(Boolean);
      syncSeq = broadcastScopedDelta({
        type: "delta:assignments",
        action,
        domains: ["logistics", "roster", "attendance"],
        senderClientId,
        affectedNrics: affected,
        adminPayload: { updates: body.updates || [], column: body.column },
      });
    } else if (action === "saveFinance") {
      patchAllFinanceCaches(body.payload);
      syncSeq = broadcastScopedDelta({
        type: "delta:finance",
        action,
        domains: ["finance"],
        senderClientId,
        broadcastToParticipants: Boolean(body.payload && body.payload.config),
        adminPayload: { payload: body.payload },
      });
    } else if (action === "syncReceipts") {
      patchAllReceiptCaches(body.updates || []);
      const affected = [];
      (body.updates || []).forEach((u) => {
        if (u && u.uploaderNric) affected.push(u.uploaderNric);
        if (u && u.paidByNric) affected.push(u.paidByNric);
      });
      syncSeq = broadcastScopedDelta({
        type: "delta:receipts",
        action,
        domains: ["receipts", "finance"],
        senderClientId,
        affectedNrics: affected.length > 0 ? affected : null,
        broadcastToParticipants: affected.length === 0,
        adminPayload: { updates: body.updates || [] },
      });
    } else if (action === "syncMinutes") {
      patchAllMinutesCaches(body.updates || []);
      syncSeq = broadcastScopedDelta({
        type: "delta:minutes",
        action,
        domains: ["minutes"],
        senderClientId,
        adminPayload: { updates: body.updates || [] },
      });
    } else if (action === "adminUpdateParticipant" || action === "updateProfile") {
      patchAllRosterCaches(body.member, "");
      const affected = body.member && body.member.nric ? [body.member.nric] : [];
      syncSeq = broadcastScopedDelta({
        type: "delta:roster",
        action,
        domains: ["roster", "logistics", "finance"],
        senderClientId,
        affectedNrics: affected.length > 0 ? affected : null,
        adminPayload: { member: body.member || null },
      });
    } else if (action === "deleteParticipant") {
      patchAllRosterCaches(null, body.nric);
      const affected = body.nric ? [body.nric] : [];
      syncSeq = broadcastScopedDelta({
        type: "delta:roster",
        action,
        domains: ["roster", "logistics", "finance"],
        senderClientId,
        affectedNrics: affected.length > 0 ? affected : null,
        adminPayload: { deletedNric: body.nric || "" },
      });
    } else {
      // Settings mutations (toggleEdits, saveTripSettings, add/removeProjectGroup, modifyJunctures, etc.)
      patchedSettingsObj = patchAllSettingsCaches(action, body);
      const domains = ACTION_DOMAINS[action] || ["settings"];
      syncSeq = broadcastScopedDelta({
        type: "delta:settings",
        action,
        domains,
        senderClientId,
        groupName: body.groupName ? String(body.groupName) : "",
        adminPayload: patchedSettingsObj ? { settings: patchedSettingsObj } : {},
      });
    }

    // 2. Enqueue durable write to Google Apps Script in FIFO background queue
    const pendingId = addPendingMutation(action, body);
    writeQueue
      .add(async () => {
        try {
          const gasRes = await callGAS(body, 3);
          if (gasRes && gasRes.status === "error") {
            console.error(`[GAS WRITE ERROR] ${action}:`, gasRes.message);
            // Invalidate affected domain caches so next read reconciles authoritative Sheet state
            invalidateCachesForDomains(ACTION_DOMAINS[action] || ["all"]);
          }
          return gasRes;
        } catch (err) {
          console.error(`[GAS WRITE EXCEPTION] ${action}:`, err.message);
          invalidateCachesForDomains(ACTION_DOMAINS[action] || ["all"]);
        } finally {
          removePendingMutation(pendingId);
        }
      })
      .catch(() => {});

    // 3. Fast response to caller (preserving exact response fields expected by each frontend caller!)
    if (action === "saveFinance") {
      const cachedFin = cache.get("live::admin::fetchFinance::{}");
      if (cachedFin && cachedFin.status === "success") {
        return res.json({ ...cachedFin, queued: true, _syncSeq: syncSeq, _syncTs: Date.now() });
      }
    } else if (action === "syncReceipts") {
      const cachedRec = cache.get("live::admin::fetchReceipts::{}");
      if (cachedRec && Array.isArray(cachedRec.receipts)) {
        return res.json({ status: "success", receipts: cachedRec.receipts, queued: true, _syncSeq: syncSeq, _syncTs: Date.now() });
      }
    } else if (action === "addProjectGroup" || action === "removeProjectGroup") {
      return res.json({
        status: "success",
        groups: patchedSettingsObj ? patchedSettingsObj.projectGroups : undefined,
        projectColors: patchedSettingsObj ? patchedSettingsObj.projectColors : undefined,
        queued: true,
        _syncSeq: syncSeq,
      });
    } else if (action === "modifyJunctures") {
      return res.json({
        status: "success",
        junctures: patchedSettingsObj ? patchedSettingsObj.junctures : undefined,
        queued: true,
        _syncSeq: syncSeq,
      });
    } else if (action === "addCommittee" || action === "removeCommittee") {
      return res.json({
        status: "success",
        list: patchedSettingsObj ? patchedSettingsObj.committee : undefined,
        queued: true,
        _syncSeq: syncSeq,
      });
    } else if (action === "addHelpline" || action === "removeHelpline") {
      return res.json({
        status: "success",
        list: patchedSettingsObj ? patchedSettingsObj.helpline : undefined,
        queued: true,
        _syncSeq: syncSeq,
      });
    } else if (action === "saveSortingRules") {
      return res.json({ status: "success", sortingRules: body.rules, queued: true, _syncSeq: syncSeq });
    } else if (action === "saveCustomViewsOrder") {
      return res.json({ status: "success", customViewsOrder: body.order, queued: true, _syncSeq: syncSeq });
    } else if (action === "saveTripSettings") {
      return res.json({
        status: "success",
        title: body.title,
        year: body.year,
        start: String(body.start || "").trim(),
        end: String(body.end || "").trim(),
        queued: true,
        _syncSeq: syncSeq,
      });
    }
    return res.json({ status: "success", queued: true, _syncSeq: syncSeq, _syncTs: Date.now() });
  }

  // =========================================================
  // DURABLE SYNCHRONOUS WRITES (Queued FIFO to GAS -> Instant WS Push)
  // =========================================================
  try {
    const gasRes = await writeQueue.add(() => callGAS(body, 2));
    const domains = ACTION_DOMAINS[action];

    if (domains && gasRes && gasRes.status !== "error") {
      if (action === "uploadReceipt" && gasRes.receipt) {
        patchAllReceiptCaches([gasRes.receipt]);
      } else {
        invalidateCachesForDomains(domains);
      }
      const affected = [];
      if (body.member && body.member.nric) affected.push(body.member.nric);
      if (body.nric) affected.push(body.nric);
      if (body.payload && body.payload.uploaderNric) affected.push(body.payload.uploaderNric);
      if (body.payload && body.payload.paidByNric) affected.push(body.payload.paidByNric);
      if (Array.isArray(body.updates)) {
        body.updates.forEach((u) => {
          if (u && u.uploaderNric) affected.push(u.uploaderNric);
          if (u && u.paidByNric) affected.push(u.paidByNric);
        });
      }

      const seq = broadcastScopedDelta({
        type: domains.includes("settings") ? "delta:settings" : "sync:remote",
        action,
        domains,
        senderClientId: body.clientId ? String(body.clientId) : "",
        affectedNrics: affected.length > 0 ? affected : null,
        groupName: body.groupName ? String(body.groupName) : "",
        broadcastToParticipants:
          domains.includes("settings") ||
          domains.includes("all") ||
          action === "uploadReceipt" ||
          action === "syncReceipts",
      });
      if (typeof gasRes === "object") {
        gasRes._syncSeq = seq;
      }
    }

    return res.json(gasRes);
  } catch (err) {
    console.error(`[WRITE ERROR] ${action}:`, err.message);
    return res.status(502).json({ status: "error", message: err.message || "Server write error" });
  }
});

// =========================================================
// STATIC FRONTEND FILE SERVING (IDENTICAL TO GITHUB PAGES)
// =========================================================
app.use("/frontend", express.static(path.join(__dirname, "frontend"), { dotfiles: "ignore" }));
app.use("/assets", express.static(path.join(__dirname, "assets"), { dotfiles: "ignore" }));

// Serve ONLY the public frontend config file from backend/ (never Code.js or appsscript.json)
app.get("/backend/config.js", (_req, res) => {
  res.type("application/javascript; charset=utf-8");
  res.sendFile(path.join(__dirname, "backend", "config.js"));
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/:file", (req, res, next) => {
  const file = String(req.params.file || "");
  if (ALLOWED_ROOT_FILES.has(file)) {
    return res.sendFile(path.join(__dirname, file));
  }
  return next();
});

app.use((_req, res) => {
  res.status(404).type("text/plain").send("Not Found");
});

// =========================================================
// GRACEFUL SHUTDOWN (FLUSHES QUEUED GAS WRITES BEFORE EXIT)
// =========================================================
async function gracefulShutdown(signal) {
  console.log(`[${signal}] Draining ${writeQueue.pendingCount} pending GAS write(s)...`);
  try {
    await writeQueue.waitForDrain(20000);
  } catch (e) {}
  try {
    wss.close();
    server.close();
  } catch (e) {}
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Overseas Trip Realtime Server running at http://0.0.0.0:${PORT}`);
  console.log(`ENV=${appConfig.ENV} | Durable GAS Backend=${GAS_BACKEND_URL}`);
});
