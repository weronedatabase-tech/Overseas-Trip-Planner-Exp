const fs = require('fs');
let s = fs.readFileSync('frontend/js/settings.js', 'utf8');

s = s.replace(
    'id="newCommNric" placeholder="NRIC/FIN" class="w-full',
    'id="newCommNric" placeholder="NRIC/FIN" oninput="if(typeof isValidNRIC === \'function\' && isValidNRIC(this.value)){ /* toast auto disappears anyway */ }" class="w-full'
);

fs.writeFileSync('frontend/js/settings.js', s);
