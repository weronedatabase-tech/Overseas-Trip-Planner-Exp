/* OVERSEAS TRIP APP BACKEND - Code.gs */

// SAFE SETUP: Triggers authorization without wiping data.
function setupProject() {
const props = PropertiesService.getScriptProperties();
if(!props.getProperty('PASS_GENERAL')) props.setProperty('PASS_GENERAL', 'P@ssw0rd');
if(!props.getProperty('PASS_ADMIN')) props.setProperty('PASS_ADMIN', 'P@ssw0rd');
if(!props.getProperty('REGISTRATION_OPEN')) props.setProperty('REGISTRATION_OPEN', 'false');
if(!props.getProperty('ALLOW_EDITS')) props.setProperty('ALLOW_EDITS', 'false');

DriveApp.getRootFolder(); // Triggers the Drive permission prompt
try {
DocumentApp.create('Auth Setup').setTrashed(true);
SpreadsheetApp.create('Auth Setup').setTrashed(true);
SlidesApp.create('Auth Setup').setTrashed(true);
} catch(e) {}
console.log(`Safe setup complete for ${ENV} environment.`);
}

// DANGER: Wipes all UI Settings (Run only if you want a fresh start)
function factoryResetSettings() {
const props = PropertiesService.getScriptProperties();
props.deleteProperty('COMMITTEE_LIST');
props.deleteProperty('PROJECT_GROUPS');
props.deleteProperty('PROJECT_COLORS');
props.deleteProperty('ATTENDANCE_JUNCTURES');
props.deleteProperty('SORTING_RULES');
props.deleteProperty('APP_GRANTED_ACCESS');
console.log("Settings wiped.");
}

function getDatabase() {
// Uses active registration DB or falls back to environment specific Sheet ID
const dbId = PropertiesService.getScriptProperties().getProperty('DB_SHEET_ID') || Sheet_ID;
if (!dbId) throw new Error("No active trip database found. The Admin must Open Registration first.");
return SpreadsheetApp.openById(dbId);
}

