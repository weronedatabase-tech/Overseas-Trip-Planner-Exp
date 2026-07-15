// ==========================================
// ENVIRONMENT DATA MAP
// Evaluated lazily to prevent Google Apps Script load-order Reference Errors 
// ==========================================

function getParentFolderId() {
const config = {
Dev: DEV_Drive_Folder_ID,
Prod: PROD_Drive_Folder_ID,
Exp: EXP_Drive_Folder_ID
};
return config[ENV];
}

function getTemplateFolderId() {
const parentId = getParentFolderId();
const parentFolder = DriveApp.getFolderById(parentId);
const folders = parentFolder.getFoldersByName("01. Template Files");
if (folders.hasNext()) {
return folders.next().getId();
}
throw new Error("Template folder '01. Template Files' not found in the parent directory.");
}

// --- ACTIVE CONSTANTS ---
const PROP_SETTINGS = "VOL_APP_SETTINGS";

// --- API ROUTER ---
function doGet(e) {
return ContentService.createTextOutput(`MINDS MYG API is Online (${ENV} Environment).`);
}

function doPost(e) {
let request;
try {
request = JSON.parse(e.postData.contents);
} catch (err) {
return response({ success: false, message: "Invalid JSON" });
}

const action = request.action;
const payload = request.data;
let result;

try {
switch (action) {
case 'verifyAdminPassword':
result = verifyAdminPassword(payload);
break;
case 'changeAdminPassword':
result = changeAdminPassword(payload);
break;
case 'getRecentOutingSheets':
result = getRecentOutingSheets();
break;
case 'forceBackendRefresh':
result = forceBackendRefresh(payload);
break;
case 'createOuting':
result = createOuting(payload);
break;
case 'updateOuting':
result = updateOuting(payload);
break;
case 'runAutoPairing':
result = runAutoPairing(payload);
break;
case 'runAutoGrouping':
result = runAutoGrouping(payload);
break;
case 'getNamesList':
result = getNamesList(payload.url, payload.type);
break;
case 'getPersonData':
result = getPersonData(payload.url, payload.type, payload.name);
break;
case 'submitAttendanceData':
result = submitAttendanceData(payload);
break;
case 'getTemplateHeaders':
result = getTemplateHeaders();
break;
case 'getAppSettings':
result = getAppSettings();
break;
case 'saveAppSettings':
result = saveAppSettings(payload);
break;
case 'getOutingDetails':
result = getOutingDetails(payload);
break;
case 'fetchCommAttendance':
result = fetchCommAttendance(payload.sheetUrl);
break;
case 'addCommJuncture':
result = addCommJuncture(payload.sheetUrl, payload.junctureName);
break;
case 'deleteCommJuncture':
result = deleteCommJuncture(payload.sheetUrl, payload.junctureName);
break;
case 'syncCommAttendance':
result = syncCommAttendance(payload.sheetUrl, payload.multipleUpdates);
break;
case 'fetchManualPairingData':
result = fetchManualPairingData(payload.sheetUrl);
break;
case 'syncManualPairingUpdates':
result = syncManualPairingUpdates(payload.sheetUrl, payload.updates);
break;
case 'syncManualGroupingUpdates':
result = syncManualGroupingUpdates(payload.sheetUrl, payload.updates);
break;
case 'uploadExportTable':
result = uploadExportTable(payload);
break;
default:
result = { success: false, message: "Unknown Action: " + action };
}
} catch (error) {
result = { success: false, message: "Server Error: " + error.toString() };
}

return response(result);
}

function response(data) {
return ContentService.createTextOutput(JSON.stringify(data))
.setMimeType(ContentService.MimeType.JSON);
}

// --- CACHE HELPERS ---
function getCacheKey(type, url) {
const match = String(url).match(/\/d\/([a-zA-Z0-9-_]+)/);
const id = match ? match[1] : String(url).substring(0, 30);
return type + "_" + id;
}

