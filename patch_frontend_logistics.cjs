const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

code = code.replace(
  /if \(!activeGroupsList\.includes\(val\)\) \{\n\s*activeGroupsList\.push\(val\);\n\s*localStorage\.setItem\('activeGroupsList', JSON\.stringify\(activeGroupsList\)\);\n\s*\}/,
  `if (!activeGroupsList.includes(val)) {\n            activeGroupsList.push(val);\n            localStorage.setItem('activeGroupsList', JSON.stringify(activeGroupsList));\n            apiCall('updateSyncMetadata', { payload: { groups: activeGroupsList } });\n        }`
);

code = code.replace(
  /if \(!activeBusesList\.includes\(val\)\) \{\n\s*activeBusesList\.push\(val\);\n\s*localStorage\.setItem\('activeBusesList', JSON\.stringify\(activeBusesList\)\);\n\s*\}/,
  `if (!activeBusesList.includes(val)) {\n            activeBusesList.push(val);\n            localStorage.setItem('activeBusesList', JSON.stringify(activeBusesList));\n            apiCall('updateSyncMetadata', { payload: { buses: activeBusesList } });\n        }`
);

fs.writeFileSync('frontend/js/logistics.js', code);
console.log('Patched frontend logistics creation');
