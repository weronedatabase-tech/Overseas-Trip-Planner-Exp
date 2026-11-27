/* OVERSEAS TRIP APP BACKEND - Code.gs (MPA Architecture with Atomic Write-Through Caching) */

// ==========================================
// SYSTEM & CRON SETUP 
// ==========================================
function setupProject() {
const props = PropertiesService.getScriptProperties();
if(!props.getProperty('PASS_GENERAL')) {
  const genPwd = Utilities.getUuid().replace(/-/g, '').substring(0, 12);
  props.setProperty('PASS_GENERAL', genPwd);
  console.log('Generated initial PASS_GENERAL (change in Script Properties): ' + genPwd);
}
if(!props.getProperty('PASS_ADMIN')) {
  const admPwd = Utilities.getUuid().replace(/-/g, '').substring(0, 16);
  props.setProperty('PASS_ADMIN', admPwd);
  console.log('Generated initial PASS_ADMIN (change in Script Properties): ' + admPwd);
}
getAuthSecret();
if(!props.getProperty('REGISTRATION_OPEN')) props.setProperty('REGISTRATION_OPEN', 'false');
if(!props.getProperty('ALLOW_EDITS')) props.setProperty('ALLOW_EDITS', 'false');

DriveApp.getRootFolder(); // Triggers Drive permissions
try {
DocumentApp.create('Auth Setup').setTrashed(true);
SpreadsheetApp.create('Auth Setup').setTrashed(true);
SlidesApp.create('Auth Setup').setTrashed(true);
} catch(e) {}
setupCron();
console.log(`Safe setup complete for ${ENV} environment.`);
}

// ==========================================
// AUTHENTICATION & TOKEN HELPERS (HMAC-SHA256)
// ==========================================
const AUTH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getAuthSecret() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('AUTH_SECRET');
  if (!secret) {
    const raw = Utilities.getUuid() + ':' + Utilities.getUuid() + ':' + Date.now();
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
    secret = Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '');
    props.setProperty('AUTH_SECRET', secret);
  }
  return secret;
}

function base64UrlEncodeStr(str) {
  return Utilities.base64EncodeWebSafe(Utilities.newBlob(str).getBytes()).replace(/=+$/, '');
}

function base64UrlDecodeStr(b64) {
  let padded = String(b64 || '').replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4 !== 0) padded += '=';
  return Utilities.newBlob(Utilities.base64Decode(padded)).getDataAsString();
}

function constantTimeEquals(a, b) {
  const sa = String(a || '');
  const sb = String(b || '');
  if (sa.length !== sb.length) return false;
  let diff = 0;
  for (let i = 0; i < sa.length; i++) {
    diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
  }
  return diff === 0;
}

function createAuthToken(userObj) {
  const now = Date.now();
  const payload = {
    nric: String(userObj.nric || '').trim().toUpperCase(),
    role: String(userObj.role || 'user'),
    name: String(userObj.name || ''),
    isMainAdmin: Boolean(userObj.isMainAdmin || String(userObj.nric || '').trim().toUpperCase() === 'ADMIN'),
    iat: now,
    exp: now + AUTH_TOKEN_TTL_MS
  };
  const payloadB64 = base64UrlEncodeStr(JSON.stringify(payload));
  const sigBytes = Utilities.computeHmacSha256Signature(payloadB64, getAuthSecret());
  const sigB64 = Utilities.base64EncodeWebSafe(sigBytes).replace(/=+$/, '');
  return payloadB64 + '.' + sigB64;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const payloadB64 = parts[0];
  const sigB64 = parts[1];
  try {
    const expectedBytes = Utilities.computeHmacSha256Signature(payloadB64, getAuthSecret());
    const expectedB64 = Utilities.base64EncodeWebSafe(expectedBytes).replace(/=+$/, '');
    if (!constantTimeEquals(sigB64, expectedB64)) return null;
    const payload = JSON.parse(base64UrlDecodeStr(payloadB64));
    if (!payload || !payload.nric || !payload.exp || Date.now() > payload.exp) return null;
    // Re-verify committee admin membership if not main admin
    if (payload.role === 'admin' && !payload.isMainAdmin) {
      const props = PropertiesService.getScriptProperties();
      const committeeList = JSON.parse(props.getProperty('COMMITTEE_LIST') || '[]');
      const stillCommittee = committeeList.some(c => String(c.nric || '').trim().toUpperCase() === payload.nric);
      if (!stillCommittee) return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

function requireAuth(auth, level) {
  if (!auth) throw new Error('AUTH_REQUIRED: Session expired or unauthorized. Please log in again.');
  if (level === 'admin' && auth.role !== 'admin') {
    throw new Error('FORBIDDEN: Admin access required.');
  }
  if (level === 'main_admin' && (!auth.isMainAdmin || auth.role !== 'admin')) {
    throw new Error('FORBIDDEN: Main Admin access required.');
  }
  return auth;
}

function getUserFamilyContext(userNric) {
  const cleanNric = String(userNric || '').trim().toUpperCase();
  const roster = fetchAdminRoster().roster || [];
  const self = roster.find(r => r.nric === cleanNric) || null;
  if (!self) return { self: null, pocNric: cleanNric, familyNrics: new Set([cleanNric]), groupMembersNrics: new Set() };
  const pocNric = self.pocNric || self.nric;
  const familyNrics = new Set();
  roster.forEach(r => {
    if ((r.pocNric || r.nric) === pocNric || r.nric === cleanNric) {
      familyNrics.add(r.nric);
    }
  });
  const groupMembersNrics = new Set();
  if (self.isGroupIC && self.logisticsGroup) {
    const myGrp = String(self.logisticsGroup).trim();
    roster.forEach(r => {
      if (String(r.logisticsGroup || '').trim() === myGrp) {
        groupMembersNrics.add(r.nric);
      }
    });
  }
  return { self, pocNric, familyNrics, groupMembersNrics };
}

function factoryResetSettings() {
const props = PropertiesService.getScriptProperties();
['COMMITTEE_LIST', 'PROJECT_GROUPS', 'PROJECT_COLORS', 'ATTENDANCE_JUNCTURES', 'SORTING_RULES', 'APP_GRANTED_ACCESS'].forEach(k => props.deleteProperty(k));
console.log("Settings wiped.");
}

function setupCron() {
ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
ScriptApp.newTrigger('precomputeAppCache').timeBased().everyMinutes(15).create();
precomputeAppCache();
}

function precomputeAppCache() {
try { fetchLogistics(true); } catch(e){}
try { fetchAdminRoster(true); } catch(e){}
try { fetchFinance(true); } catch(e){}
try { fetchReceipts(true); } catch(e){}
try { fetchMinutes(true); } catch(e){}
try { fetchPairingsOnly(true); } catch(e){}
try { fetchRoomsOnly(true); } catch(e){}
try {
const juncList = PropertiesService.getScriptProperties().getProperty('ATTENDANCE_JUNCTURES');
if(juncList) JSON.parse(juncList).forEach(j => fetchAttendanceData(j, true));
} catch(e){}
}

// ==========================================
// CACHING & DATABASE HELPERS
// ==========================================
let ACTIVE_ARCHIVE_SHEET_ID = null;
let ACTIVE_ARCHIVE_FOLDER_ID = null;
let ACTIVE_ARCHIVE_META = null;

function getDbId() {
if (ACTIVE_ARCHIVE_SHEET_ID) return ACTIVE_ARCHIVE_SHEET_ID;
return PropertiesService.getScriptProperties().getProperty('DB_SHEET_ID') || Fallback_Sheet_ID;
}

function getDatabase() {
const dbId = getDbId();
if (!dbId) throw new Error("No active trip database found. Admin must Open Registration first.");
return SpreadsheetApp.openById(dbId);
}

function getCacheKey(type) {
return type + "_v2_" + getDbId();
}

function putLargeCache(cacheKey, jsonStr) {
removeLargeCache(cacheKey);
const cache = CacheService.getScriptCache();
try {
if (jsonStr.length < 90000) {
cache.put(cacheKey, jsonStr, 21600); // 6 hours
} else {
const chunks = [];
let i = 0;
while (i < jsonStr.length) {
  chunks.push(jsonStr.substring(i, i + 90000));
  i += 90000;
}
cache.put(cacheKey + "_count", chunks.length.toString(), 21600);
const dict = {};
for (let j = 0; j < chunks.length; j++) dict[cacheKey + "_" + j] = chunks[j];
cache.putAll(dict, 21600);
}
} catch(e) { console.error("Cache Put Error:", e); }
}


function removeLargeCache(cacheKey) {
  const cache = CacheService.getScriptCache();
  try {
    cache.remove(cacheKey);
    const countStr = cache.get(cacheKey + "_count");
    if (countStr) {
      const count = parseInt(countStr);
      const keys = [cacheKey + "_count"];
      for (let i = 0; i < count; i++) keys.push(cacheKey + "_" + i);
      cache.removeAll(keys);
    }
  } catch(e) {}
}
function getLargeCache(cacheKey) {
const cache = CacheService.getScriptCache();
try {
const single = cache.get(cacheKey);
if (single) return single;

const countStr = cache.get(cacheKey + "_count");
if (countStr) {
const count = parseInt(countStr);
const keys = [];
for (let i = 0; i < count; i++) keys.push(cacheKey + "_" + i);
const dict = cache.getAll(keys);
let fullStr = "";
for (let i = 0; i < count; i++) {
  if (!dict[keys[i]]) return null;
  fullStr += dict[keys[i]];
}
return fullStr;
}
} catch(e) { console.error("Cache Get Error:", e); }
return null;
}

// Atomic patch helper for Arrays
function patchCacheList(cacheKey, listKey, updates, matchFn) {
const str = getLargeCache(cacheKey);
if(!str) return false;
try {
const data = JSON.parse(str);
if(!data[listKey]) data[listKey] = [];
updates.forEach(u => {
const existing = data[listKey].find(x => matchFn(x, u));
if(existing) {
  if(u.ts > (existing.ts||0)) Object.assign(existing, u);
} else {
  data[listKey].push(u);
}
});
putLargeCache(cacheKey, JSON.stringify(data));
return true;
} catch(e) { return false; }
}

// ==========================================
// API ROUTER
// ==========================================
function setupSheets(ss) {
const requiredSheets =["Raw Data", "Finance Options", "Receipts", "Rooms", "Pairings", "Attendance", "Minutes"];
requiredSheets.forEach(name => {
if (!ss.getSheetByName(name)) {
let sheet = ss.insertSheet(name);
if (name === "Raw Data") {
  sheet.appendRow(["Timestamp", "Email address", "Trainee / Volunteer / Caregiver", "Full Name (As stated in your Passport)", "Related Trainees' Name(s)", "Relationship with Trainee(s)", "Which project do you belong to?", "Gender", "Contact Number", "Home Address", "Nationality", "FULL NRIC / FIN", "Passport No.", "Passport Expiry Date", "Date of Birth", "Any dietary restrictions?", "Emergency Contact Name", "Emergency Contact Number", "Relationship with Emergency Contact", "Any sleeping arrangement request?", "Other Points to Note", "Family POC NRIC", "Short Name / Nickname", "Medical Conditions and Medications to take note of"]);
  sheet.setFrozenRows(1);
} else if (name === "Finance Options") {
  sheet.appendRow(["JSON Data - Do Not Edit"]);
  sheet.appendRow([""]);
  ensureFinanceRatesSheetRows(sheet);
} else if (name === "Receipts") {
  sheet.appendRow(["Receipt ID", "Timestamp", "Uploader NRIC", "Currency", "Amount", "Rate", "SGD Amount", "Category ID", "File URL", "Remarks", "Is Deleted", "Paid By NRIC", "Is Reimbursed", "Uploader Name"]);
  sheet.setFrozenRows(1);
} else if (name === "Rooms") {
  sheet.appendRow(["Room ID", "Room Name", "Capacity", "Occupants", "Last Updated", "Updated By", "Is Deleted"]);
  sheet.setFrozenRows(1);
} else if (name === "Attendance") {
  sheet.appendRow(["Juncture", "NRIC", "Status", "Last Updated", "Updated By"]);
  sheet.setFrozenRows(1);
} else if (name === "Pairings") {
  sheet.appendRow(["Trainee NRIC", "Volunteer NRIC", "Status", "Last Updated", "Updated By"]);
  sheet.setFrozenRows(1);
} else if (name === "Minutes") {
  sheet.appendRow(["Note ID", "Meeting Date", "Content", "Assigned To", "Last Updated", "Updated By", "Is Deleted"]);
  sheet.setFrozenRows(1);
}
}
});
const defaultSheet = ss.getSheetByName("Sheet1");
if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', service: 'Overseas Trip Planner API' })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
ACTIVE_ARCHIVE_SHEET_ID = null;
ACTIVE_ARCHIVE_FOLDER_ID = null;
ACTIVE_ARCHIVE_META = null;
try {
const data = JSON.parse(e.postData.contents);
const auth = verifyAuthToken(data.authToken);
const READONLY_ARCHIVE_ACTIONS = [
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
];
if (data.archiveId || data.archiveSheetId) {
  requireAuth(auth, 'admin');
  if (READONLY_ARCHIVE_ACTIONS.indexOf(data.action) === -1) {
    throw new Error("Archived trips are read-only and cannot be modified.");
  }
  const archives = loadArchivedTripsRegistry();
  const cleanArchId = String(data.archiveId || '').trim();
  const found = archives.find(a => cleanArchId && String(a.id || '').trim() === cleanArchId);
  if (!found || !found.sheetId) {
    throw new Error("Archived trip not found.");
  }
  ACTIVE_ARCHIVE_META = found;
  ACTIVE_ARCHIVE_SHEET_ID = found.sheetId;
  ACTIVE_ARCHIVE_FOLDER_ID = found.folderId || null;
}
let result = {};
switch(data.action) {
case 'listArchivedTrips':
  requireAuth(auth, 'admin');
  result = listArchivedTrips();
  break;
case 'getArchivedTripMeta':
  requireAuth(auth, 'admin');
  result = getArchivedTripMeta(data.archiveId);
  break;
case 'getSettings':
  result = getAppConfig(auth);
  break;
case 'login':
  result = handleLogin(data.password, data.nric);
  break;
case 'getProfile':
  requireAuth(auth, 'user');
  result = getProfile(data.nric, auth);
  break;
case 'updateProfile':
  requireAuth(auth, 'user');
  result = updateProfile(data.member, false, auth);
  break;
case 'submitRegistration':
  result = submitRegistration(data.payload);
  break;
case 'getPublicTrainees':
  if (!auth && PropertiesService.getScriptProperties().getProperty('REGISTRATION_OPEN') !== 'true') {
    throw new Error('Registration is closed.');
  }
  result = getPublicTrainees();
  break;
case 'checkDuplicateParticipant':
  if (!auth && PropertiesService.getScriptProperties().getProperty('REGISTRATION_OPEN') !== 'true') {
    throw new Error('Registration is closed.');
  }
  result = checkDuplicateParticipant(data.nric, data.passport);
  break;
case 'toggleRegistration':
  requireAuth(auth, 'admin');
  result = toggleRegistration(data.status, data.tripTitle, data.tripYear, data.tripStart, data.tripEnd);
  break;
case 'toggleEdits':
  requireAuth(auth, 'admin');
  result = toggleEdits(data.status);
  break;
case 'getCommittee':
  requireAuth(auth, 'admin');
  result = getCommitteeList();
  break;
case 'addCommittee':
  requireAuth(auth, 'admin');
  result = modifyCommitteeList(data.nric, true, data.name, data.phone);
  break;
case 'removeCommittee':
  requireAuth(auth, 'admin');
  result = modifyCommitteeList(data.nric, false);
  break;
case 'addHelpline':
  requireAuth(auth, 'admin');
  result = modifyHelplineContacts(data.id, true, data.name, data.phone);
  break;
case 'removeHelpline':
  requireAuth(auth, 'admin');
  result = modifyHelplineContacts(data.id, false);
  break;
case 'addProjectGroup':
  requireAuth(auth, 'main_admin');
  result = modifyProjectGroups(data.groupName, true, auth, data.colorClass);
  break;
case 'removeProjectGroup':
  requireAuth(auth, 'main_admin');
  result = modifyProjectGroups(data.groupName, false, auth);
  break;
case 'modifyJunctures':
  requireAuth(auth, 'admin');
  result = modifyJunctures(data.actionType, data.oldName, data.newName);
  break;
case 'modifyICJunctures':
  requireAuth(auth, 'user');
  result = modifyICJunctures(data.actionType, data.oldName, data.newName, data.groupName, auth);
  break;
case 'saveSortingRules':
  requireAuth(auth, 'admin');
  result = saveSortingRules(data.rules);
  break;
case 'saveCustomViewsOrder':
  requireAuth(auth, 'admin');
  result = saveCustomViewsOrder(data.order);
  break;
case 'saveTripSettings':
  requireAuth(auth, 'admin');
  result = saveTripSettings(data.title, data.year, data.start, data.end);
  break;
case 'clearCache':
  requireAuth(auth, 'admin');
  result = clearGlobalCache();
  break;
case 'fetchAdminRoster':
  requireAuth(auth, 'admin');
  result = fetchAdminRoster(Boolean(data.force || data.forceRebuild));
  break;
case 'adminUpdateParticipant':
  requireAuth(auth, 'admin');
  result = updateProfile(data.member, true, auth);
  break;
case 'deleteParticipant':
  requireAuth(auth, 'admin');
  result = deleteParticipant(data.nric);
  break;
case 'addDriveAccess':
  requireAuth(auth, 'main_admin');
  result = addDriveAccess(data.email, data.role);
  break;
case 'removeDriveAccess':
  requireAuth(auth, 'main_admin');
  result = removeDriveAccess(data.email);
  break;
case 'massDriveAccess':
  requireAuth(auth, 'main_admin');
  result = massDriveAccess(data.actionType, data.emails, data.role);
  break;
case 'getDriveContents':
  requireAuth(auth, 'admin');
  result = getDriveContents(data.folderId);
  break;
case 'uploadDriveFile':
  requireAuth(auth, 'admin');
  result = uploadDriveFile(data.folderId, data.fileName, data.mimeType, data.fileData);
  break;
case 'createDriveFolder':
  requireAuth(auth, 'admin');
  result = createDriveFolder(data.parentFolderId, data.folderName);
  break;
case 'createGoogleDoc':
  requireAuth(auth, 'admin');
  result = createGoogleDoc(data.folderId, data.fileName, data.docType);
  break;
case 'renameDriveItem':
  requireAuth(auth, 'admin');
  result = renameDriveItem(data.itemId, data.isFolder, data.newName, data.currentFolderId);
  break;
case 'deleteDriveItem':
  requireAuth(auth, 'admin');
  result = deleteDriveItem(data.itemId, data.isFolder, data.currentFolderId);
  break;
case 'bulkDriveOperation':
  requireAuth(auth, 'admin');
  result = bulkDriveOperation(data.actionType, data.items, data.targetFolderId, data.singleNewName);
  break;
case 'fetchLogistics':
  requireAuth(auth, 'user');
  result = fetchLogisticsScoped(auth, Boolean(data.force || data.forceRebuild));
  break;
case 'syncPairingUpdates':
  requireAuth(auth, 'admin');
  result = syncPairingUpdates(data.updates, auth.name || data.takenBy || 'Admin');
  break;
case 'extractData':
  requireAuth(auth, 'admin');
  result = extractData(data.extractType, data.excludedNrics, data.customConfig, data.folderId);
  break;
case 'fetchPairingsOnly':
  requireAuth(auth, 'admin');
  result = fetchPairingsOnly(Boolean(data.force || data.forceRebuild));
  break;
case 'syncRoomUpdates':
  requireAuth(auth, 'admin');
  result = syncRoomUpdates(data.updates, auth.name || data.takenBy || 'Admin');
  break;
case 'syncAssignments':
  requireAuth(auth, 'admin');
  result = syncAssignments(data.updates, data.column);
  break;
case 'fetchRoomsOnly':
  requireAuth(auth, 'admin');
  result = fetchRoomsOnly(Boolean(data.force || data.forceRebuild));
  break;
case 'fetchAttendanceData':
  requireAuth(auth, 'user');
  result = fetchAttendanceDataScoped(data.juncture, auth, Boolean(data.force || data.forceRebuild));
  break;
case 'syncAttendanceUpdate':
  requireAuth(auth, 'user');
  result = syncAttendanceUpdate(data.juncture, data.updates, auth.name || data.takenBy || 'System', auth);
  break;
case 'fetchFinance':
  result = fetchFinanceScoped(auth, Boolean(data.force || data.forceRebuild), Boolean(data.refreshRates));
  break;
case 'saveFinance':
  requireAuth(auth, 'admin');
  result = saveFinance(data.payload);
  break;
case 'fetchReceipts':
  requireAuth(auth, 'user');
  result = fetchReceiptsScoped(auth, Boolean(data.force || data.forceRebuild));
  break;
case 'uploadReceipt':
  result = uploadReceipt(data.payload, auth);
  break;
case 'syncReceipts':
  requireAuth(auth, 'user');
  result = syncReceipts(data.updates, auth);
  break;
case 'fetchMinutes':
  requireAuth(auth, 'admin');
  result = fetchMinutes(Boolean(data.force || data.forceRebuild));
  break;
case 'syncMinutes':
  requireAuth(auth, 'admin');
  result = syncMinutes(data.updates, auth.name || data.takenBy || 'Admin');
  break;
case 'setTripFile':
  requireAuth(auth, 'admin');
  result = setTripFile(data.fileType, data.fileId, data.fileName, data.fileUrl);
  break;
case 'archiveAndReset':
  requireAuth(auth, 'main_admin');
  result = archiveAndReset(data.newArchiveId, auth.name || data.archivedBy || 'Admin', data.driveAccessEmails, auth);
  break;
case 'deleteArchivedTrip':
  requireAuth(auth, 'main_admin');
  result = deleteArchivedTrip(data.targetArchiveId, data.targetSheetId, auth);
  break;
default: throw new Error("Unknown action.");
}
return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
} catch (error) {
return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message || error.toString() })).setMimeType(ContentService.MimeType.JSON);
} finally {
ACTIVE_ARCHIVE_SHEET_ID = null;
ACTIVE_ARCHIVE_FOLDER_ID = null;
ACTIVE_ARCHIVE_META = null;
}
}

