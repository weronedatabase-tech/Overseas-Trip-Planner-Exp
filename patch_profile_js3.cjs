const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const targetFetch = `    if (currentUser && currentUser.role === 'VOLUNTEER' && globalLogistics && globalLogistics.pairings) {
        const myPairs = globalLogistics.pairings.filter(p => p.volNric === currentUser.nric && p.status === 'ACTIVE');
        const nricsToFetch = new Set();
        myPairs.forEach(p => {
            globalLogistics.pairings.filter(op => op.traineeNric === p.traineeNric && op.volNric !== currentUser.nric && op.status === 'ACTIVE').forEach(op => {
                nricsToFetch.add(op.volNric);
            });
        });`;
        
const replacementFetch = `    if (currentUser && globalLogistics && globalLogistics.pairings) {
        const nricsToFetch = new Set();
        if (currentUser.role === 'VOLUNTEER') {
            const myPairs = globalLogistics.pairings.filter(p => p.volNric === currentUser.nric && p.status === 'ACTIVE');
            myPairs.forEach(p => {
                globalLogistics.pairings.filter(op => op.traineeNric === p.traineeNric && op.volNric !== currentUser.nric && op.status === 'ACTIVE').forEach(op => {
                    nricsToFetch.add(op.volNric);
                });
            });
        } else if (currentUser.role === 'CAREGIVER') {
            const myPoc = currentUser.pocNric || currentUser.nric;
            const myTrainees = globalLogistics.participants.filter(x => x.role === 'TRAINEE' && (x.pocNric || x.nric) === myPoc);
            myTrainees.forEach(t => {
                const pairs = globalLogistics.pairings.filter(p => p.traineeNric === t.nric && p.status === 'ACTIVE');
                pairs.forEach(p => nricsToFetch.add(p.volNric));
            });
        }`;

if (code.includes(targetFetch)) {
    code = code.replace(targetFetch, replacementFetch);
}

const targetPairing = `                       if (lp.role === 'TRAINEE') {
                           const pair = globalLogistics.pairings.find(p => p.traineeNric === lp.nric && p.status === 'ACTIVE');
                           if (pair) {
                               const vp = globalLogistics.participants.find(x => x.nric === pair.volNric);
                               if (vp) logPairing = formatPairingName(vp);
                           }
                       } else {
                           const pairs = globalLogistics.pairings.filter(p => p.volNric === lp.nric && p.status === 'ACTIVE');`;
                           
const replacementPairing = `                       if (lp.role === 'TRAINEE') {
                           const pair = globalLogistics.pairings.find(p => p.traineeNric === lp.nric && p.status === 'ACTIVE');
                           if (pair) {
                               const vp = globalLogistics.participants.find(x => x.nric === pair.volNric);
                               if (vp) logPairing = formatPairingName(vp);
                           }
                       } else if (lp.role === 'CAREGIVER') {
                           const myPoc = lp.pocNric || lp.nric;
                           const myTrainees = globalLogistics.participants.filter(x => x.role === 'TRAINEE' && (x.pocNric || x.nric) === myPoc);
                           let pairingStrs = [];
                           myTrainees.forEach(t => {
                               const pairs = globalLogistics.pairings.filter(p => p.traineeNric === t.nric && p.status === 'ACTIVE');
                               pairs.forEach(pair => {
                                   const vp = globalLogistics.participants.find(x => x.nric === pair.volNric);
                                   if (vp) {
                                       const fullVp = additionalProfiles[vp.nric] || vp;
                                       const vpName = fullVp.shortName || fullVp.name || fullVp.fullName || 'Unknown';
                                       const vpContactHtml = (fullVp.contact && typeof window.renderPhoneLink === 'function') ? window.renderPhoneLink(fullVp.contact) : (fullVp.contact || 'No contact');
                                       pairingStrs.push(\`<div class="mb-1"><span>\${formatPairingName(vp)}</span><br><span class="font-mono text-[11px] font-semibold flex items-center gap-1 mt-0.5">\${vpContactHtml}</span></div>\`);
                                   }
                               });
                           });
                           if (pairingStrs.length > 0) logPairing = pairingStrs.join('');
                       } else {
                           const pairs = globalLogistics.pairings.filter(p => p.volNric === lp.nric && p.status === 'ACTIVE');`;

if (code.includes(targetPairing)) {
    code = code.replace(targetPairing, replacementPairing);
} else {
    console.log("Target Pairing block not found");
}

const targetMyProfile = `<span class="text-xs font-black bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full uppercase tracking-widest mb-2 inline-block shadow-md">My Profile</span>`;
const replacementMyProfile = `<span class="text-sm font-black bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1 rounded-full uppercase tracking-widest mb-2 inline-block shadow-md">My Profile</span>`;

code = code.replace(targetMyProfile, replacementMyProfile);

fs.writeFileSync('frontend/js/profile.js', code);
