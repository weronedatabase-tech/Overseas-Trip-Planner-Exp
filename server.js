import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const port = 3000;

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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

app.post('/api/upload-file', async (req, res) => {
  try {
    const { fileName, mimeType, fileData, API_URL } = req.body;
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
        const driveRes = await fetch(API_URL, {
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
  let { action, payload, API_URL, clientId } = req.body;
  if (!API_URL) {
    API_URL = 'https://script.google.com/macros/s/AKfycbw7ZFsUb_24YlMNIDumzE2wNxIVl_yVLNFMFqQXArtEi79Wze11yiOrtRFhHC9D3SJv/exec';
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