// ==========================================
// CORE APP LOGIC
// ==========================================
function getAppConfig(auth) {
const props = PropertiesService.getScriptProperties();
const isAdmin = Boolean(auth && auth.role === 'admin');
const isLoggedIn = Boolean(auth);
let activeProjects = [];
try {
const dbId = getDbId();
if (dbId) {
const data = SpreadsheetApp.openById(dbId).getSheetByName("Raw Data").getDataRange().getValues();
const projSet = new Set();
for (let i = 1; i < data.length; i++) {
  let pName = String(data[i][6]).trim();
  if (pName) projSet.add(pName);
}
activeProjects = Array.from(projSet);
}
} catch(e) {}

if (ACTIVE_ARCHIVE_META) {
  return {
    status: 'success',
    isArchived: true,
    archiveId: ACTIVE_ARCHIVE_META.id,
    archivedAt: ACTIVE_ARCHIVE_META.archivedAt || '',
    registrationOpen: false,
    allowEdits: false,
    committee: isAdmin ? (ACTIVE_ARCHIVE_META.committee || []) : [],
    helpline: ACTIVE_ARCHIVE_META.helpline || [],
    projectGroups: ACTIVE_ARCHIVE_META.projectGroups || (props.getProperty('PROJECT_GROUPS') ? JSON.parse(props.getProperty('PROJECT_GROUPS')) : []),
    projectColors: ACTIVE_ARCHIVE_META.projectColors || (props.getProperty('PROJECT_COLORS') ? JSON.parse(props.getProperty('PROJECT_COLORS')) : {}),
    activeProjects: activeProjects,
    junctures: ACTIVE_ARCHIVE_META.junctures || ['Morning Assembly'],
    sortingRules: ACTIVE_ARCHIVE_META.sortingRules || ['project', 'family', 'role', 'name'],
    customViewsOrder: ACTIVE_ARCHIVE_META.customViewsOrder || ['reset_filter', 'medical.html', 'diet.html', 'expired.html', 'other.html'],
    driveAccessList: {},
    tripTitle: ACTIVE_ARCHIVE_META.tripTitle || '',
    tripYear: ACTIVE_ARCHIVE_META.tripYear || '',
    tripStartDate: ACTIVE_ARCHIVE_META.tripStartDate || '',
    tripEndDate: ACTIVE_ARCHIVE_META.tripEndDate || '',
    tripInfographicId: ACTIVE_ARCHIVE_META.tripInfographicId || '',
    tripInfographicName: ACTIVE_ARCHIVE_META.tripInfographicName || '',
    tripInfographicUrl: ACTIVE_ARCHIVE_META.tripInfographicUrl || '',
    tripInfoDocId: ACTIVE_ARCHIVE_META.tripInfoDocId || '',
    tripInfoDocName: ACTIVE_ARCHIVE_META.tripInfoDocName || '',
    tripInfoDocUrl: ACTIVE_ARCHIVE_META.tripInfoDocUrl || ''
  };
}

const rawCommittee = props.getProperty('COMMITTEE_LIST') ? JSON.parse(props.getProperty('COMMITTEE_LIST')) : [];
const safeCommittee = isAdmin
  ? rawCommittee
  : isLoggedIn
    ? rawCommittee.map(c => ({ name: c.name || '', phone: c.phone || '' }))
    : [];

return {
status: 'success', 
hasActiveTrip: Boolean(
  props.getProperty('DB_SHEET_ID') ||
  props.getProperty('REGISTRATION_OPEN') === 'true' ||
  (String(props.getProperty('TRIP_TITLE') || '').trim() &&
    String(props.getProperty('TRIP_YEAR') || '').trim())
),
registrationOpen: props.getProperty('REGISTRATION_OPEN') === 'true', 
allowEdits: props.getProperty('ALLOW_EDITS') === 'true',
committee: safeCommittee, 
helpline: props.getProperty('HELPLINE_CONTACTS') ? JSON.parse(props.getProperty('HELPLINE_CONTACTS')) : [],
projectGroups: props.getProperty('PROJECT_GROUPS') ? JSON.parse(props.getProperty('PROJECT_GROUPS')) : [], 
projectColors: props.getProperty('PROJECT_COLORS') ? JSON.parse(props.getProperty('PROJECT_COLORS')) : {}, 
activeProjects: activeProjects, 
junctures: props.getProperty('ATTENDANCE_JUNCTURES') ? JSON.parse(props.getProperty('ATTENDANCE_JUNCTURES')) : ['Morning Assembly'],
sortingRules: props.getProperty('SORTING_RULES') ? JSON.parse(props.getProperty('SORTING_RULES')) : ['project', 'family', 'role', 'name'],
customViewsOrder: props.getProperty('CUSTOM_VIEWS_ORDER') ? JSON.parse(props.getProperty('CUSTOM_VIEWS_ORDER')) : ['reset_filter', 'medical.html', 'diet.html', 'expired.html', 'other.html'],
driveAccessList: isAdmin && props.getProperty('APP_GRANTED_ACCESS') ? JSON.parse(props.getProperty('APP_GRANTED_ACCESS')) : {}, 
tripTitle: props.getProperty('TRIP_TITLE') || '', tripYear: props.getProperty('TRIP_YEAR') || '',
tripStartDate: props.getProperty('TRIP_START_DATE') || '', tripEndDate: props.getProperty('TRIP_END_DATE') || '',
tripInfographicId: props.getProperty('TRIP_INFOGRAPHIC_ID') || '',
tripInfographicName: props.getProperty('TRIP_INFOGRAPHIC_NAME') || '',
tripInfographicUrl: props.getProperty('TRIP_INFOGRAPHIC_URL') || '',
tripInfoDocId: props.getProperty('TRIP_INFODOC_ID') || '',
tripInfoDocName: props.getProperty('TRIP_INFODOC_NAME') || '',
tripInfoDocUrl: props.getProperty('TRIP_INFODOC_URL') || ''
};
}

function handleLogin(password, nric) {
const props = PropertiesService.getScriptProperties();
const adminPassPrefix = props.getProperty('PASS_ADMIN') || '';
const genPass = props.getProperty('PASS_GENERAL') || '';
password = String(password || '').trim();
nric = String(nric || '').trim().toUpperCase();

if (!password) return { status: 'error', message: 'Please enter a password.' };

if (adminPassPrefix && (password === adminPassPrefix || (nric === 'ADMIN' && password === adminPassPrefix))) {
 const userObj = { role: 'admin', name: 'MAIN ADMIN', nric: 'ADMIN', isMainAdmin: true };
 return { status: 'success', ...userObj, token: createAuthToken(userObj) };
}

const committeeList = props.getProperty('COMMITTEE_LIST') ? JSON.parse(props.getProperty('COMMITTEE_LIST')) : [];
if (adminPassPrefix && password.startsWith(adminPassPrefix) && password.length > adminPassPrefix.length) {
 const possibleNric = password.substring(adminPassPrefix.length).toUpperCase();
 const commMember = committeeList.find(c => String(c.nric || '').trim().toUpperCase() === possibleNric);
 if (commMember) {
   const userObj = { role: 'admin', name: commMember.name.toUpperCase(), nric: possibleNric, isMainAdmin: false };
   return { status: 'success', ...userObj, token: createAuthToken(userObj) };
 }
}

if (nric && adminPassPrefix) {
 const commMember = committeeList.find(c => String(c.nric || '').trim().toUpperCase() === nric);
 if (commMember && (password === adminPassPrefix || password === (adminPassPrefix + nric))) {
   const userObj = { role: 'admin', name: commMember.name.toUpperCase(), nric: nric, isMainAdmin: false };
   return { status: 'success', ...userObj, token: createAuthToken(userObj) };
 }
}

if (password.length >= 5) {
 const possibleYearStr = password.slice(-4);
 const possibleNric = password.slice(0, -4).toUpperCase();
 
 if (!isNaN(parseInt(possibleYearStr))) {
   const rosterRes = fetchAdminRoster();
   const data = rosterRes.roster;
   const user = data.find(r => r.nric === possibleNric);
   if (user) {
     let birthYear = '';
     if (user.dob) {
       const d = new Date(user.dob);
       if (!isNaN(d.getTime())) birthYear = d.getFullYear().toString();
       else {
          const m = String(user.dob).match(/\d{4}/);
          if (m) birthYear = m[0];
       }
     }
     if (birthYear && birthYear === possibleYearStr) {
       const userObj = { role: 'user', name: user.fullName, nric: possibleNric, isMainAdmin: false };
       return { status: 'success', ...userObj, token: createAuthToken(userObj) };
     }
     else return { status: 'error', message: 'Incorrect password.' };
   }
 }
}

if (nric) {
 const rosterRes = fetchAdminRoster();
 const data = rosterRes.roster;
 const user = data.find(r => r.nric === nric);
 if (user) {
   let birthYear = '';
   if (user.dob) {
     const d = new Date(user.dob);
     if (!isNaN(d.getTime())) birthYear = d.getFullYear().toString();
     else {
        const m = String(user.dob).match(/\d{4}/);
        if (m) birthYear = m[0];
     }
   }
   if ((genPass && password === genPass) || (birthYear && password === birthYear) || (birthYear && password === (nric + birthYear))) {
     const userObj = { role: 'user', name: user.fullName, nric: nric, isMainAdmin: false };
     return { status: 'success', ...userObj, token: createAuthToken(userObj) };
   } else {
     return { status: 'error', message: 'Incorrect password.' };
   }
 }
}

return { status: 'error', message: 'Invalid password or user not found.' };
}

function getProfile(nric, auth) {
const requestedNric = String(nric || '').trim().toUpperCase();
const isAdmin = Boolean(auth && auth.role === 'admin');
const rosterRes = fetchAdminRoster();
const data = rosterRes.roster;

let targetNric = requestedNric;
if (!isAdmin && auth) {
  const ctx = getUserFamilyContext(auth.nric);
  if (!ctx.familyNrics.has(requestedNric)) {
    // Allow non-admin to view limited contact card ONLY for paired volunteer/trainee or own logistics group
    const logistics = fetchLogistics();
    const allowedPaired = new Set();
    (logistics.pairings || []).filter(p => p.status === 'ACTIVE').forEach(p => {
      if (ctx.familyNrics.has(p.traineeNric)) allowedPaired.add(p.volNric);
      if (ctx.familyNrics.has(p.volNric)) allowedPaired.add(p.traineeNric);
    });
    if (!allowedPaired.has(requestedNric) && !ctx.groupMembersNrics.has(requestedNric)) {
      return { status: 'error', message: 'Unauthorized profile access.' };
    }
    const targetRec = data.find(r => r.nric === requestedNric);
    if (!targetRec) return { status: 'error', message: 'Profile not found.' };
    return {
      status: 'success',
      family: [{
        role: targetRec.role,
        fullName: targetRec.fullName,
        shortName: targetRec.shortName,
        nric: targetRec.nric,
        contact: targetRec.contact,
        gender: targetRec.gender,
        group: targetRec.group,
        logisticsGroup: targetRec.logisticsGroup,
        bus: targetRec.bus,
        isGroupIC: targetRec.isGroupIC
      }],
      groupMembers: [],
      logisticsGroup: targetRec.logisticsGroup || '',
      isGroupIC: false,
      icJunctures: []
    };
  }
  targetNric = requestedNric;
}

const currentUserRecord = data.find(r => r.nric === targetNric);
if (!currentUserRecord) return {status: 'error', message: 'Profile not found.'};

let family = [];
const targetPoc = currentUserRecord.pocNric || currentUserRecord.nric;

data.forEach(row => {
 const rowPoc = row.pocNric || row.nric;

 if (rowPoc === targetPoc) {
     let expRaw = row.passportExpiry;
     let dobRaw = row.dob;
     
     if (expRaw && typeof expRaw === 'string' && expRaw.includes('T')) {
         const d = new Date(expRaw);
         if(!isNaN(d.getTime())) expRaw = Utilities.formatDate(d, Session.getScriptTimeZone(), "dd MMM yyyy");
     }
     if (dobRaw && typeof dobRaw === 'string' && dobRaw.includes('T')) {
         const d = new Date(dobRaw);
         if(!isNaN(d.getTime())) dobRaw = Utilities.formatDate(d, Session.getScriptTimeZone(), "dd MMM yyyy");
     }
     
     family.push({
         email: row.email, role: row.role, fullName: row.fullName, relatedTrainee: row.relatedTrainee, relationship: row.relationship,
         group: row.group, gender: row.gender, contact: row.contact, address: row.address, nationality: row.nationality,
         nric: row.nric, passportNo: row.passportNo, passportExpiry: expRaw || row.passportExpiry, dob: dobRaw || row.dob, diet: row.diet,
         emergencyName: row.emergencyName, emergencyContact: row.emergencyContact, emergencyRelation: row.emergencyRelation, sleeping: row.sleeping, otherPoints: row.otherPoints,
         pocNric: row.pocNric, shortName: row.shortName, medical: row.medical,
         logisticsGroup: row.logisticsGroup, bus: row.bus, isGroupIC: row.isGroupIC
     });
 }
});

family.sort((a, b) => {
 if (a.nric === targetNric) return -1;
 if (b.nric === targetNric) return 1;
 return 0;
});

let groupMembers = []; let icJunctures = []; if (currentUserRecord.isGroupIC && currentUserRecord.logisticsGroup) { const myGrp = String(currentUserRecord.logisticsGroup).trim();
 const props = PropertiesService.getScriptProperties();
 icJunctures = JSON.parse(props.getProperty('IC_JUNCTURES_' + myGrp.replace(/\s+/g, '_').toUpperCase()) || '[]'); groupMembers = data.filter(r => String(r.logisticsGroup).trim() === myGrp).map(row => { let expRaw = row.passportExpiry; let dobRaw = row.dob; if (expRaw && typeof expRaw === 'string' && expRaw.includes('T')) { const d = new Date(expRaw); if(!isNaN(d.getTime())) expRaw = Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd MMM yyyy'); } if (dobRaw && typeof dobRaw === 'string' && dobRaw.includes('T')) { const d = new Date(dobRaw); if(!isNaN(d.getTime())) dobRaw = Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd MMM yyyy'); } return { role: row.role, fullName: row.fullName, shortName: row.shortName, nric: row.nric, contact: row.contact, emergencyName: row.emergencyName, emergencyContact: row.emergencyContact, emergencyRelation: row.emergencyRelation, diet: row.diet, medical: row.medical, otherPoints: row.otherPoints, logisticsGroup: row.logisticsGroup, bus: row.bus, isGroupIC: row.isGroupIC, pocNric: row.pocNric, group: row.group }; }); } return { status: 'success', family: family, groupMembers: groupMembers, logisticsGroup: currentUserRecord.logisticsGroup, isGroupIC: currentUserRecord.isGroupIC, icJunctures: icJunctures };
}

