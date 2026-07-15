// ==========================================
// config.js - Application Configuration (SHARED)
// ==========================================
// This file is used by both the Google Apps Script backend and the GitHub Pages frontend.
// Change the ENV variable below to switch environments across the entire app.

// ENVIRONMENT TOGGLE
// Options: 'Exp' (Experimental) | 'Dev' (Development) | 'Prod' (Production)
const ENV = 'Dev';

// ENVIRONMENT API ENDPOINTS (Google Apps Script Web App URLs)
const EXP_URL = 'https://script.google.com/macros/s/AKfycbw7ZFsUb_24YlMNIDumzE2wNxIVl_yVLNFMFqQXArtEi79Wze11yiOrtRFhHC9D3SJv/exec';
const DEV_URL = 'https://script.google.com/macros/s/AKfycby48gbzI_4V0TEJ0Gra4Qb_J3xywBA6A792d2reGx0QWUx-6QFEKRWBTmr8mGG86osg/exec';
const PROD_URL = 'https://script.google.com/macros/s/AKfycbz4OLZtR2lX97MrGZVaNg13Lrzvwgy7mBfQr7PgoQGK617sL8ZCkKvZD2hIZodus-O_/exec';
const API_URL = ENV === 'Exp' ? EXP_URL : (ENV === 'Dev' ? DEV_URL : PROD_URL);

// ENVIRONMENT Google Drive Folders (Google Drive Folder IDs)
const EXP_Drive_Folder_ID = '1j76RcNGRkbMGq6nkyiGOOGGtv5PkzhGW';
const DEV_Drive_Folder_ID = '162ZkzByQajQ-EE8OAoV76-VG5VXBX2BO';
const PROD_Drive_Folder_ID = '1ROD8FT46w5vpbZdWBGxTL59hSOKHIKH-';
const Drive_Folder_ID = ENV === 'Exp' ? EXP_Drive_Folder_ID : (ENV === 'Dev' ? DEV_Drive_Folder_ID : PROD_Drive_Folder_ID);

// ENVIRONMENT Google Sheet (Google Sheet IDs)
const EXP_Sheet_ID = '1rbHQfYfTqIn1cCQ43zm0uJ3nIF6HaVWgBB58fK4WsNA';
const DEV_Sheet_ID = '13CzgUly1RuOp1BmrxG53bj9A0oHKP6vvrVWd_GNSPdg';
const PROD_Sheet_ID = '1rddr_0oqw9qtYllP4pTZ1ottrrSOrjQ0eczn83S3z4A';
const Sheet_ID = ENV === 'Exp' ? EXP_Sheet_ID : (ENV === 'Dev' ? DEV_Sheet_ID : PROD_Sheet_ID);
