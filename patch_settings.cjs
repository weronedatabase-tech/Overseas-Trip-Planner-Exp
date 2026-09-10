const fs = require('fs');
let code = fs.readFileSync('frontend/js/settings.js', 'utf8');

// Insert custom view dropdown order block
const customViewHtml = `
  <div class="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-800 admin-only">
  <h3 class="text-sm font-black text-gray-900 dark:text-white mb-0.5 tracking-tight">Custom View Dropdown Order</h3>
  <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">Order of items in the Custom Views dropdown.</p>
  <div class="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
   \${[1,2,3,4,5].map((i) => \`
   <div>
     <label class="block text-[11px] uppercase font-bold mb-1 text-gray-500 dark:text-gray-400 tracking-wider">Pos \${i}</label>
     <select id="customViewRule\${i}" class="w-full p-2 border-2 border-gray-300 dark:border-gray-700 rounded-md text-sm md:text-xs font-bold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-md">
       <option value="none">None</option>
       <option value="reset_filter">All Participants</option>
       <option value="medical.html">Medical</option>
       <option value="diet.html">Dietary</option>
       <option value="expired.html">Expired Passports</option>
       <option value="other.html">Other Notes</option>
     </select>
   </div>\`).join('')}
  </div>
  <button onclick="saveCustomViewsOrderSettings(this)" class="w-full md:w-auto bg-primary text-white px-4 py-2 text-xs rounded-lg font-bold flex items-center justify-center shadow-md"><span class="btn-text">Save Dropdown Order</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
  </div>
`;

code = code.replace(
  '<div class="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-800 admin-only">\n  <h3 class="text-sm font-black text-gray-900 dark:text-white mb-1 tracking-tight">Attendance Junctures</h3>',
  customViewHtml + '\n  <div class="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-800 admin-only">\n  <h3 class="text-sm font-black text-gray-900 dark:text-white mb-1 tracking-tight">Attendance Junctures</h3>'
);

// Populate selects
code = code.replace(
  "renderJunctureList(appSettings.junctures);",
  "const cvRules = appSettings.customViewsOrder || ['reset_filter', 'medical.html', 'diet.html', 'expired.html', 'other.html'];\n  for(let i=0; i<5; i++) {\n    const sel = document.getElementById(`customViewRule${i+1}`);\n    if(sel) sel.value = cvRules[i] || 'none';\n  }\n\n  renderJunctureList(appSettings.junctures);"
);

// Add save function
code += `
async function saveCustomViewsOrderSettings(btn) {
  setBtnLoading(btn, true);
  const rules = [];
  for(let i=1; i<=5; i++) {
    const val = document.getElementById('customViewRule'+i).value;
    if(val !== 'none' && !rules.includes(val)) rules.push(val);
  }
  try {
    const res = await apiCall('saveCustomViewsOrder', { order: rules, callerNric: currentUser.nric });
    appSettings.customViewsOrder = res.customViewsOrder;
    showToast("Custom Views Order updated. Reloading data...");
    setTimeout(() => location.reload(), 1000);
  } catch(e) {
    showToast(e.message, true);
  } finally {
    setBtnLoading(btn, false);
  }
}
`;

fs.writeFileSync('frontend/js/settings.js', code);
