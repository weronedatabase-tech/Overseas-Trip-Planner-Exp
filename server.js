import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = 3000;

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const OVERRIDES_FILE = path.join(DATA_DIR, 'receipts_overrides.json');

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
  Object.values(overrides).forEach(ov => {
    if (map.has(ov.id)) {
      map.set(ov.id, { ...map.get(ov.id), ...ov });
    } else {
      map.set(ov.id, { ...ov });
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

function invalidateReceiptsCache() {
  for (const key of cache.keys()) {
    if (key.startsWith('fetchReceipts')) {
      cache.delete(key);
    }
  }
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
  const { action, payload, API_URL } = req.body;
  
  if (!API_URL) {
    return res.status(400).json({ status: 'error', message: 'API_URL not provided' });
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

    const merged = mergeReceiptsWithOverrides(gasReceipts, overrides);
    return res.json({ status: 'success', receipts: merged });
  }

  if (action === 'uploadReceipt') {
    invalidateReceiptsCache();
    const p = (payload && payload.payload) ? payload.payload : (payload || {});
    const overrides = loadReceiptOverrides();
    const newId = "rec_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);

    let fileUrl = "";
    if (p.fileData) {
      try {
        const safeName = (p.fileName || 'receipt.jpg').replace(/[^a-zA-Z0-9.-]/g, '_');
        const storedName = `${Date.now()}_${safeName}`;
        const filePath = path.join(UPLOADS_DIR, storedName);
        fs.writeFileSync(filePath, Buffer.from(p.fileData, 'base64'));
        fileUrl = `/uploads/${storedName}`;
      } catch (err) {
        console.warn('Local file write error:', err);
      }
    }

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
      fileUrl: fileUrl,
      isDeleted: false,
      isReimbursed: false,
    };
    saveReceiptOverrides(overrides);

    let gasReceipts = [];
    try {
      const fetchResponse = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'uploadReceipt', payload: p }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow'
      });
      const gasData = await fetchResponse.json();
      if (gasData && gasData.receipts) gasReceipts = gasData.receipts;
    } catch (e) {
      console.warn('GAS uploadReceipt warning:', e.message);
    }

    const merged = mergeReceiptsWithOverrides(gasReceipts, overrides);
    return res.json({ status: 'success', receipts: merged, receiptId: newId });
  }

  const cacheKey = action + JSON.stringify(payload || {});
  
  if (CACHEABLE_ACTIONS.includes(action)) {
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
       return res.send(responseData);
    }
  }

  // Request coalescing for identical API_URL and cacheKey
  const requestKey = API_URL + cacheKey;
  
  if (activeRequests.has(requestKey)) {
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

  activeRequests.set(requestKey, fetchPromise);

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

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});

