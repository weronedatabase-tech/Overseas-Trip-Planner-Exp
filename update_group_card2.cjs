const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const targetStart = '<div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="myGroupMembersGrid">` + \n        loadedGroupMembers.map(member => { ';
const targetEnd = '        }).join("") + \n        `</div></div>`; ';

let startIdx = code.indexOf('<div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="myGroupMembersGrid">');
let endIdx = code.indexOf('`</div></div>`; ', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `<div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="myGroupMembersGrid">\` + 
        loadedGroupMembers.map(member => {
            let medicalHtml = '';
            if (member.role === 'TRAINEE') {
                medicalHtml = \`<div class="text-[11px] font-bold text-gray-500 dark:text-gray-400 flex items-start gap-1.5"><i class="fa-solid fa-notes-medical w-4 text-center mt-0.5 text-red-400"></i> <span class="text-gray-700 dark:text-gray-300 leading-tight">\${member.medical || "None"}</span></div>\`;
            }

            let pairedVolunteersStr = '';
            if (member.role === 'TRAINEE' && globalLogistics && globalLogistics.pairings && globalLogistics.participants) {
                const pairs = globalLogistics.pairings.filter(p => p.traineeNric === member.nric && p.status === 'ACTIVE');
                if (pairs.length > 0) {
                    let vols = pairs.map(pair => {
                        const vp = globalLogistics.participants.find(x => x.nric === pair.volNric);
                        if (!vp) return null;
                        const fullVp = typeof additionalProfiles !== 'undefined' ? (additionalProfiles[vp.nric] || vp) : vp;
                        return fullVp.shortName || fullVp.name || fullVp.fullName;
                    }).filter(Boolean).join(', ');
                    if (vols) {
                        pairedVolunteersStr = \`<div class="text-[11px] font-bold text-gray-500 dark:text-gray-400 flex items-start gap-1.5"><i class="fa-solid fa-hands-holding-child w-4 text-center mt-0.5 text-blue-400"></i> <span class="text-gray-700 dark:text-gray-300 leading-tight">\${vols}</span></div>\`;
                    }
                }
            }
            
            return \`<div class="my-group-card p-3 bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-lg cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 transition shadow-sm" onclick="showPairingDetails('\${member.nric}')" data-name="\${(member.fullName||'').toLowerCase()} \${(member.shortName||'').toLowerCase()} \${(member.role||'').toLowerCase()}">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-gray-900 dark:text-white text-sm">\${member.fullName} \${member.shortName ? "(" + member.shortName + ")" : ""}</span>
                    <span class="text-[10px] uppercase font-black \${member.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (member.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400')} bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded shadow-sm">\${member.role}</span>
                </div>
                <div class="flex flex-col gap-1 mt-2">
                    <div class="text-[11px] font-bold text-gray-500 dark:text-gray-400 flex items-start gap-1.5"><i class="fa-solid fa-utensils w-4 text-center mt-0.5 text-amber-500"></i> <span class="text-gray-700 dark:text-gray-300 leading-tight">\${member.diet || "None"}</span></div>
                    <div class="text-[11px] font-bold text-gray-500 dark:text-gray-400 flex items-start gap-1.5"><i class="fa-solid fa-bus w-4 text-center mt-0.5 text-teal-500"></i> <span class="text-gray-700 dark:text-gray-300 leading-tight">\${member.bus || "None"}</span></div>
                    \${medicalHtml}
                    \${pairedVolunteersStr}
                </div>
            </div>\`; 
        }).join("") + \n        \``;

    code = code.substring(0, startIdx) + replacement + code.substring(endIdx + 1);
    fs.writeFileSync('frontend/js/profile.js', code);
    console.log("Replaced");
} else {
    console.log("Could not find start/end idx");
}
