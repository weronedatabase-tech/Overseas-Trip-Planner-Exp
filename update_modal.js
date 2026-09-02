const fs = require('fs');
let code = fs.readFileSync('frontend/js/main.js', 'utf8');

const injectionCode = `
    let logRoom = 'None';
    let logGroup = m.logisticsGroup || 'None';
    let logBus = m.bus || 'None';
    let logPairing = 'None';

    try {
        const logistics = (typeof globalLogistics !== 'undefined' && globalLogistics) ? globalLogistics : await apiCall('fetchLogistics').catch(e => null);
        if (logistics && logistics.participants) {
            const lp = logistics.participants.find(p => p.nric.toUpperCase() === m.nric.toUpperCase());
            if (lp) {
                logGroup = lp.logisticsGroup || 'None';
                logBus = lp.bus || 'None';
                if (logistics.rooms) {
                    const r = logistics.rooms.find(r => r.occupants && r.occupants.includes(lp.nric));
                    if (r) logRoom = r.name;
                }
                if (logistics.pairings) {
                    if (lp.role === 'TRAINEE') {
                        const pair = logistics.pairings.find(p => p.traineeNric === lp.nric && p.status === 'ACTIVE');
                        if (pair) {
                            const vp = logistics.participants.find(x => x.nric === pair.volNric);
                            if (vp) logPairing = vp.shortName || vp.fullName || pair.volNric;
                        }
                    } else {
                        const pairs = logistics.pairings.filter(p => p.volNric === lp.nric && p.status === 'ACTIVE');
                        if (pairs.length > 0) {
                            logPairing = pairs.map(pair => {
                                const tp = logistics.participants.find(x => x.nric === pair.traineeNric);
                                return tp ? (tp.shortName || tp.fullName) : pair.traineeNric;
                            }).join(', ');
                        }
                    }
                }
            }
        }
    } catch(e) {}
`;

code = code.replace(/window\._currentModalParticipant = m;/, injectionCode + '\n    window._currentModalParticipant = m;');

const uiCode = `
          <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-1">Project</p><span class="font-bold text-xs px-1.5 py-0.5 rounded border inline-block shadow-sm \${dynColor}">\${m.group || 'None'}</span></div>
          <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-0.5">Pairing</p><p class="font-semibold">\${logPairing}</p></div>
          <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-0.5">Room</p><p class="font-semibold">\${logRoom}</p></div>
          <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-0.5">Group & Bus</p><p class="font-semibold">\${logGroup} &bull; \${logBus}</p></div>
`;

code = code.replace(/<div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-\[11px\] uppercase tracking-wider mb-1">Project<\/p><span class="font-bold text-xs px-1.5 py-0.5 rounded border inline-block shadow-sm \$\{dynColor\}">\$\{m.group \|\| 'None'\}<\/span><\/div>/, uiCode.trim());

fs.writeFileSync('frontend/js/main.js', code);
