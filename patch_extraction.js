const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

const regex = /let isFirst = true;[\s\S]*?if \(rows\.length > 0\) \{\s*sheet\.getRange\(9, 1, rows\.length, rows\[0\]\.length\)\.setValues\(rows\);\s*\}\s*\}/;

const replacement = `let isFirst = true;
      for (const b in buses) {
        let sheet;
        let tabName = b.toLowerCase() === 'unassigned' ? 'Unassigned' : (b.toLowerCase().startsWith('bus') ? b : 'Bus ' + b);
        if (isFirst) {
          sheet = ss.getSheets()[0];
          sheet.setName(tabName);
          isFirst = false;
        } else {
          sheet = ss.insertSheet(tabName);
        }
        
        // Rows 1-7 bus info
        sheet.getRange("B1").setValue("Departure from Singapore Date");
        sheet.getRange("B2").setValue("Estimated time to reach checkpoint");
        sheet.getRange("B3").setValue("Arrival to Singapore Date");
        sheet.getRange("B4").setValue("Estimated time to reach checkpoint");
        sheet.getRange("B5").setValue("Checkpoint (Tuas / Woodlands)");
        sheet.getRange("B6").setValue("Point of Contact");
        sheet.getRange("B7").setValue("Bus Plate #, Assigned Bus Driver name & Passport Detail:");
        sheet.getRange("C7").setValue("1. Bus plate No: \\n2. Driver Full Name: \\n3. Driver Gender: \\n4. Driver Date of Birth: \\n5. Driver Passport Number: \\n6. Driver Passport Expiry: \\n7. Driver Nationality: \\n8. H/P: ");
        sheet.getRange("C7").setVerticalAlignment("top").setWrap(true);
        sheet.setRowHeight(7, 130);
        
        // Row 9 Header
        const header = ["S/N", "Full Name as per Passport", "Gender", "Date of Birth", "Passport No.", "Passport Expiry Date", "Nationality", "Medical Conditions", "Remarks", "Clients / Volunteers / Caregivers"];
        sheet.getRange("A9:J9").setValues([header]).setFontWeight("bold");
        
        // Formatting column widths
        sheet.setColumnWidth(1, 40); // S/N
        sheet.setColumnWidth(2, 280); // Full Name
        sheet.setColumnWidth(3, 80); // Gender
        sheet.setColumnWidth(4, 120); // DOB
        sheet.setColumnWidth(5, 120); // Passport No
        sheet.setColumnWidth(6, 120); // Passport Expiry
        sheet.setColumnWidth(7, 120); // Nationality
        sheet.setColumnWidth(8, 200); // Medical Conditions
        sheet.setColumnWidth(9, 150); // Remarks
        sheet.setColumnWidth(10, 200); // Role
        
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
            p.medical || '', // Medical Conditions
            p.otherPoints || '', // Remarks
            roleMapped
          ]);
        });
        
        if (rows.length > 0) {
          sheet.getRange(10, 1, rows.length, rows[0].length).setValues(rows);
        }
      }`;

if(code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('backend/Code.js', code);
    console.log('Successfully patched Code.js');
} else {
    console.log('Regex did not match.');
}
