const fs = require('fs');
const path = './frontend/js/main.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /let targetPoc = window\.resolvePocNric \? window\.resolvePocNric\(m, sourceArr\) : \(m\.pocNric \|\| m\.nric\);[\s\S]*?if \(targetPoc\) \{[\s\S]*?familyArr = sourceArr\.filter\(f => \{[\s\S]*?if \(f\.nric === m\.nric\) return false;[\s\S]*?let fPoc = window\.resolvePocNric \? window\.resolvePocNric\(f, sourceArr\) : \(f\.pocNric \|\| f\.nric\);[\s\S]*?return fPoc === targetPoc;[\s\S]*?\}\);[\s\S]*?\}/g;

const replacement = "familyArr = window.getFamilyMembers ? window.getFamilyMembers(m.nric, sourceArr).filter(f => f.nric !== m.nric) : [];";
content = content.replace(regex, replacement);
fs.writeFileSync(path, content);
