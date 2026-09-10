const fs = require('fs');
let code = fs.readFileSync('frontend/js/participants.js', 'utf8');

const oldHtml = `<option value="reset_filter" class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">All Participants</option>
               <option value="medical.html" class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Medical</option>
               <option value="diet.html" class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Dietary</option>
               <option value="expired.html" class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Expired Passports</option>
               <option value="other.html" class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Other Notes</option>`;

const newHtml = `\${(() => {
                   const viewLabels = {
                       'reset_filter': 'All Participants',
                       'medical.html': 'Medical',
                       'diet.html': 'Dietary',
                       'expired.html': 'Expired Passports',
                       'other.html': 'Other Notes'
                   };
                   const order = (typeof appSettings !== 'undefined' && appSettings.customViewsOrder) ? appSettings.customViewsOrder : ['reset_filter', 'medical.html', 'diet.html', 'expired.html', 'other.html'];
                   return order.map(val => \`<option value="\${val}" class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">\${viewLabels[val] || val}</option>\`).join('');
               })()}`;

code = code.replace(oldHtml, newHtml);
fs.writeFileSync('frontend/js/participants.js', code);
