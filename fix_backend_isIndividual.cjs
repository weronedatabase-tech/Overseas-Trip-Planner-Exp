const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

// fix fetchAdminRoster
code = code.replace(
  /shortName: String\(data\[i\]\[22\]\|\|''\)\.trim\(\)\.toUpperCase\(\),\n\s*medical: String\(data\[i\]\[23\]\|\|''\)\.trim\(\),\n\s*isIndividual: String\(data\[i\]\[24\]\|\|''\)\.toUpperCase\(\) === 'TRUE',\n\s*medical: String\(data\[i\]\[23\]\|\|''\)\.trim\(\),\n\s*bus: String\(data\[i\]\[24\]\|\|''\)\.trim\(\),\n\s*logisticsGroup: String\(data\[i\]\[25\]\|\|''\)\.trim\(\)/,
  `shortName: String(data[i][22]||'').trim().toUpperCase(),\n  medical: String(data[i][23]||'').trim(),\n  bus: String(data[i][24]||'').trim(),\n  logisticsGroup: String(data[i][25]||'').trim(),\n  isIndividual: String(data[i][26]||'').toUpperCase() === 'TRUE'`
);

// fix updateProfile
code = code.replace(
  /if \(member\.medical !== undefined\) rData\[23\] = member\.medical \|\| '';\n\s*if \(member\.isIndividual !== undefined\) rData\[24\] = member\.isIndividual \? 'TRUE' : 'FALSE';/,
  `if (member.medical !== undefined) rData[23] = member.medical || '';\n  if (member.isIndividual !== undefined) rData[26] = member.isIndividual ? 'TRUE' : 'FALSE';`
);

fs.writeFileSync('backend/Code.js', code);
console.log('Fixed backend isIndividual index');
