const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

const replacement = `const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);

if (payload.categoryId === "Fees Payment Screenshot") {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[7] === "Fees Payment Screenshot" && row[2] === payload.uploaderNric && row[10] !== true) {
      // Mark old row as deleted
      sheet.getRange(i + 1, 11).setValue(true);
      // Attempt to trash old file in Drive
      const oldUrl = row[8];
      if (oldUrl) {
        try {
          const match = oldUrl.match(/id=([^&]+)/) || oldUrl.match(/d\\/([^\\/]+)/);
          if (match && match[1]) {
            DriveApp.getFileById(match[1]).setTrashed(true);
          }
        } catch(e) {}
      }
    }
  }
}

sheet.appendRow([`;

code = code.replace(/const lock = LockService\.getScriptLock\(\);\ntry \{\nlock\.waitLock\(15000\);\nsheet\.appendRow\(\[/, replacement);

fs.writeFileSync('backend/Code.js', code);
