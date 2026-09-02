const fs = require('fs');
let s = fs.readFileSync('frontend/js/participants.js', 'utf8');

s = s.replace(
  'formattedExpiry = `${expD.getFullYear()}-${String(expD.getMonth()+1).padStart(2,\'0\')}-${String(expD.getDate()).padStart(2,\'0\')}`;',
  "formattedExpiry = typeof formatDDMmmYYYY === 'function' ? formatDDMmmYYYY(p.passportExpiry) : p.passportExpiry;"
);

s = s.replace(
  'formattedDob = `${dD.getFullYear()}-${String(dD.getMonth()+1).padStart(2,\'0\')}-${String(dD.getDate()).padStart(2,\'0\')}`;',
  "formattedDob = typeof formatDDMmmYYYY === 'function' ? formatDDMmmYYYY(p.dob) : p.dob;"
);

fs.writeFileSync('frontend/js/participants.js', s);
