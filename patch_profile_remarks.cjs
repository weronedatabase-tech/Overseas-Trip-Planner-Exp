const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

code = code.replace(
  /<button onclick="document\.getElementById\('reuploadFormContainer'\)\.classList\.toggle\('hidden-force'\)"/,
  `<a href="\${feeReceipt.fileUrl}" target="_blank" class="mt-4 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1">
           <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
           Open Screenshot in New Tab
       </a>
       <button onclick="document.getElementById('reuploadFormContainer').classList.toggle('hidden-force')"`
);

// Add admin deviation remarks in paymentHtml
code = code.replace(
  /const payNowNum = finConfig\.payNowNumber \? "\+65" \+ finConfig\.payNowNumber : "";/,
  `const payNowNum = finConfig.payNowNumber ? "+65" + finConfig.payNowNumber : "";
const adminRemarksHtml = (finConfig.showAdminRemarks && finConfig.feeDeviations?.[targetNric]?.remarks) 
    ? \`<div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border-2 border-blue-200 dark:border-blue-800 text-left mt-2">
         <p class="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-1">Admin Remarks</p>
         <p class="text-xs font-medium text-blue-900 dark:text-blue-100 whitespace-pre-wrap">\${finConfig.feeDeviations[targetNric].remarks}</p>
       </div>\` : '';`
);

code = code.replace(
  /<div class="mt-2 text-left">\$\{membersListHtml\}<\/div>\n\s*<\/div>/,
  `<div class="mt-2 text-left">\${membersListHtml}</div>\n       \${adminRemarksHtml}\n   </div>`
);

fs.writeFileSync('frontend/js/profile.js', code);
console.log('Patched profile remarks and links');