function setupSheets(ss) {
const requiredSheets =["Raw Data", "Finance", "Rooms", "Buses", "Groups", "Pairings", "Attendance", "Minutes"];
requiredSheets.forEach(name => {
if (!ss.getSheetByName(name)) {
let sheet = ss.insertSheet(name);
if (name === "Raw Data") {
sheet.appendRow(["Timestamp", "Email address", "Trainee / Volunteer / Caregiver", "Full Name (As stated in your Passport)", "Related Trainee's Name", "Relationship with Trainee", "Which project do you belong to?", "Gender", "Contact Number", "Home Address", "Nationality", "FULL NRIC / FIN", "Passport No.", "Passport Expiry Date", "Date of Birth", "Any dietary restrictions?", "Emergency Contact Name", "Emergency Contact Number", "Relationship with Emergency Contact", "Any sleeping arrangement request?", "Other Points to Note", "Family POC NRIC", "Short Name / Nickname"]);
sheet.setFrozenRows(1);
} else if (name === "Finance") {
sheet.appendRow(["Currency Setup", "SGD to MYR Rate:", '=GOOGLEFINANCE("CURRENCY:SGDMYR")']);
sheet.appendRow(["Timestamp", "NRIC", "Name", "Total Amount (SGD)", "PayNow Serial", "Payment Status", "CSV Match Date"]);
sheet.setFrozenRows(2);
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

function getAppConfig() {
const props = PropertiesService.getScriptProperties();
const commList = props.getProperty('COMMITTEE_LIST') ? JSON.parse(props.getProperty('COMMITTEE_LIST')) :[];
const groupList = props.getProperty('PROJECT_GROUPS') ? JSON.parse(props.getProperty('PROJECT_GROUPS')) :[];
const juncList = props.getProperty('ATTENDANCE_JUNCTURES') ? JSON.parse(props.getProperty('ATTENDANCE_JUNCTURES')) : ['Morning Assembly'];
const projColors = props.getProperty('PROJECT_COLORS') ? JSON.parse(props.getProperty('PROJECT_COLORS')) : {};
const sortingRules = props.getProperty('SORTING_RULES') ? JSON.parse(props.getProperty('SORTING_RULES')) :['project', 'family', 'role', 'name'];
const rawAccess = props.getProperty('APP_GRANTED_ACCESS');
const driveAccessList = rawAccess ? JSON.parse(rawAccess) : {};

let activeProjects =[];
try {
const dbId = props.getProperty('DB_SHEET_ID') || Sheet_ID;
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
status: 'success', registrationOpen: props.getProperty('REGISTRATION_OPEN') === 'true', allowEdits: props.getProperty('ALLOW_EDITS') === 'true',
committee: commList, projectGroups: groupList, projectColors: projColors, activeProjects: activeProjects, junctures: juncList,
sortingRules: sortingRules, driveAccessList: driveAccessList, 
tripTitle: props.getProperty('TRIP_TITLE') || '', tripYear: props.getProperty('TRIP_YEAR') || '',
tripStartDate: props.getProperty('TRIP_START_DATE') || '', tripEndDate: props.getProperty('TRIP_END_DATE') || ''
};
}

function handleLogin(nric, password) {
const props = PropertiesService.getScriptProperties();
const genPass = props.getProperty('PASS_GENERAL'); const adminPassPrefix = props.getProperty('PASS_ADMIN');
nric = nric.trim().toUpperCase();

if (nric === 'ADMIN' && password === adminPassPrefix) return { status: 'success', role: 'admin', name: 'Main Admin' };

const committeeList = props.getProperty('COMMITTEE_LIST') ? JSON.parse(props.getProperty('COMMITTEE_LIST')) :[];
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
currentUserRecord = data[i]; 
break; 
} 
}
if (!currentUserRecord) return {status: 'error', message: 'Profile not found.'};

let family = [];
const userRole = String(currentUserRecord[2]).trim().toUpperCase();
const userName = String(currentUserRecord[3]).trim().toLowerCase();
const userRelatedTrainee = String(currentUserRecord[4]).trim().toLowerCase();

let targetTraineeName = null;
if (userRole === 'TRAINEE') {
targetTraineeName = userName;
} else if (userRole === 'CAREGIVER' && userRelatedTrainee) {
targetTraineeName = userRelatedTrainee;
}

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
if (rowNric === nric) isFamilyMember = true; // Always include self

if (isFamilyMember) {
let expRaw = data[i][13]; if (expRaw instanceof Date) expRaw = Utilities.formatDate(expRaw, Session.getScriptTimeZone(), "dd MMM yyyy");
let dobRaw = data[i][14]; if (dobRaw instanceof Date) dobRaw = Utilities.formatDate(dobRaw, Session.getScriptTimeZone(), "dd MMM yyyy");
family.push({
email: data[i][1], role: data[i][2], fullName: data[i][3], relatedTrainee: data[i][4], relationship: data[i][5],
group: data[i][6], gender: data[i][7], contact: data[i][8], address: data[i][9], nationality: data[i][10],
nric: data[i][11], passportNo: data[i][12], passportExpiry: expRaw, dob: dobRaw, diet: data[i][15],
emergencyName: data[i][16], emergencyContact: data[i][17], emergencyRelation: data[i][18], sleeping: data[i][19], otherPoints: data[i][20],
shortName: data[i][22] || ''
});
}
}
return { status: 'success', family: family };
}

function updateProfile(member) {
const props = PropertiesService.getScriptProperties();
if (props.getProperty('ALLOW_EDITS') !== 'true') return { status: 'error', message: 'Editing is locked by the committee.' };
const sheet = getDatabase().getSheetByName("Raw Data"); const data = sheet.getDataRange().getValues();
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
return { status: 'success' };
}
}
return { status: 'error', message: 'Record not found.' };
}

function submitRegistration(payloadArray) {
if (PropertiesService.getScriptProperties().getProperty('REGISTRATION_OPEN') !== 'true') return { status: 'error', message: 'Registration is closed.' };
const sheet = getDatabase().getSheetByName("Raw Data"); const pocNric = payloadArray[0].nric.toUpperCase();
payloadArray.forEach(p => {
sheet.appendRow([
new Date(), p.email||'', p.role||'', p.fullName||'', p.relatedTrainee||'', p.relationship||'', p.group||'', p.gender||'', p.contact||'', p.address||'', p.nationality||'',
p.nric.toUpperCase(), p.passportNo||'', p.passportExpiry ? "'" + p.passportExpiry : '', p.dob ? "'" + p.dob : '', p.diet||'',
p.emergencyName||'', p.emergencyContact||'', p.emergencyRelation||'', p.sleeping||'', p.otherPoints||'', pocNric, p.shortName||''
]);
});
return { status: 'success' };
}

