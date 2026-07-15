/* OVERSEAS TRIP APP BACKEND - Code.gs */ 
// [CONSIDERATION - ARCHITECTURE]: Upgraded to MPA standard with Strict Mutational Locks (Pillar 2) 
// and dynamic JSON Cache Chunking to bypass the 100KB limitation (Pillar 3).

const CACHE = CacheService.getScriptCache();

// ==========================================
// CACHE CHUNKING UTILITIES (Pillar 2 & 3)
// ==========================================
function setCache(key, obj) {
  const str = JSON.stringify(obj);
  const chunkSize = 90000;
  const chunks = Math.ceil(str.length / chunkSize);
  CACHE.put(key + '_meta', chunks.toString(), 21600); // 6 hours
  for(let i=0; i<chunks; i++) CACHE.put(key + '_' + i, str.substring(i*chunkSize, (i+1)*chunkSize), 21600);
}
function getCache(key) {
  const meta = CACHE.get(key + '_meta');
  if(!meta) return null;
  let str = '';
  for(let i=0; i<parseInt(meta); i++) {
    const chunk = CACHE.get(key + '_' + i);
    if(!chunk) return null; // Corrupt cache protection
    str += chunk;
  }
  try { return JSON.parse(str); } catch(e) { return null; }
}
function invCache(key) { CACHE.remove(key + '_meta'); }

// ==========================================
// SYSTEM SETUP
// ==========================================
function setupProject() {
  const props = PropertiesService.getScriptProperties();
  if(!props.getProperty('PASS_GENERAL')) props.setProperty('PASS_GENERAL', 'P@ssw0rd');
  if(!props.getProperty('PASS_ADMIN')) props.setProperty('PASS_ADMIN', 'P@ssw0rd');
  if(!props.getProperty('REGISTRATION_OPEN')) props.setProperty('REGISTRATION_OPEN', 'false');
  if(!props.getProperty('ALLOW_EDITS')) props.setProperty('ALLOW_EDITS', 'false');
  DriveApp.getRootFolder();
}

function factoryResetSettings() {
  const props = PropertiesService.getScriptProperties();
  ['COMMITTEE_LIST','PROJECT_GROUPS','PROJECT_COLORS','ATTENDANCE_JUNCTURES','SORTING_RULES','APP_GRANTED_ACCESS'].forEach(k => props.deleteProperty(k));
  invCache('SETTINGS');
}

function getDatabase() {
  const dbId = PropertiesService.getScriptProperties().getProperty('DB_SHEET_ID') || Sheet_ID;
  if (!dbId) throw new Error("No active trip database. Admin must Open Registration first.");
  return SpreadsheetApp.openById(dbId);
}

function setupSheets(ss) {
  const req = ["Raw Data", "Finance", "Rooms", "Buses", "Groups", "Pairings", "Attendance", "Minutes"];
  req.forEach(name => {
    if (!ss.getSheetByName(name)) {
      let sh = ss.insertSheet(name);
      if (name === "Raw Data") { sh.appendRow(["Timestamp", "Email address", "Trainee / Volunteer / Caregiver", "Full Name (As stated in your Passport)", "Related Trainee's Name", "Relationship with Trainee", "Which project do you belong to?", "Gender", "Contact Number", "Home Address", "Nationality", "FULL NRIC / FIN", "Passport No.", "Passport Expiry Date", "Date of Birth", "Any dietary restrictions?", "Emergency Contact Name", "Emergency Contact Number", "Relationship with Emergency Contact", "Any sleeping arrangement request?", "Other Points to Note", "Family POC NRIC", "Short Name / Nickname"]); sh.setFrozenRows(1); }
      else if (name === "Finance") { sh.appendRow(["Currency Setup", "SGD to MYR:", '=GOOGLEFINANCE("CURRENCY:SGDMYR")']); sh.appendRow(["Timestamp", "NRIC", "Name", "Total (SGD)", "PayNow Serial", "Payment Status", "CSV Match Date"]); sh.setFrozenRows(2); }
      else if (name === "Rooms") { sh.appendRow(["Room ID", "Room Name", "Capacity", "Occupants", "Last Updated", "Updated By", "Is Deleted"]); sh.setFrozenRows(1); }
      else if (name === "Attendance") { sh.appendRow(["Juncture", "NRIC", "Status", "Last Updated", "Updated By"]); sh.setFrozenRows(1); }
      else if (name === "Pairings") { sh.appendRow(["Trainee NRIC", "Volunteer NRIC", "Status", "Last Updated", "Updated By"]); sh.setFrozenRows(1); }
      else if (name === "Minutes") { sh.appendRow(["Note ID", "Meeting Date", "Content", "Assigned To", "Last Updated", "Updated By", "Is Deleted"]); sh.setFrozenRows(1); }
    }
  });
  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);
}

// ==========================================
// API ROUTER
// ==========================================
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

