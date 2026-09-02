const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

const oldSyncAssignments = `function syncAssignments(updates, column) {
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
let dataChanged = false;

// Ensure all rows are at least colIndex + 1 in length
const targetLength = Math.max(data[0].length, colIndex + 1);
for (let i = 0; i < data.length; i++) {
    while (data[i].length < targetLength) {
        data[i].push("");
    }
}

updates.forEach(u => {
  if (existingMap[u.nric] !== undefined) {
    const rowIndex = existingMap[u.nric];
    if (data[rowIndex][colIndex] !== u.value) {
        data[rowIndex][colIndex] = u.value || '';
        dataChanged = true;
    }
  }
});

if (dataChanged) {
  if (sheet.getMaxColumns() < targetLength) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), targetLength - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, data.length, targetLength).setValues(data);
  SpreadsheetApp.flush();
  removeLargeCache(getCacheKey('ROSTER'));
  removeLargeCache(getCacheKey('LOGISTICS'));
  precomputeAppCache();
}
return { status: 'success' };

} catch(e) { return { status: 'error', message: e.message }; }
finally { lock.releaseLock(); }
}`;

const newSyncAssignments = `function syncAssignments(updates, column) {
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
let dataChanged = false;

const targetLength = Math.max(data[0].length, colIndex + 1);
if (sheet.getMaxColumns() < targetLength) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), targetLength - sheet.getMaxColumns());
}

updates.forEach(u => {
  if (existingMap[u.nric] !== undefined) {
    const rowIndex = existingMap[u.nric];
    if (data[rowIndex][colIndex] !== u.value) {
        // Target only the specific cell to update
        sheet.getRange(rowIndex + 1, colIndex + 1).setValue(u.value || '');
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
}`;

if (code.includes(oldSyncAssignments)) {
    code = code.replace(oldSyncAssignments, newSyncAssignments);
    fs.writeFileSync('backend/Code.js', code);
    console.log("Successfully replaced syncAssignments");
} else {
    console.log("Failed to find exact match. Writing to debug.txt");
    fs.writeFileSync('debug.txt', oldSyncAssignments);
}

