/**
 * Hybrid Real-Time + Direct GAS API Client
 * - When a persistent Node.js WebSocket/Cache server is available (same-origin on Cloud Run/AI Studio/localhost,
 *   or cross-origin via REALTIME_SERVER_URL on GitHub Pages), routes /api calls through it for 0ms cached reads,
 *   <50ms WebSocket push, and FIFO background GAS writes.
 * - Automatically falls back seamlessly to direct Google Apps Script (API_URL) if the Node server is unset or unreachable.
 */
window.CLIENT_ID =
  window.CLIENT_ID ||
  "client_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);

window.getRealtimeServerBaseUrl = function () {
  try {
    if (typeof REALTIME_SERVER_URL === "string" && REALTIME_SERVER_URL.trim() !== "") {
      return REALTIME_SERVER_URL.trim().replace(/\/+$/, "");
    }
    if (typeof window !== "undefined" && window.location) {
      const host = String(window.location.hostname || "").toLowerCase();
      const proto = String(window.location.protocol || "").toLowerCase();
      if (
        (proto === "http:" || proto === "https:") &&
        host &&
        !host.endsWith(".github.io") &&
        host !== "github.io"
      ) {
        return window.location.origin.replace(/\/+$/, "");
      }
    }
  } catch (e) {}
  return "";
};

window.getRealtimeWsUrl = function () {
  const base = window.getRealtimeServerBaseUrl();
  if (!base) return "";
  if (base.startsWith("https://")) return "wss://" + base.slice("https://".length);
  if (base.startsWith("http://")) return "ws://" + base.slice("http://".length);
  return "";
};

let realtimeServerUnavailableUntil = 0;
const REALTIME_FAILOVER_COOLDOWN_MS = 15000;

const API_CACHE = new Map();
const API_INFLIGHT = new Map();
const API_CACHE_TTL_MS = 5000;

const CACHEABLE_API_ACTIONS = new Set([
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
]);

const MUTATION_INVALIDATION_MAP = {
  syncReceipts: { domain: "receipts", prefixes: ["fetchReceipts", "fetchFinance", "getProfile"] },
  uploadReceipt: { domain: "receipts", prefixes: ["fetchReceipts", "fetchFinance", "getProfile"] },
  saveFinance: { domain: "finance", prefixes: ["fetchFinance", "fetchReceipts", "getProfile"] },
  syncPairingUpdates: { domain: "pairings", prefixes: ["fetchPairingsOnly", "fetchLogistics", "getProfile"] },
  syncRoomUpdates: { domain: "rooms", prefixes: ["fetchRoomsOnly", "fetchLogistics", "getProfile"] },
  syncAssignments: { domain: "logistics", prefixes: ["fetchLogistics", "fetchAdminRoster", "getProfile", "fetchAttendanceData"] },
  syncAttendanceUpdate: { domain: "attendance", prefixes: ["fetchAttendanceData", "fetchLogistics"] },
  syncMinutes: { domain: "minutes", prefixes: ["fetchMinutes"] },
  updateProfile: { domain: "roster", prefixes: ["fetchAdminRoster", "fetchLogistics", "getProfile", "getPublicTrainees", "fetchFinance"] },
  adminUpdateParticipant: { domain: "roster", prefixes: ["fetchAdminRoster", "fetchLogistics", "getProfile", "getPublicTrainees", "fetchFinance"] },
  submitRegistration: { domain: "roster", prefixes: ["fetchAdminRoster", "fetchLogistics", "getProfile", "getPublicTrainees", "fetchFinance"] },
  deleteParticipant: { domain: "roster", prefixes: ["fetchAdminRoster", "fetchLogistics", "getProfile", "getPublicTrainees", "fetchFinance"] },
  setTripFile: { domain: "settings", prefixes: ["getSettings"] },
  saveTripSettings: { domain: "settings", prefixes: ["getSettings"] },
  toggleRegistration: { domain: "settings", prefixes: ["getSettings"] },
  toggleEdits: { domain: "settings", prefixes: ["getSettings"] },
  addProjectGroup: { domain: "settings", prefixes: ["getSettings", "fetchLogistics", "fetchAdminRoster"] },
  removeProjectGroup: { domain: "settings", prefixes: ["getSettings", "fetchLogistics", "fetchAdminRoster"] },
  modifyJunctures: { domain: "settings", prefixes: ["getSettings", "fetchAttendanceData"] },
  modifyICJunctures: { domain: "settings", prefixes: ["getSettings", "fetchAttendanceData", "getProfile"] },
  saveSortingRules: { domain: "settings", prefixes: ["getSettings", "fetchLogistics", "fetchAdminRoster"] },
  saveCustomViewsOrder: { domain: "settings", prefixes: ["getSettings"] },
  addCommittee: { domain: "settings", prefixes: ["getSettings", "fetchAdminRoster"] },
  removeCommittee: { domain: "settings", prefixes: ["getSettings", "fetchAdminRoster"] },
  addHelpline: { domain: "settings", prefixes: ["getSettings"] },
  removeHelpline: { domain: "settings", prefixes: ["getSettings"] },
  addDriveAccess: { domain: "settings", prefixes: ["getSettings"] },
  removeDriveAccess: { domain: "settings", prefixes: ["getSettings"] },
  massDriveAccess: { domain: "settings", prefixes: ["getSettings"] },
  archiveAndReset: { domain: "settings", prefixes: ["ALL"] },
  deleteArchivedTrip: { domain: "settings", prefixes: ["listArchivedTrips"] },
  clearCache: { domain: "settings", prefixes: ["ALL"] },
  uploadDriveFile: { domain: "files", prefixes: ["getSettings"] },
  createDriveFolder: { domain: "files", prefixes: ["getSettings"] },
  createGoogleDoc: { domain: "files", prefixes: ["getSettings"] },
  renameDriveItem: { domain: "files", prefixes: ["getSettings"] },
  deleteDriveItem: { domain: "files", prefixes: ["getSettings"] },
  bulkDriveOperation: { domain: "files", prefixes: ["getSettings"] },
  extractData: { domain: "files", prefixes: ["getSettings"] },
};