// ==========================================
// SETTINGS & CONFIG
// ==========================================
function getAppConfig() {
  const cached = getCache('SETTINGS');
  if (cached) return cached;
  
  const props = PropertiesService.getScriptProperties();
  const getP = (k, def) => { const v = props.getProperty(k); return v ? JSON.parse(v) : def; };
  
  let activeProjects = [];
  try {
    const dbId = props.getProperty('DB_SHEET_ID') || Sheet_ID;
    if (dbId) {
      const data = SpreadsheetApp.openById(dbId).getSheetByName("Raw Data").getDataRange().getValues();
      const projSet = new Set();
      for (let i = 1; i < data.length; i++) if (String(data[i][6]).trim()) projSet.add(String(data[i][6]).trim());
      activeProjects = Array.from(projSet);
    }
  } catch(e) {}

  const config = {
    status: 'success', registrationOpen: props.getProperty('REGISTRATION_OPEN') === 'true', allowEdits: props.getProperty('ALLOW_EDITS') === 'true',
    committee: getP('COMMITTEE_LIST', []), projectGroups: getP('PROJECT_GROUPS', []), projectColors: getP('PROJECT_COLORS', {}),
    activeProjects, junctures: getP('ATTENDANCE_JUNCTURES', ['Morning Assembly']), sortingRules: getP('SORTING_RULES', ['project', 'family', 'role', 'name']),
    driveAccessList: getP('APP_GRANTED_ACCESS', {}), tripTitle: props.getProperty('TRIP_TITLE') || '', tripYear: props.getProperty('TRIP_YEAR') || '',
    tripStartDate: props.getProperty('TRIP_START_DATE') || '', tripEndDate: props.getProperty('TRIP_END_DATE') || ''
  };
  setCache('SETTINGS', config);
  return config;
}

function handleLogin(nric, password) {
  const props = PropertiesService.getScriptProperties();
  const genPass = props.getProperty('PASS_GENERAL'); const adminPass = props.getProperty('PASS_ADMIN');
  nric = nric.trim().toUpperCase();

  if (nric === 'ADMIN' && password === adminPass) return { status: 'success', role: 'admin', name: 'Main Admin' };
  const commList = props.getProperty('COMMITTEE_LIST') ? JSON.parse(props.getProperty('COMMITTEE_LIST')) : [];
  const comm = commList.find(c => c.nric === nric);
  if (comm) {
    if (password === (adminPass + nric)) return { status: 'success', role: 'admin', name: comm.name };
    return { status: 'error', message: 'Incorrect committee password.' };
  }

  const pData = fetchAdminRoster().roster;
  const user = pData.find(p => p.nric === nric);
  if (user) {
    if (password === genPass) return { status: 'success', role: 'user', name: user.fullName };
    return { status: 'error', message: 'Incorrect password.' };
  }
  return { status: 'error', message: 'NRIC not found. Register first.' };
}

// ==========================================
// REGISTRATION & PROFILES
// ==========================================
function submitRegistration(payloadArray) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // [CONSIDERATION - CONCURRENCY]: Strict Mutational Lock
    if (PropertiesService.getScriptProperties().getProperty('REGISTRATION_OPEN') !== 'true') throw new Error("Registration is closed.");
    const sheet = getDatabase().getSheetByName("Raw Data"); 
    const pocNric = payloadArray[0].nric.toUpperCase();
    const rows = payloadArray.map(p => [
      new Date(), p.email||'', p.role||'', p.fullName||'', p.relatedTrainee||'', p.relationship||'', p.group||'', p.gender||'', p.contact||'', p.address||'', p.nationality||'',
      p.nric.toUpperCase(), p.passportNo||'', p.passportExpiry ? "'" + p.passportExpiry : '', p.dob ? "'" + p.dob : '', p.diet||'',
      p.emergencyName||'', p.emergencyContact||'', p.emergencyRelation||'', p.sleeping||'', p.otherPoints||'', pocNric, p.shortName||''
    ]);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    invCache('PARTICIPANTS');
    invCache('SETTINGS'); // Update active projects
    return { status: 'success' };
  } catch (e) { return { status: 'error', message: e.message }; } finally { lock.releaseLock(); }
}

function updateProfile(member) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (PropertiesService.getScriptProperties().getProperty('ALLOW_EDITS') !== 'true') throw new Error('Editing is locked.');
    const sheet = getDatabase().getSheetByName("Raw Data"); 
    const data = sheet.getDataRange().getValues();
    const nric = member.nric.trim().toUpperCase();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][11]).trim().toUpperCase() === nric) {
        const r = [member.email, member.role, member.fullName, member.relatedTrainee||'', member.relationship||'', member.group||'', member.gender, member.contact, member.address||'', member.nationality, data[i][11], member.passportNo, member.passportExpiry ? "'"+member.passportExpiry : '', member.dob ? "'"+member.dob : '', member.diet||'', member.emergencyName||'', member.emergencyContact||'', member.emergencyRelation||'', member.sleeping||'', member.otherPoints||'', data[i][21], member.shortName||''];
        sheet.getRange(i+1, 2, 1, 22).setValues([r]);
        invCache('PARTICIPANTS');
        return { status: 'success' };
      }
    }
    throw new Error("Record not found.");
  } catch (e) { return { status: 'error', message: e.message }; } finally { lock.releaseLock(); }
}

