const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

code = code.replace(
  /pocNric: row\.pocNric, shortName: row\.shortName, medical: row\.medical, isIndividual: row\.isIndividual/,
  `pocNric: row.pocNric, shortName: row.shortName, medical: row.medical, isIndividual: row.isIndividual, logisticsGroup: row.logisticsGroup, room: row.room, bus: row.bus, pairings: row.pairings`
);

fs.writeFileSync('backend/Code.js', code);
console.log('Patched backend/Code.js');