function getStoredAuthToken() {
  if (typeof currentUser !== "undefined" && currentUser && currentUser.token) {
    return currentUser.token;
  }
  try {
    const raw = localStorage.getItem("userSession");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.token) return parsed.token;
    }
  } catch (e) {}
  return "";
}

const DOMAIN_CACHE_PREFIXES = {
  roster: ["fetchAdminRoster", "fetchLogistics", "getProfile", "getPublicTrainees", "fetchFinance"],
  logistics: ["fetchLogistics", "fetchAdminRoster", "getProfile", "fetchAttendanceData"],
  pairings: ["fetchPairingsOnly", "fetchLogistics", "getProfile"],
  rooms: ["fetchRoomsOnly", "fetchLogistics", "getProfile"],
  attendance: ["fetchAttendanceData", "fetchLogistics"],
  finance: ["fetchFinance", "fetchReceipts", "getProfile"],
  receipts: ["fetchReceipts", "fetchFinance", "getProfile"],
  minutes: ["fetchMinutes"],
  settings: ["getSettings", "fetchAttendanceData", "fetchLogistics", "fetchAdminRoster", "getProfile"],
  files: ["getSettings"],
  all: ["ALL"],
};

function invalidateLocalApiCacheForDomains(domains) {
  const list = Array.isArray(domains) ? domains : [domains];
  const prefixes = new Set();
  for (const d of list) {
    const mapped = DOMAIN_CACHE_PREFIXES[d];
    if (!mapped) continue;
    for (const p of mapped) prefixes.add(p);
  }
  if (prefixes.has("ALL")) {
    API_CACHE.clear();
    return;
  }
  if (prefixes.size === 0) return;
  for (const key of API_CACHE.keys()) {
    for (const p of prefixes) {
      if (key.startsWith(p + "::")) {
        API_CACHE.delete(key);
        break;
      }
    }
  }
}

window.invalidateLocalApiCacheForDomains = invalidateLocalApiCacheForDomains;

function invalidateLocalApiCache(action) {
  const entry = MUTATION_INVALIDATION_MAP[action];
  if (!entry) return null;
  if (entry.prefixes.includes("ALL")) {
    API_CACHE.clear();
  } else {
    for (const key of API_CACHE.keys()) {
      if (entry.prefixes.some((p) => key.startsWith(p + "::"))) {
        API_CACHE.delete(key);
      }
    }
  }
  return entry.domain;
}

window.clearApiClientCache = function () {
  API_CACHE.clear();
  API_INFLIGHT.clear();
};

