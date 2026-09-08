const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

// fetchAdminRoster
code = code.replace(
  /shortName: String\(data\[i\]\[22\]\|\|''\)\.trim\(\)\.toUpperCase\(\),/,
  `shortName: String(data[i][22]||'').trim().toUpperCase(),\n  medical: String(data[i][23]||'').trim(),\n  isIndividual: String(data[i][24]||'').toUpperCase() === 'TRUE',`
);

// fetchLogistics
code = code.replace(
  /sleeping: p\.sleeping\n\}\)\);/,
  `sleeping: p.sleeping,\n  isIndividual: p.isIndividual\n}));`
);

// getProfile
code = code.replace(
  /medical: row\.medical\n\s*\}\);/,
  `medical: row.medical, isIndividual: row.isIndividual\n         });`
);

// updateProfile
code = code.replace(
  /if \(member\.medical !== undefined\) rData\[23\] = member\.medical \|\| '';/,
  `if (member.medical !== undefined) rData[23] = member.medical || '';\n  if (member.isIndividual !== undefined) rData[24] = member.isIndividual ? 'TRUE' : 'FALSE';`
);

fs.writeFileSync('backend/Code.js', code);
console.log('Patched backend for isIndividual');
