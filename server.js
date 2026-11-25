import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const port = 3000;

const DATA_DIR = path.join(__dirname, 'data');
const ARCHIVES_DIR = path.join(DATA_DIR, 'archived_trips');
const ARCHIVES_INDEX_FILE = path.join(ARCHIVES_DIR, 'index.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const EXTRACTIONS_DIR = path.join(UPLOADS_DIR, 'extractions');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ARCHIVES_DIR)) fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(EXTRACTIONS_DIR)) fs.mkdirSync(EXTRACTIONS_DIR, { recursive: true });

const DEFAULT_GAS_API_URL = 'https://script.google.com/macros/s/AKfycbw7ZFsUb_24YlMNIDumzE2wNxIVl_yVLNFMFqQXArtEi79Wze11yiOrtRFhHC9D3SJv/exec';

function sanitizeGasApiUrl(candidateUrl) {
  if (!candidateUrl || typeof candidateUrl !== 'string') return DEFAULT_GAS_API_URL;
  try {
    const parsed = new URL(candidateUrl.trim());
    if (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'script.google.com' &&
      parsed.pathname.startsWith('/macros/s/')
    ) {
      return parsed.toString();
    }
  } catch (e) {}
  return DEFAULT_GAS_API_URL;
}

function isValidArchiveId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{4,80}$/.test(id);
}

function resolveArchiveFilePath(archiveId) {
  if (!isValidArchiveId(archiveId)) return null;
  const baseDir = path.resolve(ARCHIVES_DIR);
  const target = path.resolve(baseDir, `${archiveId}.json`);
  if (!target.startsWith(baseDir + path.sep)) return null;
  return target;
}