function fetchAdminRoster() {
const ss = getDatabase();
const sheet = ss.getSheetByName("Raw Data");
if(!sheet) return { status: 'success', roster: [] };

const data = sheet.getDataRange().getValues();
const results = [];
for(let i = 1; i < data.length; i++) {
if(data[i][11]) { 
results.push({
timestamp: data[i][0] instanceof Date ? data[i][0].getTime() : data[i][0],
email: data[i][1],
role: data[i][2],
fullName: data[i][3],
relatedTrainee: data[i][4],
relationship: data[i][5],
group: data[i][6],
gender: data[i][7],
contact: data[i][8],
address: data[i][9],
nationality: data[i][10],
nric: data[i][11],
passportNo: data[i][12],
passportExpiry: data[i][13] instanceof Date ? data[i][13].toISOString() : String(data[i][13] || '').replace(/^'/, ''),
dob: data[i][14] instanceof Date ? data[i][14].toISOString() : String(data[i][14] || '').replace(/^'/, ''),
diet: data[i][15],
emergencyName: data[i][16],
emergencyContact: data[i][17],
emergencyRelation: data[i][18],
sleeping: data[i][19],
otherPoints: data[i][20],
pocNric: data[i][21],
shortName: data[i][22]
});
}
}
return { status: 'success', roster: results };
}

function fetchLogistics() {
const ss = getDatabase(); const pData = ss.getSheetByName("Raw Data").getDataRange().getValues(); const participants =[];
for(let i=1; i<pData.length; i++) {
if(pData[i][11]) {
participants.push({ 
role: String(pData[i][2]).trim().toUpperCase(), 
name: pData[i][3], 
relatedTrainee: pData[i][4] ? String(pData[i][4]).trim() : '',
shortName: pData[i][22] ? String(pData[i][22]).trim() : '',
group: String(pData[i][6]).trim(), 
nric: String(pData[i][11]).trim().toUpperCase(),
pocNric: String(pData[i][21]).trim().toUpperCase(),
sleeping: pData[i][19] ? String(pData[i][19]).trim() : ''
});
}
}

const pairSheet = ss.getSheetByName("Pairings"); let pairings =[];
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

const roomSheet = ss.getSheetByName("Rooms"); let rooms = [];
if(roomSheet) {
const maxCols = Math.max(roomSheet.getLastColumn(), 1);
const headers = roomSheet.getRange(1,1,1,maxCols).getValues()[0];
if(headers[0] !== "Room ID") {
roomSheet.getRange(1,1,1,7).setValues([["Room ID", "Room Name", "Capacity", "Occupants", "Last Updated", "Updated By", "Is Deleted"]]);
roomSheet.setFrozenRows(1);
}

const roomData = roomSheet.getDataRange().getValues();
for(let i=1; i<roomData.length; i++) {
const id = String(roomData[i][0]).trim();
if(id && id !== "Room ID") {
let occ = [];
try { occ = JSON.parse(roomData[i][3] || '[]'); } catch(e){}
rooms.push({
    id: id,
    name: String(roomData[i][1]),
    capacity: parseInt(roomData[i][2]) || 0,
    occupants: occ,
    ts: new Date(roomData[i][4]).getTime() || 0,
    isDeleted: String(roomData[i][6]).toUpperCase() === 'TRUE'
});
}
}
}

return { status: 'success', participants, pairings, rooms, groups: [], buses:[] };
}

function fetchPairingsOnly() {
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
return { status: 'success', pairings };
}

function syncPairingUpdates(updates, takenBy) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(10000);
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

return fetchPairingsOnly();
} catch (e) {
return { status: 'error', message: e.message };
} finally {
lock.releaseLock();
}
}

function fetchRoomsOnly() {
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
rooms.push({
    id: id,
    name: String(rData[i][1]),
    capacity: parseInt(rData[i][2]) || 0,
    occupants: occ,
    ts: new Date(rData[i][4]).getTime() || 0,
    isDeleted: String(rData[i][6]).toUpperCase() === 'TRUE'
});
}
}
}
return { status: 'success', rooms };
}

function syncRoomUpdates(updates, takenBy) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(10000);
const ss = getDatabase();
let sheet = ss.getSheetByName("Rooms");
if(!sheet) {
sheet = ss.insertSheet("Rooms");
sheet.appendRow(["Room ID", "Room Name", "Capacity", "Occupants", "Last Updated", "Updated By", "Is Deleted"]);
sheet.setFrozenRows(1);
}

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

