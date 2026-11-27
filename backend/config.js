// ==========================================
// config.js - Application Configuration (SHARED)
// ==========================================
const ENV = 'Exp';

// ENVIRONMENT API ENDPOINTS (Google Apps Script Durable Backend)
const EXP_URL = 'https://script.google.com/macros/s/AKfycbw7ZFsUb_24YlMNIDumzE2wNxIVl_yVLNFMFqQXArtEi79Wze11yiOrtRFhHC9D3SJv/exec';
const DEV_URL = 'https://script.google.com/macros/s/AKfycby48gbzI_4V0TEJ0Gra4Qb_J3xywBA6A792d2reGx0QWUx-6QFEKRWBTmr8mGG86osg/exec';
const PROD_URL = 'https://script.google.com/macros/s/AKfycbz4OLZtR2lX97MrGZVaNg13Lrzvwgy7mBfQr7PgoQGK617sL8ZCkKvZD2hIZodus-O_/exec';
const API_URL = ENV === 'Exp' ? EXP_URL : (ENV === 'Dev' ? DEV_URL : PROD_URL);
const GAS_BACKEND_URL = API_URL;

// PERSISTENT NODE.JS WEBSOCKET & IN-MEMORY CACHE SERVER URLS
// Used by GitHub Pages (cross-origin) to get <50ms WebSocket push + 0ms cached reads + background GAS write queue.
// When served directly by server.js (e.g. Cloud Run / AI Studio / localhost), same-origin /api & ws(s):// are auto-detected.
// Set each URL once deployed (e.g. 'https://overseas-trip-exp-xxxx.run.app'); leave '' to fall back to direct GAS.
const EXP_REALTIME_URL = '';
const DEV_REALTIME_URL = '';
const PROD_REALTIME_URL = '';
const REALTIME_SERVER_URL = ENV === 'Exp' ? EXP_REALTIME_URL : (ENV === 'Dev' ? DEV_REALTIME_URL : PROD_REALTIME_URL);

// ENVIRONMENT Google Drive Folders
const EXP_Drive_Folder_ID = '1j76RcNGRkbMGq6nkyiGOOGGtv5PkzhGW';
const DEV_Drive_Folder_ID = '162ZkzByQajQ-EE8OAoV76-VG5VXBX2BO';
const PROD_Drive_Folder_ID = '1ROD8FT46w5vpbZdWBGxTL59hSOKHIKH-';
const Drive_Folder_ID = ENV === 'Exp' ? EXP_Drive_Folder_ID : (ENV === 'Dev' ? DEV_Drive_Folder_ID : PROD_Drive_Folder_ID);

// ENVIRONMENT Google Sheet (Fallback)
const EXP_Sheet_ID = '1rbHQfYfTqIn1cCQ43zm0uJ3nIF6HaVWgBB58fK4WsNA';
const DEV_Sheet_ID = '13CzgUly1RuOp1BmrxG53bj9A0oHKP6vvrVWd_GNSPdg';
const PROD_Sheet_ID = '1rddr_0oqw9qtYllP4pTZ1ottrrSOrjQ0eczn83S3z4A';
const Fallback_Sheet_ID = ENV === 'Exp' ? EXP_Sheet_ID : (ENV === 'Dev' ? DEV_Sheet_ID : PROD_Sheet_ID);