function getProfile(nric) {
  const pData = fetchAdminRoster().roster;
  const user = pData.find(p => p.nric === nric);
  if (!user) return {status: 'error', message: 'Profile not found.'};
  
  let targetTraineeName = null;
  if (user.role === 'TRAINEE') targetTraineeName = user.fullName.toLowerCase();
  else if (user.role === 'CAREGIVER' && user.relatedTrainee) targetTraineeName = user.relatedTrainee.toLowerCase();

  const family = pData.filter(row => {
    if (row.nric === nric) return true;
    if (targetTraineeName) {
      if (row.role === 'TRAINEE' && row.fullName.toLowerCase() === targetTraineeName) return true;
      if (row.role === 'CAREGIVER' && row.relatedTrainee.toLowerCase() === targetTraineeName) return true;
    }
    return false;
  });
  return { status: 'success', family };
}

function fetchAdminRoster() {
  const cached = getCache('PARTICIPANTS');
  if (cached) return { status: 'success', roster: cached };

  const sheet = getDatabase().getSheetByName("Raw Data");
  if(!sheet) return { status: 'success', roster: [] };
  const data = sheet.getDataRange().getValues();
  const results = [];
  for(let i = 1; i < data.length; i++) {
    if(data[i][11]) { 
      results.push({
        timestamp: data[i][0] instanceof Date ? data[i][0].getTime() : data[i][0], email: data[i][1], role: String(data[i][2]).trim().toUpperCase(), fullName: data[i][3], relatedTrainee: data[i][4], relationship: data[i][5], group: data[i][6], gender: data[i][7], contact: data[i][8], address: data[i][9], nationality: data[i][10], nric: String(data[i][11]).trim().toUpperCase(), passportNo: data[i][12], passportExpiry: data[i][13] instanceof Date ? data[i][13].toISOString() : String(data[i][13]||'').replace(/^'/,''), dob: data[i][14] instanceof Date ? data[i][14].toISOString() : String(data[i][14]||'').replace(/^'/,''), diet: data[i][15], emergencyName: data[i][16], emergencyContact: data[i][17], emergencyRelation: data[i][18], sleeping: data[i][19], otherPoints: data[i][20], pocNric: data[i][21], shortName: data[i][22]
      });
    }
  }
  setCache('PARTICIPANTS', results);
  return { status: 'success', roster: results };
}

// ==========================================
// LOGISTICS: PAIRINGS & ROOMS
// ==========================================
function fetchLogistics() {
  const participants = fetchAdminRoster().roster.map(p => ({ role: p.role, name: p.fullName, relatedTrainee: p.relatedTrainee, shortName: p.shortName, group: String(p.group).trim(), nric: p.nric, pocNric: p.pocNric, sleeping: p.sleeping, gender: p.gender }));
  const pairings = fetchPairingsOnly().pairings;
  const rooms = fetchRoomsOnly().rooms;
  return { status: 'success', participants, pairings, rooms, groups: [], buses:[] };
}

function fetchPairingsOnly() {
  const cached = getCache('PAIRINGS');
  if(cached) return { status: 'success', pairings: cached };
  
  const pairSheet = getDatabase().getSheetByName("Pairings"); 
  let pairings = [];
  if(pairSheet) {
    const pairData = pairSheet.getDataRange().getValues();
    for(let i=1; i<pairData.length; i++) {
      const t = String(pairData[i][0]).trim().toUpperCase(); const v = String(pairData[i][1]).trim().toUpperCase();
      if(t && v) {
        const tsVal = new Date(pairData[i][3]).getTime();
        pairings.push({ traineeNric: t, volNric: v, status: String(pairData[i][2]||'ACTIVE').toUpperCase(), ts: isNaN(tsVal)?0:tsVal });
      }
    }
  }
  setCache('PAIRINGS', pairings);
  return { status: 'success', pairings };
}

function syncPairingUpdates(updates, takenBy) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getDatabase();
    const sheet = ss.getSheetByName("Pairings");
    const data = sheet.getDataRange().getValues();
    const existingMap = {};
    for(let i=1; i<data.length; i++) existingMap[`${String(data[i][0]).trim().toUpperCase()}_${String(data[i][1]).trim().toUpperCase()}`] = i + 1;

    updates.forEach(u => {
      const t = String(u.traineeNric).trim().toUpperCase(); const v = String(u.volNric).trim().toUpperCase();
      const status = u.action === 'ADD' ? 'ACTIVE' : 'UNPAIRED';
      const tsDate = new Date(u.ts || Date.now());
      const key = `${t}_${v}`;

      if(existingMap[key]) {
        const rowIndex = existingMap[key];
        const exTs = new Date(data[rowIndex - 1][3]).getTime() || 0;
        if ((u.ts || Date.now()) > exTs) sheet.getRange(rowIndex, 3, 1, 3).setValues([[status, tsDate, takenBy]]);
      } else {
        sheet.appendRow([t, v, status, tsDate, takenBy]);
        existingMap[key] = sheet.getLastRow();
      }
    });
    invCache('PAIRINGS'); // Next read rebuilds it securely
    return fetchPairingsOnly();
  } catch (e) { return { status: 'error', message: e.message }; } finally { lock.releaseLock(); }
}