// Perform Global Sweep to ensure no duplicate occupants across active rooms
SpreadsheetApp.flush();
const freshData = sheet.getDataRange().getValues();
const roomsList = [];
for(let i=1; i<freshData.length; i++) {
const id = String(freshData[i][0]).trim();
if(id && String(freshData[i][6]).toUpperCase() !== 'TRUE') {
   let occ = [];
   try { occ = JSON.parse(freshData[i][3] || '[]'); } catch(e){}
   roomsList.push({
       rowIdx: i + 1,
       id: id,
       occupants: occ,
       ts: new Date(freshData[i][4]).getTime() || 0
   });
}
}

// Sort by TS desc so latest assignments win
roomsList.sort((a,b) => b.ts - a.ts);
const seenNrics = new Set();
let needsFlush = false;

roomsList.forEach(r => {
const newOcc = [];
let changed = false;
r.occupants.forEach(n => {
if(!seenNrics.has(n)) {
    seenNrics.add(n);
    newOcc.push(n);
} else {
    changed = true; // Dupe found and removed silently
}
});

if(changed) {
sheet.getRange(r.rowIdx, 4, 1, 2).setValues([[JSON.stringify(newOcc), new Date()]]);
needsFlush = true;
}
});

return fetchRoomsOnly();
} catch (e) {
return { status: 'error', message: e.message };
} finally {
lock.releaseLock();
}
}

function setupFinanceRates(sheet) {
const pairs = [
["Currency", "Rate to SGD"],
["SGD", 1], 
["MYR", '=IFERROR(GOOGLEFINANCE("CURRENCY:MYRSGD"), 0.28)'],
["USD", '=IFERROR(GOOGLEFINANCE("CURRENCY:USDSGD"), 1.35)'],
["EUR", '=IFERROR(GOOGLEFINANCE("CURRENCY:EURSGD"), 1.45)'],
["GBP", '=IFERROR(GOOGLEFINANCE("CURRENCY:GBPSGD"), 1.7)'],
["AUD", '=IFERROR(GOOGLEFINANCE("CURRENCY:AUDSGD"), 0.88)'],
["IDR", '=IFERROR(GOOGLEFINANCE("CURRENCY:IDRSGD"), 0.00008)'],
["THB", '=IFERROR(GOOGLEFINANCE("CURRENCY:THBSGD"), 0.038)'],
["JPY", '=IFERROR(GOOGLEFINANCE("CURRENCY:JPYSGD"), 0.009)'],
["KRW", '=IFERROR(GOOGLEFINANCE("CURRENCY:KRWSGD"), 0.001)'],
["TWD", '=IFERROR(GOOGLEFINANCE("CURRENCY:TWDSGD"), 0.042)'],
["PHP", '=IFERROR(GOOGLEFINANCE("CURRENCY:PHPSGD"), 0.024)'],
["VND", '=IFERROR(GOOGLEFINANCE("CURRENCY:VNDSGD"), 0.00005)']
];
sheet.getRange(1, 4, pairs.length, 2).setValues(pairs);
sheet.getRange(1, 4, 1, 2).setFontWeight("bold");
}

function fetchFinance() {
const ss = getDatabase();
let sheet = ss.getSheetByName("Finance Options");
if (!sheet) {
sheet = ss.insertSheet("Finance Options");
sheet.getRange("A1").setValue("JSON Data - Do Not Edit");
setupFinanceRates(sheet);
} else {
const d1 = sheet.getRange("D1").getValue();
if (d1 !== "Currency") setupFinanceRates(sheet);
}

// Ensure formulas are evaluated
SpreadsheetApp.flush();

let ratesObj = { "SGD": 1 };
try {
const ratesData = sheet.getRange(2, 4, 13, 2).getValues();
ratesData.forEach(r => {
if(r[0] && r[1] && !isNaN(r[1])) ratesObj[String(r[0])] = parseFloat(r[1]);
});
} catch(e){}

const data = sheet.getDataRange().getValues();
let jsonData = null;
if (data.length >= 2 && data[1][0]) {
try { jsonData = JSON.parse(String(data[1][0])); } catch(e) {}
}

return { status: 'success', data: jsonData, rates: ratesObj };
}

