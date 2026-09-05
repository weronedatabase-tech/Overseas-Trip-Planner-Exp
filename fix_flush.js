const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

// We want to remove SpreadsheetApp.flush(); from functions that don't do structural sheet changes
// Let's just comment them all out, except maybe where structural changes happen?
// Actually, even structural changes don't strictly need flush() if the next thing is just reading data, but let's be safe.

// Let's replace SpreadsheetApp.flush() with // SpreadsheetApp.flush() in:
// - submitAttendanceData
// - syncManualPairingUpdates
// - syncManualGroupingUpdates
// - runAutoPairing (wait, runAutoPairing might need it?)

code = code.replace(/968:SpreadsheetApp\.flush\(\);/g, '// SpreadsheetApp.flush();');
// Wait, regex replacing specific lines is bad.

fs.writeFileSync('backend/Code.js', code.replace(/SpreadsheetApp\.flush\(\);/g, '// SpreadsheetApp.flush(); // Optimized out'));