function fetchRoomsOnly() {
  const cached = getCache('ROOMS');
  if(cached) return { status: 'success', rooms: cached };
  
  const roomSheet = getDatabase().getSheetByName("Rooms");
  let rooms = [];
  if(roomSheet) {
    const rData = roomSheet.getDataRange().getValues();
    for(let i=1; i<rData.length; i++) {
      const id = String(rData[i][0]).trim();
      if(id && id !== "Room ID") {
        let occ = []; try { occ = JSON.parse(rData[i][3] || '[]'); } catch(e){}
        rooms.push({ id, name: String(rData[i][1]), capacity: parseInt(rData[i][2])||0, occupants: occ, ts: new Date(rData[i][4]).getTime()||0, isDeleted: String(rData[i][6]).toUpperCase()==='TRUE' });
      }
    }
  }
  setCache('ROOMS', rooms);
  return { status: 'success', rooms };
}

function syncRoomUpdates(updates, takenBy) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getDatabase();
    let sheet = ss.getSheetByName("Rooms");
    if(!sheet) { sheet = ss.insertSheet("Rooms"); sheet.appendRow(["Room ID", "Room Name", "Capacity", "Occupants", "Last Updated", "Updated By", "Is Deleted"]); sheet.setFrozenRows(1); }

    const data = sheet.getDataRange().getValues();
    const existingMap = {};
    for (let i = 1; i < data.length; i++) if(String(data[i][0]).trim()) existingMap[String(data[i][0]).trim()] = i + 1;

    updates.forEach(u => {
      const tsDate = new Date(u.ts); const isDel = u.isDeleted ? 'TRUE' : 'FALSE'; const occStr = JSON.stringify(u.occupants || []);
      if (existingMap[u.id]) {
        const rIdx = existingMap[u.id]; const exTs = new Date(data[rIdx - 1][4]).getTime()||0;
        if (u.ts > exTs) sheet.getRange(rIdx, 2, 1, 6).setValues([[u.name, u.capacity, occStr, tsDate, takenBy, isDel]]);
      } else {
        sheet.appendRow([u.id, u.name, u.capacity, occStr, tsDate, takenBy, isDel]);
        existingMap[u.id] = sheet.getLastRow();
      }
    });

    SpreadsheetApp.flush(); // Global Sweep
    const freshData = sheet.getDataRange().getValues();
    const roomsList = [];
    for(let i=1; i<freshData.length; i++) {
      const id = String(freshData[i][0]).trim();
      if(id && String(freshData[i][6]).toUpperCase() !== 'TRUE') {
        let occ = []; try { occ = JSON.parse(freshData[i][3] || '[]'); } catch(e){}
        roomsList.push({ rowIdx: i + 1, id, occupants: occ, ts: new Date(freshData[i][4]).getTime() || 0 });
      }
    }
    roomsList.sort((a,b) => b.ts - a.ts);
    const seenNrics = new Set();
    roomsList.forEach(r => {
      const newOcc = []; let changed = false;
      r.occupants.forEach(n => { if(!seenNrics.has(n)) { seenNrics.add(n); newOcc.push(n); } else changed = true; });
      if(changed) sheet.getRange(r.rowIdx, 4, 1, 2).setValues([[JSON.stringify(newOcc), new Date()]]);
    });

    invCache('ROOMS');
    return fetchRoomsOnly();
  } catch (e) { return { status: 'error', message: e.message }; } finally { lock.releaseLock(); }
}

// ==========================================
// ATTENDANCE MODULE
// ==========================================
function fetchAttendanceData(juncture) {
  const cacheKey = 'ATT_' + juncture.replace(/[^a-zA-Z0-9]/g, '');
  const cached = getCache(cacheKey);
  if(cached) return { status: 'success', data: cached };

  const sheet = getDatabase().getSheetByName("Attendance");
  const result = {};
  if(sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === juncture) {
        const tsVal = new Date(data[i][3]).getTime();
        result[String(data[i][1]).trim().toUpperCase()] = { status: (String(data[i][2]).trim() === 'true'), ts: isNaN(tsVal)?0:tsVal };
      }
    }
  }
  setCache(cacheKey, result);
  return { status: 'success', data: result };
}

function syncAttendanceUpdate(juncture, updates, takenBy) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getDatabase();
    const sheet = ss.getSheetByName("Attendance");
    const data = sheet.getDataRange().getValues();
    const existingMap = {};
    for (let i = 1; i < data.length; i++) if (data[i][0] === juncture) existingMap[String(data[i][1]).trim().toUpperCase()] = i + 1; 

    updates.forEach(u => {
      const nric = String(u.nric).trim().toUpperCase(); const tsDate = new Date(u.ts || Date.now());
      if (existingMap[nric]) {
        const rIdx = existingMap[nric]; const exTs = new Date(data[rIdx - 1][3]).getTime()||0;
        if ((u.ts||Date.now()) > exTs) sheet.getRange(rIdx, 3, 1, 3).setValues([[u.status ? 'true':'false', tsDate, takenBy]]);
      } else {
        sheet.appendRow([juncture, nric, u.status ? 'true':'false', tsDate, takenBy]);
        existingMap[nric] = sheet.getLastRow();
      }
    });
    
    invCache('ATT_' + juncture.replace(/[^a-zA-Z0-9]/g, ''));
    return { status: 'success' };
  } catch (e) { return { status: 'error', message: e.message }; } finally { lock.releaseLock(); }
}

