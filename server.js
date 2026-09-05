import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = 3000;

app.use(express.static(__dirname));
app.use(express.json({ limit: '50mb' }));

// Simple in-memory cache
const cache = new Map();
// Active requests cache to prevent duplicate concurrent network calls
const activeRequests = new Map();

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

app.post('/api', async (req, res) => {
  const { action, payload, API_URL } = req.body;
  
  if (!API_URL) {
    return res.status(400).json({ status: 'error', message: 'API_URL not provided' });
  }

  const cacheKey = action + JSON.stringify(payload || {});
  
  if (CACHEABLE_ACTIONS.includes(action)) {
    const cached = cache.get(cacheKey);
    // Cache for 10 seconds to combine concurrent requests across clients
    if (cached && (Date.now() - cached.timestamp < 10000)) { 
       return res.send(cached.data);
    }
  }

  // Request coalescing for identical API_URL and cacheKey
  const requestKey = API_URL + cacheKey;
  
  if (activeRequests.has(requestKey)) {
    try {
      const text = await activeRequests.get(requestKey);
      return res.send(text);
    } catch (error) {
      // If the shared promise rejected, we fall through and might try again 
      // or just return an error, but let's just let it fall through for now
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
       // Only cache if it isn't an error
       try {
           const parsed = JSON.parse(text);
           if (parsed.status !== 'error') {
               cache.set(cacheKey, { timestamp: Date.now(), data: text });
           }
       } catch (e) {
           // Not JSON, don't cache
       }
    }
    
    res.send(text);
  } catch (error) {
    console.error('Proxy fetch error:', error);
    res.status(500).json({ status: 'error', message: 'Proxy server error' });
  } finally {
    activeRequests.delete(requestKey);
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});