function updateProfile(member, isAdmin = false, auth = null) {
if (!member || !member.nric) return { status: 'error', message: 'Missing participant NRIC.' };
const props = PropertiesService.getScriptProperties();
if (!isAdmin && props.getProperty('ALLOW_EDITS') !== 'true') return { status: 'error', message: 'Editing locked.' };
if (!isAdmin && auth) {
  const ctx = getUserFamilyContext(auth.nric);
  const targetNric = String(member.nric || '').trim().toUpperCase();
  if (!ctx.familyNrics.has(targetNric)) {
    return { status: 'error', message: 'Unauthorized: you can only edit your own family members.' };
  }
}
const ss = getDatabase();
const sheet = ss.getSheetByName("Raw Data"); 

const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const data = sheet.getDataRange().getValues();

for (let i = 1; i < data.length; i++) {
if (String(data[i][11]).trim().toUpperCase() === String(member.nric || '').trim().toUpperCase()) {
  const rData = data[i];
  const effectiveRole = isAdmin ? (member.role || rData[2] || '') : (rData[2] || '');
  rData[1] = member.email || '';
  rData[2] = effectiveRole;
  rData[3] = member.fullName || '';
  rData[4] = member.relatedTrainee || '';
  rData[5] = member.relationship || '';
  rData[6] = member.group || '';
  rData[7] = member.gender || '';
  rData[8] = member.contact || '';
  rData[9] = member.address || '';
  rData[10] = member.nationality || '';
  rData[12] = member.passportNo || '';
  rData[13] = member.passportExpiry ? "'" + member.passportExpiry : '';
  rData[14] = member.dob ? "'" + member.dob : '';                      
  rData[15] = member.diet || '';
  rData[16] = member.emergencyName || '';
  rData[17] = member.emergencyContact || '';
  rData[18] = member.emergencyRelation || '';
  rData[19] = member.sleeping || '';
  rData[20] = member.otherPoints || '';
  rData[22] = member.shortName || '';
  
  if (member.medical !== undefined) rData[23] = member.medical || '';

  sheet.getRange(i+1, 1, 1, rData.length).setValues([rData]);
  
  // Write-Through: Invalidate dependent caches
  if (String(effectiveRole).trim().toUpperCase() === 'CAREGIVER') {
      const desiredNames = (member.relatedTrainee || '').split('|').map(n => n.trim().toLowerCase()).filter(n => n);
      const targetPoc = String(rData[21] || rData[11] || '').trim().toUpperCase();
      
      for (let j = 1; j < data.length; j++) {
          if (String(data[j][2]).trim().toUpperCase() === 'TRAINEE') {
              const jNric = String(data[j][11]).trim().toUpperCase();
              const jPoc = String(data[j][21] || data[j][11] || '').trim().toUpperCase();
              const jName = String(data[j][3] || '').replace(/\s+/g, '').toLowerCase();
              const jShort = String(data[j][22] || '').replace(/\s+/g, '').toLowerCase();
              
              const isDesired = desiredNames.some(d => d.includes(jName) || jName.includes(d) || (jShort && d.includes(jShort)));
              
              if (isDesired && jPoc !== targetPoc) {
                  data[j][21] = targetPoc;
                  sheet.getRange(j+1, 22).setValue(targetPoc);
              } else if (!isDesired && jPoc === targetPoc) {
                  data[j][21] = jNric;
                  sheet.getRange(j+1, 22).setValue(jNric);
              }
          }
      }
  }
  removeLargeCache(getCacheKey('ROSTER'));
  removeLargeCache(getCacheKey('LOGISTICS'));
  return { status: 'success' };
}
}
return { status: 'error', message: 'Record not found.' };
} catch(e) { return { status: 'error', message: e.message }; }
finally { lock.releaseLock(); }
}

function getPublicTrainees() {
const rosterRes = fetchAdminRoster();
const trainees = rosterRes.roster
   .filter(p => p.role === 'TRAINEE')
   .map(p => ({ name: p.fullName, fullName: p.fullName, shortName: p.shortName }));
return { status: 'success', trainees };
}

function submitRegistration(payloadArray) {
if (PropertiesService.getScriptProperties().getProperty('REGISTRATION_OPEN') !== 'true') return { status: 'error', message: 'Registration is closed.' };
const sheet = getDatabase().getSheetByName("Raw Data"); 

const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);

const data = sheet.getDataRange().getValues();
const existingNrics = new Set();
const existingPassports = new Set();
for (let i = 1; i < data.length; i++) {
  if (data[i][11]) existingNrics.add(String(data[i][11]).trim().toUpperCase());
  if (data[i][12]) existingPassports.add(String(data[i][12]).trim().toUpperCase());
}

const pocNric = payloadArray[0].nric.toUpperCase();
const newRows = [];

for (let p of payloadArray) {
  const pNric = String(p.nric).trim().toUpperCase();
  const pPassport = String(p.passportNo || '').trim().toUpperCase();
  if (existingNrics.has(pNric)) {
    return { status: 'error', message: `NRIC/FIN ${pNric} already exists. If you have already registered, login to make changes.` };
  }
  if (pPassport && existingPassports.has(pPassport)) {
    return { status: 'error', message: `Passport ${pPassport} already exists. If you have already registered, login to make changes.` };
  }
  existingNrics.add(pNric); if(pPassport) existingPassports.add(pPassport);
  newRows.push([
    new Date(), p.email||'', p.role||'', p.fullName||'', p.relatedTrainee||'', p.relationship||'', p.group||'', p.gender||'', p.contact||'', p.address||'', p.nationality||'',
    pNric, p.passportNo||'', p.passportExpiry ? "'" + p.passportExpiry : '', p.dob ? "'" + p.dob : '', p.diet||'',
    p.emergencyName||'', p.emergencyContact||'', p.emergencyRelation||'', p.sleeping||'', p.otherPoints||'', pocNric, p.shortName||'', p.medical||''
  ]);
}


if (newRows.length > 0) {
  sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  
  // Sync logic for Caregivers linking existing trainees during registration
  const data = sheet.getDataRange().getValues();
  for (let p of payloadArray) {
      if (p.role === 'CAREGIVER' && p.relatedTrainee) {
          const desiredNames = p.relatedTrainee.split('|').map(n => n.trim().toLowerCase()).filter(n => n);
          const targetPoc = pocNric; // pocNric was defined above
          
          for (let j = 1; j < data.length; j++) {
              if (String(data[j][2]).trim().toUpperCase() === 'TRAINEE') {
                  const jNric = String(data[j][11]).trim().toUpperCase();
                  const jPoc = String(data[j][21] || data[j][11] || '').trim().toUpperCase();
                  const jName = String(data[j][3] || '').replace(/\s+/g, '').toLowerCase();
                  const jShort = String(data[j][22] || '').replace(/\s+/g, '').toLowerCase();
                  
                  const isDesired = desiredNames.some(d => d.includes(jName) || jName.includes(d) || (jShort && d.includes(jShort)));
                  
                  if (isDesired && jPoc !== targetPoc) {
                      sheet.getRange(j+1, 22).setValue(targetPoc);
                  }
              }
          }
      }
  }

  removeLargeCache(getCacheKey('ROSTER'));
  removeLargeCache(getCacheKey('LOGISTICS'));
}

return { status: 'success' };
} catch(e) { return { status: 'error', message: e.message }; }
finally { lock.releaseLock(); }
}

function fetchAdminRoster(forceRebuild = false) {
const cacheKey = getCacheKey('ROSTER');
if(!forceRebuild) {
const cached = getLargeCache(cacheKey);
if(cached) return JSON.parse(cached);
}

const ss = getDatabase();
const sheet = ss.getSheetByName("Raw Data");
if(!sheet) return { status: 'success', roster: [] };

const data = sheet.getDataRange().getValues();
const results = [];
for(let i = 1; i < data.length; i++) {
if(data[i][11]) { 
results.push({
  timestamp: data[i][0] instanceof Date ? data[i][0].getTime() : data[i][0],
  email: String(data[i][1]||'').trim(), 
  role: String(data[i][2]||'').trim().toUpperCase(), 
  fullName: String(data[i][3]||'').trim().toUpperCase(), 
  relatedTrainee: String(data[i][4]||'').trim().toUpperCase(), 
  relationship: String(data[i][5]||'').trim(),
  group: String(data[i][6]||'').trim(), 
  gender: String(data[i][7]||'').trim(), 
  contact: String(data[i][8]||'').trim(), 
  address: String(data[i][9]||'').trim(), 
  nationality: String(data[i][10]||'').trim(),
  nric: String(data[i][11]||'').trim().toUpperCase(), 
  passportNo: String(data[i][12]||'').trim().toUpperCase(), 
  passportExpiry: data[i][13] instanceof Date ? data[i][13].toISOString() : String(data[i][13] || '').replace(/^'/, ''),
  dob: data[i][14] instanceof Date ? data[i][14].toISOString() : String(data[i][14] || '').replace(/^'/, ''),
  diet: String(data[i][15]||'').trim(), 
  emergencyName: String(data[i][16]||'').trim().toUpperCase(), 
  emergencyContact: String(data[i][17]||'').trim(), 
  emergencyRelation: String(data[i][18]||'').trim(),
  sleeping: String(data[i][19]||'').trim(), 
  otherPoints: String(data[i][20]||'').trim(), 
  pocNric: String(data[i][21]||data[i][11]||'').trim().toUpperCase(), 
  shortName: String(data[i][22]||'').trim().toUpperCase(),
  medical: String(data[i][23]||'').trim(),
  bus: String(data[i][24]||'').trim(),
  logisticsGroup: String(data[i][25]||'').trim(),
  isGroupIC: String(data[i][26]||'').trim().toLowerCase() === 'true'
});
}
}

  // Optimized In-memory self-healing of pocNric based on 'relatedTrainee' column (index 4)
  results.forEach(r => {
      r._normFullName = (r.fullName || '').replace(/\s+/g, '').toLowerCase();
      r._normShortName = (r.shortName || '').replace(/\s+/g, '').toLowerCase();
      if (r.role === 'CAREGIVER' && r.relatedTrainee) {
          r._normDesired = r.relatedTrainee.split('|').map(n => n.replace(/\s+/g, '').toLowerCase()).filter(n => n);
      }
  });

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 5) {
      changed = false;
      iterations++;
      results.forEach(r => {
          if (r.role === 'CAREGIVER' && r._normDesired && r._normDesired.length > 0) {
              const desiredNames = r._normDesired;
              results.forEach(j => {
                  if (j !== r) {
                      const isDesired = desiredNames.some(d => d.includes(j._normFullName) || j._normFullName.includes(d) || (j._normShortName && d.includes(j._normShortName)));
                      if (isDesired) {
                          const rPoc = r.pocNric || r.nric;
                          const jPoc = j.pocNric || j.nric;
                          if (rPoc !== jPoc) {
                              results.forEach(x => {
                                  if ((x.pocNric || x.nric) === jPoc) {
                                      x.pocNric = rPoc;
                                  }
                              });
                              changed = true;
                          }
                      }
                  }
              });
          }
      });
  }
  
  results.forEach(r => {
      delete r._normFullName;
      delete r._normShortName;
      delete r._normDesired;
  });

  results.forEach(r => {
      if (r.role === 'CAREGIVER') {
          const dependents = results.filter(x => x !== r && x.pocNric === r.pocNric && x.role === 'TRAINEE');
          if (dependents.length > 0) {
              r.relatedTrainee = dependents.map(d => `${d.fullName}${d.shortName ? ' (' + d.shortName + ')' : ''}`).join(' | ');
          }
      }
  });


  const res = { status: 'success', roster: results };
putLargeCache(cacheKey, JSON.stringify(res));
return res;
}

// ==========================================
// LOGISTICS & SYNC ENGINE
// ==========================================

function fetchLogistics(forceRebuild = false) {
const cacheKey = getCacheKey('LOGISTICS');
if(!forceRebuild) {
const cached = getLargeCache(cacheKey);
if(cached) return JSON.parse(cached);
}

// Reuse the fully healed roster
const rosterData = fetchAdminRoster(forceRebuild).roster;
const participants = rosterData.map(p => ({
  role: p.role,
  name: p.fullName,
  relatedTrainee: p.relatedTrainee,
  shortName: p.shortName,
  group: p.group,
  gender: p.gender,
  nric: p.nric,
  pocNric: p.pocNric,
  bus: p.bus,
  logisticsGroup: p.logisticsGroup,
  sleeping: p.sleeping,
  contact: p.contact,
  emergencyName: p.emergencyName,
  emergencyContact: p.emergencyContact,
  emergencyRelation: p.emergencyRelation,
  diet: p.diet,
  medical: p.medical,
  otherPoints: p.otherPoints,
  isGroupIC: p.isGroupIC
}));

const pairRes = fetchPairingsOnly(forceRebuild);

const roomRes = fetchRoomsOnly(forceRebuild);

const res = { status: 'success', participants, pairings: pairRes.pairings, rooms: roomRes.rooms, groups: [], buses:[] };
putLargeCache(cacheKey, JSON.stringify(res));
return res;
}

function fetchLogisticsScoped(auth, forceRebuild = false) {
  const full = fetchLogistics(forceRebuild);
  if (auth && auth.role === 'admin') return full;
  const ctx = getUserFamilyContext(auth ? auth.nric : '');
  const activePairings = (full.pairings || []).filter(p => p.status === 'ACTIVE');
  const allowedNrics = new Set([...ctx.familyNrics, ...ctx.groupMembersNrics]);

  // Add paired volunteers/trainees for the user's family
  activePairings.forEach(p => {
    if (ctx.familyNrics.has(p.traineeNric)) allowedNrics.add(p.volNric);
    if (ctx.familyNrics.has(p.volNric)) allowedNrics.add(p.traineeNric);
  });

  // Find rooms occupied by the user's family or paired trainees/volunteers
  const relevantRooms = (full.rooms || []).filter(r =>
    !r.isDeleted &&
    Array.isArray(r.occupants) &&
    r.occupants.some(n => allowedNrics.has(String(n || '').trim().toUpperCase()))
  );
  relevantRooms.forEach(r => {
    (r.occupants || []).forEach(n => allowedNrics.add(String(n || '').trim().toUpperCase()));
  });

  // Also include logistics group members if user has a logisticsGroup (for My Group view)
  const myGroup = ctx.self && ctx.self.logisticsGroup ? String(ctx.self.logisticsGroup).trim() : '';
  if (myGroup) {
    (full.participants || []).forEach(p => {
      if (String(p.logisticsGroup || '').trim() === myGroup) {
        allowedNrics.add(p.nric);
      }
    });
  }

  const scopedParticipants = (full.participants || [])
    .filter(p => allowedNrics.has(p.nric))
    .map(p => {
      const isFamilyOrIcGroup = ctx.familyNrics.has(p.nric) || ctx.groupMembersNrics.has(p.nric);
      return {
        role: p.role,
        name: p.name,
        relatedTrainee: p.relatedTrainee,
        shortName: p.shortName,
        group: p.group,
        gender: p.gender,
        nric: p.nric,
        pocNric: p.pocNric,
        bus: p.bus,
        logisticsGroup: p.logisticsGroup,
        sleeping: isFamilyOrIcGroup ? p.sleeping : '',
        contact: p.contact,
        emergencyName: isFamilyOrIcGroup ? p.emergencyName : '',
        emergencyContact: isFamilyOrIcGroup ? p.emergencyContact : '',
        emergencyRelation: isFamilyOrIcGroup ? p.emergencyRelation : '',
        diet: isFamilyOrIcGroup ? p.diet : '',
        medical: isFamilyOrIcGroup ? p.medical : '',
        otherPoints: isFamilyOrIcGroup ? p.otherPoints : '',
        isGroupIC: p.isGroupIC
      };
    });

  const scopedPairings = activePairings.filter(p =>
    allowedNrics.has(p.traineeNric) || allowedNrics.has(p.volNric)
  );

  return {
    status: 'success',
    participants: scopedParticipants,
    pairings: scopedPairings,
    rooms: relevantRooms,
    groups: [],
    buses: []
  };
}

function fetchPairingsOnly(forceRebuild = false) {
const cacheKey = getCacheKey('PAIRINGS');
if(!forceRebuild) {
const cached = getLargeCache(cacheKey);
if(cached) return JSON.parse(cached);
}

const ss = getDatabase(); 
const pairSheet = ss.getSheetByName("Pairings"); 
let pairings = [];
if(pairSheet) {
const pairData = pairSheet.getDataRange().getValues();
for(let i=1; i<pairData.length; i++) {
const t = String(pairData[i][0]).trim().toUpperCase();
const v = String(pairData[i][1]).trim().toUpperCase();
if(t && v) {
  const status = pairData[i][2] ? String(pairData[i][2]).trim().toUpperCase() : 'ACTIVE';
  const tsVal = new Date(pairData[i][3]).getTime();
  const ts = isNaN(tsVal) ? 0 : tsVal;
  pairings.push({ traineeNric: t, volNric: v, status: status, ts: ts });
}
}
}
const res = { status: 'success', pairings };
putLargeCache(cacheKey, JSON.stringify(res));
return res;
}

function syncPairingUpdates(updates, takenBy) {
const ss = getDatabase();
const sheet = ss.getSheetByName("Pairings");
if(!sheet) return { status: 'error', message: 'Sheet not found.' };

const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const data = sheet.getDataRange().getValues();
const existingMap = {};
for(let i=1; i<data.length; i++) {
const t = String(data[i][0]).trim().toUpperCase();
const v = String(data[i][1]).trim().toUpperCase();
if(t && v) existingMap[`${t}_${v}`] = i;
}

let changed = false;
updates.forEach(u => {
const t = String(u.traineeNric).trim().toUpperCase();
const v = String(u.volNric).trim().toUpperCase();
const status = u.action === 'ADD' ? 'ACTIVE' : 'UNPAIRED';
const ts = u.ts || Date.now();
const tsDate = new Date(ts);
const key = `${t}_${v}`;

if(existingMap[key] !== undefined) {
  const rowIndex = existingMap[key];
  const existingTsVal = new Date(data[rowIndex][3]).getTime();
  const existingTs = isNaN(existingTsVal) ? 0 : existingTsVal;

  if (ts > existingTs) {
    data[rowIndex][2] = status;
    data[rowIndex][3] = tsDate;
    data[rowIndex][4] = takenBy;
    changed = true;
  }
} else {
  data.push([t, v, status, tsDate, takenBy]);
  existingMap[key] = data.length - 1;
  changed = true;
}
});
if (changed) sheet.getRange(1, 1, data.length, data[0].length).setValues(data);

// Atomic Write-Through Cache
const matchFn = (x, u) => x.traineeNric === u.traineeNric && x.volNric === u.volNric;
patchCacheList(getCacheKey('PAIRINGS'), 'pairings', updates.map(u => ({...u, status: u.action === 'ADD' ? 'ACTIVE' : 'UNPAIRED'})), matchFn);
patchCacheList(getCacheKey('LOGISTICS'), 'pairings', updates.map(u => ({...u, status: u.action === 'ADD' ? 'ACTIVE' : 'UNPAIRED'})), matchFn);

return fetchPairingsOnly();
} catch (e) { return { status: 'error', message: e.message }; }
finally { lock.releaseLock(); }
}