function saveFinance(payload) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(10000);
const ss = getDatabase();
let sheet = ss.getSheetByName("Finance Options");
if (!sheet) {
sheet = ss.insertSheet("Finance Options");
sheet.getRange("A1").setValue("JSON Data - Do Not Edit");
setupFinanceRates(sheet);
}

let existingStr = sheet.getRange(2, 1).getValue();
let existingData = { options: [], config: {} };
try { if(existingStr) existingData = JSON.parse(existingStr); } catch(e){}

let changed = false;

if (payload.config && payload.config.ts) {
if (!existingData.config || !existingData.config.ts || payload.config.ts > existingData.config.ts) {
existingData.config = payload.config;
changed = true;
}
} else if (payload.config) {
existingData.config = payload.config;
changed = true;
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
} else if (payload.options) {
// Fallback for old save behavior
existingData.options = payload.options;
changed = true;
}

if(changed) {
sheet.getRange(2, 1).setValue(JSON.stringify(existingData));
}

return fetchFinance();
} catch(e) {
return { status: 'error', message: e.message };
} finally {
lock.releaseLock();
}
}

function fetchMinutes() {
const ss = getDatabase();
const sheet = ss.getSheetByName("Minutes");
if (!sheet) return { status: 'success', minutes: [] };

const maxCols = Math.max(sheet.getLastColumn(), 1);
const headers = sheet.getRange(1, 1, 1, maxCols).getValues()[0];
if (headers[0] !== "Note ID") {
sheet.getRange(1, 1, 1, 7).setValues([["Note ID", "Meeting Date", "Content", "Assigned To", "Last Updated", "Updated By", "Is Deleted"]]);
sheet.setFrozenRows(1);
}

const data = sheet.getDataRange().getValues();
const minutes = [];
for (let i = 1; i < data.length; i++) {
const id = String(data[i][0]).trim();
if (!id || id === "Note ID") continue;
minutes.push({
id: id,
date: String(data[i][1] || ''),
content: String(data[i][2] || ''),
assignedTo: String(data[i][3] || ''),
ts: new Date(data[i][4]).getTime() || 0,
updatedBy: String(data[i][5] || ''),
isDeleted: String(data[i][6]).toUpperCase() === 'TRUE'
});
}
return { status: 'success', minutes };
}

function syncMinutes(updates, takenBy) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(10000);
const ss = getDatabase();
let sheet = ss.getSheetByName("Minutes");
if(!sheet) {
sheet = ss.insertSheet("Minutes");
sheet.appendRow(["Note ID", "Meeting Date", "Content", "Assigned To", "Last Updated", "Updated By", "Is Deleted"]);
sheet.setFrozenRows(1);
}

const maxCols = Math.max(sheet.getLastColumn(), 1);
const headers = sheet.getRange(1, 1, 1, maxCols).getValues()[0];
if (headers[0] !== "Note ID") {
sheet.getRange(1, 1, 1, 7).setValues([["Note ID", "Meeting Date", "Content", "Assigned To", "Last Updated", "Updated By", "Is Deleted"]]);
}

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

return fetchMinutes();
} catch (e) {
return { status: 'error', message: e.message };
} finally {
lock.releaseLock();
}
}

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

function getCommitteeList() {
const rawComm = PropertiesService.getScriptProperties().getProperty('COMMITTEE_LIST'); let list = rawComm ? JSON.parse(rawComm) :[]; return { status: 'success', list: list };
}

function modifyCommitteeList(nric, isAdding, name = "", phone = "") {
const props = PropertiesService.getScriptProperties(); nric = nric.trim().toUpperCase();
const rawComm = props.getProperty('COMMITTEE_LIST'); let list = rawComm ? JSON.parse(rawComm) :[];
if (isAdding) { if (!list.find(c => c.nric === nric)) list.push({ nric, name: name.trim(), phone: phone.trim() }); }
else { list = list.filter(c => c.nric !== nric); }
props.setProperty('COMMITTEE_LIST', JSON.stringify(list)); return getCommitteeList();
}