function putLargeCache(cacheKey, jsonStr) {
const cache = CacheService.getScriptCache();
try {
if (jsonStr.length < 90000) {
cache.put(cacheKey, jsonStr, 21600); // 6 hours max
} else {
const chunks = [];
let i = 0;
while (i < jsonStr.length) {
chunks.push(jsonStr.substring(i, i + 90000));
i += 90000;
}
cache.put(cacheKey + "_count", chunks.length.toString(), 21600);
const dict = {};
for (let j = 0; j < chunks.length; j++) {
dict[cacheKey + "_" + j] = chunks[j];
}
cache.putAll(dict, 21600);
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
} catch(e) {}
return null;
}

function invalidateCaches(url) {
if (!url) return;
try {
const cache = CacheService.getScriptCache();
const types = ["pair", "comm", "stats", "names_trainee", "names_volunteer"];
let keysToRemove = [];
types.forEach(type => {
const baseKey = getCacheKey(type, url);
keysToRemove.push(baseKey, baseKey + "_count");
for (let i = 0; i < 15; i++) keysToRemove.push(baseKey + "_" + i);
});
cache.removeAll(keysToRemove);
} catch(e) {}
}

// --- ATOMIC WRITE-THROUGH CACHE (Bypasses Lock Logic internally) ---
function atomicCacheRebuild(sheetUrl, ssOpt = null) {
try {
const ss = ssOpt || SpreadsheetApp.openByUrl(sheetUrl);
fetchCommAttendance(sheetUrl, true, true, ss);
fetchManualPairingData(sheetUrl, true, true, ss);
getOutingDetails(sheetUrl, true, true, ss);
getNamesList(sheetUrl, 'trainee', true, true, ss);
getNamesList(sheetUrl, 'volunteer', true, true, ss);
} catch (e) {
console.log("Atomic cache rebuild failed, invalidating instead: " + e);
invalidateCaches(sheetUrl);
}
}

// --- CRON JOB (BACKGROUND PRE-COMPUTATION) ---
function setupCron() {
const triggers = ScriptApp.getProjectTriggers();
triggers.forEach(t => ScriptApp.deleteTrigger(t));
ScriptApp.newTrigger('precomputeRecentOutings')
 .timeBased()
 .everyMinutes(15)
 .create();
precomputeRecentOutings();
}

function precomputeRecentOutings() {
const parentFolder = DriveApp.getFolderById(getParentFolderId());
const subfolders = parentFolder.getFolders();
const folderList = [];
const regex = /(\d{8})/;
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const today = new Date();
today.setDate(today.getDate() - 1);
const tY = today.getFullYear();
const tM = String(today.getMonth() + 1).padStart(2, '0');
const tD = String(today.getDate()).padStart(2, '0');
const thresholdDateNum = parseInt(`${tY}${tM}${tD}`);

let count = 0;
while (subfolders.hasNext()) {
count++;
if (count > 500 && folderList.length >= 20) break;
let folder = subfolders.next();
let name = folder.getName();
let match = name.match(regex);
if (match) {
let dStr = match[1];
let folderDateNum = parseInt(dStr);
if (folderDateNum < thresholdDateNum) continue;

let cleanName = name.replace(dStr, "").replace(/^[_-\s]+|[_-\s]+$/g, "").trim();
let y = dStr.substring(0, 4);
let mIndex = parseInt(dStr.substring(4, 6), 10) - 1;
let d = parseInt(dStr.substring(6, 8), 10);
let prettyDate = (mIndex >= 0 && mIndex < 12 && d > 0 && d <= 31) ? `${d} ${monthNames[mIndex]} ${y}` : dStr;

folderList.push({
id: folder.getId(),
fullName: name,
displayName: cleanName || name,
formattedDate: prettyDate,
folderDateNum: folderDateNum,
folderUrl: folder.getUrl(),
sheetUrl: ""
});
}
}

folderList.sort((a, b) => a.folderDateNum !== b.folderDateNum ? a.folderDateNum - b.folderDateNum : a.fullName.localeCompare(b.fullName));

const result = [];
const limit = Math.min(folderList.length, 20);
for (let i = 0; i < limit; i++) {
let f = folderList[i];
let folderObj = DriveApp.getFolderById(f.id);
let files = folderObj.getFilesByType("application/vnd.google-apps.spreadsheet");
if (files.hasNext()) {
f.sheetUrl = files.next().getUrl();
result.push(f);
}
}

const finalResult = { success: true, data: result };
CacheService.getScriptCache().put('CRON_OUTINGS_' + ENV, JSON.stringify(finalResult), 21600); // Max 6 hours
return finalResult;
}

function getRecentOutingSheets() {
const cacheKey = "CRON_OUTINGS_" + ENV;
const cache = CacheService.getScriptCache();
let cached = cache.get(cacheKey);
if (cached) {
try { return JSON.parse(cached); } catch(e) {}
}
// If CRON cache is missing, compute it synchronously
return precomputeRecentOutings();
}

function forceBackendRefresh(payload) {
try {
CacheService.getScriptCache().remove('CRON_OUTINGS_' + ENV);
precomputeRecentOutings(); // Rebuild global list immediately

if (payload && payload.sheetUrl) {
const url = payload.sheetUrl;
invalidateCaches(url); // Destroy any local cache payload mapping to this specific sheet URL
try {
  atomicCacheRebuild(url); // Rebuild it immediately from raw spreadsheet data
} catch (e) {
  // If rebuilding fails (e.g. file deleted from drive entirely), it's fine, it's already invalidated
}
}
return { success: true, message: "Backend caches forcefully wiped and rebuilt." };
} catch(e) {
return { success: false, message: e.toString() };
}
}

// --- SHARED HELPER: AGGRESSIVE NORMALIZATION ---
function normalizeHeader(str) {
if (!str) return "";
return str.toString().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// --- SHARED HELPER: KEYWORD COLUMN FINDER ---
function getColIndex(headers, keyword) {
if (!headers || !keyword) return -1;
const key = keyword.toString().toLowerCase().replace(/[^a-z0-9]/g, "");
return headers.findIndex(h => {
if (h == null) return false;
return h.toString().toLowerCase().replace(/[^a-z0-9]/g, "").includes(key);
});
}

// --- SHARED HELPER: DYNAMIC LOCATION EXTRACTOR ---
function extractLocations(infoSheet) {
let meetLocs = [], disLocs = [], busJuncs = [];
if (!infoSheet) return { meetLocs, disLocs, busJuncs };
try {
const maxCol = infoSheet.getMaxColumns();
const maxRow = infoSheet.getLastRow();
const getList = (keyword, stopKeyword, isMeet) => {
let found = infoSheet.createTextFinder(keyword).findNext();
if (found) {
const row = found.getRow() + 1;
const col = found.getColumn();
if (col <= maxCol) {
  const vals = infoSheet.getRange(row, col, Math.min(10, maxRow - row + 1), Math.min(3, maxCol - col + 1)).getValues();
  for(let r of vals) {
      const val = String(r[0]).trim();
      if(val === "" || (stopKeyword && val.toLowerCase().includes(stopKeyword.toLowerCase()))) break;
      if (isMeet) meetLocs.push(val);
      else disLocs.push(val);
      if (r.length > 2 && (r[2] === true || String(r[2]).toLowerCase() === 'true')) {
          busJuncs.push({ name: val, type: isMeet ? 'meet' : 'dismiss' });
      }
  }
}
}
};
getList("Meeting Location", "Dismissal", true);
getList("Dismissal Location", "Timeline", false);
} catch(e) {}
return { meetLocs, disLocs, busJuncs };
}

// --- SHARED HELPER: EXPLICIT DATA EXTRACTOR FOR POPUPS & FLAGS ---
function buildExtraDataMap(ss) {
const extraData = {};
const ensureInit = (name) => {
const norm = String(name).toLowerCase().trim();
if (!extraData[norm]) extraData[norm] = {};
return norm;
};

// Process Trainee Attendance
let tSheet = ss.getSheetByName("Trainee Attendance");
if (!tSheet) tSheet = ss.getSheetByName("Trainee Attendance ");
if (tSheet) {
const tData = tSheet.getDataRange().getDisplayValues();
for (let i = 1; i < tData.length; i++) {
const row = tData[i];
const name = String(row[0]).trim();
if (name) {
const key = ensureInit(name);
extraData[key].role = 'TRAINEE';
extraData[key].t_meet = String(row[3] || '').trim(); // Col D
extraData[key].t_meet_fetching = String(row[6] || '').trim(); // Col G
extraData[key].t_dismiss = String(row[7] || '').trim(); // Col H
extraData[key].t_dismiss_fetching = String(row[8] || '').trim(); // Col I
extraData[key].t_dietary = String(row[9] || '').trim(); // Col J
extraData[key].remark = String(row[10] || '').trim(); // Col K (Remarks)
extraData[key].t_group = String(row[11] || '').trim(); // Col L
extraData[key].t_paired_vol = String(row[14] || '').trim(); // Col O
extraData[key].t_one_on_one = String(row[15] || '').trim(); // Col P
}
}
}

// Process Volunteer Attendance
const vSheet = ss.getSheetByName("Volunteer Attendance");
if (vSheet) {
const vData = vSheet.getDataRange().getDisplayValues();
for (let i = 1; i < vData.length; i++) {
const row = vData[i];
const name = String(row[0]).trim();
if (name) {
const key = ensureInit(name);
extraData[key].role = 'VOLUNTEER';
extraData[key].v_meet = String(row[3] || '').trim(); // Col D
extraData[key].v_dismiss = String(row[4] || '').trim(); // Col E
extraData[key].v_paired_trainee = String(row[5] || '').trim(); // Col F
extraData[key].v_group = String(row[6] || '').trim(); // Col G
extraData[key].remark = String(row[7] || '').trim(); // Col H (Remarks)
}
}
}

// Process MISC PriVol
const mSheet = ss.getSheetByName("MISC PriVol");
if (mSheet) {
const mData = mSheet.getDataRange().getDisplayValues();
for (let i = 1; i < mData.length; i++) {
const row = mData[i];
const name = String(row[0]).trim();
if (name) {
const key = ensureInit(name);
extraData[key].m_cg_contact = String(row[1] || '').trim(); // Col B
}
}
}

return extraData;
}

/* =========================================
AUTH LOGIC
========================================= */
function verifyAdminPassword(inputPassword) {
const correctPassword = PropertiesService.getScriptProperties().getProperty("Admin");
return inputPassword === correctPassword;
}

function changeAdminPassword(payload) {
const { currentPassword, newPassword } = payload;
const props = PropertiesService.getScriptProperties();
const storedPassword = props.getProperty("Admin");

if (currentPassword === storedPassword) {
props.setProperty("Admin", newPassword);
return { success: true, message: "Password updated successfully!" };
} else {
return { success: false, message: "Incorrect current password." };
}
}

/* =========================================
HELPER: GET PROJECT LIST FROM LOOKUP TAB
========================================= */
function getProjectList(sheetUrl) {
try {
const ss = SpreadsheetApp.openByUrl(sheetUrl);
const sheet = ss.getSheetByName("Lookup");
if (!sheet) return [];

const lastRow = sheet.getLastRow();
const lastCol = sheet.getLastColumn();
if (lastRow < 2) return [];

const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
const projIdx = getColIndex(headers, "project");

if (projIdx === -1) return [];

const data = sheet.getRange(2, projIdx + 1, lastRow - 1, 1).getValues().flat();
const projects = [...new Set(data.filter(p => p && p.toString().trim() !== ""))];
return projects.sort();
} catch (e) {
return [];
}
}

/* =========================================
CORE LOGIC (COMM PROFILE)
========================================= */

function createOuting(form) {
try {
const parentFolder = DriveApp.getFolderById(getParentFolderId());
const templateFolder = DriveApp.getFolderById(getTemplateFolderId());

const rawDate = new Date(form.eventDate);
const yyyy = rawDate.getFullYear();
const mm = String(rawDate.getMonth() + 1).padStart(2, '0');
const dd = String(rawDate.getDate()).padStart(2, '0');

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mmm = monthNames[rawDate.getMonth()];
const dateForSheet = `${dd} ${mmm} ${yyyy}`;

const folderName = `${yyyy}${mm}${dd}_${form.eventName}`;

if (parentFolder.getFoldersByName(folderName).hasNext()) return { success: false, message: "A folder with this name already exists!" };

const newFolder = parentFolder.createFolder(folderName);
const templateFiles = templateFolder.getFiles();
let sheetUrl = "";

while (templateFiles.hasNext()) {
const file = templateFiles.next();
if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
const sheetName = `${form.eventName} ${dateForSheet}`;
const newFile = file.makeCopy(sheetName, newFolder);
updateSpecificCells(newFile.getId(), form, dateForSheet);
sheetUrl = newFile.getUrl();
} else {
file.makeCopy(file.getName(), newFolder);
}
}
precomputeRecentOutings(); // Instantly update global CRON cache
return { success: true, message: "Folder created & Sheet populated!", url: newFolder.getUrl(), sheetUrl: sheetUrl };
} catch (e) {
return { success: false, message: "Error: " + e.toString() };
}
}

function updateOuting(payload) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const { sheetUrl, form } = payload;
const rawDate = new Date(form.eventDate);
const yyyy = rawDate.getFullYear();
const mm = String(rawDate.getMonth() + 1).padStart(2, '0');
const dd = String(rawDate.getDate()).padStart(2, '0');
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mmm = monthNames[rawDate.getMonth()];
const formattedDate = `${dd} ${mmm} ${yyyy}`;

const newFolderName = `${yyyy}${mm}${dd}_${form.eventName}`;
const newFileName = `${form.eventName} ${formattedDate}`;

const ss = SpreadsheetApp.openByUrl(sheetUrl);
updateSpecificCells(ss.getId(), form, formattedDate);

const file = DriveApp.getFileById(ss.getId());
file.setName(newFileName);

const parents = file.getParents();
if (parents.hasNext()) {
const folder = parents.next();
folder.setName(newFolderName);
}

precomputeRecentOutings(); // Instantly update global CRON cache
atomicCacheRebuild(sheetUrl, ss);
return { success: true, message: "Outing Details Updated!" };
} catch (e) {
return { success: false, message: e.toString() };
} finally {
lock.releaseLock();
}
}

function updateSpecificCells(spreadsheetId, form, formattedDate) {
const ss = SpreadsheetApp.openById(spreadsheetId);
let sheet = ss.getSheetByName("OutingInformation");
if (!sheet) sheet = ss.getSheets()[0];
const maxCol = sheet.getMaxColumns();
const maxRow = sheet.getMaxRows();

const setVal = (keyword, val) => {
let found = sheet.createTextFinder(keyword).findNext();
if (found && found.getColumn() < maxCol) found.offset(0, 1).setValue(val);
};

setVal("Name of Outing", form.eventName);
sheet.getRange("G5").setValue(formattedDate);

const updateList = (keyword, locs, times, buses) => {
let found = sheet.createTextFinder(keyword).findNext();
if (found) {
let row = found.getRow() + 1;
let col = found.getColumn();
const neededCols = col + 2;
if (neededCols > sheet.getMaxColumns()) {
sheet.insertColumnsAfter(sheet.getMaxColumns(), neededCols - sheet.getMaxColumns());
}
for(let i=0; i<4; i++) {
if (row + i <= maxRow) {
  sheet.getRange(row + i, col).setValue(locs[i] || "");
  sheet.getRange(row + i, col + 1).setValue(times[i] || "");
  sheet.getRange(row + i, col + 2).setValue(buses && buses[i] ? true : false);
}
}
}
};

updateList("Meeting Location", form.meetingLocs, form.meetingTimes, form.meetingBuses);
updateList("Dismissal Location", form.dismissalLocs, form.dismissalTimes, form.dismissalBuses);
}