function handleAuthExpiredOnce(message) {
  if (window.__handlingAuthExpiry) return;
  window.__handlingAuthExpiry = true;
  try {
    localStorage.removeItem("userSession");
    localStorage.removeItem("cachedAdminRoster");
    localStorage.removeItem("cachedLogistics");
    sessionStorage.removeItem("activeArchiveTrip");
  } catch (e) {}
  if (typeof currentUser !== "undefined") currentUser = null;
  API_CACHE.clear();
  if (typeof showToast === "function") {
    showToast(message || "Session expired. Please log in again.", true);
  }
  const path = window.location.pathname;
  const onPublicPage =
    path.endsWith("index.html") ||
    path.endsWith("register.html") ||
    path.endsWith("/") ||
    path === "";
  if (!onPublicPage) {
    setTimeout(() => {
      window.__handlingAuthExpiry = false;
      if (typeof navigateTo === "function") {
        navigateTo("index.html");
      } else {
        window.location.assign("index.html");
      }
    }, 600);
  } else {
    setTimeout(() => {
      window.__handlingAuthExpiry = false;
    }, 1000);
  }
}

async function apiCall(action, payload = {}, retries = 2) {
  const activeArchive =
    typeof window !== "undefined" &&
    window.ArchiveMode &&
    typeof window.ArchiveMode.getActiveArchive === "function"
      ? window.ArchiveMode.getActiveArchive()
      : null;

  if (activeArchive) {
    const allowed =
      window.ArchiveMode &&
      typeof window.ArchiveMode.isActionAllowedInArchive === "function" &&
      window.ArchiveMode.isActionAllowedInArchive(action);
    if (!allowed) {
      if (typeof showToast === "function") {
        showToast("Read-only mode: archived trips cannot be modified.", true);
      }
      throw new Error("Archived trip is read-only.");
    }
  }

  const gasEndpoint = typeof API_URL !== "undefined" ? API_URL : "";
  const realtimeBase =
    typeof window.getRealtimeServerBaseUrl === "function"
      ? window.getRealtimeServerBaseUrl()
      : "";
  const useRealtimeProxy =
    Boolean(realtimeBase) && Date.now() >= realtimeServerUnavailableUntil;
  const primaryEndpoint = useRealtimeProxy ? `${realtimeBase}/api` : gasEndpoint;
  if (!primaryEndpoint && !gasEndpoint) {
    throw new Error("API_URL is not configured in backend/config.js.");
  }

  const safePayload =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? { ...payload }
      : {};
  const bypassLocalCache = Boolean(safePayload.bypassLocalCache);
  delete safePayload.bypassLocalCache;
  const forceRefresh = Boolean(safePayload.force || safePayload.forceRebuild);
  const authToken = getStoredAuthToken();

  const reqBody = {
    action: action,
    ...safePayload,
  };
  if (action !== "getSyncState" && window.CLIENT_ID) {
    reqBody.clientId = window.CLIENT_ID;
  }
  if (authToken) {
    reqBody.authToken = authToken;
  }
  if (activeArchive && action !== "listArchivedTrips" && action !== "login") {
    reqBody.archiveId = activeArchive.archiveId;
  }

  const isCacheable = CACHEABLE_API_ACTIONS.has(action);
  const cachePayloadCopy = { ...safePayload };
  delete cachePayloadCopy.force;
  delete cachePayloadCopy.forceRebuild;
  const cacheKey = `${action}::${activeArchive ? activeArchive.archiveId : "live"}::${authToken ? authToken.slice(-8) : "anon"}::${JSON.stringify(cachePayloadCopy)}`;

  if (isCacheable && !forceRefresh && !bypassLocalCache) {
    const cached = API_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < API_CACHE_TTL_MS) {
      return JSON.parse(cached.raw);
    }
    if (API_INFLIGHT.has(cacheKey)) {
      const raw = await API_INFLIGHT.get(cacheKey);
      return JSON.parse(raw);
    }
  }

  const mutationDomain = invalidateLocalApiCache(action);

  const executeFetch = async () => {
    let activeEndpoint = primaryEndpoint || gasEndpoint;
    let usedProxy = Boolean(useRealtimeProxy && activeEndpoint === `${realtimeBase}/api`);

    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(activeEndpoint, {
          method: "POST",
          body: JSON.stringify(reqBody),
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          redirect: "follow",
        });

        // If the Node realtime server is sleeping/unreachable (502/503/504/404), fall back straight to GAS
        if (usedProxy && (response.status >= 500 || response.status === 404) && gasEndpoint) {
          realtimeServerUnavailableUntil = Date.now() + REALTIME_FAILOVER_COOLDOWN_MS;
          activeEndpoint = gasEndpoint;
          usedProxy = false;
          throw new Error("Network fallback to GAS");
        }

        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          if (usedProxy && gasEndpoint) {
            realtimeServerUnavailableUntil = Date.now() + REALTIME_FAILOVER_COOLDOWN_MS;
            activeEndpoint = gasEndpoint;
            usedProxy = false;
            throw new Error("Network fallback to GAS");
          }
          console.warn(`API Parse Error on attempt ${i + 1}:`, text.slice(0, 200));
          throw new Error("SERVER_PARSE_ERROR");
        }

        if (data && data.status === "error") {
          const errMsg = String(data.message || "Request failed");
          if (errMsg.startsWith("AUTH_REQUIRED")) {
            handleAuthExpiredOnce("Session expired. Please log in again.");
          }
          const appErr = new Error(errMsg.replace(/^(AUTH_REQUIRED|FORBIDDEN):\s*/i, ""));
          appErr.response = data;
          throw appErr;
        }
        return text;
      } catch (err) {
        // Immediate failover from Node proxy to direct GAS on connection failure
        if (
          usedProxy &&
          gasEndpoint &&
          err.message &&
          (err.message.includes("fetch") ||
            err.message.includes("Network") ||
            err.message.includes("Failed to fetch"))
        ) {
          realtimeServerUnavailableUntil = Date.now() + REALTIME_FAILOVER_COOLDOWN_MS;
          activeEndpoint = gasEndpoint;
          usedProxy = false;
          continue;
        }

        if (
          err.message &&
          err.message !== "SERVER_PARSE_ERROR" &&
          !err.message.includes("fetch") &&
          !err.message.includes("Network") &&
          !err.message.includes("Failed to fetch")
        ) {
          throw err;
        }

        console.warn(`API attempt ${i + 1} failed:`, err.message);
        if (i === retries) {
          if (err.message === "SERVER_PARSE_ERROR") {
            throw new Error(
              "Server Error: Invalid Response from Google. Please try again.",
            );
          }
          throw err;
        }

        await new Promise((r) => setTimeout(r, 1200 * Math.pow(2, i)));
      }
    }
  };

  const promise = executeFetch();
  if (isCacheable && !forceRefresh && !bypassLocalCache) {
    API_INFLIGHT.set(cacheKey, promise);
  }

  try {
    const rawText = await promise;
    const parsed = JSON.parse(rawText);

    if (isCacheable) {
      API_CACHE.set(cacheKey, { ts: Date.now(), raw: rawText });
    } else if (mutationDomain) {
      invalidateLocalApiCache(action);
      if (parsed && typeof parsed._syncSeq === "number" && window.LiveSync && typeof window.LiveSync.noteLocalSeq === "function") {
        window.LiveSync.noteLocalSeq(parsed._syncSeq);
      }
      if (window.LiveSync && typeof window.LiveSync.broadcast === "function") {
        window.LiveSync.broadcast({
          type: "sync:update",
          action: action,
          domain: mutationDomain,
          domains: [mutationDomain],
          syncSeq: parsed && parsed._syncSeq ? parsed._syncSeq : undefined,
          clientId: window.CLIENT_ID,
          ts: Date.now(),
        });
      }
    }
    return parsed;
  } finally {
    if (isCacheable && !forceRefresh && !bypassLocalCache) {
      API_INFLIGHT.delete(cacheKey);
    }
  }
}

