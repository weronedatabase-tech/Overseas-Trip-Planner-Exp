const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const errorLine = "    const searchWrapper = document.getElementById('icAttendanceSearchWrapper');\\n    if (searchWrapper) searchWrapper.classList.remove('hidden-force');";
const replaceLine = "    if (searchWrapper) searchWrapper.classList.remove('hidden-force');";
code = code.replace("    const searchWrapper = document.getElementById('icAttendanceSearchWrapper');\n    if (searchWrapper) searchWrapper.classList.remove('hidden-force');", "    if (searchWrapper) searchWrapper.classList.remove('hidden-force');");

fs.writeFileSync('frontend/js/profile.js', code);
console.log("Fixed");