// ==========================================
// FINANCE MODULE
// ==========================================
function setupFinanceRates(sheet) {
  const p=[["Currency","Rate to SGD"],["SGD",1],["MYR",'=IFERROR(GOOGLEFINANCE("CURRENCY:MYRSGD"), 0.28)'],["USD",'=IFERROR(GOOGLEFINANCE("CURRENCY:USDSGD"), 1.35)'],["EUR",'=IFERROR(GOOGLEFINANCE("CURRENCY:EURSGD"), 1.45)'],["GBP",'=IFERROR(GOOGLEFINANCE("CURRENCY:GBPSGD"), 1.7)'],["AUD",'=IFERROR(GOOGLEFINANCE("CURRENCY:AUDSGD"), 0.88)'],["IDR",'=IFERROR(GOOGLEFINANCE("CURRENCY:IDRSGD"), 0.00008)'],["THB",'=IFERROR(GOOGLEFINANCE("CURRENCY:THBSGD"), 0.038)'],["JPY",'=IFERROR(GOOGLEFINANCE("CURRENCY:JPYSGD"), 0.009)'],["KRW",'=IFERROR(GOOGLEFINANCE("CURRENCY:KRWSGD"), 0.001)'],["TWD",'=IFERROR(GOOGLEFINANCE("CURRENCY:TWDSGD"), 0.042)'],["PHP",'=IFERROR(GOOGLEFINANCE("CURRENCY:PHPSGD"), 0.024)'],["VND",'=IFERROR(GOOGLEFINANCE("CURRENCY:VNDSGD"), 0.00005)']];
  sheet.getRange(1, 4, p.length, 2).setValues(p); sheet.getRange(1, 4, 1, 2).setFontWeight("bold");
}

function fetchFinance() {
  const cached = getCache('FINANCE');
  const cachedRates = getCache('FINANCE_RATES');
  if(cached && cachedRates) return { status: 'success', data: cached, rates: cachedRates };

  const ss = getDatabase();
  let sheet = ss.getSheetByName("Finance Options");
  if (!sheet) { sheet = ss.insertSheet("Finance Options"); sheet.getRange("A1").setValue("JSON Data - Do Not Edit"); setupFinanceRates(sheet); SpreadsheetApp.flush(); } 
  else { if (sheet.getRange("D1").getValue() !== "Currency") { setupFinanceRates(sheet); SpreadsheetApp.flush(); } }

  let ratesObj = { "SGD": 1 };
  try { sheet.getRange(2, 4, 13, 2).getValues().forEach(r => { if(r[0] && r[1] && !isNaN(r[1])) ratesObj[String(r[0])] = parseFloat(r[1]); }); } catch(e){}
  
  const data = sheet.getDataRange().getValues();
  let jsonData = null;
  if (data.length >= 2 && data[1][0]) { try { jsonData = JSON.parse(String(data[1][0])); } catch(e) {} }

  setCache('FINANCE', jsonData); setCache('FINANCE_RATES', ratesObj);
  return { status: 'success', data: jsonData, rates: ratesObj };
}

function saveFinance(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getDatabase(); let sheet = ss.getSheetByName("Finance Options");
    if (!sheet) { sheet = ss.insertSheet("Finance Options"); sheet.getRange("A1").setValue("JSON Data - Do Not Edit"); setupFinanceRates(sheet); }

    let existingData = { options: [], config: {} };
    try { const ex = sheet.getRange(2, 1).getValue(); if(ex) existingData = JSON.parse(ex); } catch(e){}
    let changed = false;

    if (payload.config && (!existingData.config.ts || payload.config.ts > existingData.config.ts)) { existingData.config = payload.config; changed = true; }
    
    if (payload.updates && Array.isArray(payload.updates)) {
      let optMap = {}; if(existingData.options) existingData.options.forEach(o => optMap[o.id] = o);
      payload.updates.forEach(u => { const ext = optMap[u.id]; if (!ext || !ext.ts || !u.ts || u.ts > ext.ts) { optMap[u.id] = u; changed = true; } });
      existingData.options = Object.values(optMap);
    } else if (payload.options) { existingData.options = payload.options; changed = true; }

    if(changed) sheet.getRange(2, 1).setValue(JSON.stringify(existingData));
    invCache('FINANCE');
    return fetchFinance();
  } catch(e) { return { status: 'error', message: e.message }; } finally { lock.releaseLock(); }
}

// ==========================================
// MINUTES MODULE
// ==========================================
function fetchMinutes() {
  const cached = getCache('MINUTES');
  if(cached) return { status: 'success', minutes: cached };

  const sheet = getDatabase().getSheetByName("Minutes");
  if (!sheet) return { status: 'success', minutes: [] };
  const data = sheet.getDataRange().getValues();
  const minutes = [];
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0]).trim();
    if (!id || id === "Note ID") continue;
    minutes.push({ id, date: String(data[i][1]||''), content: String(data[i][2]||''), assignedTo: String(data[i][3]||''), ts: new Date(data[i][4]).getTime()||0, updatedBy: String(data[i][5]||''), isDeleted: String(data[i][6]).toUpperCase()==='TRUE' });
  }
  setCache('MINUTES', minutes);
  return { status: 'success', minutes };
}