function fetchRoomsOnly(forceRebuild = false) {
const cacheKey = getCacheKey('ROOMS');
if(!forceRebuild) {
const cached = getLargeCache(cacheKey);
if(cached) return JSON.parse(cached);
}

const ss = getDatabase();
const roomSheet = ss.getSheetByName("Rooms");
let rooms = [];
if(roomSheet) {
const rData = roomSheet.getDataRange().getValues();
for(let i=1; i<rData.length; i++) {
const id = String(rData[i][0]).trim();
if(id && id !== "Room ID") {
  let occ = [];
  try { occ = JSON.parse(rData[i][3] || '[]'); } catch(e){}
  rooms.push({ id: id, name: String(rData[i][1]), capacity: parseInt(rData[i][2]) || 0, occupants: occ, ts: new Date(rData[i][4]).getTime() || 0, isDeleted: String(rData[i][6]).toUpperCase() === 'TRUE' });
}
}
}
const res = { status: 'success', rooms };
putLargeCache(cacheKey, JSON.stringify(res));
return res;
}

function syncRoomUpdates(updates, takenBy) {
const ss = getDatabase();
let sheet = ss.getSheetByName("Rooms");
if (!sheet) {
  sheet = ss.insertSheet("Rooms");
  sheet.appendRow(["Room ID", "Room Name", "Capacity", "Occupants", "Last Updated", "Updated By", "Is Deleted"]);
  sheet.setFrozenRows(1);
}

const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const data = sheet.getDataRange().getValues();
const existingMap = {};
for (let i = 1; i < data.length; i++) {
const id = String(data[i][0]).trim();
if(id && id !== "Room ID") existingMap[id] = i;
}

let dataChanged = false;
updates.forEach(u => {
const tsDate = new Date(u.ts);
const isDel = u.isDeleted ? 'TRUE' : 'FALSE';
const occStr = JSON.stringify(u.occupants || []);

if (existingMap[u.id] !== undefined) {
  const rowIndex = existingMap[u.id];
  const existingTsVal = new Date(data[rowIndex][4]).getTime();
  const existingTs = isNaN(existingTsVal) ? 0 : existingTsVal;

  if (u.ts > existingTs) {
     data[rowIndex][1] = u.name;
     data[rowIndex][2] = u.capacity;
     data[rowIndex][3] = occStr;
     data[rowIndex][4] = tsDate;
     data[rowIndex][5] = takenBy;
     data[rowIndex][6] = isDel;
     dataChanged = true;
  }
} else {
  data.push([u.id, u.name, u.capacity, occStr, tsDate, takenBy, isDel]);
  existingMap[u.id] = data.length - 1;
  dataChanged = true;
}
});

// Global Sweep directly on memory array `data`
const roomsList = [];
for(let i=1; i<data.length; i++) {
const id = String(data[i][0]).trim();
if(id && String(data[i][6]).toUpperCase() !== 'TRUE') {
  let occ = [];
  try { occ = JSON.parse(data[i][3] || '[]'); } catch(e){}
  roomsList.push({ rowIdx: i, id: id, occupants: occ, ts: new Date(data[i][4]).getTime() || 0 });
}
}
roomsList.sort((a,b) => b.ts - a.ts);
const seenNrics = new Set();
roomsList.forEach(r => {
const newOcc = [];
let occChanged = false;
r.occupants.forEach(n => {
  if(!seenNrics.has(n)) { seenNrics.add(n); newOcc.push(n); } 
  else occChanged = true;
});
if(occChanged) {
   data[r.rowIdx][3] = JSON.stringify(newOcc);
   data[r.rowIdx][4] = new Date();
   dataChanged = true;
}
});

if(dataChanged) sheet.getRange(1, 1, data.length, data[0].length).setValues(data);

// Clear cache instead of forcing a full sync fetch
removeLargeCache(getCacheKey('ROOMS'));
removeLargeCache(getCacheKey('LOGISTICS'));
return fetchRoomsOnly();
} catch (e) { return { status: 'error', message: e.message }; }
finally { lock.releaseLock(); }
}

// ==========================================
// ATTENDANCE ENGINE
// ==========================================
function fetchAttendanceData(juncture, forceRebuild = false) {
const cacheKey = getCacheKey('ATTENDANCE_' + juncture);
if(!forceRebuild) {
const cached = getLargeCache(cacheKey);
if(cached) return JSON.parse(cached);
}

const ss = getDatabase();
const sheet = ss.getSheetByName("Attendance");
if(!sheet) return { status: 'success', data: {} };

const data = sheet.getDataRange().getValues();
const result = {};

for (let i = 1; i < data.length; i++) {
if (data[i][0] === juncture) {
const nric = String(data[i][1]).trim().toUpperCase();
const status = (String(data[i][2]).trim() === 'true');
const tsVal = new Date(data[i][3]).getTime();
const ts = isNaN(tsVal) ? 0 : tsVal;
result[nric] = { status: status, ts: ts };
}
}
const res = { status: 'success', data: result };
putLargeCache(cacheKey, JSON.stringify(res));
return res;
}

function fetchAttendanceDataScoped(juncture, auth, forceRebuild = false) {
  const full = fetchAttendanceData(juncture, forceRebuild);
  if (auth && auth.role === 'admin') return full;
  const ctx = getUserFamilyContext(auth ? auth.nric : '');
  if (!ctx.self || !ctx.self.isGroupIC) {
    throw new Error('FORBIDDEN: Group IC or Admin access required.');
  }
  const filtered = {};
  Object.keys(full.data || {}).forEach(k => {
    if (ctx.groupMembersNrics.has(k)) filtered[k] = full.data[k];
  });
  return { status: 'success', data: filtered };
}

function syncAttendanceUpdate(juncture, updates, takenBy, auth = null) {
if (!Array.isArray(updates)) return { status: 'error', message: 'Invalid updates payload.' };
if (auth && auth.role !== 'admin') {
  const ctx = getUserFamilyContext(auth.nric);
  if (!ctx.self || !ctx.self.isGroupIC) {
    return { status: 'error', message: 'FORBIDDEN: Only Group ICs or Admins can update attendance.' };
  }
  const unauthorized = updates.some(u => !ctx.groupMembersNrics.has(String(u.nric || '').trim().toUpperCase()));
  if (unauthorized) {
    return { status: 'error', message: 'FORBIDDEN: You can only update attendance for your own group.' };
  }
}
const ss = getDatabase();
const sheet = ss.getSheetByName("Attendance");
if(!sheet) return { status: 'error', message: 'Sheet not found.' };

const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const data = sheet.getDataRange().getValues();
const existingMap = {};
for (let i = 1; i < data.length; i++) {
if (data[i][0] === juncture) {
  existingMap[String(data[i][1]).trim().toUpperCase()] = i; 
}
}

let dataChanged = false;
const normalizedUpdates = updates.map(u => ({
  nric: String(u.nric || '').trim().toUpperCase(),
  status: Boolean(u.status),
  ts: Number(u.ts) || Date.now()
}));

normalizedUpdates.forEach(u => {
const nric = u.nric;
const status = u.status ? 'true' : 'false';
const ts = u.ts;
const tsDate = new Date(ts);

if (existingMap[nric] !== undefined) {
  const rowIndex = existingMap[nric];
  const existingTsVal = new Date(data[rowIndex][3]).getTime();
  const existingTs = isNaN(existingTsVal) ? 0 : existingTsVal;

  if (ts > existingTs) {
    data[rowIndex][2] = status;
    data[rowIndex][3] = tsDate;
    data[rowIndex][4] = takenBy || 'System';
    dataChanged = true;
  }
} else {
  data.push([juncture, nric, status, tsDate, takenBy || 'System']);
  existingMap[nric] = data.length - 1;
  dataChanged = true;
}
});
if (dataChanged) sheet.getRange(1, 1, data.length, data[0].length).setValues(data);

// Write-Through Cache
const cacheKey = getCacheKey('ATTENDANCE_' + juncture);
const str = getLargeCache(cacheKey);
if(str) {
try {
  const cData = JSON.parse(str);
  if (!cData.data) cData.data = {};
  normalizedUpdates.forEach(u => {
    if(!cData.data[u.nric] || u.ts > (cData.data[u.nric].ts || 0)) {
      cData.data[u.nric] = { status: u.status, ts: u.ts };
    }
  });
  putLargeCache(cacheKey, JSON.stringify(cData));
} catch(e) {}
} else {
fetchAttendanceData(juncture, true);
}

return { status: 'success' };
} catch (e) { return { status: 'error', message: e.message }; }
finally { lock.releaseLock(); }
}

// ==========================================
// FINANCE ENGINE & RECEIPTS
// ==========================================
const SUPPORTED_FINANCE_CURRENCIES = [
  'MYR', 'USD', 'EUR', 'GBP', 'AUD', 'IDR',
  'THB', 'JPY', 'KRW', 'TWD', 'PHP', 'VND'
];

function ensureFinanceRatesSheetRows(sheet) {
  if (!sheet || ACTIVE_ARCHIVE_SHEET_ID) return;
  try {
    const count = SUPPORTED_FINANCE_CURRENCIES.length;
    const existingFormulas = sheet.getRange(3, 1, count, 3).getFormulas();
    const existingValues = sheet.getRange(3, 1, count, 3).getValues();
    let needsWrite = false;
    const rowsToWrite = [];

    for (let i = 0; i < count; i++) {
      const code = SUPPORTED_FINANCE_CURRENCIES[i];
      const expectedLabel = code + ' to SGD Rate:';
      const expectedFormula = '=GOOGLEFINANCE("CURRENCY:' + code + 'SGD")';
      const curCode = String(existingValues[i][0] || '').trim().toUpperCase();
      const curFormula = String(existingFormulas[i][2] || '').trim().toUpperCase();
      if (curCode !== code || curFormula !== expectedFormula.toUpperCase()) {
        needsWrite = true;
      }
      rowsToWrite.push([code, expectedLabel, expectedFormula]);
    }

    if (needsWrite) {
      sheet.getRange(3, 1, count, 3).setValues(rowsToWrite);
      SpreadsheetApp.flush();
    }
  } catch (e) {
    console.warn('ensureFinanceRatesSheetRows warning:', e.message);
  }
}

function parseGoogleFinanceQuoteHtml(html, currencyCode) {
  if (!html) return null;
  const cur = String(currencyCode || '').trim().toUpperCase();
  const patterns = [
    new RegExp('"' + cur + '\\s*/\\s*SGD"[^\\[]*\\[([0-9]+(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)'),
    /data-last-price="([0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)"/,
    /class="YMlKec fxKbKc"[^>]*>([0-9,]+(?:\.[0-9]+)?)</
  ];
  for (let i = 0; i < patterns.length; i++) {
    const m = html.match(patterns[i]);
    if (m && m[1]) {
      const num = parseFloat(String(m[1]).replace(/,/g, ''));
      if (!isNaN(num) && isFinite(num) && num > 0) return num;
    }
  }
  return null;
}

function fetchGoogleFinanceLiveRates(forceRefresh = false, sheet = null) {
  const cache = CacheService.getScriptCache();
  const rateCacheKey = 'FINANCE_LIVE_RATES_V2';

  if (!forceRefresh) {
    try {
      const cachedRaw = cache.get(rateCacheKey);
      if (cachedRaw) {
        const cachedObj = JSON.parse(cachedRaw);
        if (cachedObj && cachedObj.rates && Object.keys(cachedObj.rates).length >= 10) {
          return cachedObj;
        }
      }
    } catch (e) {}
  }

  const ratesObj = { SGD: 1 };
  let updatedAt = '';

  // 1. Read Google Sheets =GOOGLEFINANCE("CURRENCY:<CUR>SGD") values first
  if (sheet && !ACTIVE_ARCHIVE_SHEET_ID) {
    ensureFinanceRatesSheetRows(sheet);
    try {
      const count = SUPPORTED_FINANCE_CURRENCIES.length;
      const sheetRows = sheet.getRange(3, 1, count, 5).getValues();
      sheetRows.forEach(r => {
        const code = String(r[0] || '').trim().toUpperCase();
        const val = typeof r[2] === 'number' ? r[2] : parseFloat(r[2]);
        if (code && SUPPORTED_FINANCE_CURRENCIES.indexOf(code) !== -1 && !isNaN(val) && isFinite(val) && val > 0) {
          ratesObj[code] = val;
        }
      });
    } catch (e) {
      console.warn('Sheet GOOGLEFINANCE read warning:', e.message);
    }
  }

  // 2. Fetch directly from Google Finance (parallel UrlFetchApp.fetchAll) for any missing currencies or on forceRefresh
  const toFetch = forceRefresh
    ? SUPPORTED_FINANCE_CURRENCIES.slice()
    : SUPPORTED_FINANCE_CURRENCIES.filter(c => !(ratesObj[c] > 0));

  let fetchedLiveCount = 0;
  if (toFetch.length > 0) {
    try {
      const requests = toFetch.map(cur => ({
        url: 'https://www.google.com/finance/quote/' + cur + '-SGD?hl=en',
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      }));
      const responses = UrlFetchApp.fetchAll(requests);
      for (let i = 0; i < responses.length; i++) {
        try {
          if (responses[i].getResponseCode() === 200) {
            const parsed = parseGoogleFinanceQuoteHtml(responses[i].getContentText(), toFetch[i]);
            if (parsed && parsed > 0) {
              ratesObj[toFetch[i]] = parsed;
              fetchedLiveCount++;
            }
          }
        } catch (err) {}
      }
      if (fetchedLiveCount > 0) {
        updatedAt = new Date().toISOString();
      }
    } catch (e) {
      console.warn('Google Finance fetchAll warning:', e.message);
    }
  }

  // 3. Merge with persisted last-known-good Google Finance rates for any transient failures
  const props = PropertiesService.getScriptProperties();
  let stored = null;
  try {
    const rawStored = props.getProperty('LAST_GOOD_GF_RATES_V2');
    if (rawStored) stored = JSON.parse(rawStored);
  } catch (e) {}

  if (stored && stored.rates) {
    SUPPORTED_FINANCE_CURRENCIES.forEach(code => {
      if (!(ratesObj[code] > 0) && stored.rates[code] > 0) {
        ratesObj[code] = stored.rates[code];
      }
    });
    if (!updatedAt && stored.ratesUpdatedAt) {
      updatedAt = stored.ratesUpdatedAt;
    }
  }

  if (!updatedAt && Object.keys(ratesObj).length > 1) {
    updatedAt = new Date().toISOString();
  }

  const result = {
    rates: ratesObj,
    ratesSource: 'Google Finance',
    ratesUpdatedAt: updatedAt
  };

  // Persist last-known-good snapshot and update audit columns D/E in Finance Options sheet
  if (Object.keys(ratesObj).length >= 2) {
    try {
      if (fetchedLiveCount > 0 || !stored || Object.keys(ratesObj).length > Object.keys((stored && stored.rates) || {}).length) {
        props.setProperty('LAST_GOOD_GF_RATES_V2', JSON.stringify(result));
      }
    } catch (e) {}

    if (sheet && !ACTIVE_ARCHIVE_SHEET_ID && fetchedLiveCount > 0) {
      try {
        const snapshotRows = SUPPORTED_FINANCE_CURRENCIES.map(code => [
          ratesObj[code] || '',
          updatedAt
        ]);
        sheet.getRange(3, 4, snapshotRows.length, 2).setValues(snapshotRows);
      } catch (e) {}
    }
  }

  if (Object.keys(ratesObj).length >= 10) {
    try {
      cache.put(rateCacheKey, JSON.stringify(result), 900); // 15-minute TTL
    } catch (e) {}
  }

  return result;
}

