/* OVERSEAS TRIP APP BACKEND - Code.gs (MPA Architecture with Atomic Write-Through Caching) */

// ==========================================
// SYSTEM & CRON SETUP
// ==========================================
function setupProject() {
const props = PropertiesService.getScriptProperties();
if(!props.getProperty('PASS_GENERAL')) props.setProperty('PASS_GENERAL', 'P@ssw0rd');
if(!props.getProperty('PASS_ADMIN')) props.setProperty('PASS_ADMIN', 'P@ssw0rd');
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
function getDbId() {
return PropertiesService.getScriptProperties().getProperty('DB_SHEET_ID') || Fallback_Sheet_ID;
}

function getDatabase() {
const dbId = getDbId();
if (!dbId) throw new Error("No active trip database found. Admin must Open Registration first.");
return SpreadsheetApp.openById(dbId);
}

function getCacheKey(type) {
return type + "_" + getDbId();
}

function putLargeCache(cacheKey, jsonStr) {
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
const requiredSheets =["Raw Data", "Finance Options", "Receipts", "Rooms", "Buses", "Groups", "Pairings", "Attendance", "Minutes"];
requiredSheets.forEach(name => {
if (!ss.getSheetByName(name)) {
  let sheet = ss.insertSheet(name);
  if (name === "Raw Data") {
    sheet.appendRow(["Timestamp", "Email address", "Trainee / Volunteer / Caregiver", "Full Name (As stated in your Passport)", "Related Trainee's Name", "Relationship with Trainee", "Which project do you belong to?", "Gender", "Contact Number", "Home Address", "Nationality", "FULL NRIC / FIN", "Passport No.", "Passport Expiry Date", "Date of Birth", "Any dietary restrictions?", "Emergency Contact Name", "Emergency Contact Number", "Relationship with Emergency Contact", "Any sleeping arrangement request?", "Other Points to Note", "Family POC NRIC", "Short Name / Nickname"]);
    sheet.setFrozenRows(1);
  } else if (name === "Finance Options") {
    sheet.appendRow(["JSON Data - Do Not Edit"]);
    sheet.appendRow([""]);
    sheet.appendRow(["Currency Setup", "SGD to MYR Rate:", '=GOOGLEFINANCE("CURRENCY:SGDMYR")']);
  } else if (name === "Receipts") {
    sheet.appendRow(["Receipt ID", "Timestamp", "Uploader NRIC", "Currency", "Amount", "Rate", "SGD Amount", "Category ID", "File URL", "Remarks", "Is Deleted"]);
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

function doPost(e) {
try {
const data = JSON.parse(e.postData.contents);
let result = {};
switch(data.action) {
  case 'getSettings': result = getAppConfig(); break;
  case 'login': result = handleLogin(data.nric, data.password); break;
  case 'getProfile': result = getProfile(data.nric); break;
  case 'updateProfile': result = updateProfile(data.member); break;
  case 'submitRegistration': result = submitRegistration(data.payload); break;
  case 'toggleRegistration': result = toggleRegistration(data.status, data.tripTitle, data.tripYear, data.tripStart, data.tripEnd); break;
  case 'toggleEdits': result = toggleEdits(data.status); break;
  case 'getCommittee': result = getCommitteeList(); break;
  case 'addCommittee': result = modifyCommitteeList(data.nric, true, data.name, data.phone); break;
  case 'removeCommittee': result = modifyCommitteeList(data.nric, false); break;
  case 'addProjectGroup': result = modifyProjectGroups(data.groupName, true, data.callerNric, data.colorClass); break;
  case 'removeProjectGroup': result = modifyProjectGroups(data.groupName, false, data.callerNric); break;
  case 'modifyJunctures': result = modifyJunctures(data.actionType, data.oldName, data.newName); break;
  case 'saveSortingRules': result = saveSortingRules(data.rules, data.callerNric); break;
  case 'saveTripSettings': result = saveTripSettings(data.title, data.year, data.start, data.end); break;
  case 'fetchAdminRoster': result = fetchAdminRoster(); break;
  case 'addDriveAccess': result = addDriveAccess(data.email, data.role); break;
  case 'removeDriveAccess': result = removeDriveAccess(data.email); break;
  case 'massDriveAccess': result = massDriveAccess(data.actionType, data.emails, data.role); break;
  case 'getDriveContents': result = getDriveContents(data.folderId); break;
  case 'uploadDriveFile': result = uploadDriveFile(data.folderId, data.fileName, data.mimeType, data.fileData); break;
  case 'createDriveFolder': result = createDriveFolder(data.parentFolderId, data.folderName); break;
  case 'createGoogleDoc': result = createGoogleDoc(data.folderId, data.fileName, data.docType); break;
  case 'renameDriveItem': result = renameDriveItem(data.itemId, data.isFolder, data.newName, data.currentFolderId); break;
  case 'deleteDriveItem': result = deleteDriveItem(data.itemId, data.isFolder, data.currentFolderId); break;
  case 'bulkDriveOperation': result = bulkDriveOperation(data.actionType, data.items, data.targetFolderId, data.singleNewName); break;
  case 'fetchLogistics': result = fetchLogistics(); break;
  case 'syncPairingUpdates': result = syncPairingUpdates(data.updates, data.takenBy || 'Admin'); break;
  case 'fetchPairingsOnly': result = fetchPairingsOnly(); break;
  case 'syncRoomUpdates': result = syncRoomUpdates(data.updates, data.takenBy || 'Admin'); break;
  case 'fetchRoomsOnly': result = fetchRoomsOnly(); break;
  case 'fetchAttendanceData': result = fetchAttendanceData(data.juncture); break;
  case 'syncAttendanceUpdate': result = syncAttendanceUpdate(data.juncture, data.updates, data.takenBy); break;
  case 'fetchFinance': result = fetchFinance(); break;
  case 'saveFinance': result = saveFinance(data.payload); break;
  case 'fetchReceipts': result = fetchReceipts(); break;
  case 'uploadReceipt': result = uploadReceipt(data.payload); break;
  case 'syncReceipts': result = syncReceipts(data.updates); break;
  case 'fetchMinutes': result = fetchMinutes(); break;
  case 'syncMinutes': result = syncMinutes(data.updates, data.takenBy); break;
  case 'archiveAndReset': result = archiveAndReset(); break;
  default: throw new Error("Unknown action.");
}
return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
} catch (error) {
return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
}
}

// ==========================================
// CORE APP LOGIC
// ==========================================
function getAppConfig() {
const props = PropertiesService.getScriptProperties();
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

return {
status: 'success', 
registrationOpen: props.getProperty('REGISTRATION_OPEN') === 'true', 
allowEdits: props.getProperty('ALLOW_EDITS') === 'true',
committee: props.getProperty('COMMITTEE_LIST') ? JSON.parse(props.getProperty('COMMITTEE_LIST')) : [], 
projectGroups: props.getProperty('PROJECT_GROUPS') ? JSON.parse(props.getProperty('PROJECT_GROUPS')) : [], 
projectColors: props.getProperty('PROJECT_COLORS') ? JSON.parse(props.getProperty('PROJECT_COLORS')) : {}, 
activeProjects: activeProjects, 
junctures: props.getProperty('ATTENDANCE_JUNCTURES') ? JSON.parse(props.getProperty('ATTENDANCE_JUNCTURES')) : ['Morning Assembly'],
sortingRules: props.getProperty('SORTING_RULES') ? JSON.parse(props.getProperty('SORTING_RULES')) : ['project', 'family', 'role', 'name'], 
driveAccessList: props.getProperty('APP_GRANTED_ACCESS') ? JSON.parse(props.getProperty('APP_GRANTED_ACCESS')) : {}, 
tripTitle: props.getProperty('TRIP_TITLE') || '', tripYear: props.getProperty('TRIP_YEAR') || '',
tripStartDate: props.getProperty('TRIP_START_DATE') || '', tripEndDate: props.getProperty('TRIP_END_DATE') || ''
};
}

function handleLogin(nric, password) {
const props = PropertiesService.getScriptProperties();
const genPass = props.getProperty('PASS_GENERAL'); 
const adminPassPrefix = props.getProperty('PASS_ADMIN');
nric = nric.trim().toUpperCase();

if (nric === 'ADMIN' && password === adminPassPrefix) return { status: 'success', role: 'admin', name: 'Main Admin' };

const committeeList = props.getProperty('COMMITTEE_LIST') ? JSON.parse(props.getProperty('COMMITTEE_LIST')) : [];
const commMember = committeeList.find(c => c.nric === nric);
if (commMember) {
if (password === (adminPassPrefix + nric)) return { status: 'success', role: 'admin', name: commMember.name };
else return { status: 'error', message: 'Incorrect committee password.' };
}

const ss = getDatabase();
const data = ss.getSheetByName("Raw Data").getDataRange().getValues();
for (let i = 1; i < data.length; i++) {
if (String(data[i][11]).trim().toUpperCase() === nric) {
  if (password === genPass) return { status: 'success', role: 'user', name: data[i][3] };
  else return { status: 'error', message: 'Incorrect password.' };
}
}
return { status: 'error', message: 'NRIC not found. Please register first.' };
}

function getProfile(nric) {
const ss = getDatabase(); 
const data = ss.getSheetByName("Raw Data").getDataRange().getValues();

let currentUserRecord = null;
for (let i = 1; i < data.length; i++) { 
if (String(data[i][11]).trim().toUpperCase() === nric) { 
  currentUserRecord = data[i]; break; 
} 
}
if (!currentUserRecord) return {status: 'error', message: 'Profile not found.'};

let family = [];
const userRole = String(currentUserRecord[2]).trim().toUpperCase();
const userName = String(currentUserRecord[3]).trim().toLowerCase();
const userRelatedTrainee = String(currentUserRecord[4]).trim().toLowerCase();

let targetTraineeName = null;
if (userRole === 'TRAINEE') targetTraineeName = userName;
else if (userRole === 'CAREGIVER' && userRelatedTrainee) targetTraineeName = userRelatedTrainee;

for (let i = 1; i < data.length; i++) {
const rowRole = String(data[i][2]).trim().toUpperCase();
const rowName = String(data[i][3]).trim().toLowerCase();
const rowRelatedTrainee = String(data[i][4]).trim().toLowerCase();
const rowNric = String(data[i][11]).trim().toUpperCase();

let isFamilyMember = false;
if (targetTraineeName) {
  if (rowRole === 'TRAINEE' && rowName === targetTraineeName) isFamilyMember = true;
  if (rowRole === 'CAREGIVER' && rowRelatedTrainee === targetTraineeName) isFamilyMember = true;
}
if (rowNric === nric) isFamilyMember = true;

if (isFamilyMember) {
  let expRaw = data[i][13]; if (expRaw instanceof Date) expRaw = Utilities.formatDate(expRaw, Session.getScriptTimeZone(), "dd MMM yyyy");
  let dobRaw = data[i][14]; if (dobRaw instanceof Date) dobRaw = Utilities.formatDate(dobRaw, Session.getScriptTimeZone(), "dd MMM yyyy");
  family.push({
    email: data[i][1], role: data[i][2], fullName: data[i][3], relatedTrainee: data[i][4], relationship: data[i][5],
    group: data[i][6], gender: data[i][7], contact: data[i][8], address: data[i][9], nationality: data[i][10],
    nric: data[i][11], passportNo: data[i][12], passportExpiry: expRaw, dob: dobRaw, diet: data[i][15],
    emergencyName: data[i][16], emergencyContact: data[i][17], emergencyRelation: data[i][18], sleeping: data[i][19], otherPoints: data[i][20],
    pocNric: data[i][21], shortName: data[i][22] || ''
  });
}
}
return { status: 'success', family: family };
}

function updateProfile(member) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const props = PropertiesService.getScriptProperties();
if (props.getProperty('ALLOW_EDITS') !== 'true') return { status: 'error', message: 'Editing locked.' };

const ss = getDatabase();
const sheet = ss.getSheetByName("Raw Data"); 
const data = sheet.getDataRange().getValues();

for (let i = 1; i < data.length; i++) {
  if (String(data[i][11]).trim().toUpperCase() === member.nric.trim().toUpperCase()) {
    sheet.getRange(i+1, 2).setValue(member.email); sheet.getRange(i+1, 3).setValue(member.role); sheet.getRange(i+1, 4).setValue(member.fullName);
    sheet.getRange(i+1, 5).setValue(member.relatedTrainee || ''); sheet.getRange(i+1, 6).setValue(member.relationship || '');
    sheet.getRange(i+1, 7).setValue(member.group || ''); sheet.getRange(i+1, 8).setValue(member.gender);
    sheet.getRange(i+1, 9).setValue(member.contact); sheet.getRange(i+1, 10).setValue(member.address || '');
    sheet.getRange(i+1, 11).setValue(member.nationality); sheet.getRange(i+1, 13).setValue(member.passportNo);
    sheet.getRange(i+1, 14).setValue(member.passportExpiry ? "'" + member.passportExpiry : '');
    sheet.getRange(i+1, 15).setValue(member.dob ? "'" + member.dob : '');                      
    sheet.getRange(i+1, 16).setValue(member.diet || ''); sheet.getRange(i+1, 17).setValue(member.emergencyName || '');
    sheet.getRange(i+1, 18).setValue(member.emergencyContact || ''); sheet.getRange(i+1, 19).setValue(member.emergencyRelation || '');
    sheet.getRange(i+1, 20).setValue(member.sleeping || ''); sheet.getRange(i+1, 21).setValue(member.otherPoints || '');
    sheet.getRange(i+1, 23).setValue(member.shortName || '');
    
    // Write-Through: Invalidate dependent caches
    CacheService.getScriptCache().remove(getCacheKey('ROSTER'));
    CacheService.getScriptCache().remove(getCacheKey('LOGISTICS'));
    precomputeAppCache(); 
    return { status: 'success' };
  }
}
return { status: 'error', message: 'Record not found.' };
} catch(e) { return { status: 'error', message: e.message }; }
finally { lock.releaseLock(); }
}

function submitRegistration(payloadArray) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
if (PropertiesService.getScriptProperties().getProperty('REGISTRATION_OPEN') !== 'true') return { status: 'error', message: 'Registration is closed.' };
const sheet = getDatabase().getSheetByName("Raw Data"); 
const pocNric = payloadArray[0].nric.toUpperCase();
payloadArray.forEach(p => {
  sheet.appendRow([
    new Date(), p.email||'', p.role||'', p.fullName||'', p.relatedTrainee||'', p.relationship||'', p.group||'', p.gender||'', p.contact||'', p.address||'', p.nationality||'',
    p.nric.toUpperCase(), p.passportNo||'', p.passportExpiry ? "'" + p.passportExpiry : '', p.dob ? "'" + p.dob : '', p.diet||'',
    p.emergencyName||'', p.emergencyContact||'', p.emergencyRelation||'', p.sleeping||'', p.otherPoints||'', pocNric, p.shortName||''
  ]);
});
CacheService.getScriptCache().remove(getCacheKey('ROSTER'));
CacheService.getScriptCache().remove(getCacheKey('LOGISTICS'));
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
    email: data[i][1], role: data[i][2], fullName: data[i][3], relatedTrainee: data[i][4], relationship: data[i][5],
    group: data[i][6], gender: data[i][7], contact: data[i][8], address: data[i][9], nationality: data[i][10],
    nric: data[i][11], passportNo: data[i][12], passportExpiry: data[i][13] instanceof Date ? data[i][13].toISOString() : String(data[i][13] || '').replace(/^'/, ''),
    dob: data[i][14] instanceof Date ? data[i][14].toISOString() : String(data[i][14] || '').replace(/^'/, ''),
    diet: data[i][15], emergencyName: data[i][16], emergencyContact: data[i][17], emergencyRelation: data[i][18],
    sleeping: data[i][19], otherPoints: data[i][20], pocNric: data[i][21], shortName: data[i][22]
  });
}
}
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

const ss = getDatabase(); 
const pData = ss.getSheetByName("Raw Data").getDataRange().getValues(); 
const participants = [];
for(let i=1; i<pData.length; i++) {
if(pData[i][11]) {
  participants.push({ 
    role: String(pData[i][2]).trim().toUpperCase(), 
    name: pData[i][3], 
    relatedTrainee: pData[i][4] ? String(pData[i][4]).trim() : '',
    shortName: pData[i][22] ? String(pData[i][22]).trim() : '',
    group: String(pData[i][6]).trim(), 
    gender: String(pData[i][7]).trim(),
    nric: String(pData[i][11]).trim().toUpperCase(),
    pocNric: String(pData[i][21]).trim().toUpperCase(),
    sleeping: pData[i][19] ? String(pData[i][19]).trim() : ''
  });
}
}

const pairRes = fetchPairingsOnly(forceRebuild);
const roomRes = fetchRoomsOnly(forceRebuild);

const res = { status: 'success', participants, pairings: pairRes.pairings, rooms: roomRes.rooms, groups: [], buses:[] };
putLargeCache(cacheKey, JSON.stringify(res));
return res;
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
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const ss = getDatabase();
const sheet = ss.getSheetByName("Pairings");
if(!sheet) return { status: 'error', message: 'Sheet not found.' };

const data = sheet.getDataRange().getValues();
const existingMap = {};
for(let i=1; i<data.length; i++) {
  const t = String(data[i][0]).trim().toUpperCase();
  const v = String(data[i][1]).trim().toUpperCase();
  if(t && v) existingMap[`${t}_${v}`] = i + 1;
}

updates.forEach(u => {
  const t = String(u.traineeNric).trim().toUpperCase();
  const v = String(u.volNric).trim().toUpperCase();
  const status = u.action === 'ADD' ? 'ACTIVE' : 'UNPAIRED';
  const ts = u.ts || Date.now();
  const tsDate = new Date(ts);
  const key = `${t}_${v}`;

  if(existingMap[key]) {
    const rowIndex = existingMap[key];
    const existingTsVal = new Date(data[rowIndex - 1][3]).getTime();
    const existingTs = isNaN(existingTsVal) ? 0 : existingTsVal;

    if (ts > existingTs) {
      sheet.getRange(rowIndex, 3, 1, 3).setValues([[status, tsDate, takenBy]]);
    }
  } else {
    sheet.appendRow([t, v, status, tsDate, takenBy]);
    existingMap[key] = sheet.getLastRow();
  }
});

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
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const ss = getDatabase();
let sheet = ss.getSheetByName("Rooms");

const data = sheet.getDataRange().getValues();
const existingMap = {};
for (let i = 1; i < data.length; i++) {
  const id = String(data[i][0]).trim();
  if(id && id !== "Room ID") existingMap[id] = i + 1;
}

updates.forEach(u => {
  const tsDate = new Date(u.ts);
  const isDel = u.isDeleted ? 'TRUE' : 'FALSE';
  const occStr = JSON.stringify(u.occupants || []);

  if (existingMap[u.id]) {
    const rowIndex = existingMap[u.id];
    const existingTsVal = new Date(data[rowIndex - 1][4]).getTime();
    const existingTs = isNaN(existingTsVal) ? 0 : existingTsVal;

    if (u.ts > existingTs) {
       sheet.getRange(rowIndex, 2, 1, 6).setValues([[u.name, u.capacity, occStr, tsDate, takenBy, isDel]]);
    }
  } else {
    sheet.appendRow([u.id, u.name, u.capacity, occStr, tsDate, takenBy, isDel]);
    existingMap[u.id] = sheet.getLastRow();
  }
});

// Global Sweep
SpreadsheetApp.flush();
const freshData = sheet.getDataRange().getValues();
const roomsList = [];
for(let i=1; i<freshData.length; i++) {
  const id = String(freshData[i][0]).trim();
  if(id && String(freshData[i][6]).toUpperCase() !== 'TRUE') {
    let occ = [];
    try { occ = JSON.parse(freshData[i][3] || '[]'); } catch(e){}
    roomsList.push({ rowIdx: i + 1, id: id, occupants: occ, ts: new Date(freshData[i][4]).getTime() || 0 });
  }
}

roomsList.sort((a,b) => b.ts - a.ts);
const seenNrics = new Set();

roomsList.forEach(r => {
  const newOcc = [];
  let changed = false;
  r.occupants.forEach(n => {
    if(!seenNrics.has(n)) { seenNrics.add(n); newOcc.push(n); } 
    else changed = true;
  });
  if(changed) sheet.getRange(r.rowIdx, 4, 1, 2).setValues([[JSON.stringify(newOcc), new Date()]]);
});

// Atomic Write-Through Cache
fetchRoomsOnly(true);
fetchLogistics(true);

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

function syncAttendanceUpdate(juncture, updates, takenBy) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const ss = getDatabase();
const sheet = ss.getSheetByName("Attendance");
if(!sheet) return { status: 'error', message: 'Sheet not found.' };

const data = sheet.getDataRange().getValues();
const existingMap = {};
for (let i = 1; i < data.length; i++) {
  if (data[i][0] === juncture) {
    existingMap[String(data[i][1]).trim().toUpperCase()] = i + 1; 
  }
}

updates.forEach(u => {
  const nric = String(u.nric).trim().toUpperCase();
  const status = u.status ? 'true' : 'false';
  const ts = u.ts || Date.now();
  const tsDate = new Date(ts);

  if (existingMap[nric]) {
    const rowIndex = existingMap[nric];
    const existingTsVal = new Date(data[rowIndex - 1][3]).getTime();
    const existingTs = isNaN(existingTsVal) ? 0 : existingTsVal;

    if (ts > existingTs) {
      sheet.getRange(rowIndex, 3, 1, 3).setValues([[status, tsDate, takenBy || 'System']]);
    }
  } else {
    sheet.appendRow([juncture, nric, status, tsDate, takenBy || 'System']);
    existingMap[nric] = sheet.getLastRow();
  }
});

// Write-Through Cache
const cacheKey = getCacheKey('ATTENDANCE_' + juncture);
const str = getLargeCache(cacheKey);
if(str) {
  try {
    const cData = JSON.parse(str);
    updates.forEach(u => {
      const nric = String(u.nric).trim().toUpperCase();
      if(!cData.data[nric] || u.ts > cData.data[nric].ts) {
        cData.data[nric] = { status: u.status, ts: u.ts };
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
function fetchFinance(forceRebuild = false) {
const cacheKey = getCacheKey('FINANCE');
if(!forceRebuild) {
const cached = getLargeCache(cacheKey);
if(cached) return JSON.parse(cached);
}

const ss = getDatabase();
let sheet = ss.getSheetByName("Finance Options");
if (!sheet) {
sheet = ss.insertSheet("Finance Options");
sheet.getRange("A1").setValue("JSON Data - Do Not Edit");
}

let ratesObj = { "SGD": 1 };
try {
const ratesData = sheet.getRange(3, 1, 13, 3).getValues();
ratesData.forEach(r => { if(r[0] && r[1] && !isNaN(r[2])) ratesObj[String(r[0])] = parseFloat(r[2]); });
} catch(e){}

const data = sheet.getDataRange().getValues();
let jsonData = null;
if (data.length >= 2 && data[1][0]) {
try { jsonData = JSON.parse(String(data[1][0])); } catch(e) {}
}

const res = { status: 'success', data: jsonData, rates: ratesObj };
putLargeCache(cacheKey, JSON.stringify(res));
return res;
}

function saveFinance(payload) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const ss = getDatabase();
let sheet = ss.getSheetByName("Finance Options");

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
    isDeleted: String(data[i][10]).toUpperCase() === 'TRUE'
  });
}
const res = { status: 'success', receipts };
putLargeCache(cacheKey, JSON.stringify(res));
return res;
}

function uploadReceipt(payload) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);

// Ensure Receipts folder exists
const tripFolder = getTripFolder();
let receiptsFolder;
const folders = tripFolder.getFoldersByName("Receipts");
if (folders.hasNext()) receiptsFolder = folders.next();
else receiptsFolder = tripFolder.createFolder("Receipts");

// Save file
let fileUrl = "";
if (payload.fileData) {
  const blob = Utilities.newBlob(Utilities.base64Decode(payload.fileData), payload.mimeType, payload.fileName);
  const file = receiptsFolder.createFile(blob);
  fileUrl = file.getUrl();
}

const ss = getDatabase();
let sheet = ss.getSheetByName("Receipts");
const newId = "rec_" + Date.now() + "_" + Math.random().toString(36).substr(2,5);

sheet.appendRow([
  newId, new Date(), payload.uploaderNric, payload.currency, payload.amount, payload.rate, 
  payload.sgdAmount, payload.categoryId, fileUrl, payload.remarks, false
]);

fetchReceipts(true);
return fetchReceipts();
} catch (e) { return { status: 'error', message: e.message }; }
finally { lock.releaseLock(); }
}