function syncMinutes(updates, takenBy) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getDatabase(); let sheet = ss.getSheetByName("Minutes");
    if(!sheet) { sheet = ss.insertSheet("Minutes"); sheet.appendRow(["Note ID", "Meeting Date", "Content", "Assigned To", "Last Updated", "Updated By", "Is Deleted"]); sheet.setFrozenRows(1); }
    
    const data = sheet.getDataRange().getValues(); const existingMap = {};
    for (let i = 1; i < data.length; i++) if(String(data[i][0]).trim()) existingMap[String(data[i][0]).trim()] = i + 1;

    updates.forEach(u => {
      const tsDate = new Date(u.ts); const isDel = u.isDeleted ? 'TRUE' : 'FALSE';
      if (existingMap[u.id]) {
        const rIdx = existingMap[u.id]; const exTs = new Date(data[rIdx - 1][4]).getTime()||0;
        if (u.ts > exTs) sheet.getRange(rIdx, 2, 1, 6).setValues([[u.date, u.content, u.assignedTo, tsDate, u.updatedBy || takenBy, isDel]]);
      } else {
        sheet.appendRow([u.id, u.date, u.content, u.assignedTo, tsDate, u.updatedBy || takenBy, isDel]);
        existingMap[u.id] = sheet.getLastRow();
      }
    });
    invCache('MINUTES');
    return fetchMinutes();
  } catch (e) { return { status: 'error', message: e.message }; } finally { lock.releaseLock(); }
}

// ==========================================
// DRIVE UTILS (No Cache Needed - Direct API)
// ==========================================
function getTripFolder() {
  const dbId = PropertiesService.getScriptProperties().getProperty('DB_SHEET_ID');
  if (!dbId) throw new Error("No active trip folder.");
  const file = DriveApp.getFileById(dbId);
  const parents = file.getParents();
  if (parents.hasNext()) return parents.next();
  throw new Error("Trip parent folder not found.");
}

function getDriveContents(targetFolderId) {
  try {
    let folder = (!targetFolderId || targetFolderId === 'root') ? getTripFolder() : DriveApp.getFolderById(targetFolderId);
    const files = []; const fileIter = folder.getFiles();
    while(fileIter.hasNext()) {
      const f = fileIter.next(); let mime = f.getMimeType(); let url = f.getUrl(); let isShortcut = false;
      if (mime === 'application/vnd.google-apps.shortcut') { isShortcut = true; try { const tId = f.getTargetId(); const tMime = f.getTargetMimeType(); url = tMime === 'application/vnd.google-apps.folder' ? `https://drive.google.com/drive/folders/${tId}` : `https://drive.google.com/open?id=${tId}`; mime = tMime; } catch(e) {} }
      files.push({ id: f.getId(), name: f.getName(), mimeType: mime, url, isShortcut });
    }
    files.sort((a,b) => a.name.localeCompare(b.name));
    
    const folders = []; const folderIter = folder.getFolders();
    while(folderIter.hasNext()) { const f = folderIter.next(); folders.push({ id: f.getId(), name: f.getName() }); }
    folders.sort((a,b) => a.name.localeCompare(b.name));

    return { status: 'success', currentFolderId: folder.getId(), currentFolderName: folder.getName(), files, folders };
  } catch (e) { return { status: 'error', message: e.message }; }
}

