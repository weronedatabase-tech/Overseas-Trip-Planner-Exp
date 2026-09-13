const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const targetStr = "let receiptsHtml = `";

const groupHtmlLogic = `
let myGroupHtml = '';
if (globalLogistics && globalLogistics.participants) {
    const currentProfile = loadedFamily.find(m => m.nric === currentUser.nric);
    const cGroup = currentProfile ? currentProfile.group : currentUser.group;
    
    if (cGroup && String(cGroup).trim() !== '') {
        const myGroupMembers = globalLogistics.participants.filter(p => p.group === cGroup && p.nric !== currentUser.nric);
        if (myGroupMembers.length > 0) {
            const roleOrder = { 'TRAINEE': 1, 'CAREGIVER': 2, 'VOLUNTEER': 3 };
            myGroupMembers.sort((a, b) => {
                const rA = roleOrder[a.role] || 9;
                const rB = roleOrder[b.role] || 9;
                if (rA !== rB) return rA - rB;
                return (a.name || '').localeCompare(b.name || '');
            });
            
            let membersHtml = myGroupMembers.map(p => {
                const roleColor = p.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (p.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
                const displayName = p.shortName || p.name || 'Unknown';
                return \`<div class="flex flex-col md:flex-row md:items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:border-primary dark:hover:border-primary transition cursor-pointer mb-2 active:scale-95" onclick="showParticipantSummaryModal('\${p.nric}')">
                    <div class="flex items-center gap-2 mb-1 md:mb-0">
                        <span class="text-[10px] font-black \${roleColor} bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded border-2 border-gray-200 dark:border-gray-700 uppercase tracking-wider shrink-0">\${(p.role||'').substring(0,3)}</span>
                        <span class="font-bold text-sm text-gray-800 dark:text-gray-200">\${displayName}</span>
                    </div>
                    <div class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center">
                        View Details <i class="fa-solid fa-chevron-right ml-1"></i>
                    </div>
                </div>\`;
            }).join('');
            
            myGroupHtml = \`
            <div class="bg-gray-50 dark:bg-gray-950 p-3 md:p-4 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-800 mt-4">
                <h3 class="text-base font-black text-gray-900 dark:text-white tracking-tight mb-1 flex items-center">
                    <i class="fa-solid fa-users text-orange-500 mr-2"></i> Group \${cGroup} Members
                </h3>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 mb-3 font-semibold uppercase tracking-wider">Click a member to view details.</p>
                <div class="flex flex-col">
                    \${membersHtml}
                </div>
            </div>\`;
        }
    }
}

let receiptsHtml = \``;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, groupHtmlLogic);
    
    // Now replace the final injection
    const targetInject = "tabProfile.innerHTML = topBannersHtml + personalDetailsHeader + profilesHtml + receiptsHtml + paymentHtml;";
    const replacementInject = "tabProfile.innerHTML = topBannersHtml + personalDetailsHeader + profilesHtml + myGroupHtml + receiptsHtml + paymentHtml;";
    
    if (code.includes(targetInject)) {
        code = code.replace(targetInject, replacementInject);
        fs.writeFileSync('frontend/js/profile.js', code, 'utf8');
        console.log("Patched profile.js successfully");
    } else {
        console.log("Could not find targetInject");
    }
} else {
    console.log("Could not find targetStr");
}