// ==========================================
// UNIFIED REAL-TIME DISPATCHER (WEBSOCKET DELTA + CROSS-TAB + GAS FALLBACK)
// ==========================================
window.dispatchRealtimeUpdate = async function (msg) {
  if (typeof window.isArchiveReadOnly === "function" && window.isArchiveReadOnly()) {
    return;
  }
  if (!msg) return;

  // Fast 0ms in-memory delta path (skip HTTP refetch when the active view handled the rich WebSocket delta!)
  let handledDirectly = false;
  try {
    if (msg.type === "delta:attendance" && Array.isArray(msg.updates)) {
      if (typeof window.applyRemoteAttendanceDelta === "function" && window.applyRemoteAttendanceDelta(msg.juncture, msg.updates) === true) {
        handledDirectly = true;
      }
      if (typeof window.applyRemoteIcAttendanceDelta === "function" && window.applyRemoteIcAttendanceDelta(msg.juncture, msg.updates) === true) {
        handledDirectly = true;
      }
    } else if (msg.type === "delta:pairings" && Array.isArray(msg.updates)) {
      if (typeof window.applyRemotePairingsDelta === "function" && window.applyRemotePairingsDelta(msg.updates) === true) {
        handledDirectly = true;
      }
    } else if (msg.type === "delta:rooms" && Array.isArray(msg.updates)) {
      if (typeof window.applyRemoteRoomsDelta === "function" && window.applyRemoteRoomsDelta(msg.updates) === true) {
        handledDirectly = true;
      }
    } else if (msg.type === "delta:assignments" && Array.isArray(msg.updates)) {
      if (typeof window.applyRemoteAssignmentsDelta === "function" && window.applyRemoteAssignmentsDelta(msg.updates, msg.column) === true) {
        handledDirectly = true;
      }
    } else if (msg.type === "delta:finance" && msg.payload) {
      if (typeof window.applyRemoteFinanceDelta === "function" && window.applyRemoteFinanceDelta(msg.payload) === true) {
        handledDirectly = true;
      }
    } else if (msg.type === "delta:minutes" && Array.isArray(msg.updates)) {
      if (typeof window.applyRemoteMinutesDelta === "function" && window.applyRemoteMinutesDelta(msg.updates) === true) {
        handledDirectly = true;
      }
    }
  } catch (deltaErr) {
    console.warn("Direct delta apply warning:", deltaErr);
    handledDirectly = false;
  }

  const domainSet = new Set();
  if (Array.isArray(msg.domains)) {
    msg.domains.forEach((d) => {
      if (d) domainSet.add(d);
    });
  }
  if (msg.domain) domainSet.add(msg.domain);
  if (domainSet.size === 0) domainSet.add("all");

  const has = (...ds) => domainSet.has("all") || ds.some((d) => domainSet.has(d));

  if (msg.action) {
    invalidateLocalApiCache(msg.action);
  }
  invalidateLocalApiCacheForDomains(Array.from(domainSet));

  if (handledDirectly) {
    if (Array.isArray(window.__realtimeListeners)) {
      window.__realtimeListeners.forEach((fn) => {
        try {
          fn(msg);
        } catch (e) {}
      });
    }
    return;
  }

  try {
    if (has("settings")) {
      if (typeof window.refreshSettingsRealtime === "function") {
        await window.refreshSettingsRealtime(msg);
      }
    }
    if (has("roster", "logistics", "pairings", "rooms", "settings")) {
      if (typeof window.pollRosterNow === "function") window.pollRosterNow(msg);
      if (typeof window.pollDietNow === "function") window.pollDietNow(msg);
      if (typeof window.pollMedicalNow === "function") window.pollMedicalNow(msg);
      if (typeof window.pollExpiredNow === "function") window.pollExpiredNow(msg);
      if (typeof window.pollOtherNow === "function") window.pollOtherNow(msg);
    }
    if (has("attendance", "settings", "logistics", "roster")) {
      if (typeof window.pollAttendanceNow === "function") window.pollAttendanceNow(msg);
    }
    if (has("pairings", "logistics", "roster")) {
      if (typeof window.pollPairingsNow === "function") window.pollPairingsNow(msg);
    }
    if (has("rooms", "logistics", "roster")) {
      if (typeof window.pollRoomsNow === "function") window.pollRoomsNow(msg);
    }
    if (has("logistics", "roster", "settings")) {
      if (typeof window.pollLogisticsAssignmentsNow === "function") {
        window.pollLogisticsAssignmentsNow(msg);
      }
    }
    if (has("finance", "receipts", "roster", "logistics")) {
      if (typeof window.pollFinanceNow === "function") window.pollFinanceNow(msg);
    }
    if (has("minutes")) {
      if (typeof window.pollMinutesNow === "function") window.pollMinutesNow(msg);
    }
    if (has("files", "settings")) {
      if (typeof window.pollFilesNow === "function") window.pollFilesNow(msg);
    }
    if (typeof window.pollProfileNow === "function") {
      window.pollProfileNow(Array.from(domainSet), msg);
    } else if (has("attendance", "settings") && typeof window.pollIcAttendanceNow === "function") {
      window.pollIcAttendanceNow(msg);
    }
    if (Array.isArray(window.__realtimeListeners)) {
      window.__realtimeListeners.forEach((fn) => {
        try {
          fn(msg);
        } catch (e) {}
      });
    }
  } catch (e) {
    console.warn("Realtime dispatch warning:", e);
  }
};

window.registerRealtimeListener = function (fn) {
  if (!Array.isArray(window.__realtimeListeners)) {
    window.__realtimeListeners = [];
  }
  if (typeof fn === "function" && !window.__realtimeListeners.includes(fn)) {
    window.__realtimeListeners.push(fn);
  }
};
