const fs = require('fs');
let index = fs.readFileSync('index.html', 'utf8');

index = index.replace(
    'id="landingRecNric" required class="',
    'id="landingRecNric" required oninput="if(typeof isValidNRIC === \'function\' && isValidNRIC(this.value)){ document.getElementById(\'landingReceiptError\').classList.add(\'hidden-force\'); }" class="'
);
fs.writeFileSync('index.html', index);