function syncReceipts(updates) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const ss = getDatabase();
let sheet = ss.getSheetByName("Receipts");

const data = sheet.getDataRange().getValues();
const existingMap = {};
for (let i = 1; i < data.length; i++) {
  const id = String(data[i][0]).trim();
  if(id && id !== "Receipt ID") existingMap[id] = i + 1;
}

updates.forEach(u => {
  const isDel = u.isDeleted ? 'TRUE' : 'FALSE';
  if (existingMap[u.id]) {
    const rowIndex = existingMap[u.id];
    const existingTsVal = new Date(data[rowIndex - 1][1]).getTime();
    const existingTs = isNaN(existingTsVal) ? 0 : existingTsVal;
    if (u.ts > existingTs) {
      sheet.getRange(rowIndex, 2, 1, 10).setValues([[
        new Date(u.ts), u.uploaderNric, u.currency, u.amount, u.rate, u.sgdAmount, u.categoryId, u.fileUrl, u.remarks, isDel
      ]]);
    }
  }
});

fetchReceipts(true);
return fetchReceipts();
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
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const ss = getDatabase();
let sheet = ss.getSheetByName("Minutes");

const data = sheet.getDataRange().getValues();
const existingMap = {};
for (let i = 1; i < data.length; i++) {
  const id = String(data[i][0]).trim();
  if(id && id !== "Note ID") existingMap[id] = i + 1;
}

