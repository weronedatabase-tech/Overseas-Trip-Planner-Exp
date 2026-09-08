const fs = require('fs');
let code = fs.readFileSync('frontend/js/main.js', 'utf8');

code = code.replace(
  /\$\{currentUser && currentUser\.role === 'admin' \? 'Participant Summary' : 'Participant Details'\}/,
  `\${currentUser && (currentUser.role === 'admin' || currentUser.nric === 'ADMIN') ? 'Participant Summary' : 'Participant Details'}`
);

fs.writeFileSync('frontend/js/main.js', code);
console.log('Patched modal title 2');
