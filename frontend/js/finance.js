let financeOptions = [];
let pendingFinanceUpdates = new Map(); // Map of optId -> option Object to merge
let globalFinanceRates = { "SGD": 1, "MYR": 0.28 };
let financeConfig = {
globalPaxMode: 'individual', // 'individual', 'manual', 'auto'
globalPaxCount: 0,
ts: 0,
customRates: {}
};
let isFinanceCollapsed = false;
let financeSyncTimeout = null;
let financePollInterval = null;
let isFinanceSyncing = false;

// Custom Drag & Drop State for Categories
let finDndState = { active: false, row: null, placeholder: null, container: null, optId: null, yOffset: 0, xOffset: 0 };

const defaultFinanceFields = [
'Accommodation', 'Transport', 'Day 1 Lunch', 'Day 1 Dinner', 
'Day 1 Activity', 'Day 2 Breakfast', 'Day 2 Lunch', 'Day 2 Activity', 
'Logistics', 'First Aid', 'Miscellaneous', 'Recce', 'Insurance'
];

function generateFinanceUUID() {
return 'fin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getCurrencyOptions(selected) {
const top = ["SGD", "MYR"];
const rest = ["USD", "EUR", "GBP", "AUD", "IDR", "THB", "JPY", "KRW", "TWD", "PHP", "VND"];
let html = '';
top.forEach(c => html += `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`);
html += `<option disabled>──────────</option>`;
rest.forEach(c => html += `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`);
return html;
}

function getActivePax(opt) {
if (financeConfig.globalPaxMode === 'auto') {
   return globalLogistics && globalLogistics.participants ? globalLogistics.participants.length : 0;
} else if (financeConfig.globalPaxMode === 'manual') {
   return parseInt(financeConfig.globalPaxCount) || 0;
} else {
   return parseInt(opt.pax) || 0;
}
}

function getActualRate(currency) {
if (currency === 'SGD') return 1;
if (financeConfig.customRates && financeConfig.customRates[currency]) {
   return parseFloat(financeConfig.customRates[currency]);
}
return globalFinanceRates[currency] || 1;
}

function toggleFinanceCollapse() {
isFinanceCollapsed = !isFinanceCollapsed;
financeOptions.forEach(o => o._isCollapsed = isFinanceCollapsed);
renderFinanceGlobalSettings();
renderFinanceOptions();
}

function toggleIndividualFinanceCollapse(id) {
const opt = financeOptions.find(o => o.id === id);
if (opt) {
   opt._isCollapsed = !opt._isCollapsed;
   renderFinanceOptions();
}
}

function cycleFinanceOptionWidth(optId) {
const opt = financeOptions.find(o => o.id === optId);
if (opt) {
   opt.widthSpan = (opt.widthSpan || 2) + 1;
   if (opt.widthSpan > 3) opt.widthSpan = 1;
   queueFinanceUpdate(optId);
   renderFinanceOptions();
}
}