updates.forEach(u => {
  const id = u.id;
  const tsDate = new Date(u.ts);
  const isDel = u.isDeleted ? 'TRUE' : 'FALSE';

  if (existingMap[id]) {
    const rowIndex = existingMap[id];
    const existingTsVal = new Date(data[rowIndex - 1][4]).getTime();
    const existingTs = isNaN(existingTsVal) ? 0 : existingTsVal;

    if (u.ts > existingTs) {
      sheet.getRange(rowIndex, 2, 1, 6).setValues([[u.date, u.content, u.assignedTo, tsDate, u.updatedBy || takenBy, isDel]]);
    }
  } else {
    sheet.appendRow([id, u.date, u.content, u.assignedTo, tsDate, u.updatedBy || takenBy, isDel]);
    existingMap[id] = sheet.getLastRow();
  }
});

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
if(start) props.setProperty('TRIP_START_DATE', start);
if(end) props.setProperty('TRIP_END_DATE', end);
return { status: 'success', title, year, start, end };
}

function toggleEdits(status) { PropertiesService.getScriptProperties().setProperty('ALLOW_EDITS', status ? 'true' : 'false'); return { status: 'success' }; }

function getCommitteeList() { return { status: 'success', list: JSON.parse(PropertiesService.getScriptProperties().getProperty('COMMITTEE_LIST') || '[]') }; }