function loadArchivesIndex() {
  try {
    if (fs.existsSync(ARCHIVES_INDEX_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ARCHIVES_INDEX_FILE, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error loading archives index:', e);
  }
  return [];
}

function saveArchivesIndex(list) {
  try {
    if (!fs.existsSync(ARCHIVES_DIR)) fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
    fs.writeFileSync(ARCHIVES_INDEX_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving archives index:', e);
  }
}

function loadArchiveSnapshot(archiveId) {
  const filePath = resolveArchiveFilePath(archiveId);
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.error('Error loading archive snapshot:', archiveId, e);
    return null;
  }
}

function saveArchiveSnapshot(archiveId, snapshot) {
  const filePath = resolveArchiveFilePath(archiveId);
  if (!filePath) throw new Error('Invalid archive ID');
  if (!fs.existsSync(ARCHIVES_DIR)) fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
}

function deleteArchiveSnapshot(archiveId) {
  try {
    const filePath = resolveArchiveFilePath(archiveId);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const index = loadArchivesIndex();
    const filtered = index.filter((x) => x && x.id !== archiveId);
    if (filtered.length !== index.length) {
      saveArchivesIndex(filtered);
    }
  } catch (e) {
    console.warn('Failed to roll back archive snapshot:', archiveId, e.message);
  }
}

const ARCHIVE_READONLY_ACTIONS = new Set([
  'getSettings',
  'fetchAdminRoster',
  'fetchLogistics',
  'fetchPairingsOnly',
  'fetchRoomsOnly',
  'fetchAttendanceData',
  'fetchFinance',
  'fetchReceipts',
  'fetchMinutes',
  'getDriveContents',
  'getProfile',
  'getPublicTrainees',
  'getArchivedTripMeta',
  'extractData'
]);

async function callGasJson(apiUrl, bodyObj) {
  const safeUrl = sanitizeGasApiUrl(apiUrl);
  const resp = await fetch(safeUrl, {
    method: 'POST',
    body: JSON.stringify(bodyObj),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow'
  });
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return { status: 'error', message: 'Invalid response from Google Apps Script' };
  }
}

async function snapshotDriveRecursive(apiUrl, startFolderId = 'root') {
  const foldersById = {};
  let totalFiles = 0;
  let rootFolderId = startFolderId;
  let rootFolderName = 'Trip Folder';
  const visited = new Set();
  const MAX_FOLDERS = 40;
  const MAX_DEPTH = 4;

  const queue = [{ id: startFolderId, depth: 0 }];
  while (queue.length > 0 && visited.size < MAX_FOLDERS) {
    const batch = queue.splice(0, 3);
    await Promise.all(
      batch.map(async ({ id, depth }) => {
        if (visited.has(id)) return;
        visited.add(id);
        try {
          const res = await callGasJson(apiUrl, {
            action: 'getDriveContents',
            folderId: id
          });
          if (res && res.status === 'success') {
            const entry = {
              status: 'success',
              currentFolderId: res.currentFolderId || id,
              currentFolderName: res.currentFolderName || 'Folder',
              folders: Array.isArray(res.folders) ? res.folders : [],
              files: Array.isArray(res.files) ? res.files : []
            };
            foldersById[id] = entry;
            if (entry.currentFolderId && entry.currentFolderId !== id) {
              foldersById[entry.currentFolderId] = entry;
            }
            if (id === 'root') {
              rootFolderId = entry.currentFolderId;
              rootFolderName = entry.currentFolderName;
            }
            totalFiles += entry.files.length;
            if (depth < MAX_DEPTH) {
              entry.folders.forEach((sub) => {
                if (sub && sub.id && !visited.has(sub.id) && visited.size + queue.length < MAX_FOLDERS) {
                  queue.push({ id: sub.id, depth: depth + 1 });
                }
              });
            }
          }
        } catch (e) {
          console.warn('Archive drive folder snapshot warning:', id, e.message);
        }
      })
    );
  }

  return { rootFolderId, rootFolderName, foldersById, totalFiles };
}

function buildArchiveStats(roster, logistics, settings, receipts, minutes, totalFiles) {
  const safeRoster = Array.isArray(roster) ? roster : [];
  const safeRooms = Array.isArray(logistics?.rooms)
    ? logistics.rooms.filter((r) => !r.isDeleted)
    : [];
  const safeJunctures = Array.isArray(settings?.junctures) ? settings.junctures : [];
  const regularJunctures = safeJunctures.filter((j) => !String(j).startsWith('__BUS__'));
  const busJunctures = safeJunctures.filter((j) => String(j).startsWith('__BUS__'));
  const activeReceipts = Array.isArray(receipts)
    ? receipts.filter((r) => !r.isDeleted && r.categoryId !== 'TRIP_FEE')
    : [];
  const totalSpendSgd = activeReceipts.reduce(
    (sum, r) => sum + (parseFloat(r.sgdAmount) || 0),
    0
  );
  const activeMinutes = Array.isArray(minutes)
    ? minutes.filter((m) => !m.isDeleted)
    : [];

  return {
    participants: safeRoster.length,
    trainees: safeRoster.filter((p) => p.role === 'TRAINEE').length,
    caregivers: safeRoster.filter((p) => p.role === 'CAREGIVER').length,
    volunteers: safeRoster.filter((p) => p.role === 'VOLUNTEER').length,
    rooms: safeRooms.length,
    junctures: regularJunctures.length,
    busJunctures: busJunctures.length,
    receipts: activeReceipts.length,
    totalSpendSgd: Math.round(totalSpendSgd * 100) / 100,
    minutes: activeMinutes.length,
    files: totalFiles || 0
  };
}

async function captureActiveTripSnapshot(apiUrl, extraMeta = {}) {
  const safeUrl = sanitizeGasApiUrl(apiUrl);
  const [settingsRaw, rosterRes, logisticsRes, financeRes, receiptsRaw, minutesRes] = await Promise.all([
    callGasJson(safeUrl, { action: 'getSettings' }).catch(() => ({})),
    callGasJson(safeUrl, { action: 'fetchAdminRoster' }).catch(() => ({ roster: [] })),
    callGasJson(safeUrl, { action: 'fetchLogistics' }).catch(() => ({ participants: [], pairings: [], rooms: [] })),
    callGasJson(safeUrl, { action: 'fetchFinance' }).catch(() => ({ data: { config: {}, options: [] }, rates: { SGD: 1 } })),
    callGasJson(safeUrl, { action: 'fetchReceipts' }).catch(() => ({ receipts: [] })),
    callGasJson(safeUrl, { action: 'fetchMinutes' }).catch(() => ({ minutes: [] }))
  ]);

  const settings = mergeSettingsWithTripFiles(settingsRaw || {});
  const roster = Array.isArray(rosterRes?.roster) ? rosterRes.roster : [];
  const logistics = {
    status: 'success',
    participants: Array.isArray(logisticsRes?.participants) ? logisticsRes.participants : [],
    pairings: Array.isArray(logisticsRes?.pairings) ? logisticsRes.pairings : [],
    rooms: Array.isArray(logisticsRes?.rooms) ? logisticsRes.rooms : []
  };
  const finance = {
    status: 'success',
    data: financeRes?.data || { config: {}, options: [] },
    rates: financeRes?.rates || { SGD: 1 }
  };
  const receipts = mergeReceiptsWithOverrides(
    Array.isArray(receiptsRaw?.receipts) ? receiptsRaw.receipts : [],
    loadReceiptOverrides()
  );
  const minutes = Array.isArray(minutesRes?.minutes) ? minutesRes.minutes : [];

  // Capture attendance for all regular and adhoc bus junctures
  const attendance = {};
  const allJunctures = Array.isArray(settings.junctures) ? settings.junctures : [];
  for (let i = 0; i < allJunctures.length; i += 4) {
    const chunk = allJunctures.slice(i, i + 4);
    await Promise.all(
      chunk.map(async (juncture) => {
        try {
          const attRes = await callGasJson(safeUrl, {
            action: 'fetchAttendanceData',
            juncture
          });
          attendance[juncture] = (attRes && attRes.data) ? attRes.data : {};
        } catch (e) {
          attendance[juncture] = {};
        }
      })
    );
  }

  // Capture Drive folder tree
  const drive = await snapshotDriveRecursive(safeUrl, 'root');

  const archivedAt = new Date().toISOString();
  const archiveId = `arch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const tripTitle = String(settings.tripTitle || extraMeta.tripTitle || 'Overseas Trip').trim() || 'Overseas Trip';
  const tripYear = String(settings.tripYear || extraMeta.tripYear || new Date().getFullYear()).trim();

  const stats = buildArchiveStats(roster, logistics, settings, receipts, minutes, drive.totalFiles);

  const meta = {
    id: archiveId,
    tripTitle,
    tripYear,
    tripStartDate: settings.tripStartDate || '',
    tripEndDate: settings.tripEndDate || '',
    archivedAt,
    archivedBy: String(extraMeta.archivedBy || 'Admin'),
    source: 'snapshot',
    sheetId: extraMeta.sheetId || settings.sheetId || '',
    folderId: drive.rootFolderId && drive.rootFolderId !== 'root' ? drive.rootFolderId : '',
    folderName: drive.rootFolderName || `${tripTitle} ${tripYear}`.trim(),
    stats
  };

  const snapshot = {
    meta,
    settings: {
      ...settings,
      registrationOpen: false,
      allowEdits: false,
      isArchived: true,
      archiveId,
      archivedAt
    },
    roster,
    logistics,
    attendance,
    finance,
    receipts,
    minutes,
    drive: {
      rootFolderId: drive.rootFolderId,
      rootFolderName: drive.rootFolderName,
      foldersById: drive.foldersById
    }
  };

  saveArchiveSnapshot(archiveId, snapshot);

  const index = loadArchivesIndex();
  index.unshift(meta);
  saveArchivesIndex(index);

  return { meta, snapshot };
}

function buildArchivedProfile(snapshot, nric) {
  const targetNric = String(nric || '').trim().toUpperCase();
  const roster = Array.isArray(snapshot?.roster) ? snapshot.roster : [];
  const logistics = snapshot?.logistics || {};
  const match = roster.find((p) => String(p.nric || '').trim().toUpperCase() === targetNric);
  if (!match) {
    return { status: 'error', message: 'Participant not found in archived trip.' };
  }
  const poc = String(match.pocNric || match.nric || '').trim().toUpperCase();
  const family = roster.filter((p) => {
    const pNric = String(p.nric || '').trim().toUpperCase();
    const pPoc = String(p.pocNric || p.nric || '').trim().toUpperCase();
    return pNric === targetNric || (poc && pPoc === poc);
  });
  const lp = Array.isArray(logistics.participants)
    ? logistics.participants.find((p) => String(p.nric || '').trim().toUpperCase() === targetNric)
    : null;
  return {
    status: 'success',
    family,
    logisticsGroup: lp?.logisticsGroup || match.logisticsGroup || '',
    isGroupIC: Boolean(lp?.isGroupIC || match.isGroupIC),
    groupMembers: [],
    icJunctures: []
  };
}

const extractedFiles = new Map();
const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function cleanupOldExtractions() {
  const maxAgeMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  for (const [id, entry] of extractedFiles.entries()) {
    if (now - entry.createdAt > maxAgeMs) {
      try {
        if (fs.existsSync(entry.filePath)) fs.unlinkSync(entry.filePath);
      } catch (e) {}
      extractedFiles.delete(id);
    }
  }
}

const OVERRIDES_FILE = path.join(DATA_DIR, 'receipts_overrides.json');
const TRIP_FILES_FILE = path.join(DATA_DIR, 'trip_files.json');

// WebSocket connection handling & real-time broadcast
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      } else if (msg.type === 'sync:invalidate' && msg.action) {
        const domain = invalidateCacheForAction(msg.action);
        broadcastSyncEvent({
          type: 'sync:update',
          action: msg.action,
          domain: msg.domain || domain,
          clientId: msg.clientId || null,
          ts: Date.now()
        }, ws);
      }
    } catch (e) {
      // Ignore malformed messages
    }
  });
});

const wsHeartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (e) {}
  });
}, 30000);

wss.on('close', () => {
  clearInterval(wsHeartbeatInterval);
});

function broadcastSyncEvent(eventObj, excludeWs = null) {
  const payload = JSON.stringify(eventObj);
  wss.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === 1) {
      try {
        client.send(payload);
      } catch (e) {}
    }
  });
}

function loadTripFiles() {
  try {
    if (fs.existsSync(TRIP_FILES_FILE)) {
      const data = fs.readFileSync(TRIP_FILES_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading trip files:', e);
  }
  return {};
}

function saveTripFiles(files) {
  try {
    fs.writeFileSync(TRIP_FILES_FILE, JSON.stringify(files, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving trip files:', e);
  }
}

function mergeSettingsWithTripFiles(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  const files = loadTripFiles();
  return {
    ...settings,
    tripInfographicId: files.tripInfographicId !== undefined ? files.tripInfographicId : (settings.tripInfographicId || ''),
    tripInfographicName: files.tripInfographicName !== undefined ? files.tripInfographicName : (settings.tripInfographicName || ''),
    tripInfographicUrl: files.tripInfographicUrl !== undefined ? files.tripInfographicUrl : (settings.tripInfographicUrl || ''),
    tripInfoDocId: files.tripInfoDocId !== undefined ? files.tripInfoDocId : (settings.tripInfoDocId || ''),
    tripInfoDocName: files.tripInfoDocName !== undefined ? files.tripInfoDocName : (settings.tripInfoDocName || ''),
    tripInfoDocUrl: files.tripInfoDocUrl !== undefined ? files.tripInfoDocUrl : (settings.tripInfoDocUrl || '')
  };
}

function loadReceiptOverrides() {
  try {
    if (fs.existsSync(OVERRIDES_FILE)) {
      const data = fs.readFileSync(OVERRIDES_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading receipt overrides:', e);
  }
  return {};
}

function saveReceiptOverrides(overrides) {
  try {
    fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(overrides, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving receipt overrides:', e);
  }
}

function mergeReceiptsWithOverrides(receipts, overrides) {
  const map = new Map();
  if (Array.isArray(receipts)) {
    receipts.forEach(r => map.set(r.id, { ...r }));
  }
  Object.values(overrides || {}).forEach(ov => {
    if (map.has(ov.id)) {
      map.set(ov.id, { ...map.get(ov.id), ...ov });
    } else {
      // Check if this override is an exact duplicate of a receipt already in GAS
      const isDuplicate = Array.from(map.values()).some(existing => 
        !existing.isDeleted &&
        existing.uploaderNric === ov.uploaderNric &&
        Number(existing.amount) === Number(ov.amount) &&
        existing.currency === ov.currency &&
        existing.categoryId === ov.categoryId &&
        Math.abs((existing.ts || 0) - (ov.ts || 0)) < 120000
      );
      if (!isDuplicate) {
        map.set(ov.id, { ...ov });
      }
    }
  });
  return Array.from(map.values());
}

app.use(express.static(__dirname));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.json({ limit: '50mb' }));

// Simple in-memory cache
const cache = new Map();
// Active requests cache to prevent duplicate concurrent network calls
const activeRequests = new Map();

function invalidateCacheByPrefixes(prefixes) {
  for (const key of cache.keys()) {
    if (prefixes.some(prefix => key.startsWith(prefix))) {
      cache.delete(key);
    }
  }
}

function invalidateReceiptsCache() {
  invalidateCacheByPrefixes(['fetchReceipts', 'fetchFinance', 'getProfile']);
}

function invalidateSettingsCache() {
  invalidateCacheByPrefixes(['getSettings']);
}

const MUTATION_DOMAIN_MAP = {
  syncReceipts: { domain: 'receipts', prefixes: ['fetchReceipts', 'fetchFinance', 'getProfile'] },
  uploadReceipt: { domain: 'receipts', prefixes: ['fetchReceipts', 'fetchFinance', 'getProfile'] },
  saveFinance: { domain: 'finance', prefixes: ['fetchFinance', 'fetchReceipts', 'getProfile'] },
  syncPairingUpdates: { domain: 'pairings', prefixes: ['fetchPairingsOnly', 'fetchLogistics', 'getProfile'] },
  syncRoomUpdates: { domain: 'rooms', prefixes: ['fetchRoomsOnly', 'fetchLogistics', 'getProfile'] },
  syncAssignments: { domain: 'logistics', prefixes: ['fetchLogistics', 'fetchAdminRoster', 'getProfile', 'fetchAttendanceData'] },
  syncAttendanceUpdate: { domain: 'attendance', prefixes: ['fetchAttendanceData', 'fetchLogistics'] },
  syncMinutes: { domain: 'minutes', prefixes: ['fetchMinutes'] },
  updateProfile: { domain: 'roster', prefixes: ['fetchAdminRoster', 'fetchLogistics', 'getProfile', 'getPublicTrainees', 'fetchFinance'] },
  adminUpdateParticipant: { domain: 'roster', prefixes: ['fetchAdminRoster', 'fetchLogistics', 'getProfile', 'getPublicTrainees', 'fetchFinance'] },
  submitRegistration: { domain: 'roster', prefixes: ['fetchAdminRoster', 'fetchLogistics', 'getProfile', 'getPublicTrainees', 'fetchFinance'] },
  deleteParticipant: { domain: 'roster', prefixes: ['fetchAdminRoster', 'fetchLogistics', 'getProfile', 'getPublicTrainees', 'fetchFinance'] },
  setTripFile: { domain: 'settings', prefixes: ['getSettings'] },
  saveTripSettings: { domain: 'settings', prefixes: ['getSettings'] },
  toggleRegistration: { domain: 'settings', prefixes: ['getSettings'] },
  toggleEdits: { domain: 'settings', prefixes: ['getSettings'] },
  addProjectGroup: { domain: 'settings', prefixes: ['getSettings', 'fetchLogistics', 'fetchAdminRoster'] },
  removeProjectGroup: { domain: 'settings', prefixes: ['getSettings', 'fetchLogistics', 'fetchAdminRoster'] },
  modifyJunctures: { domain: 'settings', prefixes: ['getSettings', 'fetchAttendanceData'] },
  modifyICJunctures: { domain: 'settings', prefixes: ['getSettings', 'fetchAttendanceData'] },
  saveSortingRules: { domain: 'settings', prefixes: ['getSettings', 'fetchLogistics', 'fetchAdminRoster'] },
  saveCustomViewsOrder: { domain: 'settings', prefixes: ['getSettings'] },
  addCommittee: { domain: 'settings', prefixes: ['getSettings', 'fetchAdminRoster'] },
  removeCommittee: { domain: 'settings', prefixes: ['getSettings', 'fetchAdminRoster'] },
  addHelpline: { domain: 'settings', prefixes: ['getSettings'] },
  removeHelpline: { domain: 'settings', prefixes: ['getSettings'] },
  archiveAndReset: { domain: 'settings', prefixes: ['ALL'] },
  clearCache: { domain: 'settings', prefixes: ['ALL'] },
  uploadDriveFile: { domain: 'files', prefixes: ['getSettings'] },
  createDriveFolder: { domain: 'files', prefixes: ['getSettings'] },
  createGoogleDoc: { domain: 'files', prefixes: ['getSettings'] },
  renameDriveItem: { domain: 'files', prefixes: ['getSettings'] },
  deleteDriveItem: { domain: 'files', prefixes: ['getSettings'] },
  bulkDriveOperation: { domain: 'files', prefixes: ['getSettings'] },
  extractData: { domain: 'files', prefixes: ['getSettings'] },
  syncManualPairingUpdates: { domain: 'outing', prefixes: ['fetchPairingsOnly', 'fetchLogistics'] },
  syncManualGroupingUpdates: { domain: 'outing', prefixes: ['fetchLogistics'] },
  runAutoPairing: { domain: 'outing', prefixes: ['fetchPairingsOnly', 'fetchLogistics'] },
  runAutoGrouping: { domain: 'outing', prefixes: ['fetchLogistics'] },
  syncCommAttendance: { domain: 'outing', prefixes: ['fetchAttendanceData'] },
  addCommJuncture: { domain: 'outing', prefixes: ['fetchAttendanceData'] },
  deleteCommJuncture: { domain: 'outing', prefixes: ['fetchAttendanceData'] },
  submitAttendanceData: { domain: 'outing', prefixes: ['fetchAttendanceData'] }
};

function invalidateCacheForAction(action) {
  const entry = MUTATION_DOMAIN_MAP[action];
  if (!entry) return null;
  if (entry.prefixes.includes('ALL')) {
    cache.clear();
  } else {
    invalidateCacheByPrefixes(entry.prefixes);
  }
  return entry.domain;
}

// Cache these read-only actions to optimize for concurrent usage (>50 users)
const CACHEABLE_ACTIONS = [
  'fetchAdminRoster',
  'fetchLogistics',
  'fetchFinance',
  'getSettings',
  'getPublicTrainees',
  'fetchPairingsOnly',
  'fetchRoomsOnly',
  'fetchMinutes',
  'fetchAttendanceData',
  'fetchReceipts',
  'getProfile'
];

app.get('/api/extractions/:id', (req, res) => {
  const id = String(req.params.id || '');
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ status: 'error', message: 'Invalid extraction ID' });
  }
  const entry = extractedFiles.get(id);
  if (!entry || !fs.existsSync(entry.filePath)) {
    return res.status(404).json({ status: 'error', message: 'Extracted file not found or expired' });
  }
  const safeAsciiName = entry.fileName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
  res.setHeader('Content-Type', EXCEL_MIME_TYPE);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(entry.fileName)}`
  );
  return res.sendFile(entry.filePath);
});

