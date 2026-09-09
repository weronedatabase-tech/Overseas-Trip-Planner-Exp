const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const target1 = `               const isVol = m.role === 'VOLUNTEER';
               const clickHandler = isVol ? \`onclick="window.showPairingDetails('\${tp.nric}')"\` : '';
               const clickClasses = isVol ? \`cursor-pointer hover:underline decoration-2 underline-offset-2 relative z-10 focus:outline-none focus:ring-2 focus:ring-primary rounded-sm\` : '';`;

const replacement1 = `               const isVol = m.role === 'VOLUNTEER';
               const clickHandler = isVol ? \`onclick="window.showPairingDetails('\${tp.nric}')"\` : '';
               const clickClasses = isVol ? \`cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800 decoration-2 underline-offset-2 relative z-10 focus:outline-none focus:ring-2 focus:ring-primary rounded-md px-1.5 py-0.5 -ml-1 border-2 border-purple-400 dark:border-purple-600 shadow-sm animate-pulse text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40\` : '';`;

if (code.includes(target1)) {
    code = code.replace(target1, replacement1);
} else {
    console.log("target1 not found in profile.js");
}

const target2 = `               let projTagHtml = '';
               if (tp.group) {
                   const projColor = typeof getProjectColor === 'function' ? getProjectColor(tp.group) : 'bg-gray-100 text-gray-800 border-gray-200';
                   projTagHtml = \`<span class="text-[10px] font-black px-1 py-[1px] rounded border shadow-sm \${projColor} ml-1.5 leading-none">\${tp.group}</span>\`;
               }
               
               return \`<span class="inline-flex items-center whitespace-nowrap mb-1 mr-3">\` + (isVol ? \`<button type="button" \${clickHandler} class="text-left font-bold \${clickClasses}">\${name}</button>\` : \`<span class="font-bold">\${name}</span>\`) + \`\${projTagHtml}\${roleTagHtml}</span>\`;`;

const replacement2 = `               let projTagHtml = '';
               if (tp.group) {
                   const projColor = typeof getProjectColor === 'function' ? getProjectColor(tp.group) : 'bg-gray-100 text-gray-800 border-gray-200';
                   projTagHtml = \`<span class="text-[10px] font-black px-1 py-[1px] rounded border shadow-sm \${projColor} ml-1.5 leading-none">\${tp.group}</span>\`;
               }
               
               let famTagHtml = '';
               if (globalLogistics && globalLogistics.participants) {
                   const pNric = tp.pocNric || tp.nric;
                   const hasFamily = globalLogistics.participants.filter(x => (x.pocNric || x.nric) === pNric).length > 1;
                   if (hasFamily) {
                       famTagHtml = \`<span class="text-[10px] uppercase font-black text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/30 px-1 py-[1px] rounded ml-1.5 leading-none shadow-sm border border-pink-200 dark:border-pink-800">FAM</span>\`;
                   }
               }
               
               return \`<span class="inline-flex items-center whitespace-nowrap mb-1 mr-3">\` + (isVol ? \`<button type="button" \${clickHandler} class="text-left font-bold \${clickClasses}">\${name}</button>\` : \`<span class="font-bold">\${name}</span>\`) + \`\${projTagHtml}\${roleTagHtml}\${famTagHtml}</span>\`;`;

if (code.includes(target2)) {
    code = code.replace(target2, replacement2);
} else {
    console.log("target2 not found in profile.js");
}

const target3 = `<h3 class="font-black text-lg text-gray-900 dark:text-white">${"${member.shortName || member.name || member.fullName || 'Unknown'}"}</h3>`;
const replacement3 = `<h3 class="font-black text-lg text-gray-900 dark:text-white">${"${member.fullName || member.name || 'Unknown'}${member.shortName ? ' (' + member.shortName + ')' : ''}"}</h3>`;

if (code.includes(target3)) {
    code = code.replace(target3, replacement3);
} else {
    console.log("target3 not found in profile.js");
}

fs.writeFileSync('frontend/js/profile.js', code);
