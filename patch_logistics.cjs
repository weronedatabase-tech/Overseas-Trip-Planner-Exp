const fs = require('fs');
const path = './frontend/js/logistics.js';
let content = fs.readFileSync(path, 'utf8');

// Replace in getRoomState
content = content.replace(
    /let targetPoc = window\.resolvePocNric \? window\.resolvePocNric\(p, globalLogistics\.participants\) : \(p\.pocNric \|\| p\.nric\);[\s\S]*?const familyMembers = globalLogistics\.participants\.filter\(x => \{[\s\S]*?let xTarget = window\.resolvePocNric \? window\.resolvePocNric\(x, globalLogistics\.participants\) : \(x\.pocNric \|\| x\.nric\);[\s\S]*?return xTarget === targetPoc;[\s\S]*?\}\);[\s\S]*?if \(familyMembers\.some\(x => x\.role === 'CAREGIVER'\)\) hasFamily = true;/g,
    "if (window.isFamily(p.nric, globalLogistics.participants)) hasFamily = true;"
);

// Replace clustering in unassigned.forEach
content = content.replace(
    /let targetPoc = window\.resolvePocNric \? window\.resolvePocNric\(p, globalLogistics\.participants\) : \(p\.pocNric \|\| p\.nric\);/g,
    "let targetPoc = p.pocNric;"
);

// Replace in getConnectedParticipants
content = content.replace(
    /let pTarget = window\.resolvePocNric \? window\.resolvePocNric\(p, globalLogistics\.participants\) : \(p\.pocNric \|\| p\.nric\);[\s\S]*?globalLogistics\.participants\.forEach\(x => \{[\s\S]*?let xTarget = window\.resolvePocNric \? window\.resolvePocNric\(x, globalLogistics\.participants\) : \(x\.pocNric \|\| x\.nric\);[\s\S]*?if \(xTarget === pTarget && !connected\.has\(x\.nric\)\) \{[\s\S]*?connected\.add\(x\.nric\);[\s\S]*?queue\.push\(x\.nric\);[\s\S]*?\}[\s\S]*?\}\);/g,
    `let pTarget = p.pocNric;
        globalLogistics.participants.forEach(x => {
            if (x.pocNric === pTarget && !connected.has(x.nric)) {
                connected.add(x.nric);
                queue.push(x.nric);
            }
        });`
);

// Replace the family grouping logic:
content = content.replace(
    /if\(group\.some\(p => p\.role === 'CAREGIVER'\) \|\| group\.length > 1\) \{/g,
    "if(group.length > 1) {"
);

fs.writeFileSync(path, content);