app.post('/api/upload-file', async (req, res) => {
  try {
    const { fileName, mimeType, fileData, API_URL, archiveId } = req.body || {};
    if (archiveId) {
      return res.status(403).json({ status: 'error', message: 'Archived trips are read-only and cannot be modified.' });
    }
    if (!fileData) {
      return res.status(400).json({ status: 'error', message: 'No file data provided' });
    }
    const safeName = (fileName || 'receipt.jpg').replace(/[^a-zA-Z0-9.-]/g, '_');
    const storedName = `${Date.now()}_${safeName}`;
    const filePath = path.join(UPLOADS_DIR, storedName);
    fs.writeFileSync(filePath, Buffer.from(fileData, 'base64'));
    const localUrl = `/uploads/${storedName}`;

    // Optionally also upload to Drive if API_URL is provided
    let driveUrl = localUrl;
    if (API_URL) {
      try {
        const safeApiUrl = sanitizeGasApiUrl(API_URL);
        const driveRes = await fetch(safeApiUrl, {
          method: 'POST',
          body: JSON.stringify({
            action: 'uploadDriveFile',
            folderId: 'root',
            fileName: safeName,
            mimeType: mimeType || 'application/octet-stream',
            fileData: fileData
          }),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          redirect: 'follow'
        });
        const driveJson = await driveRes.json();
        if (driveJson && driveJson.files && driveJson.files.length > 0) {
          const match = driveJson.files.find(f => f.name === safeName);
          if (match && match.url) driveUrl = match.url;
        }
      } catch (e) {
        console.warn('Drive upload failed, using local URL:', e.message);
      }
    }

    return res.json({ status: 'success', fileUrl: driveUrl || localUrl, localUrl });
  } catch (err) {
    console.error('File upload error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api', async (req, res) => {
  let { action, payload, API_URL, clientId, archiveId } = req.body || {};
  API_URL = sanitizeGasApiUrl(API_URL);
  const effectiveArchiveId = String(archiveId || (payload && payload.archiveId) || '').trim();

  // List all archived trips (merges local snapshots + remote GAS archived trips if deployed)
  if (action === 'listArchivedTrips') {
    try {
      const localList = loadArchivesIndex();
      let remoteList = [];
      try {
        const remoteRes = await callGasJson(API_URL, { action: 'listArchivedTrips' });
        if (remoteRes && remoteRes.status === 'success' && Array.isArray(remoteRes.archives)) {
          remoteList = remoteRes.archives;
        }
      } catch (e) {}

      const mergedMap = new Map();
      localList.forEach((item) => {
        if (item && item.id) mergedMap.set(item.id, { ...item, hasLocalSnapshot: Boolean(resolveArchiveFilePath(item.id) && fs.existsSync(resolveArchiveFilePath(item.id))) });
      });
      remoteList.forEach((item) => {
        if (!item || !item.id) return;
        const existingById = mergedMap.get(item.id);
        const existingBySheet = !existingById && item.sheetId
          ? Array.from(mergedMap.values()).find((x) => x.sheetId && x.sheetId === item.sheetId)
          : null;
        if (existingById) {
          mergedMap.set(item.id, {
            ...item,
            ...existingById,
            sheetId: existingById.sheetId || item.sheetId || '',
            folderId: existingById.folderId || item.folderId || '',
            hasLocalSnapshot: existingById.hasLocalSnapshot
          });
        } else if (existingBySheet) {
          existingBySheet.sheetId = existingBySheet.sheetId || item.sheetId || '';
          existingBySheet.folderId = existingBySheet.folderId || item.folderId || '';
        } else {
          mergedMap.set(item.id, { ...item, source: item.source || 'remote', hasLocalSnapshot: false });
        }
      });

      const archives = Array.from(mergedMap.values()).sort((a, b) => {
        const tA = new Date(a.archivedAt || 0).getTime() || 0;
        const tB = new Date(b.archivedAt || 0).getTime() || 0;
        return tB - tA;
      });
      return res.json({ status: 'success', archives });
    } catch (err) {
      console.error('listArchivedTrips error:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to load archived trips.' });
    }
  }

  // Handle archiveAndReset: capture full read-only snapshot BEFORE resetting live trip
  if (action === 'archiveAndReset' && !effectiveArchiveId) {
    try {
      const captured = await captureActiveTripSnapshot(API_URL, {
        archivedBy: (payload && payload.archivedBy) || 'Admin'
      });

      // 1. Explicitly revoke ALL accounts granted via Drive Access Management BEFORE resetting
      const snapshotAccess =
        (captured.snapshot &&
          captured.snapshot.settings &&
          captured.snapshot.settings.driveAccessList) ||
        {};
      const payloadEmails = Array.isArray(payload && payload.driveAccessEmails)
        ? payload.driveAccessEmails
        : [];
      const grantedEmails = Array.from(
        new Set(
          [...Object.keys(snapshotAccess), ...payloadEmails]
            .map((e) => String(e || '').trim().toLowerCase())
            .filter(Boolean)
        )
      );

      let revokedDriveAccounts = [];
      if (grantedEmails.length > 0) {
        try {
          const revokeRes = await callGasJson(API_URL, {
            action: 'massDriveAccess',
            actionType: 'remove',
            emails: grantedEmails
          });
          if (revokeRes && revokeRes.results && Array.isArray(revokeRes.results.success)) {
            revokedDriveAccounts = revokeRes.results.success;
          } else {
            revokedDriveAccounts = grantedEmails;
          }
        } catch (revokeErr) {
          console.warn('GAS massDriveAccess revoke during archiveAndReset warning:', revokeErr.message);
        }
      }

      // 2. Archive & reset the backend GAS database and properties
      // Note: pass newArchiveId (never archiveId) so GAS does not interpret this as a write against an existing read-only archive.
      let gasData = { status: 'success' };
      try {
        gasData = await callGasJson(API_URL, {
          action: 'archiveAndReset',
          newArchiveId: captured.meta.id,
          archivedBy: captured.meta.archivedBy
        });
      } catch (e) {
        console.warn('GAS archiveAndReset warning:', e.message);
      }

      if (gasData && gasData.status === 'error') {
        deleteArchiveSnapshot(captured.meta.id);
        return res.json(gasData);
      }

      // Attach any sheet/folder metadata returned by GAS back into our archive record and snapshot
      if (gasData && gasData.archivedTrip) {
        const index = loadArchivesIndex();
        const entry = index.find((x) => x.id === captured.meta.id);
        if (entry) {
          if (gasData.archivedTrip.sheetId) entry.sheetId = gasData.archivedTrip.sheetId;
          if (gasData.archivedTrip.folderId) entry.folderId = gasData.archivedTrip.folderId;
          saveArchivesIndex(index);
        }
        if (captured.snapshot && captured.snapshot.meta) {
          if (gasData.archivedTrip.sheetId) captured.snapshot.meta.sheetId = gasData.archivedTrip.sheetId;
          if (gasData.archivedTrip.folderId) captured.snapshot.meta.folderId = gasData.archivedTrip.folderId;
          saveArchiveSnapshot(captured.meta.id, captured.snapshot);
        }
      }

      // 3. Clear ALL local trip-specific overrides and server caches
      saveReceiptOverrides({});
      saveTripFiles({});
      cache.clear();
      invalidateCacheForAction('archiveAndReset');

      // 4. Fetch freshly reset settings so the client immediately reflects a clean slate
      let freshSettings = null;
      try {
        const cfg = await callGasJson(API_URL, { action: 'getSettings' });
        if (cfg && cfg.status !== 'error') {
          freshSettings = mergeSettingsWithTripFiles({
            ...cfg,
            registrationOpen: false,
            allowEdits: false,
            driveAccessList: {},
            tripInfographicId: '',
            tripInfographicName: '',
            tripInfographicUrl: '',
            tripInfoDocId: '',
            tripInfoDocName: '',
            tripInfoDocUrl: ''
          });
        }
      } catch (e) {}

      if (!freshSettings) {
        freshSettings = {
          status: 'success',
          registrationOpen: false,
          allowEdits: false,
          committee: [],
          helpline: [],
          projectGroups: captured.snapshot?.settings?.projectGroups || [],
          projectColors: captured.snapshot?.settings?.projectColors || {},
          activeProjects: [],
          junctures: ['Morning Assembly'],
          sortingRules: captured.snapshot?.settings?.sortingRules || ['project', 'family', 'role', 'name'],
          customViewsOrder: captured.snapshot?.settings?.customViewsOrder || ['reset_filter', 'medical.html', 'diet.html', 'expired.html', 'other.html'],
          driveAccessList: {},
          tripTitle: '',
          tripYear: '',
          tripStartDate: '',
          tripEndDate: '',
          tripInfographicId: '',
          tripInfographicName: '',
          tripInfographicUrl: '',
          tripInfoDocId: '',
          tripInfoDocName: '',
          tripInfoDocUrl: ''
        };
      }

      broadcastSyncEvent({
        type: 'sync:update',
        action: 'archiveAndReset',
        domain: 'settings',
        clientId: clientId || null,
        ts: Date.now()
      });

      return res.json({
        status: 'success',
        archivedTrip: captured.meta,
        revokedDriveAccounts,
        freshSettings
      });
    } catch (err) {
      console.error('archiveAndReset snapshot error:', err);
      return res.status(500).json({ status: 'error', message: err.message || 'Failed to archive trip.' });
    }
  }

  // STRICT READ-ONLY ARCHIVE MODE INTERCEPTOR
  let archiveSnapshotForExtract = null;
  if (effectiveArchiveId) {
    if (!isValidArchiveId(effectiveArchiveId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid archive identifier.' });
    }
    if (!ARCHIVE_READONLY_ACTIONS.has(action)) {
      return res.status(403).json({
        status: 'error',
        message: 'Archived trips are read-only and cannot be modified.'
      });
    }

    const snapshot = loadArchiveSnapshot(effectiveArchiveId);
    if (snapshot) {
      if (action === 'getArchivedTripMeta') {
        return res.json({ status: 'success', archive: snapshot.meta });
      }
      if (action === 'getSettings') {
        return res.json({
          status: 'success',
          ...(snapshot.settings || {}),
          registrationOpen: false,
          allowEdits: false,
          isArchived: true,
          archiveId: effectiveArchiveId,
          archivedAt: snapshot.meta?.archivedAt || ''
        });
      }
      if (action === 'fetchAdminRoster') {
        return res.json({ status: 'success', roster: Array.isArray(snapshot.roster) ? snapshot.roster : [] });
      }
      if (action === 'fetchLogistics') {
        return res.json({
          status: 'success',
          participants: snapshot.logistics?.participants || [],
          pairings: snapshot.logistics?.pairings || [],
          rooms: snapshot.logistics?.rooms || []
        });
      }
      if (action === 'fetchPairingsOnly') {
        return res.json({ status: 'success', pairings: snapshot.logistics?.pairings || [] });
      }
      if (action === 'fetchRoomsOnly') {
        return res.json({ status: 'success', rooms: snapshot.logistics?.rooms || [] });
      }
      if (action === 'fetchAttendanceData') {
        const juncture = (payload && payload.juncture) || '';
        const dataMap = (snapshot.attendance && snapshot.attendance[juncture]) || {};
        return res.json({ status: 'success', data: dataMap });
      }
      if (action === 'fetchFinance') {
        return res.json({
          status: 'success',
          data: snapshot.finance?.data || { config: {}, options: [] },
          rates: snapshot.finance?.rates || { SGD: 1 }
        });
      }
      if (action === 'fetchReceipts') {
        return res.json({ status: 'success', receipts: Array.isArray(snapshot.receipts) ? snapshot.receipts : [] });
      }
      if (action === 'fetchMinutes') {
        return res.json({ status: 'success', minutes: Array.isArray(snapshot.minutes) ? snapshot.minutes : [] });
      }
      if (action === 'getDriveContents') {
        const reqFolderId = (payload && payload.folderId) || 'root';
        const foldersMap = snapshot.drive?.foldersById || {};
        if (foldersMap[reqFolderId]) {
          return res.json(foldersMap[reqFolderId]);
        }
        // Fallback: if folder wasn't cached during snapshot depth limit, try read-only Drive lookup via GAS
        if (reqFolderId !== 'root') {
          try {
            const liveDriveRes = await callGasJson(API_URL, {
              action: 'getDriveContents',
              folderId: reqFolderId
            });
            if (liveDriveRes && liveDriveRes.status === 'success') {
              return res.json(liveDriveRes);
            }
          } catch (e) {}
        }
        return res.json({
          status: 'success',
          currentFolderId: snapshot.drive?.rootFolderId || 'root',
          currentFolderName: snapshot.drive?.rootFolderName || `${snapshot.meta?.tripTitle || 'Archived Trip'} Folder`,
          folders: [],
          files: []
        });
      }
      if (action === 'getProfile') {
        return res.json(buildArchivedProfile(snapshot, payload && payload.nric));
      }
      if (action === 'getPublicTrainees') {
        const trainees = (snapshot.roster || [])
          .filter((p) => p.role === 'TRAINEE')
          .map((p) => ({ fullName: p.fullName, shortName: p.shortName, nric: p.nric }));
        return res.json({ status: 'success', trainees });
      }
      if (action === 'extractData') {
        archiveSnapshotForExtract = snapshot;
      }
    } else {
      // Remote-only archive (stored in GAS ARCHIVED_TRIPS): proxy read-only call with archiveSheetId / archiveFolderId
      let remoteMeta = null;
      try {
        const remoteListRes = await callGasJson(API_URL, { action: 'listArchivedTrips' });
        if (remoteListRes && Array.isArray(remoteListRes.archives)) {
          remoteMeta = remoteListRes.archives.find((a) => a.id === effectiveArchiveId) || null;
        }
      } catch (e) {}
      if (!remoteMeta) {
        return res.status(404).json({ status: 'error', message: 'Archived trip not found.' });
      }
      if (action === 'getArchivedTripMeta') {
        return res.json({ status: 'success', archive: remoteMeta });
      }
      if (action !== 'extractData') {
        const gasRes = await callGasJson(API_URL, {
          action,
          ...(payload || {}),
          archiveId: effectiveArchiveId,
          archiveSheetId: remoteMeta.sheetId || '',
          archiveFolderId: remoteMeta.folderId || ''
        });
        return res.json(gasRes);
      }
      // For extractData on remote-only archive, fetch read-only bundle from GAS
      const [settingsRes, rosterRes, logRes] = await Promise.all([
        callGasJson(API_URL, { action: 'getSettings', archiveId: effectiveArchiveId, archiveSheetId: remoteMeta.sheetId || '', archiveFolderId: remoteMeta.folderId || '' }).catch(() => ({})),
        callGasJson(API_URL, { action: 'fetchAdminRoster', archiveId: effectiveArchiveId, archiveSheetId: remoteMeta.sheetId || '' }).catch(() => ({ roster: [] })),
        callGasJson(API_URL, { action: 'fetchLogistics', archiveId: effectiveArchiveId, archiveSheetId: remoteMeta.sheetId || '' }).catch(() => ({ rooms: [], pairings: [] }))
      ]);
      archiveSnapshotForExtract = {
        meta: remoteMeta,
        settings: settingsRes,
        roster: rosterRes?.roster || [],
        logistics: logRes || { rooms: [], pairings: [] }
      };
    }
  }

  // Handle syncReceipts locally + pass to GAS
  if (action === 'syncReceipts') {
    invalidateReceiptsCache();
    const updates = (payload && Array.isArray(payload.updates)) ? payload.updates : [];
    const overrides = loadReceiptOverrides();
    updates.forEach(u => {
      overrides[u.id] = { ...(overrides[u.id] || {}), ...u, ts: u.ts || Date.now() };
    });
    saveReceiptOverrides(overrides);

    // Also forward to GAS in background or await
    let gasReceipts = [];
    try {
      const fetchResponse = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'syncReceipts', updates }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow'
      });
      const gasData = await fetchResponse.json();
      if (gasData && gasData.receipts) gasReceipts = gasData.receipts;
    } catch (e) {
      console.warn('GAS syncReceipts warning:', e.message);
    }

    invalidateReceiptsCache();
    const merged = mergeReceiptsWithOverrides(gasReceipts, overrides);
    broadcastSyncEvent({
      type: 'sync:update',
      action: 'syncReceipts',
      domain: 'receipts',
      clientId: clientId || null,
      ts: Date.now()
    });
    return res.json({ status: 'success', receipts: merged });
  }

  if (action === 'uploadReceipt') {
    invalidateReceiptsCache();
    const p = (payload && payload.payload) ? payload.payload : (payload || {});
    const overrides = loadReceiptOverrides();

    let localFileUrl = "";
    if (p.fileData) {
      try {
        const safeName = (p.fileName || 'receipt.jpg').replace(/[^a-zA-Z0-9.-]/g, '_');
        const storedName = `${Date.now()}_${safeName}`;
        const filePath = path.join(UPLOADS_DIR, storedName);
        fs.writeFileSync(filePath, Buffer.from(p.fileData, 'base64'));
        localFileUrl = `/uploads/${storedName}`;
      } catch (err) {
        console.warn('Local file write error:', err);
      }
    }

    if (p.overwriteReceiptId) {
      if (overrides[p.overwriteReceiptId]) {
        overrides[p.overwriteReceiptId].isDeleted = true;
        overrides[p.overwriteReceiptId].ts = Date.now();
      } else {
        overrides[p.overwriteReceiptId] = {
          id: p.overwriteReceiptId,
          isDeleted: true,
          ts: Date.now()
        };
      }
      saveReceiptOverrides(overrides);
    }

    let gasReceipts = [];
    let gasSuccess = false;
    try {
      const fetchResponse = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'uploadReceipt', payload: p }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow'
      });
      const gasData = await fetchResponse.json();
      if (gasData && Array.isArray(gasData.receipts)) {
        gasReceipts = gasData.receipts;
        gasSuccess = true;
      }
    } catch (e) {
      console.warn('GAS uploadReceipt warning:', e.message);
    }

    invalidateReceiptsCache();

    if (gasSuccess) {
      // If the latest created receipt in gasReceipts doesn't have a valid fileUrl, fallback to localFileUrl
      if (localFileUrl && gasReceipts.length > 0) {
        const latest = gasReceipts[gasReceipts.length - 1];
        if (latest && !latest.fileUrl && latest.categoryId === p.categoryId) {
          latest.fileUrl = localFileUrl;
        }
      }
      const merged = mergeReceiptsWithOverrides(gasReceipts, overrides);
      broadcastSyncEvent({
        type: 'sync:update',
        action: 'uploadReceipt',
        domain: 'receipts',
        clientId: clientId || null,
        ts: Date.now()
      });
      return res.json({ status: 'success', receipts: merged });
    }

    // Fallback: only if GAS call failed, store offline receipt in overrides
    const newId = "rec_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
    overrides[newId] = {
      id: newId,
      ts: Date.now(),
      uploaderNric: p.uploaderNric || '',
      uploaderName: p.uploaderName || '',
      paidByNric: p.paidByNric || p.uploaderNric || '',
      currency: p.currency || 'SGD',
      amount: parseFloat(p.amount) || 0,
      rate: parseFloat(p.rate) || 1,
      sgdAmount: parseFloat(p.sgdAmount) || 0,
      categoryId: p.categoryId || '',
      remarks: p.remarks || '',
      fileUrl: localFileUrl,
      isDeleted: false,
      isReimbursed: false,
    };
    saveReceiptOverrides(overrides);

    const merged = mergeReceiptsWithOverrides(gasReceipts, overrides);
    broadcastSyncEvent({
      type: 'sync:update',
      action: 'uploadReceipt',
      domain: 'receipts',
      clientId: clientId || null,
      ts: Date.now()
    });
    return res.json({ status: 'success', receipts: merged, receiptId: newId });
  }

  // Handle setTripFile locally + forward to GAS
  if (action === 'setTripFile') {
    invalidateSettingsCache();
    const p = payload || {};
    const tripFiles = loadTripFiles();
    if (p.fileType === 'infographic') {
      tripFiles.tripInfographicId = p.fileId || '';
      tripFiles.tripInfographicName = p.fileName || '';
      tripFiles.tripInfographicUrl = p.fileUrl || '';
    } else if (p.fileType === 'infoDoc') {
      tripFiles.tripInfoDocId = p.fileId || '';
      tripFiles.tripInfoDocName = p.fileName || '';
      tripFiles.tripInfoDocUrl = p.fileUrl || '';
    }
    saveTripFiles(tripFiles);

    let gasSettings = {};
    try {
      const fetchResponse = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'setTripFile', ...(payload || {}) }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow'
      });
      gasSettings = await fetchResponse.json();
    } catch (e) {
      console.warn('GAS setTripFile warning:', e.message);
    }

    invalidateSettingsCache();
    const merged = mergeSettingsWithTripFiles(gasSettings.status === 'success' ? gasSettings : { status: 'success' });
    broadcastSyncEvent({
      type: 'sync:update',
      action: 'setTripFile',
      domain: 'settings',
      clientId: clientId || null,
      ts: Date.now()
    });
    return res.json(merged);
  }

  // Handle extractData by generating an Excel (.xlsx) workbook and uploading to Drive
  if (action === 'extractData') {
    try {
      const p = payload || {};
      const extractType = p.extractType || '';
      const excludedNrics = Array.isArray(p.excludedNrics) ? p.excludedNrics : [];
      const customConfig = p.customConfig || {};

      const folderId = p.folderId || 'root';

      const fetchGasJson = async (act, extra = {}) => {
        const resp = await fetch(API_URL, {
          method: 'POST',
          body: JSON.stringify({ action: act, ...extra }),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          redirect: 'follow'
        });
        return await resp.json();
      };

      let settingsRes, rosterRes, logRes, beforeDriveRes;
      if (archiveSnapshotForExtract) {
        settingsRes = archiveSnapshotForExtract.settings || {};
        rosterRes = { roster: archiveSnapshotForExtract.roster || [] };
        logRes = archiveSnapshotForExtract.logistics || { rooms: [], pairings: [] };
        beforeDriveRes = { files: [] };
      } else {
        [settingsRes, rosterRes, logRes, beforeDriveRes] = await Promise.all([
          fetchGasJson('getSettings').catch(() => ({})),
          fetchGasJson('fetchAdminRoster').catch(() => ({ roster: [] })),
          fetchGasJson('fetchLogistics').catch(() => ({ rooms: [], pairings: [] })),
          fetchGasJson('getDriveContents', { folderId }).catch(() => ({ files: [] }))
        ]);
      }

      const existingFileIds = new Set(
        Array.isArray(beforeDriveRes && beforeDriveRes.files)
          ? beforeDriveRes.files.map(f => f.id)
          : []
      );

      const tripTitle = (settingsRes && settingsRes.tripTitle) || 'TOT';
      const tripYear = (settingsRes && settingsRes.tripYear) || new Date().getFullYear().toString();
      const rosterData = Array.isArray(rosterRes && rosterRes.roster) ? [...rosterRes.roster] : [];

      // Enrich with logistics data (rooms & pairings)
      try {
        const roomsMap = {};
        const pairingsMap = {};
        if (logRes && Array.isArray(logRes.rooms)) {
          logRes.rooms.forEach(r => {
            if (!r.isDeleted && Array.isArray(r.occupants)) {
              r.occupants.forEach(n => {
                roomsMap[n] = String(r.name || '').toUpperCase();
              });
            }
          });
        }
        if (logRes && Array.isArray(logRes.pairings)) {
          logRes.pairings.filter(pair => pair.status === 'ACTIVE').forEach(pair => {
            if (!pairingsMap[pair.traineeNric]) pairingsMap[pair.traineeNric] = [];
            if (!pairingsMap[pair.volNric]) pairingsMap[pair.volNric] = [];
            const v = rosterData.find(x => x.nric === pair.volNric);
            const t = rosterData.find(x => x.nric === pair.traineeNric);
            if (v) pairingsMap[pair.traineeNric].push(((v.shortName || v.fullName) || '').toUpperCase());
            if (t) pairingsMap[pair.volNric].push(((t.shortName || t.fullName) || '').toUpperCase());
          });
        }
        rosterData.forEach(person => {
          person.room = roomsMap[person.nric] || 'UNASSIGNED';
          let myPairings = pairingsMap[person.nric] ? [...pairingsMap[person.nric]] : [];
          if (person.role === 'CAREGIVER' && person.relatedTrainee) {
            const rNames = person.relatedTrainee.split('|').map(n => n.trim().toLowerCase());
            const relatedList = rosterData.filter(
              x => rNames.includes((x.fullName || '').toLowerCase()) && x.role === 'TRAINEE'
            );
            relatedList.forEach(related => {
              if (related && pairingsMap[related.nric]) {
                myPairings.push(...pairingsMap[related.nric]);
              }
            });
          }
          person.pairings = myPairings.length > 0 ? Array.from(new Set(myPairings)).join(', ') : 'NONE';
        });
      } catch (enrichErr) {}

      rosterData.sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || '')));
      const targetRoster = rosterData.filter(person => !excludedNrics.includes(person.nric));

      const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const getSGTParts = (dateInput) => {
        if (!dateInput) return null;
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return null;
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Singapore',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric'
        }).formatToParts(d);
        const map = {};
        parts.forEach(pt => { map[pt.type] = pt.value; });
        return {
          year: parseInt(map.year, 10),
          month: parseInt(map.month, 10),
          day: parseInt(map.day, 10)
        };
      };
      const formatDdMmmYyyy = (dateInput) => {
        const pt = getSGTParts(dateInput);
        if (!pt) return '';
        return `${String(pt.day).padStart(2, '0')} ${MONTHS_SHORT[pt.month - 1]} ${pt.year}`;
      };
      const formatDdSlashMmYyyy = (dateInput) => {
        const pt = getSGTParts(dateInput);
        if (!pt) return '';
        return `${String(pt.day).padStart(2, '0')}/${String(pt.month).padStart(2, '0')}/${pt.year}`;
      };
      const calcAge = (dateInput) => {
        const pt = getSGTParts(dateInput);
        if (!pt) return '';
        const now = getSGTParts(new Date());
        let a = now.year - pt.year;
        const m = now.month - pt.month;
        if (m < 0 || (m === 0 && now.day < pt.day)) a--;
        return a.toString();
      };

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Overseas Trip';
      workbook.created = new Date();
      let baseFileName = 'Extraction';

      if (extractType === 'insurance') {
        baseFileName = `Insurance Submission_${tripTitle}_${tripYear}`;
        const sheet = workbook.addWorksheet('Insurance');
        const colWidths = [6, 36, 22, 18, 8, 18, 12, 18, 22, 15, 29];
        sheet.columns = colWidths.map(w => ({ width: w }));

        const header = [
          'No.',
          'Name of Person(s) to be insured',
          'NRIC/FIN/Passport No.',
          'Date of Birth (DD/MM/YYYY)',
          'Age',
          'Nationality',
          'Gender',
          'Contact No',
          'Relationship to Applicant',
          'Transport',
          'Project Group'
        ];
        const headerRow = sheet.addRow(header);
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'left', wrapText: true };

        targetRoster.forEach((person, idx) => {
          const row = sheet.addRow([
            idx + 1,
            person.fullName || '',
            person.nric || '',
            formatDdMmmYyyy(person.dob),
            calcAge(person.dob),
            person.nationality || '',
            person.gender || '',
            person.contact || '',
            'Friend',
            'Bus',
            'West End & RSPID (WGS)'
          ]);
          row.alignment = { horizontal: 'left', wrapText: true };
        });
      } else if (extractType === 'bus') {
        baseFileName = `Bus for ICA Submission_${tripTitle}_${tripYear}`;
        const buses = {};
        targetRoster.forEach(person => {
          let b = person.bus ? String(person.bus).trim() : 'Unassigned';
          if (!b) b = 'Unassigned';
          if (!buses[b]) buses[b] = [];
          buses[b].push(person);
        });
        if (Object.keys(buses).length === 0) {
          buses['Unassigned'] = [];
        }

        const colWidths = [6, 40, 12, 18, 18, 18, 18, 29, 22, 29];
        const usedTabNames = new Set();
        for (const b in buses) {
          let tabName = 'Unassigned';
          if (b.toLowerCase() !== 'unassigned') {
            const clean = b.replace(/bus/i, '').trim();
            tabName = 'Bus ' + clean;
          }
          tabName = tabName.replace(/[\\/*?:[\]]/g, '_').trim().slice(0, 31) || 'Sheet';
          if (usedTabNames.has(tabName.toLowerCase())) {
            let suffix = 2;
            let candidate = `${tabName.slice(0, 27)} (${suffix})`;
            while (usedTabNames.has(candidate.toLowerCase())) {
              suffix++;
              candidate = `${tabName.slice(0, 27)} (${suffix})`;
            }
            tabName = candidate;
          }
          usedTabNames.add(tabName.toLowerCase());
          const sheet = workbook.addWorksheet(tabName);
          sheet.columns = colWidths.map(w => ({ width: w }));

          const busInfoLabels = [
            'Departure from Singapore Date',
            'Estimated time to reach checkpoint',
            'Arrival to Singapore Date',
            'Estimated time to reach checkpoint',
            'Checkpoint (Tuas / Woodlands)',
            'Point of Contact',
            'Bus Plate #, Assigned Bus Driver name & Passport Detail:'
          ];
          busInfoLabels.forEach((label, idx) => {
            const r = sheet.getRow(idx + 1);
            const cellB = r.getCell(2);
            cellB.value = label;
            cellB.font = { bold: true };
            cellB.alignment = { wrapText: true, vertical: 'top' };
          });

          const row7 = sheet.getRow(7);
          row7.height = 100;
          const cellC7 = row7.getCell(3);
          cellC7.value = '1. Bus plate No: \n2. Driver Full Name: \n3. Driver Gender: \n4. Driver Date of Birth: \n5. Driver Passport Number: \n6. Driver Passport Expiry: \n7. Driver Nationality: \n8. H/P: ';
          cellC7.alignment = { vertical: 'top', wrapText: true };

          const header = [
            'S/N',
            'Full Name as per Passport',
            'Gender',
            'Date of Birth',
            'Passport No.',
            'Passport Expiry Date',
            'Nationality',
            'Medical Conditions',
            'Remarks',
            'Clients / Volunteers / Caregivers'
          ];
          const row9 = sheet.getRow(9);
          header.forEach((hText, cIdx) => {
            const cell = row9.getCell(cIdx + 1);
            cell.value = hText;
            cell.font = { bold: true };
            cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
          });

          const busParticipants = buses[b];
          busParticipants.forEach((person, idx) => {
            let roleMapped = 'Volunteer';
            if (person.role === 'TRAINEE') roleMapped = 'Client';
            else if (person.role === 'CAREGIVER') roleMapped = 'Caregiver';

            const r = sheet.getRow(10 + idx);
            const vals = [
              idx + 1,
              person.fullName || '',
              person.gender || '',
              formatDdSlashMmYyyy(person.dob),
              person.passportNo || person.nric || '',
              formatDdSlashMmYyyy(person.passportExpiry),
              person.nationality || '',
              '',
              '',
              roleMapped
            ];
            vals.forEach((v, cIdx) => {
              const cell = r.getCell(cIdx + 1);
              cell.value = v;
              cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
            });
          });
        }
      } else if (extractType === 'custom') {
        baseFileName = (customConfig && customConfig.sheetName)
          ? String(customConfig.sheetName).trim()
          : 'Custom Extraction';
        const sheet = workbook.addWorksheet('Extraction');
        const colDefs = Array.isArray(customConfig.columns) ? customConfig.columns : [];
        const colLabels = {
          fullName: 'Full Name',
          shortName: 'Short Name',
          nric: 'NRIC / FIN',
          email: 'Email Address',
          role: 'Role',
          gender: 'Gender',
          contact: 'Contact Number',
          address: 'Home Address',
          nationality: 'Nationality',
          passportNo: 'Passport No.',
          passportExpiry: 'Passport Expiry Date',
          dob: 'Date of Birth',
          diet: 'Dietary Restrictions',
          emergencyName: 'Emergency Contact Name',
          emergencyContact: 'Emergency Contact Number',
          emergencyRelation: 'Emergency Contact Relationship',
          sleeping: 'Sleeping Arrangement',
          otherPoints: 'Other Points to Note',
          medical: 'Medical Conditions',
          bus: 'Bus',
          logisticsGroup: 'Logistics Group',
          group: 'Project Group',
          relatedTrainee: 'Related Trainee(s)',
          relationship: 'Relationship to Trainee',
          room: 'Room Assignment',
          pairings: 'Pairings'
        };

        const widths = [8];
        colDefs.forEach(c => {
          if (['fullName', 'address', 'medical', 'otherPoints', 'relatedTrainee'].includes(c)) widths.push(36);
          else if (['nric', 'dob', 'passportExpiry', 'gender', 'role', 'bus', 'room', 'shortName'].includes(c)) widths.push(18);
          else if (['contact', 'emergencyContact'].includes(c)) widths.push(19);
          else widths.push(22);
        });
        sheet.columns = widths.map(w => ({ width: w }));

        const header = ['S/N', ...colDefs.map(c => colLabels[c] || c)];
        const headerRow = sheet.addRow(header);
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

        targetRoster.forEach((person, idx) => {
          const rowVals = [idx + 1];
          colDefs.forEach(c => {
            let val = person[c] || '';
            if ((c === 'dob' || c === 'passportExpiry') && val) {
              const formatted = formatDdMmmYyyy(val);
              if (formatted) val = formatted;
            }
            rowVals.push(val);
          });
          const row = sheet.addRow(rowVals);
          row.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        });
      } else {
        return res.status(400).json({ status: 'error', message: 'Invalid extraction type.' });
      }

      const sanitizedBase = String(baseFileName || 'Extraction')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\.(xlsx|xls|csv)$/i, '')
        .trim() || 'Extraction';
      const excelFileName = `${sanitizedBase}.xlsx`;
      const rawBuffer = await workbook.xlsx.writeBuffer();
      const buffer = Buffer.from(rawBuffer);
      const base64Data = buffer.toString('base64');

      cleanupOldExtractions();
      const downloadId = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const localFilePath = path.join(EXTRACTIONS_DIR, `${downloadId}.xlsx`);
      fs.writeFileSync(localFilePath, buffer);
      extractedFiles.set(downloadId, {
        filePath: localFilePath,
        fileName: excelFileName,
        createdAt: Date.now()
      });

      // In read-only archive mode, provide direct Excel download without mutating Google Drive
      if (archiveSnapshotForExtract) {
        return res.json({
          status: 'success',
          fileId: '',
          fileName: excelFileName,
          fileUrl: '',
          downloadUrl: `/api/extractions/${downloadId}`,
          mimeType: EXCEL_MIME_TYPE,
          fileData: base64Data,
          archiveReadOnlyExport: true
        });
      }

      const uploadResp = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'uploadDriveFile',
          folderId: folderId,
          fileName: excelFileName,
          mimeType: EXCEL_MIME_TYPE,
          fileData: base64Data
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow'
      });
      const uploadJson = await uploadResp.json();
      if (uploadJson && uploadJson.status === 'error') {
        return res.json(uploadJson);
      }

      let matchedFile = uploadJson && uploadJson.uploadedFile ? uploadJson.uploadedFile : null;
      if (!matchedFile && uploadJson && Array.isArray(uploadJson.files)) {
        const lowerTarget = excelFileName.toLowerCase();
        matchedFile =
          uploadJson.files.find(f => f.name === excelFileName && !existingFileIds.has(f.id)) ||
          uploadJson.files.find(f => !existingFileIds.has(f.id) && String(f.name || '').toLowerCase() === lowerTarget) ||
          uploadJson.files.find(f => !existingFileIds.has(f.id)) ||
          uploadJson.files.find(f => f.name === excelFileName) ||
          uploadJson.files.find(f => String(f.name || '').toLowerCase() === lowerTarget) ||
          null;
      }

      const fileId = matchedFile && matchedFile.id ? matchedFile.id : '';
      const fileUrl = (matchedFile && matchedFile.url)
        ? matchedFile.url
        : (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '');

      broadcastSyncEvent({
        type: 'sync:update',
        action: 'extractData',
        domain: 'files',
        clientId: clientId || null,
        ts: Date.now()
      });

      return res.json({
        status: 'success',
        fileId,
        fileName: excelFileName,
        fileUrl,
        downloadUrl: `/api/extractions/${downloadId}`,
        mimeType: EXCEL_MIME_TYPE,
        fileData: base64Data,
        folders: uploadJson ? uploadJson.folders : undefined,
        files: uploadJson ? uploadJson.files : undefined
      });
    } catch (err) {
      console.error('extractData error:', err);
      return res.json({ status: 'error', message: err.message });
    }
  }

  // Pre-invalidate cache if this is a known mutation action
  const mutationDomain = invalidateCacheForAction(action);

  const cleanPayload = { ...(payload || {}) };
  const forceRefresh = Boolean(cleanPayload.force);
  delete cleanPayload.force;

  const cacheKey = action + JSON.stringify(cleanPayload);
  
  if (CACHEABLE_ACTIONS.includes(action) && !forceRefresh) {
    const cached = cache.get(cacheKey);
    // Cache for 10 seconds to combine concurrent requests across clients
    if (cached && (Date.now() - cached.timestamp < 10000)) { 
       let responseData = cached.data;
       if (action === 'fetchReceipts') {
         try {
           const parsed = JSON.parse(responseData);
           if (parsed && parsed.receipts) {
             parsed.receipts = mergeReceiptsWithOverrides(parsed.receipts, loadReceiptOverrides());
             return res.json(parsed);
           }
         } catch (e) {}
       }
       if (action === 'getSettings') {
         try {
           const parsed = JSON.parse(responseData);
           return res.json(mergeSettingsWithTripFiles(parsed));
         } catch (e) {}
       }
       return res.send(responseData);
    }
  }

  // Request coalescing for identical API_URL and cacheKey (only for cacheable read actions)
  const requestKey = API_URL + cacheKey;
  
  if (CACHEABLE_ACTIONS.includes(action) && !forceRefresh && activeRequests.has(requestKey)) {
    try {
      const text = await activeRequests.get(requestKey);
      if (action === 'fetchReceipts') {
        try {
          const parsed = JSON.parse(text);
          if (parsed && parsed.receipts) {
            parsed.receipts = mergeReceiptsWithOverrides(parsed.receipts, loadReceiptOverrides());
            return res.json(parsed);
          }
        } catch (e) {}
      }
      if (action === 'getSettings') {
        try {
          const parsed = JSON.parse(text);
          return res.json(mergeSettingsWithTripFiles(parsed));
        } catch (e) {}
      }
      return res.send(text);
    } catch (error) {
      return res.status(500).json({ status: 'error', message: 'Proxy server error' });
    }
  }

  const fetchPromise = (async () => {
    const fetchResponse = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action, ...(payload || {}) }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow'
    });
    return await fetchResponse.text();
  })();

  if (CACHEABLE_ACTIONS.includes(action)) {
    activeRequests.set(requestKey, fetchPromise);
  }

  try {
    const text = await fetchPromise;
    
    if (CACHEABLE_ACTIONS.includes(action)) { 
       try {
           const parsed = JSON.parse(text);
           if (parsed.status !== 'error') {
               cache.set(cacheKey, { timestamp: Date.now(), data: text });
           }
       } catch (e) {
           // Not JSON, don't cache
       }
    } else if (mutationDomain) {
       // Post-invalidate cache after mutation finishes and broadcast real-time sync event
       invalidateCacheForAction(action);
       try {
         const parsed = JSON.parse(text);
         if (!parsed || parsed.status !== 'error') {
           broadcastSyncEvent({
             type: 'sync:update',
             action,
             domain: mutationDomain,
             clientId: clientId || null,
             ts: Date.now()
           });
         }
       } catch (e) {
         broadcastSyncEvent({
           type: 'sync:update',
           action,
           domain: mutationDomain,
           clientId: clientId || null,
           ts: Date.now()
         });
       }
    }
    
    if (action === 'fetchReceipts') {
      try {
        const parsed = JSON.parse(text);
        if (parsed && (parsed.receipts || Array.isArray(parsed.receipts))) {
          parsed.receipts = mergeReceiptsWithOverrides(parsed.receipts || [], loadReceiptOverrides());
          return res.json(parsed);
        } else if (parsed && parsed.status === 'error') {
          // If GAS threw error, fallback to overrides
          return res.json({ status: 'success', receipts: mergeReceiptsWithOverrides([], loadReceiptOverrides()) });
        }
      } catch (e) {
        return res.json({ status: 'success', receipts: mergeReceiptsWithOverrides([], loadReceiptOverrides()) });
      }
    }

    if (action === 'getSettings') {
      try {
        const parsed = JSON.parse(text);
        return res.json(mergeSettingsWithTripFiles(parsed));
      } catch (e) {
        return res.json(mergeSettingsWithTripFiles({ status: 'success' }));
      }
    }

    res.send(text);
  } catch (error) {
    console.error('Proxy fetch error:', error);
    if (action === 'fetchReceipts') {
      return res.json({ status: 'success', receipts: mergeReceiptsWithOverrides([], loadReceiptOverrides()) });
    }
    res.status(500).json({ status: 'error', message: 'Proxy server error' });
  } finally {
    activeRequests.delete(requestKey);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});