/* =========================================
FEATURE: GET DETAILED STATS & CONFIGURATIONS
========================================= */
function getOutingDetails(sheetUrl, forceRebuild = false, skipLock = false, ssOpt = null) {
const cacheKey = getCacheKey("stats", sheetUrl);

if (!forceRebuild) {
let cached = getLargeCache(cacheKey);
if (cached) {
try { return JSON.parse(cached); } catch(e) {}
}
}

const lock = LockService.getScriptLock();
try {
if (!skipLock) lock.waitLock(15000);
if (!forceRebuild) {
let cached = getLargeCache(cacheKey);
if (cached) { try { return JSON.parse(cached); } catch(e) {} }
}

const ss = ssOpt || SpreadsheetApp.openByUrl(sheetUrl);
const tSheet = ss.getSheetByName("Traine Attendance");
const vSheet = ss.getSheetByName("Volunteer Attendance");
const infoSheet = ss.getSheetByName("OutingInformation");
let tSheetFinal = tSheet || ss.getSheetByName("Trainee Attendance ");
if (!tSheetFinal) tSheetFinal = ss.getSheetByName("Trainee Attendance");

if(!tSheetFinal || !vSheet) return { success: false, message: "Missing Tabs: 'Trainee Attendance' or 'Volunteer Attendance'" };

let outingMessage = "";
let outingConfig = {
eventName: "", eventDate: "", meetingLocs: [], meetingTimes: [], meetingBuses: [], dismissalLocs: [], dismissalTimes: [], dismissalBuses: []
};

if (infoSheet) {
try {
const maxInfoRow = infoSheet.getLastRow();
const maxInfoCol = infoSheet.getMaxColumns();

if (maxInfoRow >= 2 && maxInfoCol >= 2) {
const numRows = Math.min(maxInfoRow, 25) - 1;
if (numRows > 0) {
   outingMessage = infoSheet.getRange(2, 2, numRows, 1).getDisplayValues()
       .map(r => r[0]).join('\n').trim();
}
}

const getVal = (keyword) => {
let found = infoSheet.createTextFinder(keyword).findNext();
if (!found || found.getColumn() >= maxInfoCol) return "";
return found.offset(0, 1).getDisplayValue();
};

const getList = (keyword, stopKeyword) => {
const locs = [], times = [], buses = [];
let found = infoSheet.createTextFinder(keyword).findNext();
if (found) {
    const row = found.getRow() + 1;
    const col = found.getColumn();
    const maxRows = infoSheet.getLastRow() - row + 1;
    if (maxRows > 0 && col <= maxInfoCol) {
        const numColsToRead = Math.min(3, maxInfoCol - col + 1);
        const vals = infoSheet.getRange(row, col, Math.min(10, maxRows), numColsToRead).getValues();
        for(let r of vals) {
            const val = String(r[0]).trim();
            if(val === "" || (stopKeyword && val.toLowerCase().includes(stopKeyword.toLowerCase()))) break;
            locs.push(val);
            times.push(r.length > 1 ? String(r[1]).trim() : "");
            buses.push(r.length > 2 ? (r[2] === true || String(r[2]).toLowerCase() === 'true') : false);
        }
    }
}
return { locs, times, buses };
};

outingConfig.eventName = getVal("Name of Outing");
const dateCell = infoSheet.createTextFinder("Date").findNext();
if(dateCell && dateCell.getColumn() < maxInfoCol) {
const dVal = dateCell.offset(0,1).getValue();
if (dVal instanceof Date) {
    outingConfig.eventDate = Utilities.formatDate(dVal, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
} else {
    outingConfig.eventDate = getVal("Date"); 
}
}

const meet = getList("Meeting Location", "Dismissal");
outingConfig.meetingLocs = meet.locs; 
outingConfig.meetingTimes = meet.times;
outingConfig.meetingBuses = meet.buses;
const dis = getList("Dismissal Location", "Timeline");
outingConfig.dismissalLocs = dis.locs; 
outingConfig.dismissalTimes = dis.times;
outingConfig.dismissalBuses = dis.buses;
} catch(extractErr) { console.log(extractErr); }
}

const stats = {};
const pendingTrainees = [];
const initProj = (p) => { if(!stats[p]) stats[p] = { tY: 0, tTot: 0, cY: 0, vY: 0, vTot: 0 }; };

const tLastRow = tSheetFinal.getLastRow();
if(tLastRow > 1) {
const tData = tSheetFinal.getRange(2, 1, tLastRow-1, tSheetFinal.getLastColumn()).getValues();
const tHeaders = tSheetFinal.getRange(1, 1, 1, tSheetFinal.getLastColumn()).getValues()[0];
const tAttIdx = getColIndex(tHeaders, "attending");
const tProjIdx = getColIndex(tHeaders, "project");
const tCareIdx = getColIndex(tHeaders, "caregiver");
let tNameIdx = getColIndex(tHeaders, "name");
if (tNameIdx === -1) tNameIdx = 0;

tData.forEach(row => {
const name = row[tNameIdx] ? row[tNameIdx].toString().trim() : "";
if(!name) return;
const project = (tProjIdx > -1 && row[tProjIdx]) ? row[tProjIdx].toString().trim() : "Unassigned";
const att = (tAttIdx > -1 && row[tAttIdx]) ? row[tAttIdx].toString().trim().toLowerCase() : "";
const cgCount = (tCareIdx > -1 && row[tCareIdx]) ? parseInt(row[tCareIdx]) : 0;
initProj(project);
stats[project].tTot++;
if(att === 'y') {
stats[project].tY++;
if(!isNaN(cgCount) && cgCount > 0) stats[project].cY += cgCount;
} else if (att !== 'n') {
pendingTrainees.push(name);
}
});
}

const vLastRow = vSheet.getLastRow();
if(vLastRow > 1) {
const vData = vSheet.getRange(2, 1, vLastRow-1, vSheet.getLastColumn()).getValues();
const vHeaders = vSheet.getRange(1, 1, 1, vSheet.getLastColumn()).getValues()[0];
const vAttIdx = getColIndex(vHeaders, "attending");
const vProjIdx = getColIndex(vHeaders, "project");
let vNameIdx = getColIndex(vHeaders, "name");
if (vNameIdx === -1) vNameIdx = 0;

vData.forEach(row => {
const name = row[vNameIdx] ? row[vNameIdx].toString().trim() : "";
if(!name) return;
const project = (vProjIdx > -1 && row[vProjIdx]) ? row[vProjIdx].toString().trim() : "Unassigned";
const att = (vAttIdx > -1 && row[vAttIdx]) ? row[vAttIdx].toString().trim().toLowerCase() : "";
initProj(project);
stats[project].vTot++;
if(att === 'y') stats[project].vY++;
});
}

pendingTrainees.sort();

const result = {
success: true, stats: stats, pending: pendingTrainees,
outingConfig: outingConfig, outingMessage: outingMessage
};

putLargeCache(cacheKey, JSON.stringify(result));
return result;

} catch(e) {
return { success: false, message: e.toString() };
} finally {
if (!skipLock) lock.releaseLock();
}
}

/* =========================================
IMAGE UPLOAD (DRIVE) LOGIC
========================================= */
function uploadExportTable(payload) {
try {
const { sheetUrl, imageBase64 } = payload;
if (!sheetUrl) return { success: false, message: "Missing sheetUrl parameter. Please refresh the page and try again." };
if (!imageBase64) return { success: false, message: "Missing imageBase64 parameter." };

const ss = SpreadsheetApp.openByUrl(sheetUrl);
const fileId = ss.getId();
const file = DriveApp.getFileById(fileId);
const parents = file.getParents();
if (!parents.hasNext()) {
return { success: false, message: "Folder not found in Drive" };
}
const folder = parents.next();

const base64Data = imageBase64.split(',')[1];
const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/png', 'Groupings_Export.png');

const existing = folder.getFilesByName('Groupings_Export.png');
while (existing.hasNext()) {
existing.next().setTrashed(true);
}

const newFile = folder.createFile(blob);
newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

return { success: true, url: newFile.getUrl() };
} catch (e) {
return { success: false, message: e.toString() };
}
}

/* =========================================
MANUAL PAIRING & GROUPING DATA ENGINE
========================================= */
function fetchManualPairingData(sheetUrl, forceRebuild = false, skipLock = false, ssOpt = null) {
const cacheKey = getCacheKey("pair", sheetUrl);

if (!forceRebuild) {
let cached = getLargeCache(cacheKey);
if (cached) { try { return JSON.parse(cached); } catch(e) {} }
}

const lock = LockService.getScriptLock();
try {
if (!skipLock) lock.waitLock(15000);
if (!forceRebuild) {
let cached = getLargeCache(cacheKey);
if (cached) { try { return JSON.parse(cached); } catch(e) {} }
}

const ss = ssOpt || SpreadsheetApp.openByUrl(sheetUrl);
let tSheet = ss.getSheetByName("Trainee Attendance");
if (!tSheet) tSheet = ss.getSheetByName("Trainee Attendance ");
const vSheet = ss.getSheetByName("Volunteer Attendance");

if (!tSheet || !vSheet) return { success: false, message: "Missing Tabs" };

let meetingLocs = []; let dismissalLocs = [];
const infoSheet = ss.getSheetByName("OutingInformation");
if (infoSheet) {
try {
const ext = extractLocations(infoSheet);
meetingLocs = ext.meetLocs;
dismissalLocs = ext.disLocs;
} catch(e) {}
}

const extraDataMap = buildExtraDataMap(ss);
const trainees = []; const volunteers = [];

const tLastRow = tSheet.getLastRow();
if (tLastRow > 1) {
const tData = tSheet.getRange(2, 1, tLastRow - 1, tSheet.getLastColumn()).getValues();
const tHeaders = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0];
const tNameIdx = getColIndex(tHeaders, "name") > -1 ? getColIndex(tHeaders, "name") : 0;
const tAttIdx = getColIndex(tHeaders, "attending");
const tVolPairedIdx = getColIndex(tHeaders, "vol paired");
const tProjIdx = getColIndex(tHeaders, "project");
const tCareIdx = getColIndex(tHeaders, "caregiver");
const tGroupIdx = getColIndex(tHeaders, "outing grouping");
const goneHomeIdx = tHeaders.indexOf("[Sys] Gone Home");

tData.forEach(row => {
  const name = row[tNameIdx] ? row[tNameIdx].toString().trim() : "";
  if (name) {
      const att = (tAttIdx > -1 && row[tAttIdx]) ? row[tAttIdx].toString().toLowerCase() : "";
      trainees.push({
          name: name, role: 'TRAINEE',
          caregivers: (tCareIdx > -1 && row[tCareIdx]) ? parseInt(row[tCareIdx]) || 0 : 0,
          attending: att,
          volPaired: (tVolPairedIdx > -1 && row[tVolPairedIdx]) ? row[tVolPairedIdx].toString().trim() : "",
          project: (tProjIdx > -1 && row[tProjIdx]) ? row[tProjIdx].toString().trim() : "",
          group: (tGroupIdx > -1 && row[tGroupIdx]) ? row[tGroupIdx].toString().trim() : "",
          isAttendingN: att === 'n',
          isAttendingUnknown: att === '',
          isGoneHome: (goneHomeIdx > -1 && (row[goneHomeIdx] === true || String(row[goneHomeIdx]).toLowerCase() === 'true')),
          extra: extraDataMap[name.toLowerCase()] || {}
      });
  }
});
}

const vLastRow = vSheet.getLastRow();
if (vLastRow > 1) {
const vData = vSheet.getRange(2, 1, vLastRow - 1, vSheet.getLastColumn()).getValues();
const vHeaders = vSheet.getRange(1, 1, 1, vSheet.getLastColumn()).getValues()[0];
const vNameIdx = getColIndex(vHeaders, "name") > -1 ? getColIndex(vHeaders, "name") : 0;
const vAttIdx = getColIndex(vHeaders, "attending");
const vProjIdx = getColIndex(vHeaders, "project");
const vGroupICIdx = getColIndex(vHeaders, "group ic");
const vMeetICIdx = getColIndex(vHeaders, "meeting ic");
const vDismissICIdx = getColIndex(vHeaders, "dismissal ic");

vData.forEach(row => {
  const att = (vAttIdx > -1 && row[vAttIdx]) ? row[vAttIdx].toString().toLowerCase() : "";
  if (att === 'y') {
      const name = row[vNameIdx] ? row[vNameIdx].toString().trim() : "";
      if (name) {
          volunteers.push({
              name: name, role: 'VOLUNTEER',
              project: (vProjIdx > -1 && row[vProjIdx]) ? row[vProjIdx].toString().trim() : "",
              groupIC: (vGroupICIdx > -1 && row[vGroupICIdx]) ? (String(row[vGroupICIdx]).toLowerCase() === 'true' || String(row[vGroupICIdx]).toLowerCase() === 'y') : false,
              meetIC: (vMeetICIdx > -1 && row[vMeetICIdx]) ? (String(row[vMeetICIdx]).toLowerCase() === 'true' || String(row[vMeetICIdx]).toLowerCase() === 'y') : false,
              dismissIC: (vDismissICIdx > -1 && row[vDismissICIdx]) ? (String(row[vDismissICIdx]).toLowerCase() === 'true' || String(row[vDismissICIdx]).toLowerCase() === 'y') : false,
              extra: extraDataMap[name.toLowerCase()] || {}
          });
      }
  }
});
}

const result = { success: true, data: { trainees: trainees, volunteers: volunteers, meetingLocs: meetingLocs, dismissalLocs: dismissalLocs } };
putLargeCache(cacheKey, JSON.stringify(result));
return result;
} catch(e) {
return { success: false, message: e.toString() };
} finally {
if (!skipLock) lock.releaseLock();
}
}

