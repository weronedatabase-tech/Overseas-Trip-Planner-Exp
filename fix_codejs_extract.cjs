const fs = require('fs');

let content = fs.readFileSync('backend/Code.js', 'utf8');

// Add the case in doPost
if (!content.includes("case 'extractData': result = extractData(")) {
    content = content.replace("case 'syncPairingUpdates': result = syncPairingUpdates(data.updates, data.takenBy || 'Admin'); break;",
                              "case 'syncPairingUpdates': result = syncPairingUpdates(data.updates, data.takenBy || 'Admin'); break;\ncase 'extractData': result = extractData(data.extractType, data.excludedNrics); break;");
}

const extractDataFunc = `
// ==========================================
// DATA EXTRACTION
// ==========================================
function extractData(extractType, excludedNrics) {
  try {
    const props = PropertiesService.getScriptProperties();
    const tripTitle = props.getProperty('TRIP_TITLE') || 'TOT';
    const tripYear = props.getProperty('TRIP_YEAR') || new Date().getFullYear();
    const rosterData = fetchAdminRoster(false).roster;
    
    // Sort array so that it's consistent.
    rosterData.sort((a,b) => String(a.fullName).localeCompare(String(b.fullName)));
    
    const targetRoster = rosterData.filter(p => !excludedNrics.includes(p.nric));
    
    const folder = getTripFolder();
    let fileId;
    
    if (extractType === 'insurance') {
      const fileName = \`Insurance Submission_\${tripTitle}_\${tripYear}\`;
      const ss = SpreadsheetApp.create(fileName);
      fileId = ss.getId();
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
            formattedDob = Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
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
          p.passportNo || p.nric || '',
          formattedDob,
          age,
          p.nationality || '',
          p.gender || '',
          p.contact || '',
          "Friend",
          "Bus",
          p.group || ''
        ]);
      });
      
      sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
      DriveApp.getFileById(fileId).moveTo(folder);
      
    } else if (extractType === 'bus') {
      const fileName = \`Bus for ICA Submission_\${tripTitle}_\${tripYear}\`;
      const ss = SpreadsheetApp.create(fileName);
      fileId = ss.getId();
      
      // Group by Bus
      const buses = {};
      targetRoster.forEach(p => {
        let b = p.bus ? String(p.bus).trim() : 'Unassigned';
        if (!b) b = 'Unassigned';
        if (!buses[b]) buses[b] = [];
        buses[b].push(p);
      });
      
      let isFirst = true;
      for (const b in buses) {
        let sheet;
        if (isFirst) {
          sheet = ss.getSheets()[0];
          sheet.setName(b);
          isFirst = false;
        } else {
          sheet = ss.insertSheet(b);
        }
        
        // Rows 1-7 bus info
        sheet.getRange("A1").setValue("Departure from Singapore Date");
        sheet.getRange("A2").setValue("Estimated time to reach checkpoint");
        sheet.getRange("A3").setValue("Arrival to Singapore Date");
        sheet.getRange("A4").setValue("Estimated time to reach checkpoint");
        sheet.getRange("A5").setValue("Checkpoint (Tuas / Woodlands)");
        sheet.getRange("A6").setValue("Point of Contact");
        sheet.getRange("A7").setValue("Bus Plate #, Assigned Bus Driver name & Passport Detail:");
        sheet.getRange("B7").setValue("1. Bus plate No: \\n2. Driver Full Name: \\n3. Driver Gender: \\n4. Driver Date of Birth: \\n5. Driver Passport Number: \\n6. Driver Passport Expiry: \\n7. Driver Nationality: \\n8. H/P: ");
        
        // Row 8 Header
        const header = ["S/N", "Full Name as per Passport", "Gender", "Date of Birth", "Passport No.", "Passport Expiry Date", "Nationality", "Medical Conditions", "Remarks", "Clients / Volunteers / Caregivers"];
        sheet.getRange("A8:J8").setValues([header]);
        
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
            '', // Medical Conditions blank
            '', // Remarks blank
            roleMapped
          ]);
        });
        
        if (rows.length > 0) {
          sheet.getRange(9, 1, rows.length, rows[0].length).setValues(rows);
        }
      }
      DriveApp.getFileById(fileId).moveTo(folder);
    }
    
    return { status: 'success', fileId: fileId };
  } catch(e) {
    return { status: 'error', message: e.message };
  }
}
`;

if (!content.includes("function extractData(")) {
    content += "\n" + extractDataFunc;
}

fs.writeFileSync('backend/Code.js', content);