function fetchFinanceScoped(auth, forceRebuild = false, refreshRates = false) {
  const full = fetchFinance(forceRebuild, refreshRates);
  if (auth && auth.role === 'admin') return full;

  const rawData = full.data || { config: {}, options: [] };
  const rawConfig = rawData.config || {};
  const rawOptions = Array.isArray(rawData.options) ? rawData.options : (Array.isArray(rawData) ? rawData : []);
  const finalOpt = rawConfig.finalOptionId
    ? rawOptions.find(o => o && o.id === rawConfig.finalOptionId && !o.isDeleted)
    : null;
  const safeOptions = finalOpt
    ? [{
        id: finalOpt.id,
        title: finalOpt.title || '',
        fields: Array.isArray(finalOpt.fields)
          ? finalOpt.fields.map(f => ({ id: f.id, name: f.name }))
          : []
      }]
    : [];

  if (!auth) {
    // Public landing receipt upload only needs finalized category labels & rates
    return {
      status: 'success',
      data: {
        config: { finalOptionId: rawConfig.finalOptionId || '' },
        options: safeOptions
      },
      rates: full.rates || { SGD: 1 },
      ratesSource: full.ratesSource || 'Google Finance',
      ratesUpdatedAt: full.ratesUpdatedAt || ''
    };
  }

  // Authenticated participant: scope feeDeviations & feesReceived to their own family POC
  const ctx = getUserFamilyContext(auth.nric);
  const myFeeDeviations = {};
  const myFeesReceived = {};
  const pocKeys = Array.from(new Set([ctx.pocNric, ...ctx.familyNrics]));
  pocKeys.forEach(k => {
    if (rawConfig.feeDeviations && rawConfig.feeDeviations[k] !== undefined) {
      myFeeDeviations[k] = rawConfig.feeDeviations[k];
    }
    if (rawConfig.feesReceived && rawConfig.feesReceived[k] !== undefined) {
      myFeesReceived[k] = rawConfig.feesReceived[k];
    }
  });

  return {
    status: 'success',
    data: {
      config: {
        finalOptionId: rawConfig.finalOptionId || '',
        perPersonFee: rawConfig.perPersonFee || 0,
        payNowNumber: rawConfig.payNowNumber || '',
        feeDeviations: myFeeDeviations,
        feesReceived: myFeesReceived
      },
      options: safeOptions
    },
    rates: full.rates || { SGD: 1 },
    ratesSource: full.ratesSource || 'Google Finance',
    ratesUpdatedAt: full.ratesUpdatedAt || ''
  };
}

function fetchFinance(forceRebuild = false, refreshRates = false) {
const cacheKey = getCacheKey('FINANCE');
let cachedRes = null;
if (!forceRebuild) {
  const cached = getLargeCache(cacheKey);
  if (cached) {
    try { cachedRes = JSON.parse(cached); } catch (e) {}
  }
}

if (cachedRes && !refreshRates) {
  const liveBundle = fetchGoogleFinanceLiveRates(false, null);
  cachedRes.rates = liveBundle.rates;
  cachedRes.ratesSource = liveBundle.ratesSource;
  cachedRes.ratesUpdatedAt = liveBundle.ratesUpdatedAt;
  return cachedRes;
}

const ss = getDatabase();
let sheet = ss.getSheetByName("Finance Options");
if (!sheet) {
sheet = ss.insertSheet("Finance Options");
sheet.appendRow(["JSON Data - Do Not Edit"]);
sheet.appendRow([""]);
ensureFinanceRatesSheetRows(sheet);
}

const liveBundle = fetchGoogleFinanceLiveRates(refreshRates, sheet);

let jsonData = cachedRes ? cachedRes.data : null;
if (!cachedRes || forceRebuild) {
  const data = sheet.getDataRange().getValues();
  jsonData = null;
  if (data.length >= 2 && data[1][0]) {
    try { jsonData = JSON.parse(String(data[1][0])); } catch(e) {}
  }
}

const res = {
  status: 'success',
  data: jsonData,
  rates: liveBundle.rates,
  ratesSource: liveBundle.ratesSource,
  ratesUpdatedAt: liveBundle.ratesUpdatedAt
};
putLargeCache(cacheKey, JSON.stringify(res));
return res;
}

function saveFinance(payload) {
const ss = getDatabase();
let sheet = ss.getSheetByName("Finance Options");
if (!sheet) {
  sheet = ss.insertSheet("Finance Options");
  sheet.appendRow(["JSON Data - Do Not Edit"]);
  sheet.appendRow([""]);
  ensureFinanceRatesSheetRows(sheet);
}

const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);

let existingStr = sheet.getRange(2, 1).getValue();
let existingData = { options: [], config: {} };
try { if(existingStr) existingData = JSON.parse(existingStr); } catch(e){}

let changed = false;

if (payload.config && payload.config.ts) {
if (!existingData.config || !existingData.config.ts || payload.config.ts > existingData.config.ts) {
  existingData.config = payload.config;
  changed = true;
}
}

if (payload.updates && Array.isArray(payload.updates)) {
let optMap = {};
if(existingData.options) existingData.options.forEach(o => optMap[o.id] = o);

payload.updates.forEach(u => {
  let ext = optMap[u.id];
  if (!ext || !ext.ts || !u.ts || u.ts > ext.ts) {
    optMap[u.id] = u;
    changed = true;
  }
});
existingData.options = Object.values(optMap);
}

if(changed) {
sheet.getRange(2, 1).setValue(JSON.stringify(existingData));
fetchFinance(true); // Write-Through
}

return fetchFinance();
} catch(e) { return { status: 'error', message: e.message }; }
finally { lock.releaseLock(); }
}

function fetchReceiptsScoped(auth, forceRebuild = false) {
  const full = fetchReceipts(forceRebuild);
  if (auth && auth.role === 'admin') return full;
  const ctx = getUserFamilyContext(auth ? auth.nric : '');
  const scoped = (full.receipts || []).filter(r =>
    !r.isDeleted &&
    (ctx.familyNrics.has(String(r.uploaderNric || '').trim().toUpperCase()) ||
     ctx.familyNrics.has(String(r.paidByNric || '').trim().toUpperCase()))
  );
  return { status: 'success', receipts: scoped };
}

function fetchReceipts(forceRebuild = false) {
const cacheKey = getCacheKey('RECEIPTS');
if(!forceRebuild) {
const cached = getLargeCache(cacheKey);
if(cached) return JSON.parse(cached);
}

const ss = getDatabase();
const sheet = ss.getSheetByName("Receipts");
if (!sheet) return { status: 'success', receipts: [] };

const data = sheet.getDataRange().getValues();
const receipts = [];
for (let i = 1; i < data.length; i++) {
const id = String(data[i][0]).trim();
if (!id || id === "Receipt ID") continue;
receipts.push({
  id: id,
  ts: new Date(data[i][1]).getTime() || 0,
  uploaderNric: String(data[i][2] || ''),
  currency: String(data[i][3] || ''),
  amount: parseFloat(data[i][4]) || 0,
  rate: parseFloat(data[i][5]) || 1,
  sgdAmount: parseFloat(data[i][6]) || 0,
  categoryId: String(data[i][7] || ''),
  fileUrl: String(data[i][8] || ''),
  remarks: String(data[i][9] || ''),
  isDeleted: String(data[i][10]).toUpperCase() === 'TRUE',
  paidByNric: String(data[i][11] || ''),
  isReimbursed: String(data[i][12]).toUpperCase() === 'TRUE',
  uploaderName: String(data[i][13] || '')
});
}
const res = { status: 'success', receipts };
putLargeCache(cacheKey, JSON.stringify(res));
return res;
}

function uploadReceipt(payload, auth = null) {
if (!payload || typeof payload !== 'object') return { status: 'error', message: 'Invalid receipt payload.' };
const isAdmin = Boolean(auth && auth.role === 'admin');
const amountNum = parseFloat(payload.amount);
if (isNaN(amountNum) || amountNum === 0) return { status: 'error', message: 'Invalid non-zero amount required.' };
if (payload.categoryId === "Fees Payment Screenshot") {
  if (!auth) return { status: 'error', message: 'AUTH_REQUIRED: Login required to upload trip fee screenshots.' };
  if (amountNum < 0) return { status: 'error', message: 'Payment screenshot amount must be positive.' };
  if (!isAdmin) {
    const ctx = getUserFamilyContext(auth.nric);
    const upNric = String(payload.uploaderNric || '').trim().toUpperCase();
    const paidNric = String(payload.paidByNric || upNric).trim().toUpperCase();
    if (!ctx.familyNrics.has(upNric) && !ctx.familyNrics.has(paidNric)) {
      return { status: 'error', message: 'FORBIDDEN: You can only upload fee screenshots for your own family.' };
    }
  }
}

const ss = getDatabase();
let sheet = ss.getSheetByName("Receipts");
if (!sheet) {
  sheet = ss.insertSheet("Receipts");
  sheet.appendRow(["Receipt ID", "Timestamp", "Uploader NRIC", "Currency", "Amount", "Rate", "SGD Amount", "Category ID", "File URL", "Remarks", "Is Deleted", "Paid By NRIC", "Is Reimbursed", "Uploader Name"]);
  sheet.setFrozenRows(1);
}

const tripFolder = getTripFolder();
const folderName = payload.categoryId === "Fees Payment Screenshot" ? "Trip Fees Payment Confirmation" : "Receipts";
let targetFolder;
const folders = tripFolder.getFoldersByName(folderName);
if (folders.hasNext()) targetFolder = folders.next();
else {
  try { targetFolder = tripFolder.createFolder(folderName); }
  catch(e) { targetFolder = tripFolder.getFoldersByName(folderName).next(); }
}

if (payload.categoryId === "Fees Payment Screenshot") {
  try {
    targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}
}

let fileUrl = "";
if (payload.fileData) {
const safeMime = payload.mimeType || 'application/octet-stream';
const safeFileName = String(payload.fileName || 'receipt.png').replace(/[\\/:*?"<>|]/g, '_');
const blob = Utilities.newBlob(Utilities.base64Decode(payload.fileData), safeMime, safeFileName);
const file = targetFolder.createFile(blob);
fileUrl = file.getUrl();
}

const newId = "rec_" + Date.now() + "_" + Math.random().toString(36).substr(2,5);

const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);

if (payload.overwriteReceiptId && auth) {
  const ctx = isAdmin ? null : getUserFamilyContext(auth.nric);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[0]).trim() === String(payload.overwriteReceiptId).trim() && String(row[10]).toUpperCase() !== 'TRUE') {
      const rowUp = String(row[2] || '').trim().toUpperCase();
      const rowPaid = String(row[11] || '').trim().toUpperCase();
      if (!isAdmin && ctx && !ctx.familyNrics.has(rowUp) && !ctx.familyNrics.has(rowPaid)) {
        continue;
      }
      sheet.getRange(i + 1, 11).setValue(true);
      const oldUrl = row[8];
      if (oldUrl) {
        try {
          const match = String(oldUrl).match(/id=([^&]+)/) || String(oldUrl).match(/d\/([^\/]+)/);
          if (match && match[1]) {
            const oldFile = DriveApp.getFileById(match[1]);
            if (isItemInsideFolder(oldFile, tripFolder)) {
              oldFile.setTrashed(true);
            }
          }
        } catch(e) {}
      }
    }
  }
}

sheet.appendRow([
newId, new Date(), payload.uploaderNric || '', payload.currency || 'SGD', amountNum, parseFloat(payload.rate) || 1, 
parseFloat(payload.sgdAmount) || amountNum, payload.categoryId || '', fileUrl, payload.remarks || '', false, payload.paidByNric || payload.uploaderNric || '', false, payload.uploaderName || ''
]);

fetchReceipts(true);
if (!auth) {
  return { status: 'success', receiptId: newId, fileUrl: fileUrl };
}
const scopedRes = fetchReceiptsScoped(auth, false);
scopedRes.receiptId = newId;
scopedRes.fileUrl = fileUrl;
return scopedRes;
} catch (e) { return { status: 'error', message: e.message }; }
finally { lock.releaseLock(); }
}

function syncReceipts(updates, auth = null) {
if (!Array.isArray(updates)) return { status: 'error', message: 'Invalid updates array.' };
const isAdmin = Boolean(auth && auth.role === 'admin');
const ctx = (!isAdmin && auth) ? getUserFamilyContext(auth.nric) : null;

const ss = getDatabase();
let sheet = ss.getSheetByName("Receipts");
if (!sheet) {
  sheet = ss.insertSheet("Receipts");
  sheet.appendRow(["Receipt ID", "Timestamp", "Uploader NRIC", "Currency", "Amount", "Rate", "SGD Amount", "Category ID", "File URL", "Remarks", "Is Deleted", "Paid By NRIC", "Is Reimbursed", "Uploader Name"]);
  sheet.setFrozenRows(1);
}

const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const lastCol = sheet.getLastColumn();
if (lastCol < 14) {
  try { sheet.getRange(1, 14).setValue("Uploader Name"); } catch(e) {}
}

const data = sheet.getDataRange().getValues();
const targetCols = Math.max(14, sheet.getLastColumn(), data[0] ? data[0].length : 14);

for (let r = 0; r < data.length; r++) {
  while (data[r].length < targetCols) {
    data[r].push('');
  }
}
const existingMap = {};
for (let i = 1; i < data.length; i++) {
const id = String(data[i][0]).trim();
if(id && id !== "Receipt ID") existingMap[id] = i;
}

let dataChanged = false;
updates.forEach(u => {
if (!u || !u.id || existingMap[u.id] === undefined) return;
const rowIndex = existingMap[u.id];
if (!isAdmin && ctx) {
  const rowUp = String(data[rowIndex][2] || '').trim().toUpperCase();
  const rowPaid = String(data[rowIndex][11] || '').trim().toUpperCase();
  if (!ctx.familyNrics.has(rowUp) && !ctx.familyNrics.has(rowPaid)) {
    return; // Non-admin cannot modify another family's receipt
  }
}
const existingTsVal = new Date(data[rowIndex][1]).getTime();
const existingTs = isNaN(existingTsVal) ? 0 : existingTsVal;
const updateTs = Number(u.ts) || Date.now();
if (updateTs > existingTs) {
  data[rowIndex][1] = new Date(updateTs);
  if (isAdmin) {
    // Merge only fields explicitly supplied so partial updates never wipe existing columns
    if (u.uploaderNric !== undefined) data[rowIndex][2] = u.uploaderNric;
    if (u.currency !== undefined) data[rowIndex][3] = u.currency;
    if (u.amount !== undefined) data[rowIndex][4] = u.amount;
    if (u.rate !== undefined) data[rowIndex][5] = u.rate;
    if (u.sgdAmount !== undefined) data[rowIndex][6] = u.sgdAmount;
    if (u.categoryId !== undefined) data[rowIndex][7] = u.categoryId;
    if (u.fileUrl !== undefined) data[rowIndex][8] = u.fileUrl;
    if (u.remarks !== undefined) data[rowIndex][9] = u.remarks;
    if (u.isDeleted !== undefined) data[rowIndex][10] = u.isDeleted ? 'TRUE' : 'FALSE';
    if (u.paidByNric !== undefined) data[rowIndex][11] = u.paidByNric || data[rowIndex][2];
    if (u.isReimbursed !== undefined) data[rowIndex][12] = u.isReimbursed ? 'TRUE' : 'FALSE';
    if (u.uploaderName !== undefined) data[rowIndex][13] = u.uploaderName || '';
  } else if (u.isDeleted === true) {
    // Non-admins may only soft-delete their own family's payment screenshot
    data[rowIndex][10] = 'TRUE';
  }
  dataChanged = true;
}
});
if(dataChanged) sheet.getRange(1, 1, data.length, targetCols).setValues(data);

fetchReceipts(true);
return fetchReceiptsScoped(auth, false);
} catch (e) { return { status: 'error', message: e.message }; }
finally { lock.releaseLock(); }
}

// ==========================================
// MINUTES ENGINE
// ==========================================
function fetchMinutes(forceRebuild = false) {
const cacheKey = getCacheKey('MINUTES');
if(!forceRebuild) {
const cached = getLargeCache(cacheKey);
if(cached) return JSON.parse(cached);
}

const ss = getDatabase();
const sheet = ss.getSheetByName("Minutes");
if (!sheet) return { status: 'success', minutes: [] };

const data = sheet.getDataRange().getValues();
const minutes = [];
for (let i = 1; i < data.length; i++) {
const id = String(data[i][0]).trim();
if (!id || id === "Note ID") continue;
minutes.push({ id: id, date: String(data[i][1] || ''), content: String(data[i][2] || ''), assignedTo: String(data[i][3] || ''), ts: new Date(data[i][4]).getTime() || 0, updatedBy: String(data[i][5] || ''), isDeleted: String(data[i][6]).toUpperCase() === 'TRUE' });
}
const res = { status: 'success', minutes };
putLargeCache(cacheKey, JSON.stringify(res));
return res;
}