function syncManualPairingUpdates(sheetUrl, updates) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const ss = SpreadsheetApp.openByUrl(sheetUrl);
let tSheet = ss.getSheetByName("Trainee Attendance");
if (!tSheet) tSheet = ss.getSheetByName("Trainee Attendance ");
if (!tSheet) return { success: false, message: "Missing Trainee Attendance Tab" };

const tLastRow = tSheet.getLastRow();
if (tLastRow < 2) return { success: true };

const tHeaders = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0];
const tNameIdx = getColIndex(tHeaders, "name") > -1 ? getColIndex(tHeaders, "name") : 0;
const tVolPairedIdx = getColIndex(tHeaders, "vol paired");

if (tVolPairedIdx === -1) return { success: false, message: "Missing 'Vol Paired' column" };

const tRange = tSheet.getRange(2, 1, tLastRow - 1, tSheet.getLastColumn());
const tData = tRange.getValues();
const tFormulas = tRange.getFormulas();

const updatesMap = {};
updates.forEach(u => {
updatesMap[u.traineeName.trim().toLowerCase()] = u.volPaired;
});

let changed = false;

for (let i = 0; i < tData.length; i++) {
const name = tData[i][tNameIdx] ? tData[i][tNameIdx].toString().trim().toLowerCase() : "";
if (name && updatesMap.hasOwnProperty(name)) {
if (tData[i][tVolPairedIdx] !== updatesMap[name]) {
tData[i][tVolPairedIdx] = updatesMap[name];
tFormulas[i][tVolPairedIdx] = ""; 
changed = true;
}
}
}

if (changed) {
let tOutput = tData.map((vals, i) => vals.map((v, c) => tFormulas[i][c] !== "" ? tFormulas[i][c] : v));
tRange.setValues(tOutput);
SpreadsheetApp.flush();
patchCachesOnPairingSync(sheetUrl, updates);
}

return { success: true };
} catch(e) {
return { success: false, message: e.toString() };
} finally {
lock.releaseLock();
}
}

function syncManualGroupingUpdates(sheetUrl, updates) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const ss = SpreadsheetApp.openByUrl(sheetUrl);

// --- Process Trainees ---
const tUpdates = updates.filter(u => u.role === 'TRAINEE' || u.traineeName);
if (tUpdates.length > 0) {
let tSheet = ss.getSheetByName("Trainee Attendance");
if (!tSheet) tSheet = ss.getSheetByName("Trainee Attendance ");
if (tSheet) {
const tLastRow = tSheet.getLastRow();
if (tLastRow >= 2) {
const tHeaders = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0];
const tNameIdx = getColIndex(tHeaders, "name") > -1 ? getColIndex(tHeaders, "name") : 0;
let tGroupIdx = getColIndex(tHeaders, "outing grouping");

if (tGroupIdx === -1) {
tGroupIdx = tHeaders.length;
tSheet.getRange(1, tGroupIdx + 1).setValue("Outing Grouping");
}

const tRange = tSheet.getRange(2, 1, tLastRow - 1, Math.max(tSheet.getLastColumn(), tGroupIdx + 1));
const tData = tRange.getValues();
const tFormulas = tRange.getFormulas();

const tUpdatesMap = {};
tUpdates.forEach(u => {
const n = u.name || u.traineeName;
tUpdatesMap[n.trim().toLowerCase()] = u.group;
});

let changed = false;
for (let i = 0; i < tData.length; i++) {
const name = tData[i][tNameIdx] ? tData[i][tNameIdx].toString().trim().toLowerCase() : "";
if (name && tUpdatesMap.hasOwnProperty(name)) {
 if (tData[i][tGroupIdx] !== tUpdatesMap[name]) {
     tData[i][tGroupIdx] = tUpdatesMap[name];
     tFormulas[i][tGroupIdx] = ""; 
     changed = true;
 }
}
}
if (changed) {
let output = tData.map((vals, i) => vals.map((v, c) => tFormulas[i][c] !== "" ? tFormulas[i][c] : v));
tRange.setValues(output);
}
}
}
}

// --- Process Volunteers (Group & Location IC Boolean toggles) ---
const vUpdates = updates.filter(u => u.role === 'VOLUNTEER');
if (vUpdates.length > 0) {
const vSheet = ss.getSheetByName("Volunteer Attendance");
if (vSheet) {
const vLastRow = vSheet.getLastRow();
if (vLastRow >= 2) {
const vHeaders = vSheet.getRange(1, 1, 1, vSheet.getLastColumn()).getValues()[0];
const vNameIdx = getColIndex(vHeaders, "name") > -1 ? getColIndex(vHeaders, "name") : 0;
let vGroupICIdx = getColIndex(vHeaders, "group ic");
let vMeetICIdx = getColIndex(vHeaders, "meeting ic");
let vDismissICIdx = getColIndex(vHeaders, "dismissal ic");

let newHeadersCount = 0;
if (vGroupICIdx === -1) { vGroupICIdx = vHeaders.length + newHeadersCount; newHeadersCount++; vSheet.getRange(1, vGroupICIdx + 1).setValue("Group IC"); }
if (vMeetICIdx === -1) { vMeetICIdx = vHeaders.length + newHeadersCount; newHeadersCount++; vSheet.getRange(1, vMeetICIdx + 1).setValue("Meeting IC"); }
if (vDismissICIdx === -1) { vDismissICIdx = vHeaders.length + newHeadersCount; newHeadersCount++; vSheet.getRange(1, vDismissICIdx + 1).setValue("Dismissal IC"); }

const maxColNeeded = Math.max(vSheet.getLastColumn(), vGroupICIdx + 1, vMeetICIdx + 1, vDismissICIdx + 1);
if (maxColNeeded > vSheet.getMaxColumns()) {
vSheet.insertColumnsAfter(vSheet.getMaxColumns(), maxColNeeded - vSheet.getMaxColumns());
}

const vRange = vSheet.getRange(2, 1, vLastRow - 1, maxColNeeded);
const vData = vRange.getValues();
const vFormulas = vRange.getFormulas();

const vUpdatesMap = {};
vUpdates.forEach(u => {
const key = u.name.trim().toLowerCase();
if (!vUpdatesMap[key]) {
  vUpdatesMap[key] = { groupIC: null, meetIC: null, dismissIC: null };
}
if (u.groupIC !== undefined) vUpdatesMap[key].groupIC = u.groupIC === true;
if (u.meetIC !== undefined) vUpdatesMap[key].meetIC = u.meetIC === true;
if (u.dismissIC !== undefined) vUpdatesMap[key].dismissIC = u.dismissIC === true;
});

let changed = false;
for (let i = 0; i < vData.length; i++) {
const name = vData[i][vNameIdx] ? vData[i][vNameIdx].toString().trim().toLowerCase() : "";
if (name && vUpdatesMap.hasOwnProperty(name)) {
 const upd = vUpdatesMap[name];
 if (upd.groupIC !== null && vData[i][vGroupICIdx] !== upd.groupIC) {
     vData[i][vGroupICIdx] = upd.groupIC; vFormulas[i][vGroupICIdx] = ""; changed = true;
 }
 if (upd.meetIC !== null && vData[i][vMeetICIdx] !== upd.meetIC) {
     vData[i][vMeetICIdx] = upd.meetIC; vFormulas[i][vMeetICIdx] = ""; changed = true;
 }
 if (upd.dismissIC !== null && vData[i][vDismissICIdx] !== upd.dismissIC) {
     vData[i][vDismissICIdx] = upd.dismissIC; vFormulas[i][vDismissICIdx] = ""; changed = true;
 }
}
}
if (changed) {
let output = vData.map((vals, i) => vals.map((v, c) => vFormulas[i][c] !== "" ? vFormulas[i][c] : v));
vRange.setValues(output);
}
}
}
}

SpreadsheetApp.flush();
patchCachesOnGroupingSync(sheetUrl, updates);
return { success: true };
} catch(e) {
return { success: false, message: e.toString() };
} finally {
lock.releaseLock();
}
}

/* =========================================
CORE LOGIC 1: MANUAL PAIRING BUTTON
========================================= */
function runAutoPairing(sheetUrl) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
if (!sheetUrl) throw new Error("Invalid URL");
const ss = SpreadsheetApp.openByUrl(sheetUrl);
let tSheet = ss.getSheetByName("Trainee Attendance");
if (!tSheet) tSheet = ss.getSheetByName("Trainee Attendance ");
const vSheet = ss.getSheetByName("Volunteer Attendance");
const mSheet = ss.getSheetByName("MISC PriVol");
if (!tSheet || !vSheet || !mSheet) return { success: false, message: "Missing Tabs" };

// 1. Get Active Volunteers
const vLastRow = vSheet.getLastRow();
const vActive = new Set();
if (vLastRow > 1) {
const vHeaders = vSheet.getRange(1,1,1,vSheet.getLastColumn()).getValues()[0];
const vAttIdx = getColIndex(vHeaders, "attending");
const vNameIdx = getColIndex(vHeaders, "name") > -1 ? getColIndex(vHeaders, "name") : 0;
const vData = vSheet.getRange(2,1,vLastRow-1,vSheet.getLastColumn()).getValues();
for(let r of vData) {
if(r[vAttIdx] && r[vAttIdx].toString().toLowerCase() === 'y') {
if(r[vNameIdx]) vActive.add(r[vNameIdx].toString().toLowerCase());
}
}
}

