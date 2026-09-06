const fs = require('fs');
let c = fs.readFileSync('frontend/js/finance.js', 'utf8');

const oldNameHtml = "return `\\<span class=\"inline-block mr-1.5\"\\>\\<span class=\"${roleColor} font-black text-[11px] mr-0.5 border border-current px-0.5 rounded\"\\>${m.role.substring(0,3)}\\</span\\>\\<button onclick=\"showContactPaymentPopup('${m.nric}')\" class=\"font-bold text-xs text-primary hover:underline focus:outline-none\"\\>${m.shortName || m.name}\\</button\\>\\</span\\>`;";
const newNameHtml = "return `\\<span class=\"inline-block mr-1.5\"\\>\\<span class=\"${roleColor} font-black text-[11px] mr-0.5 border border-current px-0.5 rounded\"\\>${m.role.substring(0,3)}\\</span\\>\\<span class=\"font-bold text-xs text-gray-800 dark:text-gray-200\"\\>${m.shortName || m.name}\\</span\\>\\</span\\>`;";

const oldButtonHtml = `<button onclick="toggleFeeReceived('\${c.poc}', \${!c.isPaid})" class="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center shrink-0 transition shadow-sm hover:scale-110 focus:outline-none \${c.isPaid ? 'border-green-500 ring-2 ring-green-400 ring-offset-1 dark:ring-offset-gray-900' : ''}">
                <div class="w-6 h-6 rounded-full flex items-center justify-center transition-colors \${checkColor}">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                </div>
            </button>`;

const newButtonHtml = `<div class="flex items-center gap-2 shrink-0">
                <button onclick="showContactPaymentPopup('\${c.poc}')" class="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary hover:border-primary transition shadow-sm focus:outline-none" title="Payment QR & Contact">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                </button>
                <button onclick="toggleFeeReceived('\${c.poc}', \${!c.isPaid})" class="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center shrink-0 transition shadow-sm hover:scale-110 focus:outline-none \${c.isPaid ? 'border-green-500 ring-2 ring-green-400 ring-offset-1 dark:ring-offset-gray-900' : ''}">
                    <div class="w-6 h-6 rounded-full flex items-center justify-center transition-colors \${checkColor}">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                    </div>
                </button>
            </div>`;

c = c.replace(oldNameHtml, newNameHtml);
c = c.replace(oldButtonHtml, newButtonHtml);
fs.writeFileSync('frontend/js/finance.js', c);
console.log("Updated fee tracker UI");