function modifyProjectGroups(groupName, isAdding, callerNric, colorClass) {
if (callerNric !== 'ADMIN') return { status: 'error', message: 'Only Main Admin can modify Projects.' };
const props = PropertiesService.getScriptProperties(); groupName = groupName.trim();
const rawGroups = props.getProperty('PROJECT_GROUPS'); let list = rawGroups ? JSON.parse(rawGroups) :[];
const rawColors = props.getProperty('PROJECT_COLORS'); let colors = rawColors ? JSON.parse(rawColors) : {};

if (isAdding) {
if (groupName && !list.includes(groupName)) list.push(groupName);
if (colorClass) colors[groupName] = colorClass;
} else {
list = list.filter(g => g !== groupName);
delete colors[groupName];
}
props.setProperty('PROJECT_GROUPS', JSON.stringify(list));
props.setProperty('PROJECT_COLORS', JSON.stringify(colors));
return { status: 'success', groups: list, projectColors: colors };
}

function modifyJunctures(actionType, oldName, newName) {
const props = PropertiesService.getScriptProperties(); const rawJunc = props.getProperty('ATTENDANCE_JUNCTURES');
let list = rawJunc ? JSON.parse(rawJunc) :['Morning Assembly'];
if (actionType === 'add' && newName && !list.includes(newName)) list.push(newName);
else if (actionType === 'remove' && oldName) list = list.filter(j => j !== oldName);
else if (actionType === 'edit' && oldName && newName) { const idx = list.indexOf(oldName); if (idx > -1) list[idx] = newName; }
props.setProperty('ATTENDANCE_JUNCTURES', JSON.stringify(list)); return { status: 'success', junctures: list };
}

function saveSortingRules(rules, callerNric) {
if (callerNric !== 'ADMIN' && !JSON.parse(PropertiesService.getScriptProperties().getProperty('COMMITTEE_LIST') || '[]').some(c => c.nric === callerNric)) {
return { status: 'error', message: 'Unauthorized' };
}
PropertiesService.getScriptProperties().setProperty('SORTING_RULES', JSON.stringify(rules));
return { status: 'success', sortingRules: rules };
}

function getTripFolder() {
const dbId = PropertiesService.getScriptProperties().getProperty('DB_SHEET_ID');
if (!dbId) throw new Error("No active trip folder found. Ensure registration has been opened.");
const file = DriveApp.getFileById(dbId);
const parents = file.getParents();
if (parents.hasNext()) return parents.next();
throw new Error("Trip parent folder not found.");
}

function getDriveContents(targetFolderId) {
try {
let folder;
if (!targetFolderId || targetFolderId === 'root') {
folder = getTripFolder(); 
} else {
folder = DriveApp.getFolderById(targetFolderId);
}

const files = [];
const fileIter = folder.getFiles();
while(fileIter.hasNext()) {
const f = fileIter.next();
let mime = f.getMimeType();
let url = f.getUrl();
let isShortcut = false;

if (mime === 'application/vnd.google-apps.shortcut') {
isShortcut = true;
try {
const tId = f.getTargetId();
const tMime = f.getTargetMimeType();
if (tMime === 'application/vnd.google-apps.folder') {
url = `https://drive.google.com/drive/folders/${tId}`;
} else {
url = `https://drive.google.com/open?id=${tId}`;
}
mime = tMime; 
} catch(e) { } 
}

files.push({
id: f.getId(),
name: f.getName(),
mimeType: mime,
url: url,
isShortcut: isShortcut
});
}
files.sort((a,b) => a.name.localeCompare(b.name));

const folders = [];
const folderIter = folder.getFolders();
while(folderIter.hasNext()) {
const f = folderIter.next();
folders.push({
id: f.getId(),
name: f.getName()
});
}
folders.sort((a,b) => a.name.localeCompare(b.name));

return { status: 'success', currentFolderId: folder.getId(), currentFolderName: folder.getName(), files: files, folders: folders };
} catch (e) {
return { status: 'error', message: e.message };
}
}

function uploadDriveFile(folderId, fileName, mimeType, fileData) {
try {
let folder = folderId === 'root' ? getTripFolder() : DriveApp.getFolderById(folderId);
let blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType, fileName);
folder.createFile(blob);
Utilities.sleep(1500);
return getDriveContents(folderId);
} catch (e) {
return { status: 'error', message: e.message };
}
}

function createDriveFolder(parentFolderId, folderName) {
try {
let parent = parentFolderId === 'root' ? getTripFolder() : DriveApp.getFolderById(parentFolderId);
parent.createFolder(folderName);
Utilities.sleep(1500);
return getDriveContents(parentFolderId);
} catch (e) {
return { status: 'error', message: e.message };
}
}