// 2. Get Mapping (Primary & Fallback)
const priVolMap = new Map();
const mHeaders = mSheet.getRange(1,1,1,mSheet.getLastColumn()).getValues()[0];
const mPairIdx = getColIndex(mHeaders, "outing pairing");
const mVolIdx = getColIndex(mHeaders, "vol"); // Fallback column

const mData = mSheet.getDataRange().getValues();
for(let j=1; j<mData.length; j++){
const name = mData[j][0] ? mData[j][0].toString().toLowerCase().trim() : "";
if(name) {
const primary = (mPairIdx > -1 && mData[j][mPairIdx]) ? mData[j][mPairIdx].toString().trim() : "";
const secondary = (mVolIdx > -1 && mData[j][mVolIdx]) ? mData[j][mVolIdx].toString().trim() : "";

priVolMap.set(name, { primary: primary, secondary: secondary });
}
}

// 3. Populate Trainee Vol Paired (Single Column Write)
const tLastRow = tSheet.getLastRow();
if (tLastRow > 1) {
const tHeaders = tSheet.getRange(1,1,1,tSheet.getLastColumn()).getValues()[0];
const tNameIdx = 0;
const tAttIdx = getColIndex(tHeaders, "attending");
const tVolPairedIdx = getColIndex(tHeaders, "vol paired");

if (tVolPairedIdx > -1) {
const tFullData = tSheet.getRange(2, 1, tLastRow - 1, tSheet.getLastColumn()).getValues();
const volPairedRange = tSheet.getRange(2, tVolPairedIdx + 1, tLastRow - 1, 1);
let volPairedValues = volPairedRange.getValues();

for(let k=0; k<tFullData.length; k++){
const tName = tFullData[k][tNameIdx] ? tFullData[k][tNameIdx].toString().toLowerCase().trim() : "";
const tAtt = tFullData[k][tAttIdx] ? tFullData[k][tAttIdx].toString().toLowerCase().trim() : "";

if(tName && tAtt === 'y') { // Explicit Y check required for auto pair
const assignmentInfo = priVolMap.get(tName);
if(assignmentInfo) {
if(assignmentInfo.primary && vActive.has(assignmentInfo.primary.toLowerCase())) {
volPairedValues[k][0] = assignmentInfo.primary;
} else if (assignmentInfo.secondary && vActive.has(assignmentInfo.secondary.toLowerCase())) {
volPairedValues[k][0] = assignmentInfo.secondary;
}
}
}
}

volPairedRange.setValues(volPairedValues);
SpreadsheetApp.flush(); 
}
}
atomicCacheRebuild(sheetUrl, ss);
return { success: true, message: "✅ Auto Pairing Complete!\nVolunteer Paired column updated." };
} catch (e) { 
return { success: false, message: e.toString() }; 
} finally {
lock.releaseLock();
}
}

/* =========================================
CORE LOGIC 2: MANUAL GROUPING BUTTON
========================================= */
function runAutoGrouping(sheetUrl) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
if (!sheetUrl) throw new Error("Invalid URL");
const ss = SpreadsheetApp.openByUrl(sheetUrl);
let tSheet = ss.getSheetByName("Trainee Attendance");
if (!tSheet) tSheet = ss.getSheetByName("Trainee Attendance ");
const mSheet = ss.getSheetByName("MISC PriVol");
if (!tSheet || !mSheet) return { success: false, message: "Missing Tabs" };

const groupMap = new Map();
const mHeaders = mSheet.getRange(1,1,1,mSheet.getLastColumn()).getValues()[0];
const mGroupIdx = getColIndex(mHeaders, "group");
const mData = mSheet.getDataRange().getValues();
for(let j=1; j<mData.length; j++){
if(mData[j][0] && mGroupIdx > -1) {
groupMap.set(mData[j][0].toString().toLowerCase().trim(), mData[j][mGroupIdx]);
}
}

const tLastRow = tSheet.getLastRow();
if (tLastRow > 1) {
const tRange = tSheet.getRange(2,1,tLastRow-1,tSheet.getLastColumn());
let tValues = tRange.getValues();
let tFormulas = tRange.getFormulas();

const tHeaders = tSheet.getRange(1,1,1,tSheet.getLastColumn()).getValues()[0];
const tNameIdx = 0;
const tAttIdx = getColIndex(tHeaders, "attending");
const tGroupIdx = getColIndex(tHeaders, "outing grouping");
const tVolPairedIdx = getColIndex(tHeaders, "vol paired");

if (tGroupIdx > -1) {
const volIntendedGroups = new Map();
const traineeIntendedGroup = new Map();

for(let k=0; k<tValues.length; k++){
const name = tValues[k][tNameIdx] ? tValues[k][tNameIdx].toString().toLowerCase().trim() : "";
const att = (tAttIdx > -1 && tValues[k][tAttIdx]) ? tValues[k][tAttIdx].toString().toLowerCase().trim() : "";
const volPairedStr = (tVolPairedIdx > -1 && tValues[k][tVolPairedIdx]) ? tValues[k][tVolPairedIdx].toString() : "";

if(name && att === 'y' && groupMap.has(name)) {
const intendedGroup = String(groupMap.get(name)).trim();
traineeIntendedGroup.set(name, intendedGroup);

if (volPairedStr) {
const vols = volPairedStr.split(/[,|\n]+/).map(v => v.trim().toLowerCase()).filter(v => v);
vols.forEach(v => {
if (!volIntendedGroups.has(v)) volIntendedGroups.set(v, new Set());
if (intendedGroup !== "") {
volIntendedGroups.get(v).add(intendedGroup);
}
});
}
}
}

for(let k=0; k<tValues.length; k++){
const name = tValues[k][tNameIdx] ? tValues[k][tNameIdx].toString().toLowerCase().trim() : "";
const att = (tAttIdx > -1 && tValues[k][tAttIdx]) ? tValues[k][tAttIdx].toString().toLowerCase().trim() : "";
const volPairedStr = (tVolPairedIdx > -1 && tValues[k][tVolPairedIdx]) ? tValues[k][tVolPairedIdx].toString() : "";

if(name && att === 'y' && traineeIntendedGroup.has(name)) {
const intendedGroup = traineeIntendedGroup.get(name);
let hasConflict = false;

if (volPairedStr) {
const vols = volPairedStr.split(/[,|\n]+/).map(v => v.trim().toLowerCase()).filter(v => v);
for (let v of vols) {
if (volIntendedGroups.has(v) && volIntendedGroups.get(v).size > 1) {
hasConflict = true;
break;
}
}
}

if (hasConflict) {
tValues[k][tGroupIdx] = "";
tFormulas[k][tGroupIdx] = "";
} else {
tValues[k][tGroupIdx] = intendedGroup;
tFormulas[k][tGroupIdx] = ""; 
}
}
}

let output = tValues.map((vals, i) => vals.map((v, c) => tFormulas[i][c] !== "" ? tFormulas[i][c] : v));
tRange.setValues(output);
SpreadsheetApp.flush();
}
}
atomicCacheRebuild(sheetUrl, ss);
return { success: true, message: "✅ Auto Grouping Complete!\nOuting Grouping column updated. Conflicting pairings were left unassigned." };
} catch (e) { 
return { success: false, message: e.toString() }; 
} finally {
lock.releaseLock();
}
}


/* =========================================
LIVE ATTENDANCE LOGIC (GROUPING TAB)
========================================= */

function fetchCommAttendance(sheetUrl, forceRebuild = false, skipLock = false, ssOpt = null) {
const cacheKey = getCacheKey("comm", sheetUrl);

if (!forceRebuild) {
let cached = getLargeCache(cacheKey);
if (cached) { try { return JSON.parse(cached); } catch(e) {} }
}

const lock = LockService.getScriptLock();
try {
if (!skipLock) lock.waitLock(15000);
if (!forceRebuild) {
let cached = getLargeCache(cacheKey);
if (cached) { try { return JSON.parse(cached); } catch(e) {} }
}

const ss = ssOpt || SpreadsheetApp.openByUrl(sheetUrl);
let sheet = ss.getSheetByName("Trainee Attendance") || ss.getSheetByName("Trainee Attendance ");
if (!sheet) return { success: false, message: "Trainee Attendance tab not found." };

let meetingLocs = []; let dismissalLocs = []; let busJunctures = [];
const infoSheet = ss.getSheetByName("OutingInformation");
if (infoSheet) {
try {
const ext = extractLocations(infoSheet);
meetingLocs = ext.meetLocs;
dismissalLocs = ext.disLocs;
busJunctures = ext.busJuncs;
} catch(e) {}
}

const lastRow = sheet.getLastRow();
let lastCol = sheet.getLastColumn();
if (lastRow < 2) return { success: true, participants: [], junctures: ["Meeting"], busJunctures: busJunctures, attendance: { 'Meeting': {}, '__GONE_HOME__': {} }, busAttendance: {}, meetingLocs: meetingLocs, dismissalLocs: dismissalLocs };

let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
const cgIdx = getColIndex(headers, "caregiver");
const volIdx = getColIndex(headers, "vol paired");
const meetIdx = getColIndex(headers, "meeting location");
const dismissIdx = getColIndex(headers, "dismissal location");
const groupIdx = getColIndex(headers, "outing grouping");
const attIdx = getColIndex(headers, "attending");
const goneHomeIdx = headers.indexOf("[Sys] Gone Home");

let nameIdx = getColIndex(headers, "name");
if (nameIdx === -1) nameIdx = 0; 

let junctures = [];
const junctureColMap = {}; 
headers.forEach((h, i) => {
const str = String(h);
if (str.startsWith("[Att] ")) {
  const jName = str.substring(6).trim();
  junctures.push(jName);
  junctureColMap[jName] = i;
} else if (str.startsWith("[Bus] ")) {
  const bName = str.substring(6).trim();
  junctures.push('__BUS__' + bName);
  junctureColMap['__BUS__' + bName] = i;
}
});

// ENFORCE "Meeting" Juncture to be injected if missing
let injectedMeeting = false;
if (!junctures.includes("Meeting") && lastRow >= 1) {
const targetInsertCol = lastCol + 1;

sheet.getRange(1, targetInsertCol).setValue("[Att] Meeting");
if (lastRow > 1) {
  sheet.getRange(2, targetInsertCol, lastRow - 1).insertCheckboxes();
}
SpreadsheetApp.flush();

lastCol = targetInsertCol;
headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
junctures = [];
headers.forEach((h, i) => {
  const str = String(h);
  if (str.startsWith("[Att] ")) {
      const jName = str.substring(6).trim();
      junctures.push(jName);
      junctureColMap[jName] = i;
  } else if (str.startsWith("[Bus] ")) {
      const bName = str.substring(6).trim();
      junctures.push('__BUS__' + bName);
      junctureColMap['__BUS__' + bName] = i;
  }
});
injectedMeeting = true;
}

if (junctures.includes("Meeting")) {
junctures = ["Meeting", ...junctures.filter(j => j !== "Meeting")];
}

const extraDataMap = buildExtraDataMap(ss);
const data = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];
const participants = [];
const attendance = { '__GONE_HOME__': {} };
const busAttendance = {};

junctures.forEach(j => {
if (j.startsWith('__BUS__')) {
  busAttendance[j.substring(7)] = {};
} else {
  attendance[j] = {};
}
});

data.forEach(row => {
const name = String(row[nameIdx]).trim();
const att = attIdx > -1 && row[attIdx] ? String(row[attIdx]).toLowerCase().trim() : "";

if (name && att === 'y') {
  participants.push({ 
      name: name, 
      group: groupIdx > -1 ? String(row[groupIdx]).trim() : "", 
      caregivers: cgIdx > -1 ? parseInt(row[cgIdx]) || 0 : 0, 
      volPaired: volIdx > -1 ? String(row[volIdx]).trim() : "",
      meetingLoc: meetIdx > -1 ? String(row[meetIdx]).trim() : "",
      dismissalLoc: dismissIdx > -1 ? String(row[dismissIdx]).trim() : "",
      extra: extraDataMap[name.toLowerCase()] || {}
  });

  attendance['__GONE_HOME__'][name] = (goneHomeIdx > -1 && (row[goneHomeIdx] === true || String(row[goneHomeIdx]).toLowerCase() === 'true'));
  junctures.forEach(j => {
      const val = row[junctureColMap[j]];
      if (j.startsWith('__BUS__')) {
          busAttendance[j.substring(7)][name] = val !== "" ? val : "";
      } else {
          attendance[j][name] = (val === true || String(val).toLowerCase() === 'true');
      }
  });
}
});

const result = { success: true, participants: participants, junctures: junctures.filter(j => !j.startsWith('__BUS__')), busJunctures: busJunctures, attendance: attendance, busAttendance: busAttendance, meetingLocs: meetingLocs, dismissalLocs: dismissalLocs };
putLargeCache(cacheKey, JSON.stringify(result));

if (injectedMeeting) {
invalidateCaches(sheetUrl);
}
return result;
} catch(e) { 
return { success: false, message: e.toString() }; 
} finally {
if (!skipLock) lock.releaseLock();
}
}