function syncMinutes(updates, takenBy) {
const ss = getDatabase();
let sheet = ss.getSheetByName("Minutes");
if (!sheet) {
  sheet = ss.insertSheet("Minutes");
  sheet.appendRow(["Note ID", "Date", "Content", "Assigned To", "Timestamp", "Updated By", "Is Deleted"]);
}

const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const data = sheet.getDataRange().getValues();
const existingMap = {};
for (let i = 1; i < data.length; i++) {
const id = String(data[i][0]).trim();
if(id && id !== "Note ID") existingMap[id] = i;
}

let dataChanged = false;
updates.forEach(u => {
const id = u.id;
const tsDate = new Date(u.ts);
const isDel = u.isDeleted ? 'TRUE' : 'FALSE';

if (existingMap[id] !== undefined) {
  const rowIndex = existingMap[id];
  const existingTsVal = new Date(data[rowIndex][4]).getTime();
  const existingTs = isNaN(existingTsVal) ? 0 : existingTsVal;

  if (u.ts > existingTs) {
    data[rowIndex][1] = u.date;
    data[rowIndex][2] = u.content;
    data[rowIndex][3] = u.assignedTo;
    data[rowIndex][4] = tsDate;
    data[rowIndex][5] = u.updatedBy || takenBy;
    data[rowIndex][6] = isDel;
    dataChanged = true;
  }
} else {
  data.push([id, u.date, u.content, u.assignedTo, tsDate, u.updatedBy || takenBy, isDel]);
  existingMap[id] = data.length - 1;
  dataChanged = true;
}
});
if(dataChanged) sheet.getRange(1, 1, data.length, data[0].length).setValues(data);

// Write-Through Cache
const matchFn = (x, u) => x.id === u.id;
patchCacheList(getCacheKey('MINUTES'), 'minutes', updates, matchFn);

return fetchMinutes();
} catch (e) { return { status: 'error', message: e.message }; }
finally { lock.releaseLock(); }
}

// ==========================================
// SYSTEM SETTINGS & ARCHIVE
// ==========================================
function toggleRegistration(status, tripTitle, tripYear, tripStart, tripEnd) {
const props = PropertiesService.getScriptProperties();
if (status) {
tripTitle = tripTitle || 'Overseas Trip'; tripYear = tripYear || new Date().getFullYear().toString();
const mainFolder = DriveApp.getFolderById(Drive_Folder_ID);
let subFolders = mainFolder.getFoldersByName(tripYear);
let yearFolder = subFolders.hasNext() ? subFolders.next() : mainFolder.createFolder(tripYear);
let files = yearFolder.getFilesByName("Active Database"); let dbId;
if (files.hasNext()) { dbId = files.next().getId(); }
else { let ss = SpreadsheetApp.create("Active Database"); dbId = ss.getId(); DriveApp.getFileById(dbId).moveTo(yearFolder); setupSheets(ss); }
props.setProperty('TRIP_TITLE', tripTitle); props.setProperty('TRIP_YEAR', tripYear); 
if(tripStart) props.setProperty('TRIP_START_DATE', tripStart);
if(tripEnd) props.setProperty('TRIP_END_DATE', tripEnd);
props.setProperty('DB_SHEET_ID', dbId);
}
props.setProperty('REGISTRATION_OPEN', status ? 'true' : 'false');
return { status: 'success', tripTitle, tripYear, tripStart, tripEnd };
}

function saveTripSettings(title, year, start, end) {
const props = PropertiesService.getScriptProperties();
if(title) props.setProperty('TRIP_TITLE', title);
if(year) props.setProperty('TRIP_YEAR', year);
if(start !== undefined && start !== null) props.setProperty('TRIP_START_DATE', String(start || '').trim());
if(end !== undefined && end !== null) props.setProperty('TRIP_END_DATE', String(end || '').trim());
return { status: 'success', title, year, start: String(start || '').trim(), end: String(end || '').trim() };
}

function toggleEdits(status) { PropertiesService.getScriptProperties().setProperty('ALLOW_EDITS', status ? 'true' : 'false'); return { status: 'success' }; }

function getCommitteeList() { return { status: 'success', list: JSON.parse(PropertiesService.getScriptProperties().getProperty('COMMITTEE_LIST') || '[]') }; }

function getHelplineContacts() { return { status: 'success', list: JSON.parse(PropertiesService.getScriptProperties().getProperty('HELPLINE_CONTACTS') || '[]') }; }

function modifyHelplineContacts(id, isAdding, name = "", phone = "") {
const props = PropertiesService.getScriptProperties(); id = String(id || '').trim();
let list = JSON.parse(props.getProperty('HELPLINE_CONTACTS') || '[]');
if (isAdding) { if (!list.find(c => c.id === id)) list.push({ id, name: String(name || '').trim().toUpperCase(), phone: String(phone || '').trim() }); }
else { list = list.filter(c => c.id !== id); }
props.setProperty('HELPLINE_CONTACTS', JSON.stringify(list)); return getHelplineContacts();
}

function modifyCommitteeList(nric, isAdding, name = "", phone = "") {
const props = PropertiesService.getScriptProperties(); nric = String(nric || '').trim().toUpperCase();
let list = JSON.parse(props.getProperty('COMMITTEE_LIST') || '[]');
if (isAdding) { if (!list.find(c => c.nric === nric)) list.push({ nric, name: String(name || '').trim().toUpperCase(), phone: String(phone || '').trim() }); }
else { list = list.filter(c => c.nric !== nric); }
props.setProperty('COMMITTEE_LIST', JSON.stringify(list)); return getCommitteeList();
}

function modifyProjectGroups(groupName, isAdding, auth, colorClass) {
if (!auth || !auth.isMainAdmin) return { status: 'error', message: 'Unauthorized' };
const props = PropertiesService.getScriptProperties(); groupName = String(groupName || '').trim();
let list = JSON.parse(props.getProperty('PROJECT_GROUPS') || '[]');
let colors = JSON.parse(props.getProperty('PROJECT_COLORS') || '{}');
if (isAdding) { if (groupName && !list.includes(groupName)) list.push(groupName); if (colorClass) colors[groupName] = colorClass; } 
else { list = list.filter(g => g !== groupName); delete colors[groupName]; }
props.setProperty('PROJECT_GROUPS', JSON.stringify(list)); props.setProperty('PROJECT_COLORS', JSON.stringify(colors));
return { status: 'success', groups: list, projectColors: colors };
}

function modifyJunctures(actionType, oldName, newName) {
const props = PropertiesService.getScriptProperties(); 
let list = JSON.parse(props.getProperty('ATTENDANCE_JUNCTURES') || '["Morning Assembly"]');
if (actionType === 'add' && newName && !list.includes(newName)) list.push(newName);
else if (actionType === 'remove' && oldName) list = list.filter(j => j !== oldName);
else if (actionType === 'edit' && oldName && newName) { const idx = list.indexOf(oldName); if (idx > -1) list[idx] = newName; }
props.setProperty('ATTENDANCE_JUNCTURES', JSON.stringify(list)); return { status: 'success', junctures: list };
}


function modifyICJunctures(actionType, oldName, newName, groupName, auth = null) {
    const cleanGroup = String(groupName || '').trim();
    if (!cleanGroup) return { status: 'error', message: 'Missing group name.' };
    if (auth && auth.role !== 'admin') {
      const ctx = getUserFamilyContext(auth.nric);
      if (!ctx.self || !ctx.self.isGroupIC || String(ctx.self.logisticsGroup || '').trim() !== cleanGroup) {
        return { status: 'error', message: 'FORBIDDEN: Only this group IC or Admin can modify custom junctures.' };
      }
    }
    const props = PropertiesService.getScriptProperties(); 
    const key = 'IC_JUNCTURES_' + cleanGroup.replace(/\s+/g, '_').toUpperCase();
    let list = JSON.parse(props.getProperty(key) || '[]');
    if (actionType === 'add' && newName && !list.includes(newName)) list.push(newName);
    else if (actionType === 'remove' && oldName) list = list.filter(j => j !== oldName);
    else if (actionType === 'edit' && oldName && newName) { const idx = list.indexOf(oldName); if (idx > -1) list[idx] = newName; }
    props.setProperty(key, JSON.stringify(list)); 
    return { status: 'success', icJunctures: list };
}

function saveSortingRules(rules) { PropertiesService.getScriptProperties().setProperty('SORTING_RULES', JSON.stringify(rules)); return { status: 'success', sortingRules: rules }; }
function saveCustomViewsOrder(order) { PropertiesService.getScriptProperties().setProperty('CUSTOM_VIEWS_ORDER', JSON.stringify(order)); return { status: 'success', customViewsOrder: order }; }


// ==========================================
// DRIVE & FILE MANAGEMENT
// ==========================================
function getTripFolder() {
if (ACTIVE_ARCHIVE_FOLDER_ID) {
  return DriveApp.getFolderById(ACTIVE_ARCHIVE_FOLDER_ID);
}
const dbId = getDbId();
if (!dbId) throw new Error("No active trip folder found.");
const parents = DriveApp.getFileById(dbId).getParents();
if (parents.hasNext()) return parents.next();
throw new Error("Trip parent folder not found.");
}

function isItemInsideFolder(item, rootFolder) {
  if (!item || !rootFolder) return false;
  const rootId = rootFolder.getId();
  if (item.getId() === rootId) return true;
  const queue = [item];
  const seen = {};
  let hops = 0;
  while (queue.length > 0 && hops < 50) {
    hops++;
    const curr = queue.shift();
    let parents;
    try { parents = curr.getParents(); } catch (e) { continue; }
    while (parents.hasNext()) {
      const p = parents.next();
      const pid = p.getId();
      if (pid === rootId) return true;
      if (!seen[pid]) {
        seen[pid] = true;
        queue.push(p);
      }
    }
  }
  return false;
}

function resolveTripFolder(targetFolderId) {
  const tripFolder = getTripFolder();
  if (!targetFolderId || targetFolderId === 'root') return tripFolder;
  const folder = DriveApp.getFolderById(targetFolderId);
  if (!isItemInsideFolder(folder, tripFolder)) {
    throw new Error('Access denied: folder is outside the trip directory.');
  }
  return folder;
}

function resolveTripItem(itemId, isFolder) {
  const tripFolder = getTripFolder();
  const item = isFolder ? DriveApp.getFolderById(itemId) : DriveApp.getFileById(itemId);
  if (!isItemInsideFolder(item, tripFolder)) {
    throw new Error('Access denied: item is outside the trip directory.');
  }
  return item;
}

function getDriveContents(targetFolderId) {
try {
let folder = resolveTripFolder(targetFolderId);
const files = []; const folders = [];
const fileIter = folder.getFiles();
while(fileIter.hasNext()) {
const f = fileIter.next(); let mime = f.getMimeType(); let url = f.getUrl(); let isShortcut = false;
if (mime === 'application/vnd.google-apps.shortcut') { isShortcut = true; try { const tMime = f.getTargetMimeType(); url = tMime === 'application/vnd.google-apps.folder' ? `https://drive.google.com/drive/folders/${f.getTargetId()}` : `https://drive.google.com/open?id=${f.getTargetId()}`; mime = tMime; } catch(e) {} }
files.push({ id: f.getId(), name: f.getName(), mimeType: mime, url: url, isShortcut: isShortcut });
}
const folderIter = folder.getFolders();
while(folderIter.hasNext()) { const f = folderIter.next(); folders.push({ id: f.getId(), name: f.getName() }); }
files.sort((a,b) => a.name.localeCompare(b.name)); folders.sort((a,b) => a.name.localeCompare(b.name));
return { status: 'success', currentFolderId: folder.getId(), currentFolderName: folder.getName(), files: files, folders: folders };
} catch (e) { return { status: 'error', message: e.message }; }
}

