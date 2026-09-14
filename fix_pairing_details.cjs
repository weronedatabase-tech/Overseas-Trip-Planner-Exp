const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const slowBlock = `    const pocNric = p.pocNric || p.nric;
    let familyMembers = [];
    
    try {
        const res = await apiCall('getProfile', { nric: pocNric });
        if (res && res.status === 'success' && res.family) {
            familyMembers = res.family;
        } else {
            familyMembers = globalLogistics.participants.filter(x => (x.pocNric || x.nric) === pocNric);
        }
    } catch(e) {
        familyMembers = globalLogistics.participants.filter(x => (x.pocNric || x.nric) === pocNric);
    }`;

const fastBlock = `    const pocNric = p.pocNric || p.nric;
    // Removed slow API call, construct locally instantly from globalLogistics
    let familyMembers = globalLogistics.participants.filter(x => (x.pocNric || x.nric) === pocNric);`;

code = code.replace(slowBlock, fastBlock);
fs.writeFileSync('frontend/js/profile.js', code);
console.log("Fixed showPairingDetails latency");
