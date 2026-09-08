const fs = require('fs');
let code = fs.readFileSync('frontend/js/main.js', 'utf8');

// In buildParticipantDetails, add checkbox for isIndividual
code = code.replace(
  /<div class="md:col-span-2"><label class="text-xs font-bold mb-0\.5 text-gray-500 block uppercase">Other Points<\/label>/,
  `<div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Treat as Individual</label><div class="flex items-center h-[36px]"><input type="checkbox" id="gpmIsIndividual" \${m.isIndividual ? 'checked' : ''} class="w-5 h-5 text-primary border-2 border-gray-300 rounded focus:ring-primary focus:ring-2 bg-gray-50 dark:bg-gray-800"><span class="ml-2 text-xs font-semibold text-gray-700 dark:text-gray-300">Yes, skip auto-logic</span></div></div><div class="md:col-span-2"><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Other Points</label>`
);

// In submitAdminProfileEdit, add isIndividual
code = code.replace(
  /otherPoints: document\.getElementById\('gpmOther'\)\.value/,
  `otherPoints: document.getElementById('gpmOther').value,\n      isIndividual: document.getElementById('gpmIsIndividual') ? document.getElementById('gpmIsIndividual').checked : false`
);

fs.writeFileSync('frontend/js/main.js', code);
console.log('Patched frontend main.js for isIndividual');