// Direct Mutations (Bypassing cache logic as it's outside our JSON state scope)
function uploadDriveFile(folderId, fileName, mimeType, fileData) {
  let folder = folderId === 'root' ? getTripFolder() : DriveApp.getFolderById(folderId);
  folder.createFile(Utilities.newBlob(Utilities.base64Decode(fileData), mimeType, fileName));
  Utilities.sleep(1500); return getDriveContents(folderId);
}
function createDriveFolder(parentFolderId, folderName) {
  let parent = parentFolderId === 'root' ? getTripFolder() : DriveApp.getFolderById(parentFolderId);
  parent.createFolder(folderName); Utilities.sleep(1500); return getDriveContents(parentFolderId);
}
function createGoogleDoc(folderId, fileName, docType) {
  let folder = folderId === 'root' ? getTripFolder() : DriveApp.getFolderById(folderId); let fileId;
  if (docType === 'doc') fileId = DocumentApp.create(fileName).getId();
  else if (docType === 'sheet') fileId = SpreadsheetApp.create(fileName).getId();
  else fileId = SlidesApp.create(fileName).getId();
  DriveApp.getFileById(fileId).moveTo(folder); Utilities.sleep(1500); return getDriveContents(folderId);
}
function renameDriveItem(itemId, isFolder, newName, currentFolderId) {
  if (isFolder) DriveApp.getFolderById(itemId).setName(newName.trim()); else DriveApp.getFileById(itemId).setName(newName.trim());
  Utilities.sleep(1000); return getDriveContents(currentFolderId);
}
function deleteDriveItem(itemId, isFolder, currentFolderId) {
  if (isFolder) DriveApp.getFolderById(itemId).setTrashed(true); else DriveApp.getFileById(itemId).setTrashed(true);
  Utilities.sleep(1000); return getDriveContents(currentFolderId);
}
function bulkDriveOperation(actionType, items, targetFolderId, singleNewName) {
  let targetFolder = (actionType === 'copy' || actionType === 'move') ? (targetFolderId === 'root' ? getTripFolder() : DriveApp.getFolderById(targetFolderId)) : null;
  items.forEach(item => {
    const nameToUse = (items.length === 1 && singleNewName) ? singleNewName : item.name;
    if (actionType === 'delete') { if (item.isFolder) DriveApp.getFolderById(item.id).setTrashed(true); else DriveApp.getFileById(item.id).setTrashed(true); } 
    else if (actionType === 'move') { if (item.isFolder) { let f = DriveApp.getFolderById(item.id); f.moveTo(targetFolder); if (f.getName() !== nameToUse) f.setName(nameToUse); } else { let f = DriveApp.getFileById(item.id); f.moveTo(targetFolder); if (f.getName() !== nameToUse) f.setName(nameToUse); } } 
    else if (actionType === 'copy') { if (item.isFolder) copyFolderRecursive(DriveApp.getFolderById(item.id), targetFolder.createFolder(nameToUse)); else DriveApp.getFileById(item.id).makeCopy(nameToUse, targetFolder); }
  });
  Utilities.sleep(1500); return getDriveContents(targetFolderId);
}
function copyFolderRecursive(source, dest) {
  let files = source.getFiles(); while (files.hasNext()) { let file = files.next(); file.makeCopy(file.getName(), dest); }
  let folders = source.getFolders(); while (folders.hasNext()) { let subFolder = folders.next(); copyFolderRecursive(subFolder, dest.createFolder(subFolder.getName())); }
}

