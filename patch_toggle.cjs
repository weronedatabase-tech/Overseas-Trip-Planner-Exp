const fs = require('fs');
const path = './frontend/js/attendance.js';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `function toggleAttendanceStatus(nric, forceState) {
attendanceState[nric] = { status: forceState, ts: Date.now() }; 
pendingAttendanceUpdates.add(nric);
renderAttendanceLists();`;

const replacementStr = `function toggleAttendanceStatus(nric, forceState) {
attendanceState[nric] = { status: forceState, ts: Date.now() }; 
pendingAttendanceUpdates.add(nric);

const searchInput = document.getElementById('attSearchInput');
if (searchInput && searchInput.value) {
    searchInput.value = '';
}

renderAttendanceLists();`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Patched successfully.");
} else {
    console.log("Target string not found.");
}