function modifyCommitteeList(nric, isAdding, name = "", phone = "") {
const props = PropertiesService.getScriptProperties(); nric = nric.trim().toUpperCase();
let list = JSON.parse(props.getProperty('COMMITTEE_LIST') || '[]');
if (isAdding) { if (!list.find(c => c.nric === nric)) list.push({ nric, name: name.trim(), phone: phone.trim() }); }
else { list = list.filter(c => c.nric !== nric); }
props.setProperty('COMMITTEE_LIST', JSON.stringify(list)); return getCommitteeList();
}

function modifyProjectGroups(groupName, isAdding, callerNric, colorClass) {
if (callerNric !== 'ADMIN') return { status: 'error', message: 'Unauthorized' };
const props = PropertiesService.getScriptProperties(); groupName = groupName.trim();
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

function saveSortingRules(rules, callerNric) { PropertiesService.getScriptProperties().setProperty('SORTING_RULES', JSON.stringify(rules)); return { status: 'success', sortingRules: rules }; }

// ==========================================
// DRIVE & FILE MANAGEMENT
// ==========================================
function getTripFolder() {
const dbId = getDbId();
if (!dbId) throw new Error("No active trip folder found.");
const parents = DriveApp.getFileById(dbId).getParents();
if (parents.hasNext()) return parents.next();
throw new Error("Trip parent folder not found.");
}

function getDriveContents(targetFolderId) {
try {
let folder = (!targetFolderId || targetFolderId === 'root') ? getTripFolder() : DriveApp.getFolderById(targetFolderId);
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

function uploadDriveFile(fId, fName, mime, data) { try { let folder = fId === 'root' ? getTripFolder() : DriveApp.getFolderById(fId); let blob = Utilities.newBlob(Utilities.base64Decode(data), mime, fName); folder.createFile(blob); Utilities.sleep(1500); return getDriveContents(fId); } catch (e) { return { status: 'error', message: e.message }; } }
function createDriveFolder(pId, fName) { try { let parent = pId === 'root' ? getTripFolder() : DriveApp.getFolderById(pId); parent.createFolder(fName); Utilities.sleep(1500); return getDriveContents(pId); } catch (e) { return { status: 'error', message: e.message }; } }
function createGoogleDoc(fId, fName, type) { try { let folder = fId === 'root' ? getTripFolder() : DriveApp.getFolderById(fId); let fileId; if (type === 'doc') fileId = DocumentApp.create(fName).getId(); else if (type === 'sheet') fileId = SpreadsheetApp.create(fName).getId(); else fileId = SlidesApp.create(fName).getId(); DriveApp.getFileById(fileId).moveTo(folder); Utilities.sleep(1500); return getDriveContents(fId); } catch (e) { return { status: 'error', message: e.message }; } }
function renameDriveItem(id, isFolder, newName, currFid) { try { if(isFolder) DriveApp.getFolderById(id).setName(newName.trim()); else DriveApp.getFileById(id).setName(newName.trim()); Utilities.sleep(1000); return getDriveContents(currFid); } catch (e) { return { status: 'error', message: e.message }; } }
function deleteDriveItem(id, isFolder, currFid) { try { if(isFolder) DriveApp.getFolderById(id).setTrashed(true); else DriveApp.getFileById(id).setTrashed(true); Utilities.sleep(1000); return getDriveContents(currFid); } catch (e) { return { status: 'error', message: e.message }; } }
function bulkDriveOperation(action, items, targetFid, singleNewName) {
try {
let targetFolder = null; if (action === 'copy' || action === 'move') targetFolder = targetFid === 'root' ? getTripFolder() : DriveApp.getFolderById(targetFid);
for (let i = 0; i < items.length; i++) {
  const item = items[i]; const nameToUse = (items.length === 1 && singleNewName) ? singleNewName : item.name;
  if (action === 'delete') { if (item.isFolder) DriveApp.getFolderById(item.id).setTrashed(true); else DriveApp.getFileById(item.id).setTrashed(true); } 
  else if (action === 'move') { if (item.isFolder) { let folder = DriveApp.getFolderById(item.id); folder.moveTo(targetFolder); if (folder.getName() !== nameToUse) folder.setName(nameToUse); } else { let file = DriveApp.getFileById(item.id); file.moveTo(targetFolder); if (file.getName() !== nameToUse) file.setName(nameToUse); } } 
  else if (action === 'copy') { if (item.isFolder) { let sourceFolder = DriveApp.getFolderById(item.id); let newFolder = targetFolder.createFolder(nameToUse); copyFolderRecursive(sourceFolder, newFolder); } else { let sourceFile = DriveApp.getFileById(item.id); sourceFile.makeCopy(nameToUse, targetFolder); } }
}
Utilities.sleep(1500); return getDriveContents(targetFid);
} catch (e) { return { status: 'error', message: e.message }; }
}
function copyFolderRecursive(src, dest) { let files = src.getFiles(); while (files.hasNext()) { let file = files.next(); file.makeCopy(file.getName(), dest); } let folders = src.getFolders(); while (folders.hasNext()) { let subFolder = folders.next(); let newSubFolder = dest.createFolder(subFolder.getName()); copyFolderRecursive(subFolder, newSubFolder); } }

function addDriveAccess(email, role) { try { email = email.trim().toLowerCase(); const folder = getTripFolder(); if (role === 'editor') folder.addEditor(email); else folder.addViewer(email); const props = PropertiesService.getScriptProperties(); const access = JSON.parse(props.getProperty('APP_GRANTED_ACCESS') || '{}'); access[email] = role; props.setProperty('APP_GRANTED_ACCESS', JSON.stringify(access)); return { status: 'success', driveAccessList: access }; } catch (e) { return { status: 'error', message: e.message }; } }
function removeDriveAccess(email) { try { email = email.trim().toLowerCase(); const props = PropertiesService.getScriptProperties(); const access = JSON.parse(props.getProperty('APP_GRANTED_ACCESS') || '{}'); if (!access[email]) return { status: 'error', message: 'Not granted via app' }; const folder = getTripFolder(); if (access[email] === 'editor') folder.removeEditor(email); else folder.removeViewer(email); delete access[email]; props.setProperty('APP_GRANTED_ACCESS', JSON.stringify(access)); return { status: 'success', driveAccessList: access }; } catch (e) { return { status: 'error', message: e.message }; } }
function massDriveAccess(actionType, emails, role) {
const folder = getTripFolder(); const props = PropertiesService.getScriptProperties(); const access = JSON.parse(props.getProperty('APP_GRANTED_ACCESS') || '{}'); const results = { success: [], failed: [] };
emails.forEach(email => { email = email.trim().toLowerCase(); if (!email) return; try { if (actionType === 'add') { if (role === 'editor') folder.addEditor(email); else folder.addViewer(email); access[email] = role; results.success.push(email); } else if (actionType === 'remove') { if (access[email]) { if (access[email] === 'editor') folder.removeEditor(email); else folder.removeViewer(email); delete access[email]; results.success.push(email); } else { results.failed.push({ email: email, reason: 'Not granted via app' }); } } } catch (error) { results.failed.push({ email: email, reason: error.message }); } });
props.setProperty('APP_GRANTED_ACCESS', JSON.stringify(access)); return { status: 'success', driveAccessList: access, results: results };
}

function archiveAndReset() {
const props = PropertiesService.getScriptProperties(); const dbId = getDbId();
try { if (dbId) { const folder = getTripFolder(); const accessObj = JSON.parse(props.getProperty('APP_GRANTED_ACCESS') || '{}'); for (let email in accessObj) { try { if (accessObj[email] === 'editor') folder.removeEditor(email); else folder.removeViewer(email); } catch(e) { } } } } catch (e) {}
if (dbId) { const t = props.getProperty('TRIP_TITLE') || 'Archived Trip'; const y = props.getProperty('TRIP_YEAR') || new Date().getFullYear(); const d = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"); try { DriveApp.getFileById(dbId).setName(`${t} ${y} (Archived ${d})`); } catch(e){} }
['DB_SHEET_ID', 'TRIP_TITLE', 'TRIP_YEAR', 'TRIP_START_DATE', 'TRIP_END_DATE', 'COMMITTEE_LIST', 'ATTENDANCE_JUNCTURES', 'APP_GRANTED_ACCESS'].forEach(k => props.deleteProperty(k));
props.setProperty('REGISTRATION_OPEN', 'false'); props.setProperty('ALLOW_EDITS', 'false');
const cache = CacheService.getScriptCache();
// Wipe caches related to this trip instance
try {
const types = ['LOGISTICS', 'ROSTER', 'FINANCE', 'RECEIPTS', 'MINUTES', 'ROOMS', 'PAIRINGS'];
let keys = [];
types.forEach(t => { keys.push(t + "_" + dbId); keys.push(t + "_" + dbId + "_count"); for(let i=0; i<15; i++) keys.push(t + "_" + dbId + "_" + i); });
cache.removeAll(keys);
} catch(e) {}
return { status: 'success' };
}