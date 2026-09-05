const fs = require('fs');
let c = fs.readFileSync('backend/Code.js', 'utf8');

const oldBlock = `    if (extractType === 'insurance') {
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
      
    } else if (extractType === 'bus') {`;

const newBlock = `    if (extractType === 'insurance') {
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
      
      // 1. Column Widths
      sheet.setColumnWidth(1, 40); // No.
      sheet.setColumnWidth(2, 250); // Name
      sheet.setColumnWidth(3, 150); // NRIC
      sheet.setColumnWidth(4, 120); // DOB
      sheet.setColumnWidth(5, 50); // Age
      sheet.setColumnWidth(6, 120); // Nationality
      sheet.setColumnWidth(7, 80); // Gender
      sheet.setColumnWidth(8, 120); // Contact No
      sheet.setColumnWidth(9, 150); // Relationship
      sheet.setColumnWidth(10, 100); // Transport
      sheet.setColumnWidth(11, 200); // Project Group
      
      // 2. Justify left and wrap text
      dataRange.setHorizontalAlignment("left");
      dataRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
      
      // 5. Bold row 1
      sheet.getRange(1, 1, 1, rows[0].length).setFontWeight("bold");
      
      DriveApp.getFileById(fileId).moveTo(folder);
      
    } else if (extractType === 'bus') {`;

if (c.includes(oldBlock)) {
    c = c.replace(oldBlock, newBlock);
    fs.writeFileSync('backend/Code.js', c);
    console.log("Successfully replaced the block.");
} else {
    console.error("Could not find the exact old block. Check spacing/indentation.");
}