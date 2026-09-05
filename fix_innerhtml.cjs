const fs = require('fs');

let content = fs.readFileSync('frontend/js/logistics.js', 'utf8');
content = content.replace(/document\.getElementById\((['"])([^'"]+)\1\)\.innerHTML\s*=/g, "const el_$2 = document.getElementById('$2'); if(el_$2) el_$2.innerHTML =");
fs.writeFileSync('frontend/js/logistics.js', content);

content = fs.readFileSync('frontend/js/expired.js', 'utf8');
content = content.replace(/document\.getElementById\((['"])([^'"]+)\1\)\.innerHTML\s*=/g, "const el_$2 = document.getElementById('$2'); if(el_$2) el_$2.innerHTML =");
fs.writeFileSync('frontend/js/expired.js', content);

content = fs.readFileSync('frontend/js/other.js', 'utf8');
content = content.replace(/document\.getElementById\((['"])([^'"]+)\1\)\.innerHTML\s*=/g, "const el_$2 = document.getElementById('$2'); if(el_$2) el_$2.innerHTML =");
fs.writeFileSync('frontend/js/other.js', content);

content = fs.readFileSync('frontend/js/files.js', 'utf8');
content = content.replace(/document\.getElementById\((['"])([^'"]+)\1\)\.innerHTML\s*=/g, "const el_$2 = document.getElementById('$2'); if(el_$2) el_$2.innerHTML =");
fs.writeFileSync('frontend/js/files.js', content);

content = fs.readFileSync('frontend/js/attendance.js', 'utf8');
content = content.replace(/document\.getElementById\((['"])([^'"]+)\1\)\.innerHTML\s*=/g, "const el_$2 = document.getElementById('$2'); if(el_$2) el_$2.innerHTML =");
fs.writeFileSync('frontend/js/attendance.js', content);