const fs = require('fs');

let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const regex = /(const dynColor = getProjectColor\(m\.group\);[\s\S]*?)<div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 text-sm text-gray-800 dark:text-gray-200">([\s\S]*?)<\/div>\s*<\/div>\s*<form id="profEdit_\$\{i\}"/m;

const match = code.match(regex);
if (match) {
    const originalBlock = match[0];
    const topPart = match[1];

    const newBlock = topPart + `
     <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 text-sm text-gray-800 dark:text-gray-200">
       <div><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Short Name</p><p class="font-bold text-sm md:text-base">\${m.shortName || '-'}</p></div>
       
       \${(() => {
           let logRoom = 'None';
           let logGroup = m.logisticsGroup || 'None';
           let logBus = m.bus || 'None';
           let logPairing = 'None';
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
                               if (vp) logPairing = vp.shortName || vp.fullName || pair.volNric;
                           }
                       } else {
                           const pairs = globalLogistics.pairings.filter(p => p.volNric === lp.nric && p.status === 'ACTIVE');
                           if (pairs.length > 0) {
                               logPairing = pairs.map(pair => {
                                   const tp = globalLogistics.participants.find(x => x.nric === pair.traineeNric);
                                   return tp ? (tp.shortName || tp.fullName) : pair.traineeNric;
                               }).join(', ');
                           }
                       }
                   }
               }
           }
           
           return \`
              <div class="border-t-2 md:border-t-0 border-gray-100 dark:border-gray-800 pt-3 md:pt-0"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Pairing</p><p class="font-black text-lg text-purple-600 dark:text-purple-400 truncate w-full" title="\${logPairing}">\${logPairing}</p></div>
              <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Room</p><p class="font-black text-lg text-blue-600 dark:text-blue-400 truncate w-full" title="\${logRoom}">\${logRoom}</p></div>
              <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Group</p><p class="font-black text-lg text-amber-600 dark:text-amber-400 truncate w-full" title="\${logGroup}">\${logGroup}</p></div>
              <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Bus</p><p class="font-black text-lg text-teal-600 dark:text-teal-400 truncate w-full" title="\${logBus}">\${logBus}</p></div>
           \`;
       })()}

       <div class="md:col-span-2 border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Dietary Needs</p><p class="font-bold text-sm md:text-base text-red-600 dark:text-red-400">\${m.diet || 'None'}</p></div>
       \${m.role === 'TRAINEE' ? \`<div class="md:col-span-2 border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Medical Conditions and Medications to take note of</p><p class="font-bold text-sm md:text-base text-red-600 dark:text-red-400">\${m.medical || 'None'}</p></div>\` : ''}
       
       <div class="md:col-span-2 border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Contact & Email</p><div class="font-bold text-sm md:text-base flex items-center gap-1">\${renderPhoneLink(m.contact)} | \${m.email || 'N/A'}</div></div>
       
       <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">NRIC / FIN</p><p class="font-bold text-sm md:text-base uppercase">\${m.nric}</p></div>
       <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Date of Birth</p><p class="font-bold text-sm md:text-base">\${m.dob}</p></div>
       <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Gender & Nat.</p><p class="font-bold text-sm md:text-base">\${m.gender} | \${m.nationality}</p></div>
       <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-1">Project</p><span class="font-bold text-xs px-1.5 py-0.5 rounded border inline-block shadow-md \${dynColor}">\${m.group || 'None'}</span></div>
       <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Home Address</p><p class="font-bold text-sm md:text-base">\${m.address}</p></div>
       <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Passport No.</p><p class="font-bold text-sm md:text-base uppercase">\${m.passportNo}</p></div>
       <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Passport Expiry</p><p class="\${expiryHighlight ? 'font-bold text-red-600 dark:text-red-400' : 'font-semibold'}">\${m.passportExpiry || '-'}\${expiryHighlight ? ' <span title="Expiring within 6 months of trip" class="text-sm">⚠️</span>' : ''}</p></div>
       <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Emerg. Contact</p><div class="font-bold text-sm md:text-base flex items-center gap-1">\${m.emergencyName} (\${m.emergencyRelation}) - <span class="font-mono">\${renderPhoneLink(m.emergencyContact)}</span></div></div>
       
       <div class="md:col-span-2 border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Sleeping Arrangement Request</p><p class="font-bold text-sm md:text-base text-green-600 dark:text-green-400">\${m.sleeping || 'No special request'}</p></div>
       <div class="md:col-span-2 border-t-2 border-gray-100 dark:border-gray-800 pt-3"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Other Points to Note</p><p class="font-bold text-sm md:text-base">\${m.otherPoints || 'None'}</p></div>
     </div>
   </div>
   <form id="profEdit_\$\{i\}"`;

    code = code.replace(originalBlock, newBlock);
    fs.writeFileSync('frontend/js/profile.js', code);
    console.log("Patched profile.js");
} else {
    console.log("Could not find grid matching block");
}
