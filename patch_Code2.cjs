const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

code = code.replace(/const desiredNames = String\([^)]+\)\.split\(\/\[\\\|,\]\/\)\.map\(n => n\.trim\(\)\.toLowerCase\(\)\)\.filter\(n => n\);/g, function(match) {
    return match.replace(/n\.trim\(\)\.toLowerCase\(\)/, "n.replace(/\\s+/g, '').toLowerCase()");
});

code = code.replace(/const jName = String\(data\[j\]\[3\]\)\.trim\(\)\.toLowerCase\(\);/g, "const jName = String(data[j][3] || '').replace(/\\s+/g, '').toLowerCase();");
code = code.replace(/const jShort = String\(data\[j\]\[22\]\)\.trim\(\)\.toLowerCase\(\);/g, "const jShort = String(data[j][22] || '').replace(/\\s+/g, '').toLowerCase();");

// also fix desiredNames in updateProfile
code = code.replace(/const desiredNames = (targetRelated)\.split\(\/\[\\\|,\]\/\)\.map\(n => n\.trim\(\)\.toLowerCase\(\)\)\.filter\(n => n\);/g, "const desiredNames = $1.split(/[\\|,]/).map(n => n.replace(/\\s+/g, '').toLowerCase()).filter(n => n);");
code = code.replace(/const desiredNames = (newRelated)\.split\(\/\[\\\|,\]\/\)\.map\(n => n\.trim\(\)\.toLowerCase\(\)\)\.filter\(n => n\);/g, "const desiredNames = $1.split(/[\\|,]/).map(n => n.replace(/\\s+/g, '').toLowerCase()).filter(n => n);");
code = code.replace(/const desiredNames = (data\[i\]\[4\])\.split\(\/\[\\\|,\]\/\)\.map\(n => n\.trim\(\)\.toLowerCase\(\)\)\.filter\(n => n\);/g, "const desiredNames = String($1 || '').split(/[\\|,]/).map(n => n.replace(/\\s+/g, '').toLowerCase()).filter(n => n);");

fs.writeFileSync('backend/Code.js', code);
