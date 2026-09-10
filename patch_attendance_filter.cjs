const fs = require('fs');
const path = './frontend/js/attendance.js';
let content = fs.readFileSync(path, 'utf8');

const filterOld = `    if (query) {
        const dName = p.displayName || p.name || '';
        const fullName = p.name || '';
        if (!dName.toLowerCase().includes(query) && !fullName.toLowerCase().includes(query)) return false;
    }`;

const filterNew = `    if (query) {
        const dName = p.displayName || p.name || '';
        const fullName = p.name || '';
        let tName = '';
        if (p.role === 'CAREGIVER') {
            const myPoc = p.pocNric || p.nric;
            const trainee = globalLogistics.participants.find(x => x.role === 'TRAINEE' && (x.pocNric || x.nric) === myPoc);
            if (trainee) {
                tName = trainee.shortName || trainee.name || '';
            } else if (p.relatedTrainee) {
                tName = p.relatedTrainee;
            }
        }
        if (!dName.toLowerCase().includes(query) && !fullName.toLowerCase().includes(query) && !tName.toLowerCase().includes(query)) return false;
    }`;

if (content.includes(filterOld)) {
    content = content.replace(filterOld, filterNew);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Patched filter successfully.");
} else {
    console.log("Target string not found.");
}
