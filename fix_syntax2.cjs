const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

// I am just going to delete the entire function at the bottom and cleanly append it, it got mangled with escaping.
code = code.replace(/window\.showPairingDetails[\s\S]*?\};$/m, '');

const newFn = `
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
                
                \${p.role === 'TRAINEE' ? \`<div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Medical Conditions</p><p class="font-bold text-sm text-red-600 dark:text-red-400">\${medical}</p></div>\` : ''}
                
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
`;

fs.writeFileSync('frontend/js/profile.js', code.trim() + '\n' + newFn);
