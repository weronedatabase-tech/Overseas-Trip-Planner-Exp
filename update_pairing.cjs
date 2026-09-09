const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

// The block we are replacing is inside profile.js:
const regex = /let logPairing = 'None';\s*if \(globalLogistics && globalLogistics\.participants\) \{[\s\S]*?\} else \{\s*const pairs = globalLogistics\.pairings\.filter\(p => p\.volNric === lp\.nric && p\.status === 'ACTIVE'\);\s*if \(pairs\.length > 0\) \{\s*logPairing = pairs\.map\(pair => \{\s*const tp = globalLogistics\.participants\.find\(x => x\.nric === pair\.traineeNric\);\s*return tp \? \(tp\.shortName || tp\.fullName\) : pair\.traineeNric;\s*\}\)\.join\(', '\);\s*\}\s*\}\s*\}\s*\}\s*\}/;

const match = code.match(regex);
if (match) {
    const newCode = `let logPairing = 'None';
           const formatPairingName = (tp) => {
               if (!tp) return 'Unknown';
               const name = tp.shortName || tp.fullName;
               const isVol = currentUser && currentUser.role === 'VOLUNTEER';
               const clickHandler = isVol ? \`onclick="showPairingDetails('\${tp.nric}')" class="cursor-pointer hover:underline decoration-2 underline-offset-2"\` : '';
               
               const roleMap = { 'VOLUNTEER': 'vol', 'CAREGIVER': 'car', 'TRAINEE': 'trn' };
               const rTag = roleMap[tp.role] || tp.role;
               const rColor = tp.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (tp.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
               const roleTagHtml = \`<span class="text-[10px] uppercase font-black \${rColor} bg-gray-100 dark:bg-gray-800 px-1 py-[1px] rounded ml-1.5 leading-none">\${rTag}</span>\`;
               
               let projTagHtml = '';
               if (tp.group) {
                   const projColor = typeof getProjectColor === 'function' ? getProjectColor(tp.group) : 'bg-gray-100 text-gray-800 border-gray-200';
                   projTagHtml = \`<span class="text-[10px] font-black px-1 py-[1px] rounded border shadow-sm \${projColor} ml-1.5 leading-none">\${tp.group}</span>\`;
               }
               
               return \`<span class="inline-flex items-center whitespace-nowrap mb-1 mr-3"><span \${clickHandler}>\${name}</span>\${projTagHtml}\${roleTagHtml}</span>\`;
           };

           if (globalLogistics && globalLogistics.participants) {
               const lp = globalLogistics.participants.find(p => p.nric.toUpperCase() === m.nric.toUpperCase());
               if (lp) {
                   logGroup = lp.logisticsGroup || 'None';
                   logBus = lp.bus || 'None';
                   if (globalLogistics.rooms) {
                       const r = globalLogistics.rooms.find(r => r.occupants && r.occupants.includes(lp.nric));
                       if (r) logRoom = r.name;
                   }
                   if (globalLogistics.pairings) {
                       if (lp.role === 'TRAINEE') {
                           const pair = globalLogistics.pairings.find(p => p.traineeNric === lp.nric && p.status === 'ACTIVE');
                           if (pair) {
                               const vp = globalLogistics.participants.find(x => x.nric === pair.volNric);
                               if (vp) logPairing = formatPairingName(vp);
                           }
                       } else {
                           const pairs = globalLogistics.pairings.filter(p => p.volNric === lp.nric && p.status === 'ACTIVE');
                           if (pairs.length > 0) {
                               logPairing = pairs.map(pair => {
                                   const tp = globalLogistics.participants.find(x => x.nric === pair.traineeNric);
                                   return tp ? formatPairingName(tp) : pair.traineeNric;
                               }).join('');
                           }
                       }
                   }
               }
           }`;
    code = code.replace(regex, newCode);
    
    // Also change the Pairing div to remove truncate if needed, so tags show
    code = code.replace(/<p class="font-black text-lg text-purple-600 dark:text-purple-400 truncate w-full" title="\\\$\{logPairing\}">\\\$\{logPairing\}<\/p>/g,
                        '<div class="font-black text-lg text-purple-600 dark:text-purple-400 flex flex-wrap items-center w-full">\\${logPairing}</div>');

    // Add the window function
    if (!code.includes('showPairingDetails')) {
        code += `
window.showPairingDetails = function(nric) {
    if (!globalLogistics || !globalLogistics.participants) return;
    const p = globalLogistics.participants.find(x => x.nric === nric);
    if (!p) return;
    
    let room = 'None';
    if (globalLogistics.rooms) {
        const r = globalLogistics.rooms.find(r => r.occupants && r.occupants.includes(p.nric));
        if (r) room = r.name;
    }
    const group = p.logisticsGroup || 'None';
    const bus = p.bus || 'None';
    const diet = p.diet || 'None';
    const medical = p.medical || 'None';
    const other = p.otherPoints || 'None';
    
    const html = \`
    <div class="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" id="pairing-details-modal">
        <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-sm w-full border-2 border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col">
            <div class="p-4 border-b-2 border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                <h3 class="font-black text-lg text-gray-900 dark:text-white">\${p.shortName || p.fullName}</h3>
                <button onclick="document.getElementById('pairing-details-modal').remove()" class="text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded-lg focus:outline-none transition-colors">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div class="p-4 space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Room</p>
                        <p class="font-black text-blue-600 dark:text-blue-400">\${room}</p>
                    </div>
                    <div>
                        <p class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Bus</p>
                        <p class="font-black text-teal-600 dark:text-teal-400">\${bus}</p>
                    </div>
                    <div class="col-span-2">
                        <p class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Group</p>
                        <p class="font-black text-amber-600 dark:text-amber-400">\${group}</p>
                    </div>
                </div>
                
                <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3">
                    <p class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Dietary Needs</p>
                    <p class="font-bold text-sm text-red-600 dark:text-red-400">\${diet}</p>
                </div>
                
                \${p.role === 'TRAINEE' ? \`
                <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3">
                    <p class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Medical Conditions</p>
                    <p class="font-bold text-sm text-red-600 dark:text-red-400">\${medical}</p>
                </div>
                \` : ''}
                
                <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3">
                    <p class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Other Points</p>
                    <p class="font-semibold text-sm text-gray-800 dark:text-gray-200">\${other}</p>
                </div>
            </div>
            <div class="p-3 border-t-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <button onclick="document.getElementById('pairing-details-modal').remove()" class="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-bold py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition">Close</button>
            </div>
        </div>
    </div>
    \`;
    document.body.insertAdjacentHTML('beforeend', html);
};
`
    }
    
    fs.writeFileSync('frontend/js/profile.js', code);
    console.log("Replaced Pairing block successfully");
} else {
    console.log("Could not find block");
}
