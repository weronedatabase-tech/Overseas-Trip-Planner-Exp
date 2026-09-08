const fs = require('fs');
let code = fs.readFileSync('frontend/js/main.js', 'utf8');

code = code.replace(
  /Participant Summary<\/h3>/,
  `\${currentUser && currentUser.role === 'admin' ? 'Participant Summary' : 'Participant Details'}</h3>`
);

fs.writeFileSync('frontend/js/main.js', code);
console.log('Patched modal title');
