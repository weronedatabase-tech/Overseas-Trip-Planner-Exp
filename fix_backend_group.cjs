const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

code = code.replace(
    /return \{ role: row\.role, fullName: row\.fullName, shortName: row\.shortName, nric: row\.nric, contact: row\.contact, emergencyName: row\.emergencyName, emergencyContact: row\.emergencyContact, emergencyRelation: row\.emergencyRelation, diet: row\.diet, medical: row\.medical, otherPoints: row\.otherPoints, logisticsGroup: row\.logisticsGroup, bus: row\.bus, isGroupIC: row\.isGroupIC \}; \}\);/g,
    "return { role: row.role, fullName: row.fullName, shortName: row.shortName, nric: row.nric, contact: row.contact, emergencyName: row.emergencyName, emergencyContact: row.emergencyContact, emergencyRelation: row.emergencyRelation, diet: row.diet, medical: row.medical, otherPoints: row.otherPoints, logisticsGroup: row.logisticsGroup, bus: row.bus, isGroupIC: row.isGroupIC, pocNric: row.pocNric, group: row.group }; });"
);

fs.writeFileSync('backend/Code.js', code);
