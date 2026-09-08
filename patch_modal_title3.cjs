const fs = require('fs');
let code = fs.readFileSync('frontend/js/main.js', 'utf8');

code = code.replace(
  /Participant Summary\n\s*<\/h3>/,
  `\${currentUser && (currentUser.role === 'admin' || currentUser.nric === 'ADMIN') ? 'Participant Summary' : 'Participant Details'}\n          </h3>`
);

fs.writeFileSync('frontend/js/main.js', code);
console.log('Patched modal title 3');