function uploadDriveFile(fId, fName, mime, data) { try { let folder = resolveTripFolder(fId); let blob = Utilities.newBlob(Utilities.base64Decode(data), mime || 'application/octet-stream', String(fName || 'upload').replace(/[\\/:*?"<>|]/g, '_')); const createdFile = folder.createFile(blob); const contents = getDriveContents(fId); if (contents && contents.status === 'success') { contents.uploadedFile = { id: createdFile.getId(), name: createdFile.getName(), url: createdFile.getUrl(), mimeType: createdFile.getMimeType() }; } return contents; } catch (e) { return { status: 'error', message: e.message }; } }
function createDriveFolder(pId, fName) { try { let parent = resolveTripFolder(pId); parent.createFolder(String(fName || 'New Folder').trim()); return getDriveContents(pId); } catch (e) { return { status: 'error', message: e.message }; } }
function createGoogleDoc(fId, fName, type) { try { let folder = resolveTripFolder(fId); let fileId; if (type === 'doc') fileId = DocumentApp.create(fName).getId(); else if (type === 'sheet') fileId = SpreadsheetApp.create(fName).getId(); else fileId = SlidesApp.create(fName).getId(); DriveApp.getFileById(fileId).moveTo(folder); return getDriveContents(fId); } catch (e) { return { status: 'error', message: e.message }; } }
function renameDriveItem(id, isFolder, newName, currFid) { try { newName = String(newName || '').trim(); const item = resolveTripItem(id, isFolder); item.setName(newName); return getDriveContents(currFid); } catch (e) { return { status: 'error', message: e.message }; } }
function deleteDriveItem(id, isFolder, currFid) { try { const item = resolveTripItem(id, isFolder); if (isFolder && item.getId() === getTripFolder().getId()) throw new Error('Cannot delete root trip folder.'); item.setTrashed(true); return getDriveContents(currFid); } catch (e) { return { status: 'error', message: e.message }; } }
function bulkDriveOperation(action, items, targetFid, singleNewName) {
try {
let targetFolder = null; if (action === 'copy' || action === 'move') targetFolder = resolveTripFolder(targetFid);
const tripRootId = getTripFolder().getId();
for (let i = 0; i < items.length; i++) {
const item = items[i]; const nameToUse = (items.length === 1 && singleNewName) ? singleNewName : item.name;
const resolved = resolveTripItem(item.id, item.isFolder);
if (action === 'delete') { if (item.isFolder && resolved.getId() === tripRootId) throw new Error('Cannot delete root trip folder.'); resolved.setTrashed(true); } 
else if (action === 'move') { resolved.moveTo(targetFolder); if (resolved.getName() !== nameToUse) resolved.setName(nameToUse); } 
else if (action === 'copy') { if (item.isFolder) { let newFolder = targetFolder.createFolder(nameToUse); copyFolderRecursive(resolved, newFolder); } else { resolved.makeCopy(nameToUse, targetFolder); } }
}
return getDriveContents(targetFid);
} catch (e) { return { status: 'error', message: e.message }; }
}
function copyFolderRecursive(src, dest) { let files = src.getFiles(); while (files.hasNext()) { let file = files.next(); file.makeCopy(file.getName(), dest); } let folders = src.getFolders(); while (folders.hasNext()) { let subFolder = folders.next(); let newSubFolder = dest.createFolder(subFolder.getName()); copyFolderRecursive(subFolder, newSubFolder); } }

function addDriveAccess(email, role) { try { email = String(email || '').trim().toLowerCase(); const folder = getTripFolder(); if (role === 'editor') folder.addEditor(email); else folder.addViewer(email); const props = PropertiesService.getScriptProperties(); const access = JSON.parse(props.getProperty('APP_GRANTED_ACCESS') || '{}'); access[email] = role; props.setProperty('APP_GRANTED_ACCESS', JSON.stringify(access)); return { status: 'success', driveAccessList: access }; } catch (e) { return { status: 'error', message: e.message }; } }
function removeDriveAccess(email) { try { email = String(email || '').trim().toLowerCase(); const props = PropertiesService.getScriptProperties(); const access = JSON.parse(props.getProperty('APP_GRANTED_ACCESS') || '{}'); if (!access[email]) return { status: 'error', message: 'Not granted via app' }; const folder = getTripFolder(); if (access[email] === 'editor') folder.removeEditor(email); else folder.removeViewer(email); delete access[email]; props.setProperty('APP_GRANTED_ACCESS', JSON.stringify(access)); return { status: 'success', driveAccessList: access }; } catch (e) { return { status: 'error', message: e.message }; } }
function massDriveAccess(actionType, emails, role) {
const folder = getTripFolder(); const props = PropertiesService.getScriptProperties(); const access = JSON.parse(props.getProperty('APP_GRANTED_ACCESS') || '{}'); const results = { success: [], failed: [] };
emails.forEach(email => { email = String(email || '').trim().toLowerCase(); if (!email) return; try { if (actionType === 'add') { if (role === 'editor') folder.addEditor(email); else folder.addViewer(email); access[email] = role; results.success.push(email); } else if (actionType === 'remove') { if (access[email]) { if (access[email] === 'editor') folder.removeEditor(email); else folder.removeViewer(email); delete access[email]; results.success.push(email); } else { results.failed.push({ email: email, reason: 'Not granted via app' }); } } } catch (error) { results.failed.push({ email: email, reason: error.message }); } });
props.setProperty('APP_GRANTED_ACCESS', JSON.stringify(access)); return { status: 'success', driveAccessList: access, results: results };
}

function setTripFile(fileType, fileId, fileName, fileUrl) {
  const props = PropertiesService.getScriptProperties();
  fileId = String(fileId || '').trim();
  fileName = String(fileName || '').trim();
  fileUrl = String(fileUrl || '').trim();

  if (fileId) {
    const file = resolveTripItem(fileId, false);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      if (!fileUrl) fileUrl = file.getUrl();
      if (!fileName) fileName = file.getName();
    } catch (e) {
      console.warn("setSharing error: " + e.message);
    }
  }

  if (fileType === 'infographic') {
    if (fileId) {
      props.setProperty('TRIP_INFOGRAPHIC_ID', fileId);
      props.setProperty('TRIP_INFOGRAPHIC_NAME', fileName);
      props.setProperty('TRIP_INFOGRAPHIC_URL', fileUrl);
    } else {
      props.deleteProperty('TRIP_INFOGRAPHIC_ID');
      props.deleteProperty('TRIP_INFOGRAPHIC_NAME');
      props.deleteProperty('TRIP_INFOGRAPHIC_URL');
    }
  } else if (fileType === 'infoDoc') {
    if (fileId) {
      props.setProperty('TRIP_INFODOC_ID', fileId);
      props.setProperty('TRIP_INFODOC_NAME', fileName);
      props.setProperty('TRIP_INFODOC_URL', fileUrl);
    } else {
      props.deleteProperty('TRIP_INFODOC_ID');
      props.deleteProperty('TRIP_INFODOC_NAME');
      props.deleteProperty('TRIP_INFODOC_URL');
    }
  }

  return getAppConfig({ role: 'admin', isMainAdmin: true });
}

const ARCHIVE_INDEX_FILENAME = 'ARCHIVED_TRIPS_INDEX.json';
const ARCHIVE_INDEX_CACHE_KEY = 'ARCHIVED_TRIPS_REGISTRY_V1';

function getArchiveIndexFile(createIfMissing) {
  const mainFolder = DriveApp.getFolderById(Drive_Folder_ID);
  const iter = mainFolder.getFilesByName(ARCHIVE_INDEX_FILENAME);
  if (iter.hasNext()) return iter.next();
  if (!createIfMissing) return null;
  return mainFolder.createFile(ARCHIVE_INDEX_FILENAME, '[]', MimeType.PLAIN_TEXT);
}

function loadArchivedTripsRegistry(forceReload = false) {
  const cache = CacheService.getScriptCache();
  if (!forceReload) {
    try {
      const cached = cache.get(ARCHIVE_INDEX_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
  }

  let archives = [];
  let loadedFromDrive = false;
  try {
    const file = getArchiveIndexFile(false);
    if (file) {
      const parsed = JSON.parse(file.getBlob().getDataAsString() || '[]');
      if (Array.isArray(parsed)) {
        archives = parsed;
        loadedFromDrive = true;
      }
    }
  } catch (e) {
    console.warn('loadArchivedTripsRegistry Drive read warning:', e.message);
  }

  // One-time migration from legacy PropertiesService ARCHIVED_TRIPS (9 KB limit) into Drive JSON
  const props = PropertiesService.getScriptProperties();
  const legacyRaw = props.getProperty('ARCHIVED_TRIPS');
  if (legacyRaw) {
    try {
      const legacy = JSON.parse(legacyRaw);
      if (Array.isArray(legacy) && legacy.length > 0) {
        const seenIds = new Set(archives.map(a => String(a.id || '').trim()));
        const seenSheets = new Set(archives.map(a => String(a.sheetId || '').trim()).filter(Boolean));
        let merged = false;
        legacy.forEach(item => {
          if (!item || !item.id) return;
          const id = String(item.id).trim();
          const sid = String(item.sheetId || '').trim();
          if (!seenIds.has(id) && (!sid || !seenSheets.has(sid))) {
            archives.push(item);
            seenIds.add(id);
            if (sid) seenSheets.add(sid);
            merged = true;
          }
        });
        if (merged || !loadedFromDrive) {
          saveArchivedTripsRegistry(archives);
        }
        try { props.deleteProperty('ARCHIVED_TRIPS'); } catch (e) {}
      }
    } catch (e) {}
  }

  try {
    const jsonStr = JSON.stringify(archives);
    if (jsonStr.length < 95000) cache.put(ARCHIVE_INDEX_CACHE_KEY, jsonStr, 300);
  } catch (e) {}

  return archives;
}

function saveArchivedTripsRegistry(list) {
  const safeList = Array.isArray(list) ? list : [];
  const file = getArchiveIndexFile(true);
  file.setContent(JSON.stringify(safeList, null, 2));
  try {
    CacheService.getScriptCache().remove(ARCHIVE_INDEX_CACHE_KEY);
  } catch (e) {}
}

function listArchivedTrips() {
  const archives = loadArchivedTripsRegistry(false);
  archives.sort((a, b) => (new Date(b.archivedAt || 0).getTime() || 0) - (new Date(a.archivedAt || 0).getTime() || 0));
  return { status: 'success', archives: archives };
}

function getArchivedTripMeta(archiveId) {
  const cleanId = String(archiveId || '').trim();
  const archives = loadArchivedTripsRegistry(false);
  const found = archives.find(a => String(a.id || '').trim() === cleanId);
  if (!found) return { status: 'error', message: 'Archived trip not found.' };
  return { status: 'success', archive: found };
}

function deleteArchivedTrip(targetArchiveId, targetSheetId, auth) {
if (!auth || !auth.isMainAdmin) {
  return { status: 'error', message: 'Only Main Admin can remove archived trips from the app.' };
}
const cleanId = String(targetArchiveId || '').trim();
const cleanSheetId = String(targetSheetId || '').trim();
if (!cleanId && !cleanSheetId) {
  return { status: 'error', message: 'Missing archive identifier.' };
}
// SAFETY GUARANTEE: Never call DriveApp.setTrashed on any trip spreadsheet or folder.
// Only remove the metadata index entry from ARCHIVED_TRIPS_INDEX.json.
const lock = LockService.getScriptLock();
try {
  lock.waitLock(15000);
  const archives = loadArchivedTripsRegistry(true);
  const beforeCount = archives.length;
  const filtered = archives.filter(function(item) {
    if (!item) return false;
    if (cleanId && String(item.id || '').trim() === cleanId) return false;
    if (cleanSheetId && String(item.sheetId || '').trim() === cleanSheetId) return false;
    return true;
  });
  saveArchivedTripsRegistry(filtered);
  return {
    status: 'success',
    removedCount: beforeCount - filtered.length,
    remainingCount: filtered.length,
    driveFilesUntouched: true
  };
} catch (e) {
  return { status: 'error', message: e.message };
} finally {
  lock.releaseLock();
}
}

function countFolderFilesShallow(folder) {
  if (!folder) return 0;
  let count = 0;
  try {
    const fIter = folder.getFiles();
    while (fIter.hasNext()) { fIter.next(); count++; }
    const dIter = folder.getFolders();
    let subChecked = 0;
    while (dIter.hasNext() && subChecked < 15) {
      subChecked++;
      const sub = dIter.next();
      const sfIter = sub.getFiles();
      while (sfIter.hasNext()) { sfIter.next(); count++; }
    }
  } catch (e) {}
  return count;
}

function archiveAndReset(customArchiveId, archivedBy, extraDriveEmails, auth) {
const props = PropertiesService.getScriptProperties(); const dbId = getDbId();
let folderId = '';
let folderName = '';
const revokedDriveAccounts = [];
const oldJunctures = props.getProperty('ATTENDANCE_JUNCTURES') ? JSON.parse(props.getProperty('ATTENDANCE_JUNCTURES')) : ['Morning Assembly'];

// 0. Compute archive stats BEFORE wiping properties
let archiveStats = null;
let folder = null;
try {
  folder = getTripFolder();
  if (folder) {
    folderId = folder.getId();
    folderName = folder.getName();
  }
} catch (folderErr) {}

try {
  const roster = fetchAdminRoster(false).roster || [];
  const rooms = (fetchRoomsOnly(false).rooms || []).filter(r => !r.isDeleted);
  const receipts = (fetchReceipts(false).receipts || []).filter(r => !r.isDeleted && r.categoryId !== 'TRIP_FEE');
  const minutes = (fetchMinutes(false).minutes || []).filter(m => !m.isDeleted);
  const regularJunctures = oldJunctures.filter(j => !String(j).startsWith('__BUS__'));
  const busJunctures = oldJunctures.filter(j => String(j).startsWith('__BUS__'));
  const totalSpendSgd = receipts.reduce((sum, r) => sum + (parseFloat(r.sgdAmount) || 0), 0);
  archiveStats = {
    participants: roster.length,
    trainees: roster.filter(p => p.role === 'TRAINEE').length,
    caregivers: roster.filter(p => p.role === 'CAREGIVER').length,
    volunteers: roster.filter(p => p.role === 'VOLUNTEER').length,
    rooms: rooms.length,
    junctures: regularJunctures.length,
    busJunctures: busJunctures.length,
    receipts: receipts.length,
    totalSpendSgd: Math.round(totalSpendSgd * 100) / 100,
    minutes: minutes.length,
    files: countFolderFilesShallow(folder)
  };
} catch (statsErr) {}

// 1. Revoke ALL accounts granted via the app under Drive Access Management
try {
  const accessObj = JSON.parse(props.getProperty('APP_GRANTED_ACCESS') || '{}');
  const extraList = Array.isArray(extraDriveEmails) ? extraDriveEmails : [];
  const grantedEmails = Array.from(new Set(
    [...Object.keys(accessObj || {}), ...extraList]
      .map(e => String(e || '').trim().toLowerCase())
      .filter(Boolean)
  ));

  let dbFile = null;
  if (dbId) {
    try { dbFile = DriveApp.getFileById(dbId); } catch (fileErr) {}
  }

  grantedEmails.forEach(function(email) {
    let revoked = false;
    if (folder) {
      try { folder.removeEditor(email); revoked = true; } catch (e) {}
      try { folder.removeViewer(email); revoked = true; } catch (e) {}
    }
    if (dbFile) {
      try { dbFile.removeEditor(email); revoked = true; } catch (e) {}
      try { dbFile.removeViewer(email); revoked = true; } catch (e) {}
    }
    if (revoked) revokedDriveAccounts.push(email);
  });
} catch (e) {}

let archivedRecord = null;
if (dbId) {
  const t = props.getProperty('TRIP_TITLE') || 'Archived Trip';
  const y = props.getProperty('TRIP_YEAR') || String(new Date().getFullYear());
  const d = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  try { DriveApp.getFileById(dbId).setName(`${t} ${y} (Archived ${d})`); } catch(e){}

  archivedRecord = {
    id: customArchiveId || ('arch_' + new Date().getTime() + '_' + Utilities.getUuid().substring(0, 6)),
    tripTitle: t,
    tripYear: y,
    tripStartDate: props.getProperty('TRIP_START_DATE') || '',
    tripEndDate: props.getProperty('TRIP_END_DATE') || '',
    archivedAt: new Date().toISOString(),
    archivedBy: archivedBy || 'Admin',
    source: 'remote',
    sheetId: dbId,
    folderId: folderId,
    folderName: folderName || `${t} ${y}`,
    stats: archiveStats,
    committee: props.getProperty('COMMITTEE_LIST') ? JSON.parse(props.getProperty('COMMITTEE_LIST')) : [],
    helpline: props.getProperty('HELPLINE_CONTACTS') ? JSON.parse(props.getProperty('HELPLINE_CONTACTS')) : [],
    projectGroups: props.getProperty('PROJECT_GROUPS') ? JSON.parse(props.getProperty('PROJECT_GROUPS')) : [],
    projectColors: props.getProperty('PROJECT_COLORS') ? JSON.parse(props.getProperty('PROJECT_COLORS')) : {},
    junctures: oldJunctures,
    sortingRules: props.getProperty('SORTING_RULES') ? JSON.parse(props.getProperty('SORTING_RULES')) : ['project', 'family', 'role', 'name'],
    customViewsOrder: props.getProperty('CUSTOM_VIEWS_ORDER') ? JSON.parse(props.getProperty('CUSTOM_VIEWS_ORDER')) : ['reset_filter', 'medical.html', 'diet.html', 'expired.html', 'other.html'],
    tripInfographicId: props.getProperty('TRIP_INFOGRAPHIC_ID') || '',
    tripInfographicName: props.getProperty('TRIP_INFOGRAPHIC_NAME') || '',
    tripInfographicUrl: props.getProperty('TRIP_INFOGRAPHIC_URL') || '',
    tripInfoDocId: props.getProperty('TRIP_INFODOC_ID') || '',
    tripInfoDocName: props.getProperty('TRIP_INFODOC_NAME') || '',
    tripInfoDocUrl: props.getProperty('TRIP_INFODOC_URL') || ''
  };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const existingArchives = loadArchivedTripsRegistry(true);
    existingArchives.unshift(archivedRecord);
    saveArchivedTripsRegistry(existingArchives);
  } catch (e) {
    console.error('Failed to persist archive registry:', e.message);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// 2. Wipe all trip-specific properties so the entire app is reset and ready for a new overseas trip
[
  'DB_SHEET_ID',
  'TRIP_TITLE',
  'TRIP_YEAR',
  'TRIP_START_DATE',
  'TRIP_END_DATE',
  'COMMITTEE_LIST',
  'HELPLINE_CONTACTS',
  'ATTENDANCE_JUNCTURES',
  'APP_GRANTED_ACCESS',
  'TRIP_INFOGRAPHIC_ID',
  'TRIP_INFOGRAPHIC_NAME',
  'TRIP_INFOGRAPHIC_URL',
  'TRIP_INFODOC_ID',
  'TRIP_INFODOC_NAME',
  'TRIP_INFODOC_URL'
].forEach(k => props.deleteProperty(k));

try {
  props.getKeys().forEach(function(k) {
    if (String(k).indexOf('IC_JUNCTURES_') === 0) {
      props.deleteProperty(k);
    }
  });
} catch (e) {}

props.setProperty('REGISTRATION_OPEN', 'false');
props.setProperty('ALLOW_EDITS', 'false');
props.setProperty('APP_GRANTED_ACCESS', '{}');

// 3. Wipe ALL v2 caches related to this trip instance (including attendance junctures)
try {
  const types = ['LOGISTICS', 'ROSTER', 'FINANCE', 'RECEIPTS', 'MINUTES', 'ROOMS', 'PAIRINGS'];
  types.forEach(t => removeLargeCache(t + "_v2_" + dbId));
  oldJunctures.forEach(j => removeLargeCache('ATTENDANCE_' + j + "_v2_" + dbId));
} catch(e) {}

const freshSettings = getAppConfig(auth || { role: 'admin', isMainAdmin: true });
freshSettings.hasActiveTrip = false;
return {
  status: 'success',
  archivedTrip: archivedRecord,
  revokedAccountsCount: revokedDriveAccounts.length,
  revokedDriveAccounts: revokedDriveAccounts,
  freshSettings: freshSettings
};
}
function deleteParticipant(nric) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("Raw Data");
  let archiveSheet = ss.getSheetByName("Archived Participants");
  
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet("Archived Participants");
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    archiveSheet.appendRow(headers);
  }
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const data = sheet.getDataRange().getValues();
    
    let rowIndex = -1;
    let rowData = null;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][11]).trim().toUpperCase() === String(nric || '').trim().toUpperCase()) {
        rowIndex = i + 1;
        rowData = data[i];
        break;
      }
    }
    
    if (rowIndex === -1) return { status: 'error', message: 'Participant not found.' };
    
    archiveSheet.appendRow(rowData);
    sheet.deleteRow(rowIndex);
    
    removeLargeCache(getCacheKey('ROSTER'));
    return { status: 'success' };
  } catch(e) {
    return { status: 'error', message: e.message };
  } finally {
    lock.releaseLock();
  }
}


function syncAssignments(updates, column) {
const ss = getDatabase();
const sheet = ss.getSheetByName("Raw Data");
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const data = sheet.getDataRange().getValues();
const existingMap = {};
for (let i = 1; i < data.length; i++) {
  const nric = String(data[i][11]).trim().toUpperCase();
  if (nric) existingMap[nric] = i;
}
let colIndex = 25;
if (column === 'group') colIndex = 6;
else if (column === 'bus') colIndex = 24;
else if (column === 'logisticsGroup') colIndex = 25;
else if (column === 'isGroupIC') colIndex = 26;
let dataChanged = false;

const targetLength = Math.max(data[0].length, colIndex + 1);
if (sheet.getMaxColumns() < targetLength) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), targetLength - sheet.getMaxColumns());
}

updates.forEach(u => {
  const cleanNric = String(u.nric || '').trim().toUpperCase();
  if (existingMap[cleanNric] !== undefined) {
    const rowIndex = existingMap[cleanNric];
    const currentVal = column === 'isGroupIC'
      ? (String(data[rowIndex][colIndex] || '').trim().toLowerCase() === 'true')
      : String(data[rowIndex][colIndex] || '');
    const nextVal = column === 'isGroupIC' ? Boolean(u.value) : String(u.value || '');
    if (currentVal !== nextVal) {
        sheet.getRange(rowIndex + 1, colIndex + 1).setValue(column === 'isGroupIC' ? (nextVal ? 'TRUE' : 'FALSE') : nextVal);
        dataChanged = true;
    }
  }
});

if (dataChanged) {
  SpreadsheetApp.flush();
  removeLargeCache(getCacheKey('ROSTER'));
  removeLargeCache(getCacheKey('LOGISTICS'));
  // Removed precomputeAppCache() for faster async resolution
}
return { status: 'success' };

} catch(e) { return { status: 'error', message: e.message }; }
finally { lock.releaseLock(); }
}

