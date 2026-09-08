const fs = require('fs');

let content = fs.readFileSync('frontend/js/finance.js', 'utf8');

const targetFunction = `function openFinanceRatesModal() {
const list = document.getElementById('financeRatesList');
let html = '<p class="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-tight">Override the live exchange rates used for calculations. Rates represent the value of 1 foreign unit in SGD.</p>';
Object.keys(globalFinanceRates).forEach(c => {
    if(c === 'SGD') return;
    const live = globalFinanceRates[c] || 0;
    const custom = (financeConfig.customRates && financeConfig.customRates[c]) ? financeConfig.customRates[c] : '';
    html += \`
    <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <div class="font-black text-xs text-gray-800 dark:text-gray-200 w-16 text-center shrink-0">1 \${c}</div>
        <div class="font-bold text-xs text-gray-400 dark:text-gray-500 px-2 shrink-0">=</div>
        <div class="flex-1 min-w-0 pr-2">
            <input type="number" step="0.0001" placeholder="Live: \${live.toFixed(4)}" value="\${custom}" 
                onchange="setCustomRate('\${c}', this.value)" 
                class="w-full text-sm font-bold p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-950 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-gray-900 dark:text-white transition shadow-sm placeholder-gray-400">
        </div>
        <div class="font-black text-xs text-gray-800 dark:text-gray-200 shrink-0">SGD</div>
    </div>\`;
});
if (list) list.innerHTML = html;
document.getElementById('financeRatesModal').classList.remove('hidden-force');
}`;

const newFunction = `function openFinanceRatesModal() {
    let modal = document.getElementById('financeRatesModal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', \`
            <div id="financeRatesModal" class="fixed inset-0 bg-black/60 z-[96] hidden-force flex justify-center items-center p-4 backdrop-blur-sm transition-opacity">
                <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl border border-gray-200 dark:border-gray-700 m-auto animate-slide-up flex flex-col max-h-[90vh]">
                    <div class="flex justify-between items-center mb-3 border-b border-gray-200 dark:border-gray-700 pb-2 shrink-0">
                        <h3 class="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <svg class="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Exchange Rates
                        </h3>
                        <button type="button" onclick="closeFinanceRatesModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold px-1 focus:outline-none shrink-0">&times;</button>
                    </div>
                    <div id="financeRatesList" class="overflow-y-auto custom-scrollbar flex-grow space-y-2 pb-2"></div>
                    <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 shrink-0 flex justify-end">
                        <button onclick="closeFinanceRatesModal()" class="bg-primary text-white py-2 px-6 rounded-lg font-bold shadow-sm hover:bg-green-600 transition focus:outline-none">Done</button>
                    </div>
                </div>
            </div>
        \`);
        modal = document.getElementById('financeRatesModal');
    }

    const list = document.getElementById('financeRatesList');
    let html = '<p class="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-tight">Override the live exchange rates used for calculations. Rates represent the value of 1 foreign unit in SGD.</p>';
    
    if (typeof globalFinanceRates === 'object' && globalFinanceRates !== null) {
        Object.keys(globalFinanceRates).forEach(c => {
            if(c === 'SGD') return;
            const live = globalFinanceRates[c] || 0;
            const custom = (financeConfig && financeConfig.customRates && financeConfig.customRates[c]) ? financeConfig.customRates[c] : '';
            html += \`
            <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <div class="font-black text-xs text-gray-800 dark:text-gray-200 w-16 text-center shrink-0">1 \${c}</div>
                <div class="font-bold text-xs text-gray-400 dark:text-gray-500 px-2 shrink-0">=</div>
                <div class="flex-1 min-w-0 pr-2">
                    <input type="number" step="0.0001" placeholder="Live: \${live.toFixed(4)}" value="\${custom}" 
                        onchange="setCustomRate('\${c}', this.value)" 
                        class="w-full text-sm font-bold p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-950 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-gray-900 dark:text-white transition shadow-sm placeholder-gray-400">
                </div>
                <div class="font-black text-xs text-gray-800 dark:text-gray-200 shrink-0">SGD</div>
            </div>\`;
        });
    }
    
    if (list) list.innerHTML = html;
    if (modal) modal.classList.remove('hidden-force');
}`;

content = content.replace(targetFunction, newFunction);
fs.writeFileSync('frontend/js/finance.js', content);
console.log("Patched openFinanceRatesModal");