// -----------------------------------------------------------
// LIVE MONEY FORMATTER
// -----------------------------------------------------------
window.formatMoneyInput = function(input, isBlur) {
   let cursorStart = input.selectionStart;
   let oldLen = input.value.length;
   
   let val = input.value.replace(/[^0-9.]/g, '');
   if(val === '') {
       input.value = '';
       return;
   }
   
   let parts = val.split('.');
   if(parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
   
   if (isBlur) {
       let number = parseFloat(val);
       if(!isNaN(number)) {
           input.value = number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
       } else {
           input.value = '0.00';
       }
   } else {
       parts = val.split('.');
       let whole = parts[0] ? parseFloat(parts[0]).toLocaleString('en-US') : '0';
       
       if(parts.length > 1) {
           input.value = whole + '.' + parts[1].substring(0, 2);
       } else {
           input.value = whole;
       }
       
       let newLen = input.value.length;
       let diff = newLen - oldLen;
       let newCursor = cursorStart + diff;
       try { input.setSelectionRange(newCursor, newCursor); } catch(e){}
   }
};

// -----------------------------------------------------------
// EXCHANGE RATES MODAL
// -----------------------------------------------------------
function openFinanceRatesModal() {
const list = document.getElementById('financeRatesList');
let html = '<p class="text-[10px] text-gray-500 dark:text-gray-400 mb-3 leading-tight">Override the live exchange rates used for calculations. Rates represent the value of 1 foreign unit in SGD.</p>';
Object.keys(globalFinanceRates).forEach(c => {
   if(c === 'SGD') return;
   const live = globalFinanceRates[c] || 0;
   const custom = (financeConfig.customRates && financeConfig.customRates[c]) ? financeConfig.customRates[c] : '';
   html += `
   <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
       <div class="font-black text-xs text-gray-800 dark:text-gray-200 w-16 text-center shrink-0">1 ${c}</div>
       <div class="font-bold text-xs text-gray-400 dark:text-gray-500 px-2 shrink-0">=</div>
       <div class="flex-1 min-w-0 pr-2">
           <input type="number" step="0.0001" placeholder="Live: ${live.toFixed(4)}" value="${custom}" 
               onchange="setCustomRate('${c}', this.value)" 
               class="w-full text-sm font-bold p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-950 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-gray-900 dark:text-white transition shadow-sm placeholder-gray-400">
       </div>
       <div class="font-black text-xs text-gray-800 dark:text-gray-200 shrink-0">SGD</div>
   </div>`;
});
list.innerHTML = html;
document.getElementById('financeRatesModal').classList.remove('hidden-force');
}

function closeFinanceRatesModal() {
document.getElementById('financeRatesModal').classList.add('hidden-force');
}

function setCustomRate(currency, value) {
if (!financeConfig.customRates) financeConfig.customRates = {};
if (value.trim() === '') {
   delete financeConfig.customRates[currency];
} else {
   financeConfig.customRates[currency] = parseFloat(value);
}
financeOptions.forEach(o => updateTotals(o.id));
renderFinanceOptions();
queueFinanceUpdate();
}

// -----------------------------------------------------------
// DATA SYNC & POLLING LOGIC
// -----------------------------------------------------------
function setFinanceSyncButtonState(state) {
const btn = document.getElementById('btn-sync-finance');
if(!btn) return;

const textSpan = btn.querySelector('.btn-text'); 
const spinner = btn.querySelector('.btn-spinner');

btn.className = "text-[10px] md:text-xs px-3 py-1.5 rounded-md font-bold transition flex items-center justify-center border shadow-sm focus:outline-none shrink-0"; 
spinner.className = "btn-spinner ml-1.5 !w-3 !h-3 hidden-force border-2"; 

if (state === 'loading') { 
   btn.classList.add('bg-gray-100', 'text-gray-500', 'border-gray-200', 'dark:bg-gray-800', 'dark:text-gray-400', 'dark:border-gray-700'); 
   textSpan.textContent = "Loading..."; 
   spinner.classList.remove('hidden-force'); 
   spinner.classList.add('spinner-primary'); 
} else if(state === 'saving') { 
   btn.classList.add('bg-yellow-50', 'text-yellow-700', 'border-yellow-200', 'dark:bg-yellow-900/30', 'dark:text-yellow-300', 'dark:border-yellow-800'); 
   textSpan.textContent = "Saving..."; 
   spinner.classList.remove('hidden-force'); 
   spinner.classList.add('spinner-yellow'); 
} else if (state === 'saved') { 
   btn.classList.add('bg-green-50', 'text-green-700', 'border-green-200', 'dark:bg-green-900/30', 'dark:text-green-300', 'dark:border-green-800'); 
   textSpan.textContent = "Saved"; 
} else if (state === 'error') { 
   btn.classList.add('bg-red-50', 'text-red-700', 'border-red-200', 'dark:bg-red-900/30', 'dark:text-red-300', 'dark:border-red-800'); 
   textSpan.textContent = "Error"; 
}
}

function queueFinanceUpdate(optId = null) {
if (optId) {
   const opt = financeOptions.find(o => o.id === optId);
   if (opt) {
       opt.ts = Date.now();
       pendingFinanceUpdates.set(optId, opt);
   }
}
financeConfig.ts = Date.now();

setFinanceSyncButtonState('saving');
if (financeSyncTimeout) clearTimeout(financeSyncTimeout);
financeSyncTimeout = setTimeout(() => { executeFinanceSync(); }, 1500); 
}

async function executeFinanceSync() {
if (pendingFinanceUpdates.size === 0 && !financeConfig.ts) return;

isFinanceSyncing = true;
setFinanceSyncButtonState('saving');

const updates = Array.from(pendingFinanceUpdates.values());
pendingFinanceUpdates.clear();

const payload = {
   updates: updates,
   config: financeConfig
};

try {
   const res = await callBackend('saveFinance', { payload: payload });
   // LWW Granular Merge Response
   if (res.data) {
       if (res.data.config && res.data.config.ts > financeConfig.ts) {
           financeConfig = res.data.config;
           if(!financeConfig.customRates) financeConfig.customRates = {};
           renderFinanceGlobalSettings();
       }
       
       if (res.data.options && Array.isArray(res.data.options)) {
           let hasChanges = false;
           
           res.data.options.forEach(sOpt => {
               let lIdx = financeOptions.findIndex(o => o.id === sOpt.id);
               if (lIdx === -1) {
                   sOpt._isCollapsed = isFinanceCollapsed;
                   financeOptions.push(sOpt);
                   hasChanges = true;
               } else {
                   let lOpt = financeOptions[lIdx];
                   // Granular check: Only overwrite if server is newer AND not in pending
                   if (sOpt.ts > (lOpt.ts || 0) && !pendingFinanceUpdates.has(sOpt.id)) {
                       sOpt._isCollapsed = lOpt._isCollapsed; 
                       financeOptions[lIdx] = sOpt;
                       hasChanges = true;
                   }
               }
           });

           // Clean up deletions securely without destroying locally pending creations
           const serverIds = res.data.options.map(o => o.id);
           const initialLength = financeOptions.length;
           financeOptions = financeOptions.filter(o => serverIds.includes(o.id) || pendingFinanceUpdates.has(o.id));
           
           if (financeOptions.length !== initialLength) hasChanges = true;
           
           if(hasChanges && !finDndState.active) {
               renderFinanceOptions();
           }
       }
   }
   setFinanceSyncButtonState('saved');
} catch (e) {
   setFinanceSyncButtonState('error');
   updates.forEach(u => pendingFinanceUpdates.set(u.id, u));
} finally {
   isFinanceSyncing = false;
}
}

function startFinancePolling() {
if (financePollInterval) clearInterval(financePollInterval);

financePollInterval = setInterval(async () => {
   // Do not poll if currently dragging or syncing
   const tab = document.getElementById('tab-finance');
   if(!tab || tab.classList.contains('hidden-force') || isFinanceSyncing || finDndState.active) return;
   
   try {
       const res = await callBackend('fetchFinance');
       if (res.data) {
           let hasChanges = false;
           
           if (res.data.config && res.data.config.ts > (financeConfig.ts || 0)) {
               financeConfig = res.data.config;
               if(!financeConfig.customRates) financeConfig.customRates = {};
               renderFinanceGlobalSettings();
               hasChanges = true;
           }
           
           if (res.data.options && Array.isArray(res.data.options)) {
               // Granular update logic
               res.data.options.forEach(sOpt => {
                   let lIdx = financeOptions.findIndex(o => o.id === sOpt.id);
                   if (lIdx === -1) {
                       sOpt._isCollapsed = isFinanceCollapsed;
                       financeOptions.push(sOpt);
                       hasChanges = true;
                   } else {
                       let lOpt = financeOptions[lIdx];
                       if (sOpt.ts > (lOpt.ts || 0) && !pendingFinanceUpdates.has(sOpt.id)) {
                           sOpt._isCollapsed = lOpt._isCollapsed;
                           financeOptions[lIdx] = sOpt;
                           hasChanges = true;
                       }
                   }
               });
               
               // Server deletion sync handling
               const serverIds = res.data.options.map(o => o.id);
               const initialLength = financeOptions.length;
               financeOptions = financeOptions.filter(o => serverIds.includes(o.id) || pendingFinanceUpdates.has(o.id));
               if (financeOptions.length !== initialLength) hasChanges = true;
               
               if (hasChanges && !finDndState.active) {
                   renderFinanceOptions();
                   if (pendingFinanceUpdates.size === 0) setFinanceSyncButtonState('saved');
               }
           }
       }
   } catch (e) {
       // silent background fail
   }
}, 8000);
}

async function manualFinanceSync(btn) {
setFinanceSyncButtonState('loading');
try {
   await executeFinanceSync();
   showToast("Refreshed from server!");
} catch(e) {
   showToast("Sync failed.", true);
}
}
// -----------------------------------------------------------

async function buildFinanceUI() {
document.getElementById('tab-finance').innerHTML = `
<div class="flex flex-col h-full w-full relative">
   <div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-2 md:p-3 shrink-0 flex justify-between items-center z-10 shadow-sm rounded-t-xl md:rounded-none">
       <div class="flex items-center gap-2">
           <h3 class="text-sm md:text-base font-black text-gray-900 dark:text-white tracking-tight">Finance Options Planner</h3>
       </div>
       <div class="flex items-center gap-1.5 md:gap-2">
           <button onclick="addFinanceOption()" class="bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 text-[10px] md:text-xs font-bold px-2 py-1.5 rounded-md hover:bg-blue-100 transition shadow-sm focus:outline-none shrink-0">
               + Add Option
           </button>
           <button id="btn-sync-finance" onclick="manualFinanceSync(this)" class="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-md hover:bg-green-100 transition flex items-center shadow-sm focus:outline-none shrink-0 border">
               <span class="btn-text">Saved</span>
               <div class="btn-spinner spinner-white ml-1.5 !w-3 !h-3 hidden-force border-2"></div>
           </button>
       </div>
   </div>

   <div id="financeGlobalSettings" class="bg-white dark:bg-gray-800 p-2 md:p-3 shrink-0 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center gap-2 z-10 shadow-[0_4px_10px_-5px_rgba(0,0,0,0.05)]">
       <!-- Global Pax controls injected here -->
   </div>

   <div id="financeLoadingOverlay" class="absolute inset-0 top-[90px] bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-20 flex flex-col justify-center items-center">
       <div class="loader !w-8 !h-8 border-primary mb-2"></div>
       <span class="text-primary dark:text-blue-400 font-bold text-[10px] tracking-wide shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full">Loading Planner...</span>
   </div>

   <div class="flex-grow overflow-y-auto overflow-x-hidden p-2 md:p-4 bg-gray-50 dark:bg-gray-950 custom-scrollbar pb-10">
       <div id="financeOptionsContainer" class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 w-full items-start pb-4 max-w-full mx-auto">
           <!-- Options will be rendered here dynamically -->
       </div>
   </div>
   
   <!-- Exchange Rates Modal -->
   <div id="financeRatesModal" class="fixed inset-0 bg-black/60 z-[96] hidden-force flex justify-center items-center p-4 backdrop-blur-sm transition-opacity">
       <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl border border-gray-200 dark:border-gray-700 m-auto animate-slide-up flex flex-col max-h-[90vh]">
           <div class="flex justify-between items-center mb-3 border-b border-gray-200 dark:border-gray-700 pb-2 shrink-0">
               <h3 class="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                   <svg class="w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   Exchange Rates
               </h3>
               <button type="button" onclick="closeFinanceRatesModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold px-1 focus:outline-none shrink-0">&times;</button>
           </div>
           <div id="financeRatesList" class="overflow-y-auto custom-scrollbar flex-grow space-y-2 pb-2"></div>
           <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 shrink-0 flex justify-end">
               <button onclick="closeFinanceRatesModal()" class="bg-primary text-white py-2 px-6 rounded-lg font-bold shadow-sm hover:bg-blue-600 transition focus:outline-none">Done</button>
           </div>
       </div>
   </div>
</div>
`;

try {
   const res = await callBackend('fetchFinance');
   globalFinanceRates = res.rates || { "SGD": 1, "MYR": 0.28 };
   
   const rawOptions = res.data?.options || (Array.isArray(res.data) ? res.data : []);
   financeConfig = res.data?.config || { globalPaxMode: 'individual', globalPaxCount: 0, ts: Date.now(), customRates: {} };
   if(!financeConfig.customRates) financeConfig.customRates = {};
   
   financeOptions = rawOptions.map(opt => {
       // Support backward compatibility for old finance records
       if (opt.fields && !Array.isArray(opt.fields)) {
           const newFields = [];
           for (let [k, v] of Object.entries(opt.fields)) {
               newFields.push({
                   id: generateFinanceUUID(),
                   name: k,
                   costType: 'total',
                   tax: 0,
                   cost: parseFloat(v.cost) || 0,
                   currency: v.currency || 'MYR',
                   remarks: v.remarks || ''
               });
           }
           opt.fields = newFields;
       } else if (opt.fields) {
           opt.fields.forEach(f => {
               if (!f.costType) f.costType = 'total';
               if (f.tax === undefined || isNaN(f.tax)) f.tax = 0;
           });
       }
       if(!opt.displayCurrency) opt.displayCurrency = 'SGD';
       if(!opt.pax) opt.pax = 0;
       if(opt.widthSpan === undefined) opt.widthSpan = 2;
       if(!opt.ts) opt.ts = Date.now();
       if(opt._isCollapsed === undefined) opt._isCollapsed = isFinanceCollapsed;
       return opt;
   });

   if (financeOptions.length === 0) {
       addFinanceOption("Option 1", false);
   }
   
   renderFinanceGlobalSettings();
   renderFinanceOptions();
   startFinancePolling();
} catch (e) {
   showToast("Failed to load finance data.", true);
} finally {
   const overlay = document.getElementById('financeLoadingOverlay');
   if (overlay) overlay.classList.add('hidden-force');
}
}

function renderFinanceGlobalSettings() {
const container = document.getElementById('financeGlobalSettings');
if (!container) return;

const autoPax = globalLogistics?.participants?.length || 0;

container.innerHTML = `
   <div class="flex flex-wrap md:flex-nowrap justify-between items-center gap-2 w-full">
       <div class="flex flex-wrap items-center gap-2 flex-1">
           <div class="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1">
               <label class="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider shrink-0">Pax Mode:</label>
               <select onchange="updateFinanceConfig('globalPaxMode', this.value)" class="text-[11px] font-bold bg-transparent text-gray-900 dark:text-white focus:outline-none cursor-pointer">
                   <option value="individual" ${financeConfig.globalPaxMode === 'individual' ? 'selected' : ''}>Manual Override (Individual Options)</option>
                   <option value="manual" ${financeConfig.globalPaxMode === 'manual' ? 'selected' : ''}>Manual Override (All Options)</option>
                   <option value="auto" ${financeConfig.globalPaxMode === 'auto' ? 'selected' : ''}>Total Pax based on Sign up</option>
               </select>
           </div>
           
           <div class="flex items-center gap-1.5 ${financeConfig.globalPaxMode !== 'manual' ? 'hidden-force' : ''}">
               <label class="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider shrink-0">Global Pax:</label>
               <input type="number" min="0" value="${financeConfig.globalPaxCount}" onchange="updateFinanceConfig('globalPaxCount', this.value)" onkeyup="updateFinanceConfig('globalPaxCount', this.value)" class="hide-spinners w-16 text-xs font-bold border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm text-center">
           </div>
           
           <div class="flex items-center gap-1.5 ${financeConfig.globalPaxMode !== 'auto' ? 'hidden-force' : ''}">
               <label class="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider shrink-0">Active Pax:</label>
               <span class="text-xs font-black text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 shadow-sm">${autoPax}</span>
           </div>
       </div>
       
       <div class="flex gap-2">
           <button onclick="openFinanceRatesModal()" class="text-[10px] md:text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 px-2.5 py-1.5 rounded shadow-sm whitespace-nowrap shrink-0 transition focus:outline-none flex items-center gap-1">
               <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               Rates
           </button>
           <button onclick="toggleFinanceCollapse()" class="text-[10px] md:text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 rounded shadow-sm whitespace-nowrap shrink-0 transition focus:outline-none">
               ${isFinanceCollapsed ? 'Expand All' : 'Collapse All'}
           </button>
       </div>
   </div>
`;
}

function updateFinanceConfig(key, value) {
if (key === 'globalPaxMode') {
   financeConfig[key] = value;
   queueFinanceUpdate();
   renderFinanceGlobalSettings();
   renderFinanceOptions();
} else if (key === 'globalPaxCount') {
   financeConfig[key] = parseInt(value) || 0;
   queueFinanceUpdate();
   financeOptions.forEach(o => updateTotals(o.id));
   renderFinanceOptions();
}
}

function updateFinanceOption(optId, key, value) {
const opt = financeOptions.find(o => o.id === optId);
if (!opt) return;

if (key === 'title') {
   opt.title = value;
} else if (key === 'pax') {
   opt.pax = parseInt(value) || 0;
   updateTotals(optId);
} else if (key === 'displayCurrency') {
   opt.displayCurrency = value;
   updateTotals(optId);
}
queueFinanceUpdate(optId);
}

function updateFinanceField(optId, fieldId, key, value) {
const opt = financeOptions.find(o => o.id === optId);
if (!opt) return;
const field = opt.fields.find(f => f.id === fieldId);
if (!field) return;

if (key === 'cost') {
   // Remove commas safely before parsing as float
   field.cost = parseFloat(String(value).replace(/,/g, '')) || 0;
   updateTotals(optId);
} else if (key === 'tax') {
   field.tax = parseFloat(value) || 0;
   updateTotals(optId);
} else if (key === 'costType') {
   field.costType = value;
   updateTotals(optId);
} else if (key === 'currency') {
   field.currency = value;
   updateTotals(optId);
} else if (key === 'name') {
   field.name = value;
} else if (key === 'remarks') {
   field.remarks = value;
}
queueFinanceUpdate(optId);

if (key === 'costType') {
   renderFinanceOptions(); // Re-render to update the dynamic color of the dropdown
}
}

function updateTotals(optId) {
const opt = financeOptions.find(o => o.id === optId);
if (!opt) return;

const pax = getActivePax(opt);
let totalSgd = 0;

opt.fields.forEach(f => {
   const rate = getActualRate(f.currency);
   const baseCost = parseFloat(f.cost) || 0;
   const taxPct = parseFloat(f.tax) || 0;
   const isPerPax = f.costType === 'per_pax';
   
   const rawCost = isPerPax ? (baseCost * pax) : baseCost;
   const costWithTax = rawCost * (1 + (taxPct / 100));
   
   totalSgd += costWithTax * rate;
});

const dispRate = getActualRate(opt.displayCurrency);
const totalDisp = totalSgd / dispRate;
const cppDisp = pax > 0 ? totalDisp / pax : 0;

const totEl = document.getElementById(`total_${opt.id}`);
const cppEl = document.getElementById(`cpp_${opt.id}`);

if (totEl) totEl.textContent = `${opt.displayCurrency} ${totalDisp.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
if (cppEl) cppEl.textContent = `${opt.displayCurrency} ${cppDisp.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

function addFinanceOption(title = "New Option", reRender = true) {
const newOpt = {
   id: generateFinanceUUID(),
   title: title,
   pax: 0,
   displayCurrency: 'SGD',
   widthSpan: 2,
   ts: Date.now(),
   _isCollapsed: false,
   fields: []
};

defaultFinanceFields.forEach(f => {
   newOpt.fields.push({
       id: generateFinanceUUID(),
       name: f,
       costType: 'total',
       tax: 0,
       cost: 0,
       currency: 'MYR',
       remarks: ''
   });
});

financeOptions.unshift(newOpt);
queueFinanceUpdate(newOpt.id);
if (reRender) renderFinanceOptions();
}

function duplicateFinanceOption(id) {
const opt = financeOptions.find(o => o.id === id);
if (!opt) return;

const copy = JSON.parse(JSON.stringify(opt));
copy.id = generateFinanceUUID();
copy.title = opt.title + " (Copy)";
copy.ts = Date.now();
copy._isCollapsed = false;
copy.fields.forEach(f => f.id = generateFinanceUUID()); 

financeOptions.unshift(copy);
queueFinanceUpdate(copy.id);
renderFinanceOptions();
}

function removeFinanceOption(id) {
if (!confirm("Are you sure you want to remove this option?")) return;
financeOptions = financeOptions.filter(o => o.id !== id);

// We must trigger a global save config to ensure the deletion persists securely across clients
financeConfig.ts = Date.now();

// Wipe pending updates for this opt just in case
pendingFinanceUpdates.delete(id);

setFinanceSyncButtonState('saving');
if (financeSyncTimeout) clearTimeout(financeSyncTimeout);
financeSyncTimeout = setTimeout(async () => {
   isFinanceSyncing = true;
   try {
       await callBackend('saveFinance', { payload: { options: financeOptions, config: financeConfig } });
       setFinanceSyncButtonState('saved');
   } catch(e) {
       setFinanceSyncButtonState('error');
   } finally {
       isFinanceSyncing = false;
   }
}, 500);

renderFinanceOptions();
}

function addFinanceCategory(optId) {
const opt = financeOptions.find(o => o.id === optId);
if(!opt) return;

opt.fields.push({
   id: generateFinanceUUID(),
   name: 'New Category',
   costType: 'total',
   tax: 0,
   cost: 0,
   currency: 'MYR',
   remarks: ''
});
queueFinanceUpdate(optId);
renderFinanceOptions();
}

function removeFinanceCategory(optId, fieldId) {
const opt = financeOptions.find(o => o.id === optId);
if(!opt) return;

opt.fields = opt.fields.filter(f => f.id !== fieldId);
queueFinanceUpdate(optId);
renderFinanceOptions();
}

// -----------------------------------------------------------
// DRAG & DROP ENGINE (Vertical Specific for Finance Categories)
// -----------------------------------------------------------
function startFinDrag(e) {
if(e.type === 'mousedown' && e.button !== 0) return; // Only left click allowed
e.preventDefault(); // Stop text selection / scrolling while grabbing handle

const handle = e.currentTarget;
const row = handle.closest('.fin-cat-row');
const container = row.closest('.fin-cat-container');

const clientY = e.touches ? e.touches[0].clientY : e.clientY;
const clientX = e.touches ? e.touches[0].clientX : e.clientX;
const rect = row.getBoundingClientRect();

finDndState = {
   active: true,
   row: row,
   container: container,
   optId: container.dataset.optId,
   yOffset: clientY - rect.top,
   xOffset: clientX - rect.left,
   placeholder: document.createElement('div')
};

// Style Placeholder
finDndState.placeholder.className = 'fin-cat-placeholder bg-blue-50/50 dark:bg-blue-900/20 border-2 border-dashed border-primary/50 rounded-lg my-1 transition-all';
finDndState.placeholder.style.height = rect.height + 'px';

// Swap into DOM
row.parentNode.insertBefore(finDndState.placeholder, row);

// Float Row
row.style.position = 'fixed';
row.style.zIndex = '9999';
row.style.width = rect.width + 'px';
row.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
row.classList.add('opacity-95');

updateFinDragPosition(clientY, clientX);

document.addEventListener('mousemove', moveFinDrag, {passive: false});
document.addEventListener('touchmove', moveFinDrag, {passive: false});
document.addEventListener('mouseup', endFinDrag);
document.addEventListener('touchend', endFinDrag);
}

function moveFinDrag(e) {
if(!finDndState.active) return;
e.preventDefault(); // Lock scroll while dragging

const clientY = e.touches ? e.touches[0].clientY : e.clientY;
const clientX = e.touches ? e.touches[0].clientX : e.clientX;

updateFinDragPosition(clientY, clientX);

// Find closest valid sibling
const siblings = Array.from(finDndState.container.querySelectorAll('.fin-cat-row:not(.fin-cat-placeholder):not([style*="position: fixed"])'));
let nextElement = null;

for(let sib of siblings) {
   const rect = sib.getBoundingClientRect();
   if(clientY < rect.top + rect.height / 2) {
       nextElement = sib;
       break;
   }
}

if(nextElement) {
   finDndState.container.insertBefore(finDndState.placeholder, nextElement);
} else {
   finDndState.container.appendChild(finDndState.placeholder);
}
}

function updateFinDragPosition(y, x) {
finDndState.row.style.top = (y - finDndState.yOffset) + 'px';
finDndState.row.style.left = (x - finDndState.xOffset) + 'px';
}

function endFinDrag(e) {
if(!finDndState.active) return;
finDndState.active = false;

document.removeEventListener('mousemove', moveFinDrag);
document.removeEventListener('touchmove', moveFinDrag);
document.removeEventListener('mouseup', endFinDrag);
document.removeEventListener('touchend', endFinDrag);

// Unfloat row and insert at placeholder
finDndState.placeholder.parentNode.insertBefore(finDndState.row, finDndState.placeholder);
finDndState.placeholder.remove();

finDndState.row.style = '';
finDndState.row.classList.remove('opacity-95');

reorderFieldsInModel(finDndState.optId);
renderFinanceOptions(); // Re-render ensures visual integrity if background sync occurred
}

function reorderFieldsInModel(optId) {
const opt = financeOptions.find(o => o.id === optId);
if(!opt) return;
const container = document.querySelector(`.fin-cat-container[data-opt-id="${optId}"]`);
if(!container) return;

const newFields = [];
container.querySelectorAll('.fin-cat-row').forEach(row => {
   const fId = row.dataset.fieldId;
   const field = opt.fields.find(f => f.id === fId);
   if(field) newFields.push(field);
});
opt.fields = newFields;
queueFinanceUpdate(optId);
}
// -----------------------------------------------------------

function renderFinanceOptions() {
const container = document.getElementById('financeOptionsContainer');
if (!container) return;

if (financeOptions.length === 0) {
   container.innerHTML = `<div class="w-full col-span-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 pt-10"><svg class="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p class="font-bold text-sm">No options created yet. Click '+ Add Option' to start planning.</p></div>`;
   return;
}

let html = '';
financeOptions.forEach(opt => {
   const pax = getActivePax(opt);
   let totalSgd = 0;
   
   opt.fields.forEach(f => {
       const rate = getActualRate(f.currency);
       const baseCost = parseFloat(f.cost) || 0;
       const taxPct = parseFloat(f.tax) || 0;
       const isPerPax = f.costType === 'per_pax';
       
       const rawCost = isPerPax ? (baseCost * pax) : baseCost;
       const costWithTax = rawCost * (1 + (taxPct / 100));
       
       totalSgd += costWithTax * rate;
   });
   
   const dispRate = getActualRate(opt.displayCurrency);
   const totalDisp = totalSgd / dispRate;
   const cppDisp = pax > 0 ? totalDisp / pax : 0;
   
   const paxInputDisabled = financeConfig.globalPaxMode !== 'individual';
   const isLocalCollapsed = opt._isCollapsed !== undefined ? opt._isCollapsed : false;
   
   const spanClass = opt.widthSpan === 3 ? 'col-span-1 lg:col-span-2 xl:col-span-3' : (opt.widthSpan === 2 ? 'col-span-1 lg:col-span-2 xl:col-span-2' : 'col-span-1');

   html += `
   <div class="w-full shrink-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden h-fit transition-all duration-300 ${spanClass}">
       <!-- Header -->
       <div class="p-2 md:p-3 bg-gray-50/80 dark:bg-gray-900/50 flex justify-between items-center gap-2 shrink-0 ${isLocalCollapsed ? '' : 'border-b border-gray-200 dark:border-gray-700'}">
           <input type="text" value="${opt.title}" 
                  onchange="updateFinanceOption('${opt.id}', 'title', this.value)"
                  class="font-black text-base md:text-lg bg-transparent border-b border-transparent focus:border-primary outline-none text-gray-900 dark:text-white flex-1 min-w-0 px-1 transition pb-0.5">
           <div class="flex items-center gap-1.5 shrink-0">
               <button onclick="cycleFinanceOptionWidth('${opt.id}')" class="hidden lg:block text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 md:p-1.5 rounded transition bg-gray-100/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:outline-none shadow-sm" title="Toggle Width">
                   <svg class="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 8L4 12l4 4m8-8l4 4-4 4"></path></svg>
               </button>
               <button onclick="toggleIndividualFinanceCollapse('${opt.id}')" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 md:p-1.5 rounded transition bg-gray-100/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:outline-none shadow-sm" title="Collapse/Expand">
                   <svg class="w-4 h-4 md:w-5 md:h-5 transform transition-transform ${isLocalCollapsed ? '' : 'rotate-180'}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" /></svg>
               </button>
               <button onclick="duplicateFinanceOption('${opt.id}')" class="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 p-1.5 md:px-2 md:py-1.5 rounded transition" title="Duplicate Option">
                   <svg class="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
               </button>
               <button onclick="removeFinanceOption('${opt.id}')" class="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 p-1.5 md:px-2 md:py-1.5 rounded transition" title="Delete Option">
                   <svg class="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
               </button>
           </div>
       </div>
       
       <!-- Collapsible Body (Pax & Categories) -->
       <div class="${isLocalCollapsed ? 'hidden-force' : 'flex flex-col'}">
           <div class="px-2 md:px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
               <label class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Pax Count ${paxInputDisabled ? '(Global)' : ''}</label>
               <input type="number" min="0" value="${pax}" 
                   ${paxInputDisabled ? 'disabled' : ''} 
                   onchange="updateFinanceOption('${opt.id}', 'pax', this.value)" 
                   onkeyup="updateFinanceOption('${opt.id}', 'pax', this.value)"
                   class="hide-spinners w-20 text-xs font-bold px-2 py-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-600 rounded text-center focus:outline-none focus:ring-1 focus:ring-primary ${paxInputDisabled ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-500' : ''}">
           </div>
           
           <div class="fin-cat-container p-2 bg-white dark:bg-gray-800 flex flex-col gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar" data-opt-id="${opt.id}">
               ${opt.fields.map(f => {
                   // Dynamic color based on Cost Type to act as a visual reminder (Explicitly defined to survive JIT caching)
                   const costTypeColorClass = f.costType === 'per_pax' 
                       ? 'bg-purple-100 text-purple-900 border-purple-400 focus:border-purple-500 focus:ring-purple-500 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700' 
                       : 'bg-green-100 text-green-900 border-green-400 focus:border-green-500 focus:ring-green-500 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700';

                   const displayCostStr = parseFloat(f.cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                   return `
                   <div class="fin-cat-row flex flex-col w-full bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-transparent focus-within:border-gray-300 dark:focus-within:border-gray-600 transition shadow-sm" data-field-id="${f.id}">
                       
                       <!-- Row 1: Drag, Delete, Name -->
                       <div class="flex items-center gap-2 w-full mb-1">
                           <div class="fin-drag-handle cursor-grab active:cursor-grabbing p-1 shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition" onmousedown="startFinDrag(event)" ontouchstart="startFinDrag(event)">
                               <svg class="w-5 h-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8h16M4 16h16" /></svg>
                           </div>
                           <button onclick="removeFinanceCategory('${opt.id}', '${f.id}')" class="text-red-400 hover:text-red-600 p-1 shrink-0 transition" title="Delete Category">
                               <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                           </button>
                           <input type="text" value="${f.name}" onchange="updateFinanceField('${opt.id}', '${f.id}', 'name', this.value)" class="flex-1 min-w-[80px] bg-transparent text-sm font-bold text-gray-900 dark:text-gray-100 outline-none px-1 border-b border-transparent focus:border-primary transition" placeholder="Category Name">
                       </div>

                       <!-- Row 2: Inputs (Currency, Cost Type, Cost, Tax, Remarks) -->
                       <div class="flex items-center flex-wrap gap-2 pl-[42px] w-full">
                           <select onchange="updateFinanceField('${opt.id}', '${f.id}', 'currency', this.value)" class="w-[65px] shrink-0 bg-white dark:bg-gray-950 text-xs font-bold border border-gray-300 dark:border-gray-600 rounded py-1.5 pl-1.5 pr-0 outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm cursor-pointer">
                               ${getCurrencyOptions(f.currency)}
                           </select>
                           
                           <select onchange="updateFinanceField('${opt.id}', '${f.id}', 'costType', this.value)" class="w-[70px] shrink-0 text-xs font-extrabold border rounded py-1.5 px-1 outline-none focus:ring-1 shadow-sm cursor-pointer transition-colors ${costTypeColorClass}">
                               <option value="total" ${f.costType !== 'per_pax' ? 'selected' : ''}>Total</option>
                               <option value="per_pax" ${f.costType === 'per_pax' ? 'selected' : ''}>/Pax</option>
                           </select>

                           <input type="text" value="${displayCostStr}" 
                                  oninput="formatMoneyInput(this, false); updateFinanceField('${opt.id}', '${f.id}', 'cost', this.value)" 
                                  onblur="formatMoneyInput(this, true); updateFinanceField('${opt.id}', '${f.id}', 'cost', this.value)" 
                                  class="w-[100px] shrink-0 bg-white dark:bg-gray-950 text-sm font-bold border border-gray-300 dark:border-gray-600 rounded px-2 py-1 outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm text-right" placeholder="0.00">
                           
                           <div class="flex items-center gap-1 w-[70px] shrink-0 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 outline-none focus-within:border-primary focus-within:ring-1 focus-within:ring-primary shadow-sm" title="Tax Percentage">
                               <span class="text-[10px] font-bold text-gray-400">+</span>
                               <input type="number" step="0.1" min="0" value="${f.tax || ''}" onchange="updateFinanceField('${opt.id}', '${f.id}', 'tax', this.value)" onkeyup="updateFinanceField('${opt.id}', '${f.id}', 'tax', this.value)" class="hide-spinners w-full bg-transparent text-sm font-bold outline-none text-right" placeholder="Tax">
                               <span class="text-[10px] font-bold text-gray-500">%</span>
                           </div>

                           <input type="text" value="${f.remarks}" onchange="updateFinanceField('${opt.id}', '${f.id}', 'remarks', this.value)" class="flex-1 min-w-[120px] bg-transparent text-xs font-medium text-gray-500 dark:text-gray-400 outline-none px-1 border-b border-transparent focus:border-primary transition" placeholder="Remarks...">
                       </div>
                   </div>
                   `;
               }).join('')}
               <div class="pt-2 px-1">
                   <button onclick="addFinanceCategory('${opt.id}')" class="w-full py-2 border border-dashed border-blue-300 dark:border-blue-800 rounded-lg text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">+ Add Custom Category</button>
               </div>
           </div>
       </div>
       
       <!-- Totals Section -->
       <div class="p-2 md:p-3 bg-blue-50/80 dark:bg-blue-900/20 shrink-0 flex flex-col gap-1.5 ${isLocalCollapsed ? 'border-t border-gray-200 dark:border-gray-700' : 'border-t border-blue-100 dark:border-blue-900/50'}">
           <div class="${isLocalCollapsed ? 'hidden-force' : 'flex'} justify-between items-center pb-2 border-b border-blue-200/50 dark:border-blue-800/50 mb-1">
               <span class="font-bold text-[10px] md:text-[11px] text-blue-800 dark:text-blue-300 uppercase tracking-widest">Currency for Totals</span>
               <select onchange="updateFinanceOption('${opt.id}', 'displayCurrency', this.value)" 
                   class="w-[90px] text-xs font-bold px-2 py-1 bg-white dark:bg-gray-950 border border-blue-300 dark:border-blue-700 rounded focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-sm text-blue-900 dark:text-blue-100">
                   ${getCurrencyOptions(opt.displayCurrency)}
               </select>
           </div>
           
           <div class="flex justify-between items-center">
               <span class="font-black text-xs md:text-sm text-blue-800 dark:text-blue-300 uppercase tracking-widest">Total Estimated</span>
               <span id="total_${opt.id}" class="font-black text-base md:text-lg text-blue-700 dark:text-blue-400 bg-white dark:bg-gray-900 px-2 py-1 rounded border border-blue-200 dark:border-blue-800 shadow-sm leading-none">${opt.displayCurrency} ${totalDisp.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
           </div>
           <div class="flex justify-between items-center">
               <span class="font-black text-xs md:text-sm text-emerald-800 dark:text-emerald-400 uppercase tracking-widest">Cost Per Pax</span>
               <span id="cpp_${opt.id}" class="font-black text-base md:text-lg text-emerald-700 dark:text-emerald-400 bg-white dark:bg-gray-900 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800 shadow-sm leading-none">${opt.displayCurrency} ${cppDisp.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
           </div>
       </div>
   </div>
   `;
});

container.innerHTML = html;
}