function checkDuplicateParticipant(nric, passport) {
  const sheet = getDatabase().getSheetByName("Raw Data");
  const data = sheet.getDataRange().getValues();
  const existingNrics = new Set();
  const existingPassports = new Set();
  for (let i = 1; i < data.length; i++) {
    if (data[i][11]) existingNrics.add(String(data[i][11]).trim().toUpperCase());
    if (data[i][12]) existingPassports.add(String(data[i][12]).trim().toUpperCase());
  }
  
  let conflictType = null;
  if (nric && existingNrics.has(String(nric).trim().toUpperCase())) {
    conflictType = 'NRIC';
  } else if (passport && existingPassports.has(String(passport).trim().toUpperCase())) {
    conflictType = 'Passport';
  }
  
  if (conflictType) {
    return { status: 'error', conflictType: conflictType, message: `This ${conflictType} already exists.` };
  }
  return { status: 'success' };
}


function forceMigratePocNric() {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("Raw Data");
  const data = sheet.getDataRange().getValues();
  
  // 1. Identify all caregivers and their related trainees
  let changes = 0;
  for (let i = 1; i < data.length; i++) {
      if (String(data[i][2]).trim().toUpperCase() === 'CAREGIVER') {
          const cgNric = String(data[i][11]).trim().toUpperCase();
          const relatedStr = String(data[i][4] || '').trim(); // column E has the names
          
          if (relatedStr) {
              const desiredNames = relatedStr.split('|').map(n => n.trim().toLowerCase()).filter(n => n);
              
              for (let j = 1; j < data.length; j++) {
                  if (String(data[j][2]).trim().toUpperCase() === 'TRAINEE') {
                      const jNric = String(data[j][11]).trim().toUpperCase();
                      const jPoc = String(data[j][21] || '').trim().toUpperCase(); // Column V
                      const jName = String(data[j][3] || '').replace(/\s+/g, '').toLowerCase();
                      const jShort = String(data[j][22] || '').replace(/\s+/g, '').toLowerCase();
                      
                      const isDesired = desiredNames.some(d => d.includes(jName) || jName.includes(d) || (jShort && d.includes(jShort)));
                      
                      if (isDesired && jPoc !== cgNric) {
                          sheet.getRange(j+1, 22).setValue(cgNric); // set Trainee's pocNric to Caregiver's NRIC
                          sheet.getRange(i+1, 22).setValue(cgNric); // set Caregiver's pocNric to Caregiver's NRIC
                          changes++;
                      }
                  }
              }
          }
      }
  }
  removeLargeCache(getCacheKey('ROSTER'));
  removeLargeCache(getCacheKey('LOGISTICS'));
  return changes;
}


function clearGlobalCache() {
  const cacheKeys = ['ROSTER', 'LOGISTICS', 'ROOMS', 'FINANCE', 'RECEIPTS', 'MINUTES'];
  cacheKeys.forEach(k => removeLargeCache(getCacheKey(k)));
  return { status: 'success' };
}


// ==========================================
// DATA EXTRACTION
// ==========================================
function extractData(extractType, excludedNrics, customConfig, folderId) {
  let tempSheetId = null;
  try {
    const props = PropertiesService.getScriptProperties();
    const isArchiveReadOnly = Boolean(ACTIVE_ARCHIVE_SHEET_ID);
    const tripTitle = (ACTIVE_ARCHIVE_META && ACTIVE_ARCHIVE_META.tripTitle) || props.getProperty('TRIP_TITLE') || 'TOT';
    const tripYear = (ACTIVE_ARCHIVE_META && ACTIVE_ARCHIVE_META.tripYear) || props.getProperty('TRIP_YEAR') || new Date().getFullYear();
    const safeExcluded = Array.isArray(excludedNrics) ? excludedNrics.map(n => String(n || '').trim().toUpperCase()) : [];
    const rosterData = (fetchAdminRoster(false).roster || []).map(p => ({ ...p }));
    
    // Enrich with logistics data (rooms & pairings)
    try {
      const logRes = fetchLogistics();
      const roomsMap = {};
      const pairingsMap = {};
      
      if (logRes && logRes.rooms) {
        logRes.rooms.forEach(r => {
          if (!r.isDeleted && r.occupants) {
            r.occupants.forEach(n => roomsMap[n] = String(r.name).toUpperCase());
          }
        });
      }
      
      if (logRes && logRes.pairings) {
        logRes.pairings.filter(p => p.status === 'ACTIVE').forEach(pair => {
          if(!pairingsMap[pair.traineeNric]) pairingsMap[pair.traineeNric] = [];
          if(!pairingsMap[pair.volNric]) pairingsMap[pair.volNric] = [];
          
          const v = rosterData.find(x => x.nric === pair.volNric);
          const t = rosterData.find(x => x.nric === pair.traineeNric);
          
          if(v) pairingsMap[pair.traineeNric].push(((v.shortName || v.fullName) || '').toUpperCase());
          if(t) pairingsMap[pair.volNric].push(((t.shortName || t.fullName) || '').toUpperCase());
        });
      }
      
      rosterData.forEach(p => {
        p.room = roomsMap[p.nric] || 'UNASSIGNED';
        let myPairings = pairingsMap[p.nric] ? [...pairingsMap[p.nric]] : [];
        if (p.role === 'CAREGIVER' && p.relatedTrainee) {
            const rNames = p.relatedTrainee.split('|').map(n => n.trim().toLowerCase());
            const relatedList = rosterData.filter(x => rNames.includes((x.fullName||'').toLowerCase()) && x.role === 'TRAINEE');
            relatedList.forEach(related => {
                if (related && pairingsMap[related.nric]) {
                    myPairings.push(...pairingsMap[related.nric]);
                }
            });
        }
        p.pairings = myPairings.length > 0 ? Array.from(new Set(myPairings)).join(', ') : 'NONE';
      });
    } catch(e) {
       // Silently fail enrichment if error
    }
    
    // Sort array so that it's consistent.
    rosterData.sort((a,b) => String(a.fullName || '').localeCompare(String(b.fullName || '')));
    
    const targetRoster = rosterData.filter(p => !safeExcluded.includes(String(p.nric || '').trim().toUpperCase()));
    
    let exportFileName = 'Extraction';
    
    if (extractType === 'insurance') {
      const fileName = `Insurance Submission_${tripTitle}_${tripYear}`;
      exportFileName = fileName;
      const ss = SpreadsheetApp.create(fileName);
      tempSheetId = ss.getId();
      const sheet = ss.getSheets()[0];
      sheet.setName("Insurance");
      
      const header = ["No.", "Name of Person(s) to be insured", "NRIC/FIN/Passport No.", "Date of Birth (DD/MM/YYYY)", "Age", "Nationality", "Gender", "Contact No", "Relationship to Applicant", "Transport", "Project Group"];
      const rows = [header];
      
      targetRoster.forEach((p, index) => {
        let dobStr = p.dob;
        let age = "";
        let formattedDob = "";
        
        if (dobStr) {
          const d = new Date(dobStr);
          if (!isNaN(d.getTime())) {
            formattedDob = Utilities.formatDate(d, Session.getScriptTimeZone(), "dd MMM yyyy");
            const today = new Date();
            let a = today.getFullYear() - d.getFullYear();
            const m = today.getMonth() - d.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
                a--;
            }
            age = a.toString();
          }
        }
        
        rows.push([
          index + 1,
          p.fullName || '',
          p.nric || '',
          formattedDob,
          age,
          p.nationality || '',
          p.gender || '',
          p.contact || '',
          "Friend",
          "Bus",
          "West End & RSPID (WGS)"
        ]);
      });
      
      const dataRange = sheet.getRange(1, 1, rows.length, rows[0].length);
      dataRange.setValues(rows);
      
      sheet.setColumnWidth(1, 40);
      sheet.setColumnWidth(2, 250);
      sheet.setColumnWidth(3, 150);
      sheet.setColumnWidth(4, 120);
      sheet.setColumnWidth(5, 50);
      sheet.setColumnWidth(6, 120);
      sheet.setColumnWidth(7, 80);
      sheet.setColumnWidth(8, 120);
      sheet.setColumnWidth(9, 150);
      sheet.setColumnWidth(10, 100);
      sheet.setColumnWidth(11, 200);
      
      dataRange.setHorizontalAlignment("left");
      dataRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
      sheet.getRange(1, 1, 1, rows[0].length).setFontWeight("bold");
      
    } else if (extractType === 'bus') {
      const fileName = `Bus for ICA Submission_${tripTitle}_${tripYear}`;
      exportFileName = fileName;
      const ss = SpreadsheetApp.create(fileName);
      tempSheetId = ss.getId();
      
      // Group by Bus
      const buses = {};
      targetRoster.forEach(p => {
        let b = p.bus ? String(p.bus).trim() : 'Unassigned';
        if (!b) b = 'Unassigned';
        if (!buses[b]) buses[b] = [];
        buses[b].push(p);
      });
      if (Object.keys(buses).length === 0) {
        buses['Unassigned'] = [];
      }
      
      let isFirst = true;
      const usedTabNames = new Set();
      for (const b in buses) {
        let sheet;
        let tabName = 'Unassigned';
        if (b.toLowerCase() !== 'unassigned') {
          let clean = b.replace(/bus/i, '').trim();
          tabName = 'Bus ' + clean;
        }
        tabName = tabName.replace(/[\\/*?:[\]]/g, '_').trim().slice(0, 31) || 'Sheet';
        if (usedTabNames.has(tabName.toLowerCase())) {
          let suffix = 2;
          let candidate = `${tabName.slice(0, 26)} (${suffix})`;
          while (usedTabNames.has(candidate.toLowerCase())) {
            suffix++;
            candidate = `${tabName.slice(0, 26)} (${suffix})`;
          }
          tabName = candidate;
        }
        usedTabNames.add(tabName.toLowerCase());
        
        if (isFirst) {
          sheet = ss.getSheets()[0];
          sheet.setName(tabName);
          isFirst = false;
        } else {
          sheet = ss.insertSheet(tabName);
        }
        
        sheet.getRange("B1").setValue("Departure from Singapore Date");
        sheet.getRange("B2").setValue("Estimated time to reach checkpoint");
        sheet.getRange("B3").setValue("Arrival to Singapore Date");
        sheet.getRange("B4").setValue("Estimated time to reach checkpoint");
        sheet.getRange("B5").setValue("Checkpoint (Tuas / Woodlands)");
        sheet.getRange("B6").setValue("Point of Contact");
        sheet.getRange("B7").setValue("Bus Plate #, Assigned Bus Driver name & Passport Detail:");
        sheet.getRange("B1:B7").setFontWeight("bold").setWrap(true);
        
        sheet.getRange("C7").setValue("1. Bus plate No: \n2. Driver Full Name: \n3. Driver Gender: \n4. Driver Date of Birth: \n5. Driver Passport Number: \n6. Driver Passport Expiry: \n7. Driver Nationality: \n8. H/P: ");
        sheet.getRange("C7").setVerticalAlignment("top").setWrap(true);
        sheet.setRowHeight(7, 130);
        
        const header = ["S/N", "Full Name as per Passport", "Gender", "Date of Birth", "Passport No.", "Passport Expiry Date", "Nationality", "Medical Conditions", "Remarks", "Clients / Volunteers / Caregivers"];
        sheet.getRange("A9:J9").setValues([header]).setFontWeight("bold").setWrap(true).setVerticalAlignment("top").setHorizontalAlignment("left");
        
        sheet.setColumnWidth(1, 40);
        sheet.setColumnWidth(2, 280);
        sheet.setColumnWidth(3, 80);
        sheet.setColumnWidth(4, 120);
        sheet.setColumnWidth(5, 120);
        sheet.setColumnWidth(6, 120);
        sheet.setColumnWidth(7, 120);
        sheet.setColumnWidth(8, 200);
        sheet.setColumnWidth(9, 150);
        sheet.setColumnWidth(10, 200);
        
        const rows = [];
        const busParticipants = buses[b];
        
        busParticipants.forEach((p, index) => {
          let roleMapped = "";
          if (p.role === 'TRAINEE') roleMapped = "Client";
          else if (p.role === 'CAREGIVER') roleMapped = "Caregiver";
          else roleMapped = "Volunteer";
          
          let dobStr = p.dob;
          let formattedDob = "";
          if (dobStr) {
            const d = new Date(dobStr);
            if (!isNaN(d.getTime())) formattedDob = Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
          }
          
          let expStr = p.passportExpiry;
          let formattedExp = "";
          if (expStr) {
            const d = new Date(expStr);
            if (!isNaN(d.getTime())) formattedExp = Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
          }
          
          rows.push([
            index + 1,
            p.fullName || '',
            p.gender || '',
            formattedDob,
            p.passportNo || p.nric || '',
            formattedExp,
            p.nationality || '',
            '',
            '',
            roleMapped
          ]);
        });
        
        if (rows.length > 0) {
          const dataRange = sheet.getRange(10, 1, rows.length, rows[0].length);
          dataRange.setValues(rows);
          dataRange.setWrap(true).setVerticalAlignment("top").setHorizontalAlignment("left");
        }
      }
    } else if (extractType === 'custom') {
      const fileName = (customConfig && customConfig.sheetName) ? String(customConfig.sheetName).trim() : 'Custom Extraction';
      exportFileName = fileName;
      const ss = SpreadsheetApp.create(fileName);
      tempSheetId = ss.getId();
      const sheet = ss.getSheets()[0];
      sheet.setName("Extraction");
      
      const colDefs = (customConfig && Array.isArray(customConfig.columns)) ? customConfig.columns : [];
      const colLabels = {
        fullName: 'Full Name', shortName: 'Short Name', nric: 'NRIC / FIN', email: 'Email Address', role: 'Role', gender: 'Gender', contact: 'Contact Number', address: 'Home Address', nationality: 'Nationality', passportNo: 'Passport No.', passportExpiry: 'Passport Expiry Date', dob: 'Date of Birth', diet: 'Dietary Restrictions', emergencyName: 'Emergency Contact Name', emergencyContact: 'Emergency Contact Number', emergencyRelation: 'Emergency Contact Relationship', sleeping: 'Sleeping Arrangement', otherPoints: 'Other Points to Note', medical: 'Medical Conditions', bus: 'Bus', logisticsGroup: 'Logistics Group', group: 'Project Group', relatedTrainee: 'Related Trainee(s)', relationship: 'Relationship to Trainee', room: 'Room Assignment', pairings: 'Pairings'
      };
      
      const header = ["S/N"];
      colDefs.forEach(c => header.push(colLabels[c] || c));
      
      const rows = [header];
      
      targetRoster.forEach((p, index) => {
        const row = [index + 1];
        colDefs.forEach(c => {
          let val = p[c] || '';
          if (c === 'dob' || c === 'passportExpiry') {
            if (val) {
              const d = new Date(val);
              if (!isNaN(d.getTime())) val = Utilities.formatDate(d, Session.getScriptTimeZone(), "dd MMM yyyy");
            }
          }
          row.push(val);
        });
        rows.push(row);
      });
      
      const dataRange = sheet.getRange(1, 1, rows.length, rows[0].length);
      dataRange.setValues(rows);
      
      sheet.setColumnWidth(1, 50);
      for (let i = 0; i < colDefs.length; i++) {
         const c = colDefs[i];
         let w = 150;
         if (['fullName', 'address', 'medical', 'otherPoints', 'relatedTrainee'].includes(c)) w = 250;
         else if (['nric', 'dob', 'passportExpiry', 'gender', 'role', 'bus', 'room', 'shortName'].includes(c)) w = 120;
         else if (['contact', 'emergencyContact'].includes(c)) w = 130;
         sheet.setColumnWidth(i + 2, w);
      }
      
      dataRange.setHorizontalAlignment("left");
      dataRange.setVerticalAlignment("middle");
      dataRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
      sheet.getRange(1, 1, 1, rows[0].length).setFontWeight("bold");
    } else {
      return { status: 'error', message: 'Invalid extraction type.' };
    }

    const EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    SpreadsheetApp.flush();
    const exportUrl = "https://docs.google.com/spreadsheets/d/" + tempSheetId + "/export?format=xlsx";
    const response = UrlFetchApp.fetch(exportUrl, {
      headers: {
        Authorization: "Bearer " + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) {
      throw new Error("Failed to export Excel file (HTTP " + response.getResponseCode() + ")");
    }
    const sanitizedBase = String(exportFileName || 'Extraction')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\.(xlsx|xls|csv)$/i, '')
      .trim() || 'Extraction';
    const excelName = sanitizedBase + ".xlsx";
    const xlsxBlob = response.getBlob()
      .setContentType(EXCEL_MIME)
      .setName(excelName);
    const fileData = Utilities.base64Encode(xlsxBlob.getBytes());

    if (isArchiveReadOnly) {
      return {
        status: 'success',
        fileId: '',
        fileName: excelName,
        fileUrl: '',
        mimeType: EXCEL_MIME,
        fileData: fileData,
        archiveReadOnlyExport: true
      };
    }

    const targetFolder = resolveTripFolder(folderId || 'root');
    const excelFile = targetFolder.createFile(xlsxBlob);
    const contents = getDriveContents(folderId || 'root');
    return {
      status: 'success',
      fileId: excelFile.getId(),
      fileName: excelFile.getName(),
      fileUrl: excelFile.getUrl(),
      mimeType: EXCEL_MIME,
      fileData: fileData,
      folders: contents && contents.status === 'success' ? contents.folders : undefined,
      files: contents && contents.status === 'success' ? contents.files : undefined
    };
  } catch(e) {
    return { status: 'error', message: e.message };
  } finally {
    if (tempSheetId) {
      try { DriveApp.getFileById(tempSheetId).setTrashed(true); } catch (cleanErr) {}
    }
  }
}