function syncCommAttendance(sheetUrl, multipleUpdates) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const ss = SpreadsheetApp.openByUrl(sheetUrl);
let sheet = ss.getSheetByName("Trainee Attendance") || ss.getSheetByName("Trainee Attendance ");
if (!sheet) return { success: false, message: "Trainee Attendance tab not found." };

let lastRow = sheet.getLastRow();
let lastCol = sheet.getLastColumn();

if (lastRow < 2) return { success: true };

let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

let nameIdx = getColIndex(headers, "name");
if (nameIdx === -1) nameIdx = 0;

const namesData = sheet.getRange(2, nameIdx + 1, lastRow - 1).getValues();
let changedGlobal = false;

for (const [junctureName, updates] of Object.entries(multipleUpdates)) {
let targetHeader;
let isBus = false;

if (junctureName === '__GONE_HOME__') {
targetHeader = "[Sys] Gone Home";
} else if (junctureName.startsWith('__BUS__')) {
targetHeader = `[Bus] ${junctureName.substring(7)}`;
isBus = true;
} else {
targetHeader = `[Att] ${junctureName}`;
}

let juncIdx = headers.indexOf(targetHeader);

if (juncIdx === -1) {
const newColIdx = lastCol + 1;
sheet.insertColumnAfter(lastCol);
sheet.getRange(1, newColIdx).setValue(targetHeader);
if (!isBus) {
  sheet.getRange(2, newColIdx, lastRow - 1).insertCheckboxes();
} else {
  sheet.getRange(2, newColIdx, lastRow - 1).clearDataValidations();
}
SpreadsheetApp.flush();
headers = sheet.getRange(1, 1, 1, newColIdx).getValues()[0];
lastCol = newColIdx;
juncIdx = newColIdx - 1;
}

const juncRange = sheet.getRange(2, juncIdx + 1, lastRow - 1);
const juncData = juncRange.getValues();

const updateMap = {};
updates.forEach(u => updateMap[u.name.toLowerCase()] = u.status);

let changed = false;
for (let i = 0; i < namesData.length; i++) {
const name = String(namesData[i][0]).trim().toLowerCase();
if (name && updateMap.hasOwnProperty(name)) {
  if (juncData[i][0] !== updateMap[name]) {
      juncData[i][0] = updateMap[name];
      changed = true;
  }
}
}

if (changed) {
juncRange.setValues(juncData);
changedGlobal = true;
}
}

if (changedGlobal) {
SpreadsheetApp.flush();
patchCachesOnCommSync(sheetUrl, multipleUpdates);
}
return { success: true };
} catch(e) {
return { success: false, message: e.toString() };
} finally {
lock.releaseLock();
}
}

function addCommJuncture(sheetUrl, junctureName) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
const ss = SpreadsheetApp.openByUrl(sheetUrl);
let sheet = ss.getSheetByName("Trainee Attendance") || ss.getSheetByName("Trainee Attendance ");
if (!sheet) return { success: false, message: "Trainee Attendance tab not found." };

const lastRow = sheet.getLastRow();
const lastCol = sheet.getLastColumn();
if (lastRow < 1) return { success: false, message: "Sheet is empty." };

const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
const targetHeader = `[Att] ${junctureName.trim()}`;

if (headers.includes(targetHeader)) {
return { success: false, message: "Juncture already exists." };
}

const newColIdx = lastCol + 1;
sheet.insertColumnAfter(lastCol);
sheet.getRange(1, newColIdx).setValue(targetHeader);
if (lastRow > 1) {
sheet.getRange(2, newColIdx, lastRow - 1).insertCheckboxes();
}
SpreadsheetApp.flush();
atomicCacheRebuild(sheetUrl, ss);

return fetchCommAttendance(sheetUrl, true, true, ss);
} catch(e) {
return { success: false, message: e.toString() };
} finally {
lock.releaseLock();
}
}

function deleteCommJuncture(sheetUrl, junctureName) {
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
if (junctureName === "Meeting") {
return { success: false, message: "The default 'Meeting' juncture cannot be deleted." };
}
const ss = SpreadsheetApp.openByUrl(sheetUrl);
let sheet = ss.getSheetByName("Trainee Attendance") || ss.getSheetByName("Trainee Attendance ");
if (!sheet) return { success: false, message: "Trainee Attendance tab not found." };

const lastRow = sheet.getLastRow();
const lastCol = sheet.getLastColumn();
if (lastRow < 1) return { success: false, message: "Sheet is empty." };

const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
const targetHeader = `[Att] ${junctureName.trim()}`;
const juncIdx = headers.indexOf(targetHeader);

if (juncIdx > -1) {
sheet.deleteColumn(juncIdx + 1);
SpreadsheetApp.flush();
atomicCacheRebuild(sheetUrl, ss);
return fetchCommAttendance(sheetUrl, true, true, ss);
}

return { success: false, message: "Juncture not found." };
} catch(e) {
return { success: false, message: e.toString() };
} finally {
lock.releaseLock();
}
}


/* =========================================
VOLUNTEER & SETTINGS LOGIC
========================================= */

function cleanHeader(header) {
if (!header) return "";
return header.toString().replace(/\[.*?\]/g, "").trim();
}

function getAppSettings() {
const props = PropertiesService.getScriptProperties();
const saved = props.getProperty(PROP_SETTINGS);
let settings = saved ? JSON.parse(saved) : {};
if (!settings.traineeCols) settings.traineeCols = [];
if (!settings.volCols) settings.volCols = [];
return settings;
}

function saveAppSettings(settings) {
PropertiesService.getScriptProperties().setProperty(PROP_SETTINGS, JSON.stringify(settings));
return { success: true, message: "Settings saved successfully!" };
}

function getTemplateHeaders() {
try {
const folder = DriveApp.getFolderById(getTemplateFolderId());
const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
if (!files.hasNext()) throw new Error("No Template Sheet found.");
const file = files.next();
const ss = SpreadsheetApp.openById(file.getId());
let tSheet = ss.getSheetByName("Trainee Attendance");
if (!tSheet) tSheet = ss.getSheetByName("Trainee Attendance ");
const vSheet = ss.getSheetByName("Volunteer Attendance");
if(!tSheet || !vSheet) throw new Error("Template missing required tabs.");
const tRaw = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0];
const vRaw = vSheet.getRange(1, 1, 1, vSheet.getLastColumn()).getValues()[0];
const tHeaders = tRaw.map(h => cleanHeader(h)).filter(h => h !== "");
const vHeaders = vRaw.map(h => cleanHeader(h)).filter(h => h !== "");
return { success: true, tHeaders: tHeaders, vHeaders: vHeaders };
} catch(e) { return { success: false, message: e.toString() }; }
}

function getNamesList(sheetUrl, type, forceRebuild = false, skipLock = false, ssOpt = null) {
const cacheKey = getCacheKey("names_" + type, sheetUrl);

if (!forceRebuild) {
let cached = getLargeCache(cacheKey);
if (cached) { try { return JSON.parse(cached); } catch(e) {} }
}

const lock = LockService.getScriptLock();
try {
if (!skipLock) lock.waitLock(15000);
if (!forceRebuild) {
let cached = getLargeCache(cacheKey);
if (cached) { try { return JSON.parse(cached); } catch(e) {} }
}

if (!sheetUrl || sheetUrl === "") return { success: false, message: "Invalid Sheet URL" };
const ss = ssOpt || SpreadsheetApp.openByUrl(sheetUrl);
const tabName = type === 'trainee' ? "Trainee Attendance" : "Volunteer Attendance";
let sheet = ss.getSheetByName(tabName);
if(!sheet && type === 'trainee') sheet = ss.getSheetByName("Trainee Attendance ");
if(!sheet) throw new Error(tabName + " not found.");
const lastRow = sheet.getLastRow();
if (lastRow < 2) return { success: true, names: [] };
const names = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
const cleanNames = names.filter(n => n !== "");

const result = { success: true, names: cleanNames };
putLargeCache(cacheKey, JSON.stringify(result));
return result;
} catch(e) { 
return { success: false, message: e.toString() }; 
} finally {
if (!skipLock) lock.releaseLock();
}
}

