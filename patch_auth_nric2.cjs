const fs = require('fs');
let auth = fs.readFileSync('frontend/js/auth.js', 'utf8');
auth = auth.replace(
    '"Invalid NRIC/FIN format."',
    '"Invalid NRIC/FIN."'
);
fs.writeFileSync('frontend/js/auth.js', auth);