// ==========================================
// ADMIN CONFIG OPERATIONS
// ==========================================
function toggleRegistration(status, tripTitle, tripYear, tripStart, tripEnd) {
  const props = PropertiesService.getScriptProperties();
  if (status) {
    tripTitle = tripTitle || 'Overseas Trip'; tripYear = tripYear || new Date().getFullYear().toString();
    const mainFolder = DriveApp.getFolderById(Drive_Folder_ID); let subFolders = mainFolder.getFoldersByName(tripYear);
    let yearFolder = subFolders.hasNext() ? subFolders.next() : mainFolder.createFolder(tripYear);
    let files = yearFolder.getFilesByName("Active Database"); let dbId;
    if (files.hasNext()) { dbId = files.next().getId(); }
    else { let ss = SpreadsheetApp.create("Active Database"); dbId = ss.getId(); DriveApp.getFileById(dbId).moveTo(yearFolder); setupSheets(ss); }
    props.setProperty('TRIP_TITLE', tripTitle); props.setProperty('TRIP_YEAR', tripYear); 
    if(tripStart) props.setProperty('TRIP_START_DATE', tripStart); if(tripEnd) props.setProperty('TRIP_END_DATE', tripEnd);
    props.setProperty('DB_SHEET_ID', dbId);
  }
  props.setProperty('REGISTRATION_OPEN', status ? 'true' : 'false'); invCache('SETTINGS');
  return { status: 'success', tripTitle, tripYear, tripStart, tripEnd };
}
function saveTripSettings(title, year, start, end) {
  const props = PropertiesService.getScriptProperties();
  if(title) props.setProperty('TRIP_TITLE', title); if(year) props.setProperty('TRIP_YEAR', year);
  if(start) props.setProperty('TRIP_START_DATE', start); if(end) props.setProperty('TRIP_END_DATE', end);
  invCache('SETTINGS'); return { status: 'success', title, year, start, end };
}
function toggleEdits(status) { PropertiesService.getScriptProperties().setProperty('ALLOW_EDITS', status ? 'true' : 'false'); invCache('SETTINGS'); return { status: 'success' }; }
function getCommitteeList() { return { status: 'success', list: getAppConfig().committee }; }
function modifyCommitteeList(nric, isAdding, name = "", phone = "") {
  const props = PropertiesService.getScriptProperties(); nric = nric.trim().toUpperCase();
  let list = props.getProperty('COMMITTEE_LIST') ? JSON.parse(props.getProperty('COMMITTEE_LIST')) : [];
  if (isAdding) { if (!list.find(c => c.nric === nric)) list.push({ nric, name: name.trim(), phone: phone.trim() }); } else { list = list.filter(c => c.nric !== nric); }
  props.setProperty('COMMITTEE_LIST', JSON.stringify(list)); invCache('SETTINGS'); return getCommitteeList();
}
function modifyProjectGroups(groupName, isAdding, callerNric, colorClass) {
  if (callerNric !== 'ADMIN') return { status: 'error', message: 'Only Main Admin can modify.' };
  const props = PropertiesService.getScriptProperties(); groupName = groupName.trim();
  let list = props.getProperty('PROJECT_GROUPS') ? JSON.parse(props.getProperty('PROJECT_GROUPS')) : [];
  let colors = props.getProperty('PROJECT_COLORS') ? JSON.parse(props.getProperty('PROJECT_COLORS')) : {};
  if (isAdding) { if (groupName && !list.includes(groupName)) list.push(groupName); if (colorClass) colors[groupName] = colorClass; } else { list = list.filter(g => g !== groupName); delete colors[groupName]; }
  props.setProperty('PROJECT_GROUPS', JSON.stringify(list)); props.setProperty('PROJECT_COLORS', JSON.stringify(colors)); invCache('SETTINGS');
  return { status: 'success', groups: list, projectColors: colors };
}
function modifyJunctures(actionType, oldName, newName) {
  const props = PropertiesService.getScriptProperties(); let list = props.getProperty('ATTENDANCE_JUNCTURES') ? JSON.parse(props.getProperty('ATTENDANCE_JUNCTURES')) : ['Morning Assembly'];
  if (actionType === 'add' && newName && !list.includes(newName)) list.push(newName);
  else if (actionType === 'remove' && oldName) list = list.filter(j => j !== oldName);
  else if (actionType === 'edit' && oldName && newName) { const idx = list.indexOf(oldName); if (idx > -1) list[idx] = newName; }
  props.setProperty('ATTENDANCE_JUNCTURES', JSON.stringify(list)); invCache('SETTINGS'); return { status: 'success', junctures: list };
}
function saveSortingRules(rules, callerNric) {
  PropertiesService.getScriptProperties().setProperty('SORTING_RULES', JSON.stringify(rules)); invCache('SETTINGS'); return { status: 'success', sortingRules: rules };
}
function addDriveAccess(email, role) {
  const folder = getTripFolder(); if (role === 'editor') folder.addEditor(email); else folder.addViewer(email);
  const props = PropertiesService.getScriptProperties(); const access = props.getProperty('APP_GRANTED_ACCESS') ? JSON.parse(props.getProperty('APP_GRANTED_ACCESS')) : {}; access[email] = role; props.setProperty('APP_GRANTED_ACCESS', JSON.stringify(access)); invCache('SETTINGS');
  return { status: 'success', driveAccessList: access };
}
function removeDriveAccess(email) {
  const props = PropertiesService.getScriptProperties(); const access = props.getProperty('APP_GRANTED_ACCESS') ? JSON.parse(props.getProperty('APP_GRANTED_ACCESS')) : {};
  if (!access[email]) return { status: 'error', message: 'User not added via this app.' };
  const folder = getTripFolder(); if (access[email] === 'editor') folder.removeEditor(email); else folder.removeViewer(email);
  delete access[email]; props.setProperty('APP_GRANTED_ACCESS', JSON.stringify(access)); invCache('SETTINGS');
  return { status: 'success', driveAccessList: access };
}
function massDriveAccess(actionType, emails, role) {
  const folder = getTripFolder(); const props = PropertiesService.getScriptProperties(); const access = props.getProperty('APP_GRANTED_ACCESS') ? JSON.parse(props.getProperty('APP_GRANTED_ACCESS')) : {};
  const results = { success: [], failed: [] };
  emails.forEach(email => { email = email.trim().toLowerCase(); if (!email) return; try {
      if (actionType === 'add') { if (role === 'editor') folder.addEditor(email); else folder.addViewer(email); access[email] = role; results.success.push(email); } 
      else if (actionType === 'remove' && access[email]) { if (access[email] === 'editor') folder.removeEditor(email); else folder.removeViewer(email); delete access[email]; results.success.push(email); }
    } catch (e) { results.failed.push({ email, reason: e.message }); }
  });
  props.setProperty('APP_GRANTED_ACCESS', JSON.stringify(access)); invCache('SETTINGS'); return { status: 'success', driveAccessList: access, results };
}

function archiveAndReset() {
  const props = PropertiesService.getScriptProperties(); const dbId = props.getProperty('DB_SHEET_ID');
  try { if (dbId) { const folder = getTripFolder(); const accessObj = props.getProperty('APP_GRANTED_ACCESS') ? JSON.parse(props.getProperty('APP_GRANTED_ACCESS')) : {}; for (let e in accessObj) { try { if (accessObj[e] === 'editor') folder.removeEditor(e); else folder.removeViewer(e); } catch(err) {} } } } catch (e) {}
  if (dbId) { const t = props.getProperty('TRIP_TITLE') || 'Archived Trip'; const y = props.getProperty('TRIP_YEAR') || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy"); const d = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"); try { DriveApp.getFileById(dbId).setName(`${t} ${y} (Archived ${d})`); } catch(e){} }
  ['DB_SHEET_ID','TRIP_TITLE','TRIP_YEAR','TRIP_START_DATE','TRIP_END_DATE','COMMITTEE_LIST','ATTENDANCE_JUNCTURES','APP_GRANTED_ACCESS'].forEach(k => props.deleteProperty(k));
  props.setProperty('REGISTRATION_OPEN', 'false'); props.setProperty('ALLOW_EDITS', 'false'); invCache('SETTINGS'); return { status: 'success' };
}