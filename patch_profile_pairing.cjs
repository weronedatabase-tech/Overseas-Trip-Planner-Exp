const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const generatePairingHtml = `
let pairingHtml = '';
if (currentUser.role === 'VOLUNTEER' && typeof logRes !== 'undefined' && logRes && logRes.pairings) {
    const myPairings = logRes.pairings.filter(p => p.volNric === currentUser.nric && (!p.status || p.status === 'ACTIVE'));
    if (myPairings.length > 0) {
        let pairedPocNrics = new Set();
        let pairedTrainees = [];
        
        myPairings.forEach(pair => {
            const t = logRes.participants.find(x => x.nric === pair.traineeNric);
            if (t) {
                pairedTrainees.push(t);
                pairedPocNrics.add(t.pocNric || t.nric);
            }
        });
        
        let familyMembersHtml = '';
        pairedPocNrics.forEach(pocNric => {
            const fam = logRes.participants.filter(x => (x.pocNric || x.nric) === pocNric);
            fam.forEach(m => {
                const roleColor = m.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (m.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
                const dynColor = getProjectColor(m.group);
                
                familyMembersHtml += \`<div onclick="showParticipantSummaryModal('\${m.nric}')" class="flex flex-col bg-white dark:bg-gray-800 p-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary cursor-pointer transition shadow-sm mb-2">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-[10px] font-black \${roleColor} bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded uppercase tracking-wider border border-current">\${m.role.substring(0,3)}</span>
                        <span class="font-bold text-sm md:text-base \${dynColor} px-1.5 py-0.5 rounded shadow-sm border bg-white dark:bg-gray-900">\${m.shortName || m.fullName}</span>
                    </div>
                </div>\`;
            });
        });
        
        pairingHtml = \`<div class="mt-4 mb-4">
            <div class="flex justify-between items-center border-b-2 border-gray-200 dark:border-gray-800 pb-2 mb-3">
                <h3 class="text-lg font-black text-gray-900 dark:text-white tracking-tight">Pairing</h3>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                \${familyMembersHtml}
            </div>
        </div>\`;
    }
}
`;

code = code.replace(
    /let personalDetailsHeader = /,
    generatePairingHtml + '\nlet personalDetailsHeader = '
);

code = code.replace(
    /tabProfile\.innerHTML = topBannersHtml \+ personalDetailsHeader \+ profilesHtml \+ receiptsHtml \+ paymentHtml;/,
    'tabProfile.innerHTML = topBannersHtml + pairingHtml + personalDetailsHeader + profilesHtml + receiptsHtml + paymentHtml;'
);

fs.writeFileSync('frontend/js/profile.js', code);
console.log('Patched profile.js for pairing view');