function createGoogleDoc(folderId, fileName, docType) {
try {
let folder = folderId === 'root' ? getTripFolder() : DriveApp.getFolderById(folderId);
let fileId;

if (docType === 'doc') {
let doc = DocumentApp.create(fileName);
fileId = doc.getId();
} else if (docType === 'sheet') {
let sheet = SpreadsheetApp.create(fileName);
fileId = sheet.getId();
} else if (docType === 'slide') {
let slide = SlidesApp.create(fileName);
fileId = slide.getId();
} else {
throw new Error("Invalid document type.");
}

let file = DriveApp.getFileById(fileId);
file.moveTo(folder);
Utilities.sleep(1500);
return getDriveContents(folderId);
} catch (e) {
return { status: 'error', message: e.message };
}
}

function renameDriveItem(itemId, isFolder, newName, currentFolderId) {
try {
if (!newName || !newName.trim()) throw new Error("New name is required.");
if (isFolder) {
DriveApp.getFolderById(itemId).setName(newName.trim());
} else {
DriveApp.getFileById(itemId).setName(newName.trim());
}
Utilities.sleep(1000);
return getDriveContents(currentFolderId);
} catch (e) {
return { status: 'error', message: e.message };
}
}

function deleteDriveItem(itemId, isFolder, currentFolderId) {
try {
if (isFolder) {
DriveApp.getFolderById(itemId).setTrashed(true);
} else {
DriveApp.getFileById(itemId).setTrashed(true);
}
Utilities.sleep(1000);
return getDriveContents(currentFolderId);
} catch (e) {
return { status: 'error', message: e.message };
}
}

function bulkDriveOperation(actionType, items, targetFolderId, singleNewName) {
try {
let targetFolder = null;
if (actionType === 'copy' || actionType === 'move') {
  targetFolder = targetFolderId === 'root' ? getTripFolder() : DriveApp.getFolderById(targetFolderId);
}

for (let i = 0; i < items.length; i++) {
  const item = items[i];
  const nameToUse = (items.length === 1 && singleNewName) ? singleNewName : item.name;

  if (actionType === 'delete') {
      if (item.isFolder) {
          DriveApp.getFolderById(item.id).setTrashed(true);
      } else {
          DriveApp.getFileById(item.id).setTrashed(true);
      }
  } else if (actionType === 'move') {
      if (item.isFolder) {
          let folder = DriveApp.getFolderById(item.id);
          folder.moveTo(targetFolder);
          if (folder.getName() !== nameToUse) folder.setName(nameToUse);
      } else {
          let file = DriveApp.getFileById(item.id);
          file.moveTo(targetFolder);
          if (file.getName() !== nameToUse) file.setName(nameToUse);
      }
  } else if (actionType === 'copy') {
      if (item.isFolder) {
          let sourceFolder = DriveApp.getFolderById(item.id);
          let newFolder = targetFolder.createFolder(nameToUse);
          copyFolderRecursive(sourceFolder, newFolder);
      } else {
          let sourceFile = DriveApp.getFileById(item.id);
          sourceFile.makeCopy(nameToUse, targetFolder);
      }
  }
}

Utilities.sleep(1500);
return getDriveContents(targetFolderId);
} catch (e) {
return { status: 'error', message: e.message };
}
}

function copyFolderRecursive(source, dest) {
let files = source.getFiles();
while (files.hasNext()) {
let file = files.next();
file.makeCopy(file.getName(), dest);
}
let folders = source.getFolders();
while (folders.hasNext()) {
let subFolder = folders.next();
let newSubFolder = dest.createFolder(subFolder.getName());
copyFolderRecursive(subFolder, newSubFolder);
}
}

function addDriveAccess(email, role) {
if (!email) return { status: 'error', message: 'Email is required.' };
email = email.trim().toLowerCase();
try {
const folder = getTripFolder();
if (role === 'editor') {
folder.addEditor(email);
} else {
folder.addViewer(email);
}
const props = PropertiesService.getScriptProperties();
const rawAccess = props.getProperty('APP_GRANTED_ACCESS');
const access = rawAccess ? JSON.parse(rawAccess) : {};
access[email] = role;
props.setProperty('APP_GRANTED_ACCESS', JSON.stringify(access));
return { status: 'success', driveAccessList: access };
} catch (error) {
return { status: 'error', message: "Failed to grant access. Make sure the email is a valid Google Account. (" + error.message + ")" };
}
}

