const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const target = /globalLogistics = logRes \|\| null;\s*renderProfileFullView\(\);/;
const replacement = `globalLogistics = logRes || null;

    additionalProfiles = {};
    if (currentUser && currentUser.role === 'VOLUNTEER' && globalLogistics && globalLogistics.pairings) {
        const myPairs = globalLogistics.pairings.filter(p => p.volNric === currentUser.nric && p.status === 'ACTIVE');
        const nricsToFetch = new Set();
        myPairs.forEach(p => {
            globalLogistics.pairings.filter(op => op.traineeNric === p.traineeNric && op.volNric !== currentUser.nric && op.status === 'ACTIVE').forEach(op => {
                nricsToFetch.add(op.volNric);
            });
        });
        
        const toFetch = Array.from(nricsToFetch).slice(0, 10);
        if (toFetch.length > 0) {
            await Promise.all(toFetch.map(async (n) => {
                try {
                    const res = await apiCall('getProfile', { nric: n });
                    if (res && res.status === 'success' && res.family) {
                        res.family.forEach(f => {
                            additionalProfiles[f.nric] = f;
                        });
                    }
                } catch(e) {}
            }));
        }
    }

 renderProfileFullView();`;

code = code.replace(target, replacement);
fs.writeFileSync('frontend/js/profile.js', code);
