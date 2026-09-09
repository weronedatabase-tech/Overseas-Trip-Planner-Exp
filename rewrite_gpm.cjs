const fs = require('fs');

const file = 'frontend/js/main.js';
let code = fs.readFileSync(file, 'utf8');

const regex = /<div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 text-sm text-gray-800 dark:text-gray-200">([\s\S]*?)<\/div>\s*<\/div>\s*<form id="gpm-edit"/;

const match = code.match(regex);
if (match) {
    const originalGridContent = match[1];
    
    // We will replace the content of the grid with the new layout
    const newGridContent = `
          <div><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Short Name</p><p class="font-semibold">\${m.shortName || '-'}</p></div>
          <div class="border-t-2 md:border-t-0 border-gray-100 dark:border-gray-800 pt-2 md:pt-0"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Pairing</p><p class="font-black text-lg text-purple-600 dark:text-purple-400 truncate w-full" title="\${logPairing}">\${logPairing}</p></div>
          <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Room</p><p class="font-black text-lg text-blue-600 dark:text-blue-400 truncate w-full" title="\${logRoom}">\${logRoom}</p></div>
          <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Group</p><p class="font-black text-lg text-amber-600 dark:text-amber-400 truncate w-full" title="\${logGroup}">\${logGroup}</p></div>
          <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Bus</p><p class="font-black text-lg text-teal-600 dark:text-teal-400 truncate w-full" title="\${logBus}">\${logBus}</p></div>
          
          <div class="md:col-span-2 border-t-2 border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Dietary Needs</p><p class="font-bold text-red-600 dark:text-red-400">\${m.diet || 'None'}</p></div>
          \${m.role === 'TRAINEE' ? \`<div class="md:col-span-2 border-t-2 border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Medical Conditions and Medications to take note of</p><p class="font-bold text-red-600 dark:text-red-400">\${m.medical || 'None'}</p></div>\` : ''}
          <div class="md:col-span-2 border-t-2 border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Contact & Email</p><div class="font-semibold flex flex-col gap-0.5"><span>\${renderPhoneLink(m.contact)}</span><span class="text-gray-600 dark:text-gray-400 font-medium truncate w-full" title="\${m.email || 'N/A'}">\${m.email || 'N/A'}</span></div></div>

          <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">NRIC / FIN</p><p class="font-semibold uppercase">\${m.nric}</p></div>
          <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Date of Birth</p><p class="font-semibold">\${formatDDMmmYYYY(m.dob)}</p></div>
          <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Gender & Nat.</p><p class="font-semibold">\${m.gender} | \${m.nationality}</p></div>
          <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-1">Project</p><span class="font-bold text-xs px-1.5 py-0.5 rounded border inline-block shadow-md \${dynColor}">\${m.group || 'None'}</span></div>
          <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Home Address</p><p class="font-semibold">\${m.address}</p></div>
          <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Passport No.</p><p class="font-semibold uppercase">\${m.passportNo}</p></div>
          <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Passport Expiry</p><p class="font-semibold">\${m.passportExpiry ? formatDDMmmYYYY(m.passportExpiry) : '-'}</p></div>
          <div class="border-t-2 border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Emerg. Contact</p><div class="font-semibold flex items-center gap-1">\${m.emergencyName} (\${m.emergencyRelation}) - <span class="font-mono">\${renderPhoneLink(m.emergencyContact)}</span></div></div>
          
          <div class="md:col-span-2 border-t-2 border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Sleeping Arrangement Request</p><p class="font-semibold text-green-600 dark:text-green-400">\${m.sleeping || 'No special request'}</p></div>
          <div class="md:col-span-2 border-t-2 border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Other Points to Note</p><p class="font-semibold">\${m.otherPoints || 'None'}</p></div>
          \${familyHtml}
        `;
        
    code = code.replace(originalGridContent, newGridContent);
    fs.writeFileSync(file, code);
    console.log("Successfully updated the grid content.");
} else {
    console.log("Failed to find the target grid in the file.");
}
