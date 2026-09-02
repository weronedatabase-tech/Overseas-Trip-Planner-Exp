const fs = require('fs');
let s = fs.readFileSync('frontend/js/expired.js', 'utf8');

s = s.replace(
  "const expiryDisplay = p.passportExpiry ? new Date(p.passportExpiry).toLocaleDateString('en-GB') : '-';",
  "const expiryDisplay = p.passportExpiry ? (typeof formatDDMmmYYYY === 'function' ? formatDDMmmYYYY(p.passportExpiry) : new Date(p.passportExpiry).toLocaleDateString('en-GB')) : '-';"
);

fs.writeFileSync('frontend/js/expired.js', s);
