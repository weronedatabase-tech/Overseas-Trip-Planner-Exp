const fs = require('fs');
let code = fs.readFileSync('frontend/js/ui.js', 'utf8');

const oldCat = `        let catScore = 4;
        if (isFamily) catScore = 1;
        else if (p.role === 'TRAINEE') catScore = 2;
        else if (p.role === 'VOLUNTEER') catScore = 3;`;

const newCat = `        let catScore = 5;
        if (isFamily) catScore = 1;
        else if (p.role === 'TRAINEE') catScore = 2;
        else if (p.role === 'CAREGIVER') catScore = 3;
        else if (p.role === 'VOLUNTEER') catScore = 4;`;

code = code.replace(oldCat, newCat);
fs.writeFileSync('frontend/js/ui.js', code);
