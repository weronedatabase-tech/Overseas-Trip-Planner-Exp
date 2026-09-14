const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const otherPointsHtmlRegex = /<div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3 mt-3">\s*<p class="text-\[10px\] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Other Points<\/p>/g;

const replacement = `\${volunteersHtml}
                                <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3 mt-3">
                    <p class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Other Points</p>`;

code = code.replace(otherPointsHtmlRegex, replacement);

const medicalHtmlRegex = /const other = member\.otherPoints \|\| 'None';/g;

const volunteersLogic = `const other = member.otherPoints || 'None';
        
        let volunteersHtml = '';
        if (member.role === 'TRAINEE' && globalLogistics && globalLogistics.pairings && globalLogistics.participants) {
            const pairs = globalLogistics.pairings.filter(p => p.traineeNric === member.nric && p.status === 'ACTIVE');
            if (pairs.length > 0) {
                let volsList = pairs.map(pair => {
                    const vp = globalLogistics.participants.find(x => x.nric === pair.volNric);
                    if (!vp) return '';
                    const fullVp = typeof additionalProfiles !== 'undefined' ? (additionalProfiles[vp.nric] || vp) : vp;
                    const vpName = fullVp.shortName || fullVp.name || fullVp.fullName || 'Unknown Volunteer';
                    const vpContact = (fullVp.contact && typeof window.renderPhoneLink === 'function') ? window.renderPhoneLink(fullVp.contact) : (fullVp.contact || 'No contact');
                    return \`<div class="mb-1"><span class="font-bold text-gray-800 dark:text-gray-200">\${vpName}</span><div class="mt-0.5 text-xs font-mono">\${vpContact}</div></div>\`;
                }).join('');
                
                if (volsList) {
                    volunteersHtml = \`<div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3 mt-3">
                        <p class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Paired Volunteer(s)</p>
                        \${volsList}
                    </div>\`;
                }
            }
        }`;

code = code.replace(medicalHtmlRegex, volunteersLogic);

fs.writeFileSync('frontend/js/profile.js', code);