function removeDriveAccess(email) {
if (!email) return { status: 'error', message: 'Email is required.' };
email = email.trim().toLowerCase();
const props = PropertiesService.getScriptProperties();
const rawAccess = props.getProperty('APP_GRANTED_ACCESS');
const access = rawAccess ? JSON.parse(rawAccess) : {};

if (!access[email]) {
return { status: 'error', message: 'You can only remove access for users who were added via this app interface.' };
}

try {
const folder = getTripFolder();
if (access[email] === 'editor') {
folder.removeEditor(email);
} else {
folder.removeViewer(email);
}
delete access[email];
props.setProperty('APP_GRANTED_ACCESS', JSON.stringify(access));
return { status: 'success', driveAccessList: access };
} catch (error) {
return { status: 'error', message: "Failed to remove access. (" + error.message + ")" };
}
}

function massDriveAccess(actionType, emails, role) {
if (!emails || !Array.isArray(emails) || !emails.length) return { status: 'error', message: 'Emails array is required.' };

const folder = getTripFolder();
const props = PropertiesService.getScriptProperties();
const rawAccess = props.getProperty('APP_GRANTED_ACCESS');
const access = rawAccess ? JSON.parse(rawAccess) : {};

const results = { success: [], failed: [] };

emails.forEach(email => {
email = email.trim().toLowerCase();
if (!email) return;

try {
if (actionType === 'add') {
if (role === 'editor') {
folder.addEditor(email);
} else {
folder.addViewer(email);
}
access[email] = role;
results.success.push(email);
} else if (actionType === 'remove') {
if (access[email]) {
if (access[email] === 'editor') {
folder.removeEditor(email);
} else {
folder.removeViewer(email);
}
delete access[email];
results.success.push(email);
} else {
results.failed.push({ email: email, reason: 'Not granted via app' });
}
}
} catch (error) {
results.failed.push({ email: email, reason: error.message });
}
});

props.setProperty('APP_GRANTED_ACCESS', JSON.stringify(access));
return { status: 'success', driveAccessList: access, results: results };
}

function fetchAttendanceData(juncture) {
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
return { status: 'success', data: result };
}

function syncAttendanceUpdate(juncture, updates, takenBy) {
const ss = getDatabase();
const sheet = ss.getSheetByName("Attendance");
if(!sheet) return { status: 'error', message: 'Sheet not found.' };

const data = sheet.getDataRange().getValues();
const lock = LockService.getScriptLock();

try {
lock.waitLock(10000);
const existingMap = {};
for (let i = 1; i < data.length; i++) {
if (data[i][0] === juncture) {
const nric = String(data[i][1]).trim().toUpperCase();
existingMap[nric] = i + 1; 
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
return { status: 'success' };
} catch (e) {
return { status: 'error', message: e.message };
} finally {
lock.releaseLock();
}
}

function archiveAndReset() {
const props = PropertiesService.getScriptProperties(); 
const dbId = props.getProperty('DB_SHEET_ID');

try {
if (dbId) {
const folder = getTripFolder();
const rawAccess = props.getProperty('APP_GRANTED_ACCESS');
if (rawAccess) {
const accessObj = JSON.parse(rawAccess);
for (let email in accessObj) {
try {
if (accessObj[email] === 'editor') { folder.removeEditor(email); } 
else { folder.removeViewer(email); }
} catch(e) { }
}
}
}
} catch (e) { console.log("Could not auto-revoke access: " + e.message); }

if (dbId) {
const t = props.getProperty('TRIP_TITLE') || 'Archived Trip'; 
const y = props.getProperty('TRIP_YEAR') || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy");
const d = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
try { DriveApp.getFileById(dbId).setName(`${t} ${y} (Archived ${d})`); } catch(e){}
}

props.deleteProperty('DB_SHEET_ID'); 
props.setProperty('REGISTRATION_OPEN', 'false'); 
props.setProperty('ALLOW_EDITS', 'false');
props.deleteProperty('TRIP_TITLE'); 
props.deleteProperty('TRIP_YEAR');
props.deleteProperty('TRIP_START_DATE');
props.deleteProperty('TRIP_END_DATE');
props.deleteProperty('COMMITTEE_LIST'); 
props.deleteProperty('ATTENDANCE_JUNCTURES');
props.deleteProperty('APP_GRANTED_ACCESS'); 
return { status: 'success' };
}