function getPersonData(sheetUrl, type, name) {
try {
if (!sheetUrl || sheetUrl === "") return { success: false, message: "Invalid Sheet URL" };
const ss = SpreadsheetApp.openByUrl(sheetUrl);
const tabName = type === 'trainee' ? "Trainee Attendance" : "Volunteer Attendance";
let sheet = ss.getSheetByName(tabName);
if(!sheet && type === 'trainee') sheet = ss.getSheetByName("Trainee Attendance ");

const infoSheet = ss.getSheetByName("OutingInformation");
let meetingLocations = [];
let dismissalLocations = [];

if (infoSheet) {
try {
const ext = extractLocations(infoSheet);
meetingLocations = ext.meetLocs;
dismissalLocations = ext.disLocs;
} catch (e) {
console.log("getPersonData extraction err: " + e);
}
}

let projects = [];
if (type === 'volunteer') {
projects = getProjectList(sheetUrl);
}

let activeVolunteers = [];
if (type === 'trainee') {
try {
const vSheet = ss.getSheetByName("Volunteer Attendance");
if (vSheet) {
const vLastRow = vSheet.getLastRow();
if (vLastRow > 1) {
const vHeaders = vSheet.getRange(1, 1, 1, vSheet.getLastColumn()).getValues()[0];
let vAttIdx = getColIndex(vHeaders, "attend");
let vNameIdx = getColIndex(vHeaders, "name");
if (vNameIdx === -1) vNameIdx = 0;
if (vAttIdx > -1) {
const vData = vSheet.getRange(2, 1, vLastRow - 1, vSheet.getLastColumn()).getValues();
activeVolunteers = vData
.filter(r => r[vAttIdx] && r[vAttIdx].toString().trim().toLowerCase() === 'y' && r[vNameIdx])
.map(r => r[vNameIdx].toString().trim());
}
}
}
} catch (err) {
console.log("Failed fetching active volunteers: " + err.toString());
}
}

const lastCol = sheet.getLastColumn();
const rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

const settings = getAppSettings();
let configCols = type === 'trainee' ? settings.traineeCols : settings.volCols;
if (!configCols || configCols.length === 0) {
const templateInfo = getTemplateHeaders();
if (templateInfo.success) configCols = type === 'trainee' ? templateInfo.tHeaders : templateInfo.vHeaders;
}

if (!name && type === 'volunteer') {
return {
success: true,
isNew: true,
data: {},
headers: rawHeaders,
config: configCols,
meetingOpts: meetingLocations,
dismissalOpts: dismissalLocations,
projectOpts: projects,
activeVolunteers: activeVolunteers
};
}

if (!name) return { success: false, message: "No name provided to search." };

const textFinder = sheet.getRange("A:A").createTextFinder(name).matchEntireCell(true);
const cell = textFinder.findNext();

if(!cell) {
if (type === 'volunteer') {
return {
success: true,
isNew: true,
data: {},
headers: rawHeaders,
config: configCols,
meetingOpts: meetingLocations,
dismissalOpts: dismissalLocations,
projectOpts: projects,
activeVolunteers: activeVolunteers
};
}
return { success: false, message: "Name not found in Trainee list." };
}

const row = cell.getRow();
const rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
let record = {};

rawHeaders.forEach((h, i) => {
let normH = normalizeHeader(h);
let key = normH;
if (normH.includes("meetinglocation")) key = "meetinglocation";
else if (normH.includes("dismissallocation")) key = "dismissallocation";
else if (normH.includes("attending")) key = "attendingyn";
else if (normH.includes("caregiver")) key = "caregiver";

if(key) {
let val = rowData[i];
if (val instanceof Date) val = Utilities.formatDate(val, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
record[key] = val;
}
});

return {
success: true, isNew: false, data: record,
headers: rawHeaders, config: configCols,
meetingOpts: meetingLocations, dismissalOpts: dismissalLocations,
projectOpts: projects,
activeVolunteers: activeVolunteers
};
} catch(e) { return { success: false, message: e.toString() }; }
}

/* =========================================
ATOMIC CACHE PATCHING (Ultra-Fast 0ms Writes)
========================================= */
function patchCachesOnAttendanceUpdate(sheetUrl, type, name, data) {
const role = String(type).toUpperCase();
const normName = String(name).toLowerCase().trim();
const cache = CacheService.getScriptCache();

let attVal = undefined;
let meetLoc = undefined;
let dismissLoc = undefined;
let groupVal = undefined;
let pairedVol = undefined;

for (const [k, v] of Object.entries(data)) {
const normKey = normalizeHeader(k);
if (normKey.includes("attending")) attVal = String(v).toLowerCase();
if (normKey.includes("meetinglocation")) meetLoc = String(v).trim();
if (normKey.includes("dismissallocation")) dismissLoc = String(v).trim();
if (normKey.includes("group")) groupVal = String(v).trim();
if (normKey.includes("volpaired")) pairedVol = String(v).trim();
}

// 1. Patch PAIR Cache
try {
const pairKey = getCacheKey("pair", sheetUrl);
const pairStr = getLargeCache(pairKey);
if (pairStr) {
const pairData = JSON.parse(pairStr);
if (pairData.success && pairData.data) {
 const arr = role === 'TRAINEE' ? pairData.data.trainees : pairData.data.volunteers;
 let person = arr.find(p => p.name.toLowerCase() === normName);
 
 if (!person) {
     person = { name: name, role: role, extra: {} };
     arr.push(person);
 }
 
 if (attVal !== undefined) {
     person.attending = attVal;
     if (role === 'TRAINEE') {
         person.isAttendingN = (attVal === 'n');
         person.isAttendingUnknown = (attVal === '');
     }
 }
 if (groupVal !== undefined && role === 'TRAINEE') person.group = groupVal;
 if (pairedVol !== undefined && role === 'TRAINEE') person.volPaired = pairedVol;
 
 // Apply Volunteer Cascade Unpairing immediately in cache
 if (role === 'VOLUNTEER' && attVal === 'n') {
     pairData.data.trainees.forEach(t => {
         if (t.volPaired && t.volPaired.toLowerCase().includes(normName)) {
             const vols = t.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
             t.volPaired = vols.filter(v => v.toLowerCase() !== normName).join(', ');
         }
     });
 } else if (role === 'TRAINEE' && attVal === 'n') {
     person.volPaired = "";
 }
 putLargeCache(pairKey, JSON.stringify(pairData));
}
}
} catch(e) {}

// 2. Patch COMM Cache
if (role === 'TRAINEE') {
try {
const commKey = getCacheKey("comm", sheetUrl);
const commStr = getLargeCache(commKey);
if (commStr) {
 const commData = JSON.parse(commStr);
 if (commData.success && commData.participants) {
     let person = commData.participants.find(p => p.name.toLowerCase() === normName);
     if (attVal === 'n' || attVal === '') {
         commData.participants = commData.participants.filter(p => p.name.toLowerCase() !== normName);
     } else {
         if (!person) {
             person = { name: name, group: "", caregivers: 0, volPaired: "", meetingLoc: "", dismissalLoc: "", extra: {} };
             commData.participants.push(person);
         }
         if (groupVal !== undefined) person.group = groupVal;
         if (pairedVol !== undefined) person.volPaired = pairedVol;
         if (meetLoc !== undefined) person.meetingLoc = meetLoc;
         if (dismissLoc !== undefined) person.dismissalLoc = dismissLoc;
     }
     putLargeCache(commKey, JSON.stringify(commData));
 }
}
} catch(e) {}
} else if (role === 'VOLUNTEER' && attVal === 'n') {
try {
const commKey = getCacheKey("comm", sheetUrl);
const commStr = getLargeCache(commKey);
if (commStr) {
 const commData = JSON.parse(commStr);
 if (commData.success && commData.participants) {
     let changed = false;
     commData.participants.forEach(t => {
         if (t.volPaired && t.volPaired.toLowerCase().includes(normName)) {
             const vols = t.volPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
             t.volPaired = vols.filter(v => v.toLowerCase() !== normName).join(', ');
             changed = true;
         }
     });
     if (changed) putLargeCache(commKey, JSON.stringify(commData));
 }
}
} catch(e) {}
}

// 3. Patch NAMES Cache
try {
const namesKey = getCacheKey("names_" + type.toLowerCase(), sheetUrl);
const namesStr = getLargeCache(namesKey);
if (namesStr) {
const namesData = JSON.parse(namesStr);
if (namesData.success && namesData.names) {
 const found = namesData.names.find(n => n.toLowerCase() === normName);
 if (!found) {
     namesData.names.push(name);
     putLargeCache(namesKey, JSON.stringify(namesData));
 }
}
}
} catch(e) {}

// 4. Invalidate STATS Cache lazily
try {
const statsKey = getCacheKey("stats", sheetUrl);
cache.remove(statsKey);
cache.remove(statsKey + "_count");
} catch(e) {}
}

function patchCachesOnCommSync(sheetUrl, multipleUpdates) {
try {
const commKey = getCacheKey("comm", sheetUrl);
const commStr = getLargeCache(commKey);
let commData = commStr ? JSON.parse(commStr) : null;

const pairKey = getCacheKey("pair", sheetUrl);
const pairStr = getLargeCache(pairKey);
let pairData = pairStr ? JSON.parse(pairStr) : null;
let pairChanged = false;

if (commData && commData.success && commData.attendance) {
for (const [juncName, updates] of Object.entries(multipleUpdates)) {
 const isGoneHome = juncName === '__GONE_HOME__';
 const isBus = juncName.startsWith('__BUS__');
 
 updates.forEach(u => {
     const nMatch = String(u.name).toLowerCase();
     if (isBus) {
         const bName = juncName.substring(7);
         if (!commData.busAttendance[bName]) commData.busAttendance[bName] = {};
         commData.busAttendance[bName][u.name] = u.status;
     } else {
         if (!commData.attendance[juncName]) commData.attendance[juncName] = {};
         commData.attendance[juncName][u.name] = u.status;
     }
     
     if (isGoneHome && pairData && pairData.success && pairData.data) {
         const trainee = pairData.data.trainees.find(t => t.name.toLowerCase() === nMatch);
         if (trainee) {
             trainee.isGoneHome = u.status;
             pairChanged = true;
         }
     }
 });
}
putLargeCache(commKey, JSON.stringify(commData));
}

if (pairChanged) {
putLargeCache(pairKey, JSON.stringify(pairData));
}
} catch(e) { console.log(e); }
}

function patchCachesOnPairingSync(sheetUrl, updates) {
try {
const pairKey = getCacheKey("pair", sheetUrl);
const pairStr = getLargeCache(pairKey);
const pairData = pairStr ? JSON.parse(pairStr) : null;

const commKey = getCacheKey("comm", sheetUrl);
const commStr = getLargeCache(commKey);
const commData = commStr ? JSON.parse(commStr) : null;

updates.forEach(u => {
const normName = String(u.traineeName).toLowerCase();
if (pairData && pairData.success && pairData.data) {
 const t = pairData.data.trainees.find(x => x.name.toLowerCase() === normName);
 if (t) t.volPaired = u.volPaired;
}
if (commData && commData.success && commData.participants) {
 const p = commData.participants.find(x => x.name.toLowerCase() === normName);
 if (p) p.volPaired = u.volPaired;
}
});

if (pairData) putLargeCache(pairKey, JSON.stringify(pairData));
if (commData) putLargeCache(commKey, JSON.stringify(commData));
} catch(e) { console.log(e); }
}

function patchCachesOnGroupingSync(sheetUrl, updates) {
try {
const pairKey = getCacheKey("pair", sheetUrl);
const pairStr = getLargeCache(pairKey);
const pairData = pairStr ? JSON.parse(pairStr) : null;

const commKey = getCacheKey("comm", sheetUrl);
const commStr = getLargeCache(commKey);
const commData = commStr ? JSON.parse(commStr) : null;

updates.forEach(u => {
const normName = String(u.name || u.traineeName).toLowerCase();
if (u.role === 'TRAINEE' || u.traineeName) {
 if (pairData && pairData.success && pairData.data) {
     const t = pairData.data.trainees.find(x => x.name.toLowerCase() === normName);
     if (t) t.group = u.group;
 }
 if (commData && commData.success && commData.participants) {
     const p = commData.participants.find(x => x.name.toLowerCase() === normName);
     if (p) p.group = u.group;
 }
} else if (u.role === 'VOLUNTEER') {
 if (pairData && pairData.success && pairData.data) {
     const v = pairData.data.volunteers.find(x => x.name.toLowerCase() === normName);
     if (v) {
         if (u.groupIC !== undefined) v.groupIC = u.groupIC;
         if (u.meetIC !== undefined) v.meetIC = u.meetIC;
         if (u.dismissIC !== undefined) v.dismissIC = u.dismissIC;
     }
 }
}
});

if (pairData) putLargeCache(pairKey, JSON.stringify(pairData));
if (commData) putLargeCache(commKey, JSON.stringify(commData));
} catch(e) { console.log(e); }
}

function submitAttendanceData(form) {
const lock = LockService.getScriptLock();
let res;
try {
lock.waitLock(15000);
res = _submitAttendanceDataInner(form);

if (res && res.success && res.ss) {
SpreadsheetApp.flush();
// Bypasses the 10-second full sheet read atomicCacheRebuild! 
patchCachesOnAttendanceUpdate(form.sheetUrl, form.type, res.targetName, form.data);
}
} catch(e) {
return { success: false, message: e.toString() };
} finally {
lock.releaseLock();
}

return { success: res ? res.success : false, message: res ? res.message : "Unknown Error" };
}

function _submitAttendanceDataInner(form) {
try {
if (!form.sheetUrl || form.sheetUrl === "") return { success: false, message: "Invalid Sheet URL" };

const ss = SpreadsheetApp.openByUrl(form.sheetUrl);
const tabName = form.type === 'trainee' ? "Trainee Attendance" : "Volunteer Attendance";
let sheet = ss.getSheetByName(tabName);
if(!sheet && form.type === 'trainee') sheet = ss.getSheetByName("Trainee Attendance ");

const name = form.targetName || form.data['Name'] || form.data[Object.keys(form.data)[0]];

if (!name) return { success: false, message: "No name selected to update." };

const textFinder = sheet.getRange("A:A").createTextFinder(name).matchEntireCell(true);
const cell = textFinder.findNext();
const rawHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

let targetRow;
let attendingStatus = '';

if (!cell) {
if (form.type === 'volunteer') {
let newRow = new Array(rawHeaders.length).fill("");
newRow[0] = name;

let projectVal = "";

for (const [cleanKey, value] of Object.entries(form.data)) {
const normKey = normalizeHeader(cleanKey);
if(normKey.includes("project")) projectVal = value;

for(let i=0; i<rawHeaders.length; i++) {
const normHeader = normalizeHeader(rawHeaders[i]);
const isMatch = normHeader === normKey ||
(normKey.includes("meetinglocation") && normHeader.includes("meetinglocation")) ||
(normKey.includes("dismissallocation") && normHeader.includes("dismissallocation")) ||
(normKey.includes("attending") && normHeader.includes("attending")) ||
(normKey.includes("caregiver") && normHeader.includes("caregiver"));
if (isMatch) {
newRow[i] = value;
if (normHeader.includes("attending")) attendingStatus = value.toString().toLowerCase();
break;
}
}
}

let insertRow = sheet.getLastRow() + 1;
if (insertRow < 2) insertRow = 2; // Prevent overwriting headers
sheet.getRange(insertRow, 1, 1, newRow.length).setValues([newRow]);

// --- UPDATE TEMPLATE (Name AND Project) ---
try {
const templateFolder = DriveApp.getFolderById(getTemplateFolderId());
const tFiles = templateFolder.getFilesByType(MimeType.GOOGLE_SHEETS);
if (tFiles.hasNext()) {
const tFile = tFiles.next();
const tSS = SpreadsheetApp.open(tFile);
const tSheet = tSS.getSheetByName("Volunteer Attendance");
const tFinder = tSheet.getRange("A:A").createTextFinder(name).matchEntireCell(true);

if (!tFinder.findNext()) {
let tInsertRow = tSheet.getLastRow() + 1;
if (tInsertRow < 2) tInsertRow = 2;

tSheet.getRange(tInsertRow, 1).setValue(name);

if(projectVal) {
const tHeaders = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0];
const tProjIdx = getColIndex(tHeaders, "project");
if (tProjIdx > -1) {
tSheet.getRange(tInsertRow, tProjIdx + 1).setValue(projectVal);
}
}
}
}
} catch (err) { console.log("Template update failed: " + err.toString()); }

return { success: true, message: "New volunteer added successfully & Attendance updated!", ss: ss, targetName: name };
} else if (form.type === 'trainee') {
let newRow = new Array(rawHeaders.length).fill("");
newRow[0] = name;

for (const [cleanKey, value] of Object.entries(form.data)) {
const normKey = normalizeHeader(cleanKey);
for(let i=0; i<rawHeaders.length; i++) {
const normHeader = normalizeHeader(rawHeaders[i]);
const isMatch = normHeader === normKey ||
(normKey.includes("meetinglocation") && normHeader.includes("meetinglocation")) ||
(normKey.includes("dismissallocation") && normHeader.includes("dismissallocation")) ||
(normKey.includes("attending") && normHeader.includes("attending")) ||
(normKey.includes("caregiver") && normHeader.includes("caregiver"));
if (isMatch) {
newRow[i] = value;
if (normHeader.includes("attending")) attendingStatus = value.toString().toLowerCase();
break;
}
}
}

let insertRow = sheet.getLastRow() + 1;
if (insertRow < 2) insertRow = 2; // Prevent overwriting headers
sheet.getRange(insertRow, 1, 1, newRow.length).setValues([newRow]);

// Inject checkboxes for dynamic columns
const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
currentHeaders.forEach((h, i) => {
const str = String(h);
if (str.startsWith("[Att] ") || str === "[Sys] Gone Home") {
  sheet.getRange(insertRow, i + 1).insertCheckboxes();
}
});

targetRow = insertRow;
}
} else {
// Existing Row Logic - BATCHED UPDATE
targetRow = cell.getRow();
const rowRange = sheet.getRange(targetRow, 1, 1, rawHeaders.length);
const rowData = rowRange.getValues()[0];
let hasChanges = false;

for (const [cleanKey, value] of Object.entries(form.data)) {
const normKey = normalizeHeader(cleanKey);
for(let i=0; i<rawHeaders.length; i++) {
const normHeader = normalizeHeader(rawHeaders[i]);
const isMatch = normHeader === normKey ||
(normKey.includes("meetinglocation") && normHeader.includes("meetinglocation")) ||
(normKey.includes("dismissallocation") && normHeader.includes("dismissallocation")) ||
(normKey.includes("attending") && normHeader.includes("attending")) ||
(normKey.includes("caregiver") && normHeader.includes("caregiver"));

if (isMatch) {
if (normHeader.includes("project")) {
break; // Project is locked after initial assignment typically unless handled otherwise
}

if (normHeader.includes("attending")) attendingStatus = value.toString().toLowerCase();

if (rowData[i] !== value) {
rowData[i] = value;
hasChanges = true;
}
break;
}
}
}

if (hasChanges) {
rowRange.setValues([rowData]);
}
}

// --- OPTIMIZED LOGICAL CASCADE (Unpairing) ---
if (form.type === 'trainee') {
if (attendingStatus === 'n') {
const tHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
const tVolPairedIdx = getColIndex(tHeaders, "vol paired");
if (tVolPairedIdx > -1) {
sheet.getRange(targetRow, tVolPairedIdx + 1).setValue("");
}
}
} else if (form.type === 'volunteer') {
if (attendingStatus === 'n') {
let tSheet = ss.getSheetByName("Trainee Attendance");
if (!tSheet) tSheet = ss.getSheetByName("Trainee Attendance ");
if (tSheet) {
const tLastRow = tSheet.getLastRow();
if (tLastRow > 1) {
const tHeaders = tSheet.getRange(1, 1, 1, tSheet.getLastColumn()).getValues()[0];
const tVolPairedIdx = getColIndex(tHeaders, "vol paired");
if (tVolPairedIdx > -1) {
 // TextFinder speeds up full-column searches massively compared to getValues()
 const searchRange = tSheet.getRange(2, tVolPairedIdx + 1, tLastRow - 1, 1);
 const finder = searchRange.createTextFinder(name).matchCase(false).findAll();
 
 if (finder.length > 0) {
     const nameClean = name.toLowerCase();
     finder.forEach(cell => {
         const currentPaired = cell.getValue().toString();
         const vols = currentPaired.split(/[,|\n]+/).map(v => v.trim()).filter(v => v);
         const updatedVols = vols.filter(v => v.toLowerCase() !== nameClean);
         cell.setValue(updatedVols.join(', '));
     });
 }
}
}
}
}
}

return { success: true, message: "Attendance updated successfully!", ss: ss, targetName: name };
} catch(e) { return { success: false, message: e.toString() }; }
}