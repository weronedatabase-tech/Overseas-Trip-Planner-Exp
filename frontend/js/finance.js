let financeOptions = [];
let pendingFinanceUpdates = new Map();
let pendingReceiptUpdates = new Map();
let globalFinanceRates = { "SGD": 1, "MYR": 0.28 };
let globalReceipts = [];
let financeConfig = {
globalPaxMode: 'individual', 
globalPaxCount: 0,
ts: 0,
customRates: {},
finalOptionId: null,
perPersonFee: 0,
feeDeviations: {},
feesReceived: {}
};
let isFinanceCollapsed = false;
let financeSyncTimeout = null;
let receiptSyncTimeout = null;
let financePollInterval = null;
let isFinanceSyncing = false;
let isReceiptSyncing = false;
let finSearchQuery = '';

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

async function buildFinanceUI() {
document.getElementById('tab-finance').innerHTML = `
<div class="sticky top-0 z-40 flex items-center justify-between bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shrink-0 rounded-t-xl md:rounded-none pr-2">
    <div class="flex overflow-x-auto scrollbar-hide flex-1 px-2 pt-1">
        <button onclick="switchFinanceSubTab('finalized')" id="subTab-fin-finalized" class="px-3 py-2 font-semibold border-b-2 border-primary text-primary whitespace-nowrap text-xs md:text-sm transition focus:outline-none">1. Finalized Finances</button>
        <button onclick="switchFinanceSubTab('options')" id="subTab-fin-options" class="px-3 py-2 font-semibold border-b-2 border-transparent text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs md:text-sm transition focus:outline-none">2. Trip Options</button>
        <button onclick="switchFinanceSubTab('receipts')" id="subTab-fin-receipts" class="px-3 py-2 font-semibold border-b-2 border-transparent text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs md:text-sm transition focus:outline-none">3. Receipts</button>
        <button onclick="switchFinanceSubTab('fees')" id="subTab-fin-fees" class="px-3 py-2 font-semibold border-b-2 border-transparent text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs md:text-sm transition focus:outline-none">4. Fee Tracker</button>
    </div>
    <div class="flex items-center shrink-0 pl-2 border-l border-gray-200 dark:border-gray-800 ml-1">
        <button id="btn-sync-finance" onclick="manualFinanceSync(this)" class="bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 text-xs md:text-xs font-bold px-3 py-1.5 rounded-md hover:bg-green-100 transition flex items-center shadow-sm focus:outline-none shrink-0">
            <span class="btn-text">Saved</span>
            <div class="btn-spinner spinner-white ml-1.5 !w-3 !h-3 hidden-force border-2"></div>
        </button>
    </div>
</div>

<div id="finLoadingOverlay" class="absolute inset-0 top-[50px] bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-20 flex flex-col justify-center items-center hidden-force">
    <div class="loader !w-8 !h-8 border-primary mb-2"></div>
    <span class="text-primary dark:text-green-400 font-bold text-xs tracking-wide shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full mt-2">Loading Planner...</span>
</div>

<div id="fin-tab-finalized" class="flex-1 w-full p-2 md:p-4 overflow-y-auto custom-scrollbar relative"></div>
<div id="fin-tab-options" class="hidden-force flex-1 w-full p-2 md:p-4 overflow-y-auto custom-scrollbar relative"></div>
<div id="fin-tab-receipts" class="hidden-force flex-1 w-full p-2 md:p-4 overflow-y-auto custom-scrollbar relative"></div>
<div id="fin-tab-fees" class="hidden-force flex-1 w-full p-2 md:p-4 overflow-y-auto custom-scrollbar relative"></div>
`;

const overlay = document.getElementById('finLoadingOverlay');
if (overlay) overlay.classList.remove('hidden-force');

try {
    if(!globalLogistics) {
        try {
            const resLog = await apiCall('fetchLogistics'); 
            globalLogistics = resLog;
            if (typeof processDisplayNames === "function") processDisplayNames(globalLogistics.participants);
            if (typeof applyGlobalSorting === "function") globalLogistics.participants = applyGlobalSorting(globalLogistics.participants);
        } catch(e) {}
    }

    const [finRes, recRes] = await Promise.all([
        apiCall('fetchFinance').catch(e => { console.warn("fetchFinance failed", e); return { data: { options: [], config: {} }, rates: { "SGD": 1 } }; }),
        apiCall('fetchReceipts').catch(e => { console.warn("fetchReceipts failed", e); return { receipts: [] }; })
    ]);

    globalFinanceRates = finRes.rates || { "SGD": 1, "MYR": 0.28 };
    globalReceipts = recRes.receipts || [];
    
    const rawOptions = finRes.data?.options || (Array.isArray(finRes.data) ? finRes.data : []);
    financeConfig = finRes.data?.config || { globalPaxMode: 'individual', globalPaxCount: 0, ts: Date.now(), customRates: {}, finalOptionId: null, perPersonFee: 0, feeDeviations: {}, feesReceived: {}, payNowNumber: '', showPaymentSection: false };
    
    if(!financeConfig.customRates) financeConfig.customRates = {};
    if(!financeConfig.feeDeviations) financeConfig.feeDeviations = {};
    if(!financeConfig.feesReceived) financeConfig.feesReceived = {};
    
    financeOptions = rawOptions.map(opt => {
        if (opt.fields && !Array.isArray(opt.fields)) {
            const newFields = [];
            for (let [k, v] of Object.entries(opt.fields)) {
                newFields.push({ id: generateFinanceUUID(), name: k, costType: 'total', tax: 0, cost: parseFloat(v.cost) || 0, currency: v.currency || 'MYR', remarks: v.remarks || '' });
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
    
    renderAllFinanceTabs();
    startFinancePolling();
} catch (e) {
    showToast("Failed to load finance data.", true);
} finally {
    if (overlay) overlay.classList.add('hidden-force');
}
}

function switchFinanceSubTab(tabId) {
['finalized', 'options', 'receipts', 'fees'].forEach(id => { 
    const el = document.getElementById(`fin-tab-${id}`);
    if(el) el.classList.add('hidden-force'); 
    const btn = document.getElementById(`subTab-fin-${id}`); 
    if(btn) { btn.classList.remove('border-primary', 'text-primary'); btn.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400'); } 
}); 
const targetEl = document.getElementById(`fin-tab-${tabId}`);
if(targetEl) targetEl.classList.remove('hidden-force'); 
const targetBtn = document.getElementById(`subTab-fin-${tabId}`); 
if(targetBtn) { targetBtn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400'); targetBtn.classList.add('border-primary', 'text-primary'); } 

renderAllFinanceTabs();
}

function renderAllFinanceTabs() {
renderFinalizedFinances();
renderFinanceOptions();
renderReceiptsBrowser();
renderFeeTracker();
}

function updateFinanceConfig(key, value) {
if (key === 'globalPaxMode' || key === 'finalOptionId' || key === 'perPersonFee' || key === 'payNowNumber' || key === 'showPaymentSection') {
    financeConfig[key] = value;
} else if (key === 'globalPaxCount') {
    financeConfig[key] = parseInt(value) || 0;
}
queueFinanceUpdate();
renderAllFinanceTabs();
}

function setFinanceSyncButtonState(state) {
const btn = document.getElementById('btn-sync-finance');
if(!btn) return;

const textSpan = btn.querySelector('.btn-text'); 
const spinner = btn.querySelector('.btn-spinner');

btn.className = "text-xs md:text-xs px-3 py-1.5 rounded-md font-bold transition flex items-center justify-center border shadow-sm focus:outline-none shrink-0"; 
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

const payload = { updates: updates, config: financeConfig };

try {
    const res = await apiCall('saveFinance', { payload: payload });
    if (res.data) {
        if (res.data.config && res.data.config.ts > financeConfig.ts) {
            financeConfig = res.data.config;
            if(!financeConfig.customRates) financeConfig.customRates = {};
            if(!financeConfig.feeDeviations) financeConfig.feeDeviations = {};
            if(!financeConfig.feesReceived) financeConfig.feesReceived = {};
        }
        
        if (res.data.options && Array.isArray(res.data.options)) {
            res.data.options.forEach(sOpt => {
                let lIdx = financeOptions.findIndex(o => o.id === sOpt.id);
                if (lIdx === -1) {
                    sOpt._isCollapsed = isFinanceCollapsed;
                    financeOptions.push(sOpt);
                } else {
                    let lOpt = financeOptions[lIdx];
                    if (sOpt.ts > (lOpt.ts || 0) && !pendingFinanceUpdates.has(sOpt.id)) {
                        sOpt._isCollapsed = lOpt._isCollapsed; 
                        financeOptions[lIdx] = sOpt;
                    }
                }
            });

            const serverIds = res.data.options.map(o => o.id);
            financeOptions = financeOptions.filter(o => serverIds.includes(o.id) || pendingFinanceUpdates.has(o.id));
        }
    }
    setFinanceSyncButtonState('saved');
    if (!finDndState.active && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        renderAllFinanceTabs();
    }
} catch (e) {
    setFinanceSyncButtonState('error');
    updates.forEach(u => pendingFinanceUpdates.set(u.id, u));
} finally {
    isFinanceSyncing = false;
}
}

function queueReceiptUpdate(receipt) {
receipt.ts = Date.now();
pendingReceiptUpdates.set(receipt.id, receipt);
setFinanceSyncButtonState('saving');
if (receiptSyncTimeout) clearTimeout(receiptSyncTimeout);
receiptSyncTimeout = setTimeout(() => { executeReceiptSync(); }, 1500); 
}

async function executeReceiptSync() {
if (pendingReceiptUpdates.size === 0) return;
isReceiptSyncing = true;
setFinanceSyncButtonState('saving');
const updates = Array.from(pendingReceiptUpdates.values());
pendingReceiptUpdates.clear();

try {
    const res = await apiCall('syncReceipts', { updates: updates });
    if (res.receipts) globalReceipts = res.receipts;
    setFinanceSyncButtonState('saved');
    renderReceiptsBrowser();
    renderFinalizedFinances();
} catch(e) {
    setFinanceSyncButtonState('error');
    updates.forEach(u => pendingReceiptUpdates.set(u.id, u));
} finally {
    isReceiptSyncing = false;
}
}

function startFinancePolling() {
if (financePollInterval) clearInterval(financePollInterval);

financePollInterval = setInterval(async () => {
    const tab = document.getElementById('tab-finance');
    if(!tab || tab.classList.contains('hidden-force') || isFinanceSyncing || isReceiptSyncing || finDndState.active) return;
    
    const fetchStartTime = Date.now();

    try {
        const [finRes, recRes] = await Promise.all([
        apiCall('fetchFinance').catch(e => { console.warn("fetchFinance failed", e); return { data: { options: [], config: {} }, rates: { "SGD": 1 } }; }),
        apiCall('fetchReceipts').catch(e => { console.warn("fetchReceipts failed", e); return { receipts: [] }; })
    ]);

        if (lastLocalChange > fetchStartTime) return; 

        let hasChanges = false;
        
        if (recRes.receipts) {
            globalReceipts = recRes.receipts;
            hasChanges = true;
        }

        if (finRes.data) {
            if (finRes.data.config && finRes.data.config.ts > (financeConfig.ts || 0)) {
                financeConfig = finRes.data.config;
                if(!financeConfig.customRates) financeConfig.customRates = {};
                if(!financeConfig.feeDeviations) financeConfig.feeDeviations = {};
                if(!financeConfig.feesReceived) financeConfig.feesReceived = {};
                hasChanges = true;
            }
            
            if (finRes.data.options && Array.isArray(finRes.data.options)) {
                finRes.data.options.forEach(sOpt => {
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
                const serverIds = finRes.data.options.map(o => o.id);
                const initialLength = financeOptions.length;
                financeOptions = financeOptions.filter(o => serverIds.includes(o.id) || pendingFinanceUpdates.has(o.id));
                if (financeOptions.length !== initialLength) hasChanges = true;
            }
        }

        if (hasChanges && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            renderAllFinanceTabs();
            if (pendingFinanceUpdates.size === 0 && pendingReceiptUpdates.size === 0) setFinanceSyncButtonState('saved');
        }
    } catch (e) { }
}, 10000);
}

async function manualFinanceSync(btn) {
setFinanceSyncButtonState('loading');
try {
    if (pendingFinanceUpdates.size > 0 || financeConfig.ts) await executeFinanceSync();
    if (pendingReceiptUpdates.size > 0) await executeReceiptSync();
    showToast("Refreshed from server!");
} catch(e) {
    showToast("Sync failed.", true);
}
}

// ==========================================
// TAB 1: FINALIZED FINANCES
// ==========================================
function renderFinalizedFinances() {
const cont = document.getElementById('fin-tab-finalized');
if(!cont || cont.classList.contains('hidden-force')) return;

if(!financeConfig.finalOptionId) {
    cont.innerHTML = `
    <div class="flex flex-col items-center justify-center p-12 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <svg class="w-16 h-16 mb-4 opacity-50 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p class="font-bold text-base text-gray-700 dark:text-gray-300">No Finalized Option Selected</p>
        <p class="text-xs mt-2 text-center max-w-sm">Navigate to the <b>Trip Options</b> tab and click "Mark as Finalized" on the budget option you want to proceed with.</p>
    </div>`;
    return;
}

const opt = financeOptions.find(o => o.id === financeConfig.finalOptionId && !o.isDeleted);
if(!opt) {
    cont.innerHTML = `
    <div class="flex flex-col items-center justify-center p-12 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <svg class="w-16 h-16 mb-4 opacity-50 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p class="font-bold text-base text-gray-700 dark:text-gray-300">No Finalized Option Selected</p>
        <p class="text-xs mt-2 text-center max-w-sm">Navigate to the <b>Trip Options</b> tab and click "Mark as Finalized" on the budget option you want to proceed with.</p>
    </div>`;
    return;
}

const pax = getActivePax(opt);
let grandPlannedSgd = 0;
let grandActualSgd = 0;

let rowsHtml = '';

opt.fields.forEach(f => {
    const rate = getActualRate(f.currency);
    const baseCost = parseFloat(f.cost) || 0;
    const taxPct = parseFloat(f.tax) || 0;
    const rawCost = f.costType === 'per_pax' ? (baseCost * pax) : baseCost;
    const plannedSgd = (rawCost * (1 + (taxPct / 100))) * rate;
    
    const actualSgd = globalReceipts
        .filter(r => r.categoryId === f.id && !r.isDeleted)
        .reduce((sum, r) => sum + r.sgdAmount, 0);

    grandPlannedSgd += plannedSgd;
    grandActualSgd += actualSgd;

    const diff = plannedSgd - actualSgd;
    const diffClass = diff < 0 ? 'text-rose-600 dark:text-rose-500' : 'text-purple-600 dark:text-purple-400';

    rowsHtml += `
    <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
        <td class="py-1.5 px-2 text-sm font-bold text-gray-900 dark:text-gray-100">${f.name}</td>
        <td class="py-1.5 px-2 text-xs font-semibold text-gray-600 dark:text-gray-400 text-right whitespace-nowrap">SGD ${plannedSgd.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
        <td class="py-1.5 px-2 text-xs font-bold text-green-700 dark:text-green-400 text-right whitespace-nowrap">SGD ${actualSgd.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
        <td class="py-1.5 px-2 text-xs font-black ${diffClass} text-right whitespace-nowrap">${diff > 0 ? '+' : ''}${diff.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
    </tr>`;
});

cont.innerHTML = `
<div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
    <div class="bg-green-50 dark:bg-green-900/20 p-4 border-b border-green-100 dark:border-green-800 flex justify-between items-center">
        <div>
            <h3 class="font-black text-lg text-green-800 dark:text-green-300 tracking-tight flex items-center gap-2">
                <svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Finalized Budget: ${opt.title}
            </h3>
            <p class="text-xs font-bold text-green-600/80 dark:text-green-400 mt-1 uppercase tracking-widest">Active Pax: ${pax} | Currency: SGD</p>
        </div>
    </div>
    
    <div class="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700 bg-gray-50/50 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-700">
        <div class="p-4 text-center flex flex-col">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Planned</span>
            <span class="text-lg font-black text-gray-800 dark:text-gray-200">SGD ${grandPlannedSgd.toLocaleString('en-US', {minimumFractionDigits:2})}</span>
        </div>
        <div class="p-4 text-center flex flex-col">
            <span class="text-xs font-bold text-green-500 uppercase tracking-widest mb-1">Total Actual</span>
            <span class="text-lg font-black text-green-700 dark:text-green-400">SGD ${grandActualSgd.toLocaleString('en-US', {minimumFractionDigits:2})}</span>
        </div>
        <div class="p-4 text-center flex flex-col">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Variance</span>
            <span class="text-lg font-black ${grandPlannedSgd - grandActualSgd < 0 ? 'text-rose-600 dark:text-rose-500' : 'text-purple-600 dark:text-purple-400'}">${grandPlannedSgd - grandActualSgd > 0 ? '+' : ''}${(grandPlannedSgd - grandActualSgd).toLocaleString('en-US', {minimumFractionDigits:2})}</span>
        </div>
        <div class="p-4 text-center flex flex-col">
            <span class="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">Actual Per Pax</span>
            <span class="text-lg font-black text-emerald-700 dark:text-emerald-400">SGD ${(pax > 0 ? grandActualSgd / pax : 0).toLocaleString('en-US', {minimumFractionDigits:2})}</span>
        </div>
    </div>

    <div class="overflow-x-auto custom-scrollbar">
        <table class="w-full text-left border-collapse min-w-[600px]">
            <thead class="bg-gray-100 dark:bg-gray-800 text-xs uppercase font-black text-gray-500 dark:text-gray-400 tracking-wider">
                <tr>
                    <th class="py-1.5 px-2">Category</th>
                    <th class="py-1.5 px-2 text-right">Planned (SGD)</th>
                    <th class="py-1.5 px-2 text-right">Actual (SGD)</th>
                    <th class="py-1.5 px-2 text-right">Variance</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                ${rowsHtml}
            </tbody>
        </table>
    </div>
</div>
`;
}

// ==========================================
// TAB 2: TRIP OPTIONS (SANDBOX)
// ==========================================
function renderFinanceOptions() {
const cont = document.getElementById('fin-tab-options');
if(!cont || cont.classList.contains('hidden-force')) return;

const autoPax = globalLogistics?.participants?.length || 0;

let globalSettingsHtml = `
<div class="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-wrap justify-between items-center gap-3 mb-4">
    <div class="flex flex-wrap items-center gap-3 flex-1">
        <div class="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1">
            <label class="text-xs uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider shrink-0">Pax Mode:</label>
            <select onchange="updateFinanceConfig('globalPaxMode', this.value)" class="text-sm font-bold bg-transparent text-gray-900 dark:text-white focus:outline-none cursor-pointer">
                <option value="individual" ${financeConfig.globalPaxMode === 'individual' ? 'selected' : ''}>Manual Override (Individual Options)</option>
                <option value="manual" ${financeConfig.globalPaxMode === 'manual' ? 'selected' : ''}>Manual Override (All Options)</option>
                <option value="auto" ${financeConfig.globalPaxMode === 'auto' ? 'selected' : ''}>Total Pax based on Sign up</option>
            </select>
        </div>
        <div class="flex items-center gap-1.5 ${financeConfig.globalPaxMode !== 'manual' ? 'hidden-force' : ''}">
            <label class="text-xs uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider shrink-0">Global Pax:</label>
            <input type="number" min="0" value="${financeConfig.globalPaxCount}" onchange="updateFinanceConfig('globalPaxCount', this.value)" class="hide-spinners w-16 text-xs font-bold border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm text-center">
        </div>
        <div class="flex items-center gap-1.5 ${financeConfig.globalPaxMode !== 'auto' ? 'hidden-force' : ''}">
            <label class="text-xs uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider shrink-0">Active Pax:</label>
            <span class="text-xs font-black text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded border border-green-200 dark:border-green-800 shadow-sm">${autoPax}</span>
        </div>
    </div>
    <div class="flex items-center gap-2">
        <button onclick="addFinanceOption()" class="bg-green-50 text-green-600 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 text-xs md:text-xs font-bold px-2 py-1.5 rounded-md hover:bg-green-100 transition shadow-sm focus:outline-none shrink-0">+ Add Option</button>
        <button onclick="openFinanceRatesModal()" class="text-xs md:text-xs font-bold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-200 dark:border-green-800 px-2.5 py-1.5 rounded shadow-sm whitespace-nowrap shrink-0 transition focus:outline-none flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Rates
        </button>
        <button onclick="toggleFinanceCollapse()" class="text-xs md:text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 rounded shadow-sm whitespace-nowrap shrink-0 transition focus:outline-none">
            ${isFinanceCollapsed ? 'Expand All' : 'Collapse All'}
        </button>
    </div>
</div>`;

let html = '<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 w-full items-start pb-4 max-w-full mx-auto">';

const activeOptions = financeOptions.filter(o => !o.isDeleted);

if (activeOptions.length === 0) {
    html += `<div class="w-full col-span-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 pt-10"><p class="font-bold text-sm">No options created yet.</p></div>`;
} else {
    activeOptions.forEach(opt => {
        const pax = getActivePax(opt);
        let totalSgd = 0;
        opt.fields.forEach(f => {
            const rate = getActualRate(f.currency);
            const baseCost = parseFloat(f.cost) || 0;
            const taxPct = parseFloat(f.tax) || 0;
            const rawCost = f.costType === 'per_pax' ? (baseCost * pax) : baseCost;
            totalSgd += (rawCost * (1 + (taxPct / 100))) * rate;
        });
        
        const dispRate = getActualRate(opt.displayCurrency);
        const totalDisp = totalSgd / dispRate;
        const cppDisp = pax > 0 ? totalDisp / pax : 0;
        const paxInputDisabled = financeConfig.globalPaxMode !== 'individual';
        const isLocalCollapsed = opt._isCollapsed !== undefined ? opt._isCollapsed : false;
        const spanClass = opt.widthSpan === 3 ? 'col-span-1 lg:col-span-2 xl:col-span-3' : (opt.widthSpan === 2 ? 'col-span-1 lg:col-span-2 xl:col-span-2' : 'col-span-1');
        
        const isFinal = financeConfig.finalOptionId === opt.id;
        const finalBadge = isFinal ? `<span class="bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800 text-[11px] font-black px-1.5 py-0.5 rounded shadow-sm uppercase tracking-widest shrink-0">FINALIZED</span>` : '';

        html += `
        <div class="w-full shrink-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-md border ${isFinal ? 'border-2 border-green-400 dark:border-green-600 shadow-[0_0_15px_rgba(74,222,128,0.2)]' : 'border border-gray-200 dark:border-gray-700'} overflow-hidden h-fit transition-all duration-300 ${spanClass}">
            <div class="p-2 md:p-3 ${isFinal ? 'bg-green-50/50 dark:bg-green-900/20' : 'bg-gray-50/80 dark:bg-gray-900/50'} flex justify-between items-center gap-2 shrink-0 ${isLocalCollapsed ? '' : 'border-b border-gray-200 dark:border-gray-700'}">
                <div class="flex items-center flex-1 min-w-0 gap-2">
                    <input type="text" value="${opt.title}" onchange="updateFinanceOption('${opt.id}', 'title', this.value)" class="font-black text-base md:text-lg bg-transparent border-b border-transparent focus:border-primary outline-none text-gray-900 dark:text-white flex-1 min-w-0 px-1 transition pb-0.5">
                    ${finalBadge}
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="updateFinanceConfig('finalOptionId', '${isFinal ? '' : opt.id}')" class="${isFinal ? 'text-gray-500 hover:text-red-500 bg-gray-100 hover:bg-red-50' : 'text-green-600 hover:text-white hover:bg-green-500 bg-green-50'} dark:bg-gray-800 px-2 py-1 rounded text-xs font-bold border transition focus:outline-none shadow-sm" title="${isFinal ? 'Remove Final Status' : 'Mark as Finalized Budget'}">
                        ${isFinal ? 'Unfinalize' : 'Make Final'}
                    </button>
                    <button onclick="cycleFinanceOptionWidth('${opt.id}')" class="hidden lg:block text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 md:p-1.5 rounded transition bg-gray-100/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:outline-none shadow-sm" title="Toggle Width">
                        <svg class="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 8L4 12l4 4m8-8l4 4-4 4"></path></svg>
                    </button>
                    <button onclick="toggleIndividualFinanceCollapse('${opt.id}')" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 md:p-1.5 rounded transition bg-gray-100/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:outline-none shadow-sm" title="Collapse/Expand">
                        <svg class="w-4 h-4 md:w-5 md:h-5 transform transition-transform ${isLocalCollapsed ? '' : 'rotate-180'}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button onclick="duplicateFinanceOption('${opt.id}')" class="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 p-1.5 rounded transition"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg></button>
                    <button onclick="removeFinanceOption('${opt.id}')" class="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 p-1.5 rounded transition"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                </div>
            </div>
            
            <div class="${isLocalCollapsed ? 'hidden-force' : 'flex flex-col'}">
                <div class="px-2 md:px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <label class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Pax Count ${paxInputDisabled ? '(Global)' : ''}</label>
                    <input type="number" min="0" value="${pax}" ${paxInputDisabled ? 'disabled' : ''} onchange="updateFinanceOption('${opt.id}', 'pax', this.value)" class="hide-spinners w-20 text-xs font-bold px-2 py-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-600 rounded text-center focus:outline-none focus:ring-1 focus:ring-primary ${paxInputDisabled ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-500' : ''}">
                </div>
                
                <div class="fin-cat-container p-2 bg-white dark:bg-gray-800 flex flex-col gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar" data-opt-id="${opt.id}">
                    ${opt.fields.map(f => {
                        const costTypeColorClass = f.costType === 'per_pax' ? 'bg-purple-100 text-purple-900 border-purple-400 focus:border-purple-500 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700' : 'bg-green-100 text-green-900 border-green-400 focus:border-green-500 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700';
                        const displayCostStr = parseFloat(f.cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        return `
                        <div class="fin-cat-row flex flex-col w-full bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-transparent focus-within:border-gray-300 dark:focus-within:border-gray-600 transition shadow-sm" data-field-id="${f.id}">
                            <div class="flex items-center gap-2 w-full mb-1">
                                <div class="fin-drag-handle cursor-grab active:cursor-grabbing p-1 shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition" onmousedown="startFinDrag(event)" ontouchstart="startFinDrag(event)"><svg class="w-5 h-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8h16M4 16h16" /></svg></div>
                                <button onclick="removeFinanceCategory('${opt.id}', '${f.id}')" class="text-red-400 hover:text-red-600 p-1 shrink-0 transition" title="Delete Category"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                                <input type="text" value="${f.name}" onchange="updateFinanceField('${opt.id}', '${f.id}', 'name', this.value)" class="flex-1 min-w-[80px] bg-transparent text-sm font-bold text-gray-900 dark:text-gray-100 outline-none px-1 border-b border-transparent focus:border-primary transition" placeholder="Category Name">
                            </div>
                            <div class="flex items-center flex-wrap gap-2 pl-[42px] w-full">
                                <select onchange="updateFinanceField('${opt.id}', '${f.id}', 'currency', this.value)" class="w-[65px] shrink-0 bg-white dark:bg-gray-950 text-xs font-bold border border-gray-300 dark:border-gray-600 rounded py-1.5 pl-1.5 pr-0 outline-none focus:border-primary shadow-sm cursor-pointer">${getCurrencyOptions(f.currency)}</select>
                                <select onchange="updateFinanceField('${opt.id}', '${f.id}', 'costType', this.value)" class="w-[70px] shrink-0 text-xs font-extrabold border rounded py-1.5 px-1 outline-none shadow-sm cursor-pointer transition-colors ${costTypeColorClass}"><option value="total" ${f.costType !== 'per_pax' ? 'selected' : ''}>Total</option><option value="per_pax" ${f.costType === 'per_pax' ? 'selected' : ''}>/Pax</option></select>
                                <input type="text" value="${displayCostStr}" oninput="formatMoneyInput(this, false); updateFinanceField('${opt.id}', '${f.id}', 'cost', this.value)" onblur="formatMoneyInput(this, true); updateFinanceField('${opt.id}', '${f.id}', 'cost', this.value)" class="w-[100px] shrink-0 bg-white dark:bg-gray-950 text-sm font-bold border border-gray-300 dark:border-gray-600 rounded px-2 py-1 outline-none focus:border-primary shadow-sm text-right" placeholder="0.00">
                                <div class="flex items-center gap-1 w-[70px] shrink-0 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 outline-none focus-within:border-primary shadow-sm"><span class="text-xs font-bold text-gray-400">+</span><input type="number" step="0.1" min="0" value="${f.tax || ''}" onchange="updateFinanceField('${opt.id}', '${f.id}', 'tax', this.value)" class="hide-spinners w-full bg-transparent text-sm font-bold outline-none text-right" placeholder="Tax"><span class="text-xs font-bold text-gray-500">%</span></div>
                                <input type="text" value="${f.remarks}" onchange="updateFinanceField('${opt.id}', '${f.id}', 'remarks', this.value)" class="flex-1 min-w-[120px] bg-transparent text-xs font-medium text-gray-500 dark:text-gray-400 outline-none px-1 border-b border-transparent focus:border-primary transition" placeholder="Remarks...">
                            </div>
                        </div>`;
                    }).join('')}
                    <div class="pt-2 px-1">
                        <button onclick="addFinanceCategory('${opt.id}')" class="w-full py-2 border border-dashed border-green-300 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-xs font-bold hover:bg-green-50 dark:hover:bg-green-900/20 transition">+ Add Custom Category</button>
                    </div>
                </div>
            </div>
            
            <div class="p-2 md:p-3 bg-green-50/80 dark:bg-green-900/20 shrink-0 flex flex-col gap-1.5 ${isLocalCollapsed ? 'border-t border-gray-200 dark:border-gray-700' : 'border-t border-green-100 dark:border-green-900/50'}">
                <div class="${isLocalCollapsed ? 'hidden-force' : 'flex'} justify-between items-center pb-2 border-b border-green-200/50 dark:border-green-800/50 mb-1">
                    <span class="font-bold text-xs md:text-sm text-green-800 dark:text-green-300 uppercase tracking-widest">Currency for Totals</span>
                    <select onchange="updateFinanceOption('${opt.id}', 'displayCurrency', this.value)" class="w-[90px] text-xs font-bold px-2 py-1 bg-white dark:bg-gray-950 border border-green-300 dark:border-green-700 rounded focus:outline-none cursor-pointer shadow-sm text-green-900 dark:text-green-100">${getCurrencyOptions(opt.displayCurrency)}</select>
                </div>
                <div class="flex justify-between items-center">
                    <span class="font-black text-xs md:text-sm text-green-800 dark:text-green-300 uppercase tracking-widest">Total Estimated</span>
                    <span id="total_${opt.id}" class="font-black text-base md:text-lg text-green-700 dark:text-green-400 bg-white dark:bg-gray-900 px-2 py-1 rounded border border-green-200 dark:border-green-800 shadow-sm leading-none">${opt.displayCurrency} ${totalDisp.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="font-black text-xs md:text-sm text-emerald-800 dark:text-emerald-400 uppercase tracking-widest">Cost Per Pax</span>
                    <span id="cpp_${opt.id}" class="font-black text-base md:text-lg text-emerald-700 dark:text-emerald-400 bg-white dark:bg-gray-900 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800 shadow-sm leading-none">${opt.displayCurrency} ${cppDisp.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
            </div>
        </div>`;
    });
}
html += '</div>';
cont.innerHTML = globalSettingsHtml + html;
}

function openFinanceRatesModal() {
const list = document.getElementById('financeRatesList');
let html = '<p class="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-tight">Override the live exchange rates used for calculations. Rates represent the value of 1 foreign unit in SGD.</p>';
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
if (value.trim() === '') delete financeConfig.customRates[currency];
else financeConfig.customRates[currency] = parseFloat(value);
financeOptions.forEach(o => updateTotals(o.id));
renderFinanceOptions();
queueFinanceUpdate();
}

function toggleFinanceCollapse() {
isFinanceCollapsed = !isFinanceCollapsed;
financeOptions.forEach(o => o._isCollapsed = isFinanceCollapsed);
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

function updateFinanceOption(optId, key, value) {
const opt = financeOptions.find(o => o.id === optId);
if (!opt) return;
if (key === 'title') opt.title = value;
else if (key === 'pax') { opt.pax = parseInt(value) || 0; updateTotals(optId); }
else if (key === 'displayCurrency') { opt.displayCurrency = value; updateTotals(optId); }
queueFinanceUpdate(optId);
}

function updateFinanceField(optId, fieldId, key, value) {
const opt = financeOptions.find(o => o.id === optId);
if (!opt) return;
const field = opt.fields.find(f => f.id === fieldId);
if (!field) return;

if (key === 'cost') { field.cost = parseFloat(String(value).replace(/,/g, '')) || 0; updateTotals(optId); }
else if (key === 'tax') { field.tax = parseFloat(value) || 0; updateTotals(optId); }
else if (key === 'costType') { field.costType = value; updateTotals(optId); }
else if (key === 'currency') { field.currency = value; updateTotals(optId); }
else if (key === 'name') field.name = value;
else if (key === 'remarks') field.remarks = value;

queueFinanceUpdate(optId);
if (key === 'costType') renderFinanceOptions(); 
}

function updateTotals(optId) {
const opt = financeOptions.find(o => o.id === optId);
if (!opt) return;
const pax = getActivePax(opt);
let totalSgd = 0;
opt.fields.forEach(f => {
    const rate = getActualRate(f.currency);
    const rawCost = f.costType === 'per_pax' ? ((parseFloat(f.cost)||0) * pax) : (parseFloat(f.cost)||0);
    totalSgd += (rawCost * (1 + ((parseFloat(f.tax)||0) / 100))) * rate;
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
    id: generateFinanceUUID(), title: title, pax: 0, displayCurrency: 'SGD', widthSpan: 2, ts: Date.now(), _isCollapsed: false, isDeleted: false, fields: []
};
defaultFinanceFields.forEach(f => {
    newOpt.fields.push({ id: generateFinanceUUID(), name: f, costType: 'total', tax: 0, cost: 0, currency: 'MYR', remarks: '' });
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
copy.isDeleted = false;
copy.fields.forEach(f => f.id = generateFinanceUUID()); 
financeOptions.unshift(copy);
queueFinanceUpdate(copy.id);
renderFinanceOptions();
}

function removeFinanceOption(id) {
if (!confirm("Are you sure you want to remove this option?")) return;
const opt = financeOptions.find(o => o.id === id);
if (opt) {
    opt.isDeleted = true;
    opt.ts = Date.now();
    if(financeConfig.finalOptionId === id) financeConfig.finalOptionId = null;
    queueFinanceUpdate(id);
    renderAllFinanceTabs();
}
}

function addFinanceCategory(optId) {
const opt = financeOptions.find(o => o.id === optId);
if(!opt) return;
opt.fields.push({ id: generateFinanceUUID(), name: 'New Category', costType: 'total', tax: 0, cost: 0, currency: 'MYR', remarks: '' });
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

function startFinDrag(e) {
if(e.type === 'mousedown' && e.button !== 0) return; 
e.preventDefault(); 
const handle = e.currentTarget;
const row = handle.closest('.fin-cat-row');
const container = row.closest('.fin-cat-container');
const clientY = e.touches ? e.touches[0].clientY : e.clientY;
const clientX = e.touches ? e.touches[0].clientX : e.clientX;
const rect = row.getBoundingClientRect();

finDndState = {
    active: true, row: row, container: container, optId: container.dataset.optId,
    yOffset: clientY - rect.top, xOffset: clientX - rect.left,
    placeholder: document.createElement('div')
};
finDndState.placeholder.className = 'fin-cat-placeholder bg-green-50/50 dark:bg-green-900/20 border-2 border-dashed border-primary/50 rounded-lg my-1 transition-all';
finDndState.placeholder.style.height = rect.height + 'px';
row.parentNode.insertBefore(finDndState.placeholder, row);
row.style.position = 'fixed'; row.style.zIndex = '9999'; row.style.width = rect.width + 'px';
row.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)'; row.classList.add('opacity-95');
updateFinDragPosition(clientY, clientX);
document.addEventListener('mousemove', moveFinDrag, {passive: false});
document.addEventListener('touchmove', moveFinDrag, {passive: false});
document.addEventListener('mouseup', endFinDrag);
document.addEventListener('touchend', endFinDrag);
}

function moveFinDrag(e) {
if(!finDndState.active) return;
e.preventDefault(); 
const clientY = e.touches ? e.touches[0].clientY : e.clientY;
const clientX = e.touches ? e.touches[0].clientX : e.clientX;
updateFinDragPosition(clientY, clientX);
const siblings = Array.from(finDndState.container.querySelectorAll('.fin-cat-row:not(.fin-cat-placeholder):not([style*="position: fixed"])'));
let nextElement = null;
for(let sib of siblings) {
    const rect = sib.getBoundingClientRect();
    if(clientY < rect.top + rect.height / 2) { nextElement = sib; break; }
}
if(nextElement) finDndState.container.insertBefore(finDndState.placeholder, nextElement);
else finDndState.container.appendChild(finDndState.placeholder);
}

function updateFinDragPosition(y, x) {
finDndState.row.style.top = (y - finDndState.yOffset) + 'px';
finDndState.row.style.left = (x - finDndState.xOffset) + 'px';
}

function endFinDrag(e) {
if(!finDndState.active) return;
finDndState.active = false;
document.removeEventListener('mousemove', moveFinDrag); document.removeEventListener('touchmove', moveFinDrag);
document.removeEventListener('mouseup', endFinDrag); document.removeEventListener('touchend', endFinDrag);
finDndState.placeholder.parentNode.insertBefore(finDndState.row, finDndState.placeholder);
finDndState.placeholder.remove();
finDndState.row.style = ''; finDndState.row.classList.remove('opacity-95');
reorderFieldsInModel(finDndState.optId);
renderFinanceOptions(); 
}

function reorderFieldsInModel(optId) {
const opt = financeOptions.find(o => o.id === optId);
if(!opt) return;
const container = document.querySelector(`.fin-cat-container[data-opt-id="${optId}"]`);
if(!container) return;
const newFields = [];
container.querySelectorAll('.fin-cat-row').forEach(row => {
    const fId = row.dataset.fieldId; const field = opt.fields.find(f => f.id === fId);
    if(field) newFields.push(field);
});
opt.fields = newFields;
queueFinanceUpdate(optId);
}

// ==========================================
// TAB 3: RECEIPTS BROWSER
// ==========================================
function renderReceiptsBrowser() {
const cont = document.getElementById('fin-tab-receipts');
if(!cont || cont.classList.contains('hidden-force')) return;

const activeReceipts = globalReceipts.filter(r => !r.isDeleted && r.categoryId !== "Fees Payment Screenshot").sort((a,b) => b.ts - a.ts);

if(activeReceipts.length === 0) {
    cont.innerHTML = `<div class="w-full py-10 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500"><svg class="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><p class="text-xs font-bold uppercase tracking-widest">No receipts uploaded.</p></div>`;
    return;
}

let optMap = {};
if (financeConfig.finalOptionId) {
    const opt = financeOptions.find(o => o.id === financeConfig.finalOptionId);
    if (opt) opt.fields.forEach(f => optMap[f.id] = f.name);
}

let rowsHtml = '';
activeReceipts.forEach(r => {
    const dateStr = typeof formatDDMmmYYYY === 'function' ? formatDDMmmYYYY(r.ts) : new Date(r.ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const catName = optMap[r.categoryId] || 'Unknown Category';
    
    let uploaderName = r.uploaderNric;
    let payerName = r.paidByNric || r.uploaderNric;
    
    if(globalLogistics && globalLogistics.participants) {
        const up = globalLogistics.participants.find(x => x.nric === r.uploaderNric);
        if(up) uploaderName = up.shortName || up.name;
        else if (r.uploaderName) uploaderName = r.uploaderName;
        
        const pp = globalLogistics.participants.find(x => x.nric === payerName);
       if(pp) payerName = pp.shortName || pp.name;
       else if (r.uploaderName && payerName === r.uploaderNric) payerName = r.uploaderName;
    }

    const isReimClass = r.isReimbursed ? 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-800 shadow-sm' : 'text-gray-500 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700';

    rowsHtml += `
    <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
        <td class="py-1.5 px-2 text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">${dateStr}</td>
        <td class="py-1.5 px-2 text-xs leading-tight">
           <div class="font-bold text-gray-800 dark:text-gray-200">Up: ${uploaderName}</div>
           <div class="font-black text-green-600 dark:text-green-400 text-xs uppercase mt-0.5">Paid: ${payerName}</div>
        </td>
        <td class="py-1.5 px-2 text-xs font-bold text-primary max-w-[150px] truncate" title="${catName}">${catName}</td>
        <td class="py-1.5 px-2 text-xs font-bold text-gray-800 dark:text-gray-200 text-right whitespace-nowrap">${r.currency} ${r.amount.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
        <td class="py-1.5 px-2 text-sm font-black text-purple-600 dark:text-purple-400 text-right whitespace-nowrap">SGD ${r.sgdAmount.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
        <td class="py-1.5 px-2 text-xs font-medium text-gray-600 dark:text-gray-400 max-w-[150px] truncate" title="${r.remarks}">${r.remarks || '-'}</td>
        <td class="py-1.5 px-2 text-center">
            <button onclick="toggleReceiptReimbursed('${r.id}', ${!r.isReimbursed})" class="text-xs font-bold px-2 py-1 rounded border transition focus:outline-none uppercase tracking-wider whitespace-nowrap ${isReimClass}">
                ${r.isReimbursed ? 'Reimbursed' : 'Pending'}
            </button>
        </td>
        <td class="py-1.5 px-2 text-xs text-center">
            ${r.fileUrl ? `<a href="${r.fileUrl}" target="_blank" class="text-green-500 hover:text-green-700 font-bold underline px-2">View</a>` : '-'}
        </td>
        <td class="py-1.5 px-2 text-center">
            <button onclick="deleteReceipt('${r.id}')" class="text-red-500 hover:text-red-600 transition p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm focus:outline-none"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
        </td>
    </tr>`;
});

cont.innerHTML = `
<div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
    <div class="overflow-x-auto custom-scrollbar">
        <table class="w-full text-left border-collapse min-w-[800px]">
            <thead class="bg-gray-100 dark:bg-gray-800 text-xs uppercase font-black text-gray-500 dark:text-gray-400 tracking-wider border-b border-gray-200 dark:border-gray-700">
                <tr>
                    <th class="py-1.5 px-2">Date</th>
                    <th class="py-1.5 px-2">Users</th>
                    <th class="py-1.5 px-2">Category</th>
                    <th class="py-1.5 px-2 text-right">Orig Amount</th>
                    <th class="py-1.5 px-2 text-right">SGD Value</th>
                    <th class="py-1.5 px-2">Remarks</th>
                    <th class="py-1.5 px-2 text-center">Status</th>
                    <th class="py-1.5 px-2 text-center">File</th>
                    <th class="py-1.5 px-2 text-center">Action</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                ${rowsHtml}
            </tbody>
        </table>
    </div>
</div>`;
}

function toggleReceiptReimbursed(id, status) {
const rec = globalReceipts.find(r => r.id === id);
if(rec) {
    rec.isReimbursed = status;
    queueReceiptUpdate(rec);
    renderReceiptsBrowser();
}
}

function deleteReceipt(id) {
if(!confirm("Are you sure you want to delete this receipt? It will be removed from the Actual Cost summation.")) return;
const rec = globalReceipts.find(r => r.id === id);
if(rec) {
    rec.isDeleted = true;
    queueReceiptUpdate(rec);
    renderReceiptsBrowser();
    renderFinalizedFinances();
}
}

// ==========================================
// TAB 4: TRIP FEES TRACKER
// ==========================================
function handleFeeSearch() {
    const input = document.getElementById('feeSearchInput');
    finSearchQuery = input.value;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    
    renderFeeTracker();
    
    const newInput = document.getElementById('feeSearchInput');
    if (newInput) {
        newInput.focus();
        try { newInput.setSelectionRange(start, end); } catch(e) {}
    }
}

function renderFeeTracker() {
const cont = document.getElementById('fin-tab-fees');
if(!cont || cont.classList.contains('hidden-force')) return;
if(!globalLogistics || !globalLogistics.participants) return;

const groups = {};
globalLogistics.participants.forEach(p => {
    let targetPoc = p.pocNric;

    if(!groups[targetPoc]) groups[targetPoc] = [];
    groups[targetPoc].push(p);
});

const baseFee = financeConfig.perPersonFee || 0;
let totalExpected = 0;
let totalCollected = 0;
let cardsData = [];

Object.keys(groups).forEach(poc => {
    processFeeCard(poc, groups[poc]);
});

function processFeeCard(poc, members) {
    const size = members.length;
    const dev = financeConfig.feeDeviations?.[poc]?.amount || 0;
    const rem = financeConfig.feeDeviations?.[poc]?.remarks || '';
    const isPaid = financeConfig.feesReceived?.[poc] === true;
    
    const finalExpected = (size * baseFee) + dev;
    
    totalExpected += finalExpected;
    if (isPaid) totalCollected += finalExpected;

    let match = true;
    const searchLower = finSearchQuery.toLowerCase().trim();
    if (searchLower) {
        match = members.some(m => {
            const dName = String(m.shortName || '').toLowerCase();
            const fullName = String(m.fullName || m.name || '').toLowerCase();
            return dName.includes(searchLower) || fullName.includes(searchLower) || m.nric.toLowerCase().includes(searchLower);
        });
    }

    if (match) cardsData.push({ poc, members, size, dev, rem, isPaid, finalExpected });
}

cardsData.sort((a,b) => {
    if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1; 
    return b.size - a.size;
});

let cardsHtml = '';
cardsData.forEach(c => {
    let membersHtml = c.members.map(m => {
        const roleColor = m.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (m.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
        return `<span class="inline-block mr-1.5"><span class="${roleColor} font-black text-[11px] mr-0.5 border border-current px-0.5 rounded">${m.role.substring(0,3)}</span><span class="font-bold text-xs text-gray-800 dark:text-gray-200">${m.shortName || m.name}</span></span>`;
    }).join('');

    const paidClass = c.isPaid ? 'bg-green-50 dark:bg-green-900/10 border-green-300 dark:border-green-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    const checkColor = c.isPaid ? 'text-green-600 dark:text-green-400 bg-green-200 dark:bg-green-900' : 'text-transparent bg-gray-100 dark:bg-gray-700';

    cardsHtml += `
    <div class="flex flex-col p-3 rounded-xl border ${paidClass} shadow-sm transition relative overflow-hidden h-full">
        <div class="flex justify-between items-start gap-3 mb-3">
            <div class="flex flex-col flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span class="text-[11px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">Size: ${c.size}</span>
                    ${c.isPaid ? `<span class="text-[11px] font-black uppercase tracking-widest text-green-700 bg-green-200 dark:bg-green-900 px-1.5 py-0.5 rounded border border-green-300 dark:border-green-700">Paid</span>` : ''}
                </div>
                <div class="leading-tight">${membersHtml}</div>
            </div>
            
            <button onclick="toggleFeeReceived('${c.poc}', ${!c.isPaid})" class="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center shrink-0 transition shadow-sm hover:scale-110 focus:outline-none ${c.isPaid ? 'border-green-500 ring-2 ring-green-400 ring-offset-1 dark:ring-offset-gray-900' : ''}">
                <div class="w-6 h-6 rounded-full flex items-center justify-center transition-colors ${checkColor}">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                </div>
            </button>
        </div>
        
        ${(() => {
            const feeReceipts = globalReceipts.filter(r => !r.isDeleted && r.categoryId === "Fees Payment Screenshot" && (r.uploaderNric === c.poc || r.paidByNric === c.poc)).sort((a,b) => b.ts - a.ts);
            if (feeReceipts.length > 0 && feeReceipts[0].fileUrl) {
                return `
                <div class="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <a href="${feeReceipts[0].fileUrl}" target="_blank" class="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 w-max">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                        View Uploaded Screenshot
                    </a>
                </div>
                `;
            }
            return '';
        })()}

        <div class="grid grid-cols-2 gap-2 p-2 bg-gray-50/50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800 mt-auto">
            <div>
                <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Deviation (+/- SGD)</label>
                <div class="relative flex items-center">
                    <span class="absolute left-2 text-xs font-bold text-gray-400">$</span>
                    <input type="text" id="dev-input-${c.poc}" value="${c.dev ? parseFloat(c.dev).toLocaleString('en-US', {minimumFractionDigits:2}) : '0.00'}" oninput="formatMoneyInput(this, false); updateDeviationLocal('${c.poc}', ${c.size}); if(!financeConfig.feeDeviations['${c.poc}']) financeConfig.feeDeviations['${c.poc}'] = {}; financeConfig.feeDeviations['${c.poc}'].amount = parseFloat(this.value.replace(/,/g, ''))||0; queueFinanceUpdate();" onblur="formatMoneyInput(this, true); updateFeeDeviation('${c.poc}', 'amount', this.value)" class="w-full pl-5 pr-2 py-1 text-xs font-bold border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-950 focus:outline-none focus:border-primary shadow-sm text-right h-[28px]" ${c.isPaid ? 'disabled opacity-70' : ''}>
                </div>
            </div>
            <div>
                <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Expected (SGD)</label>
                <div id="expected-display-${c.poc}" class="w-full px-2 py-1 text-sm font-black text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800 shadow-sm text-right flex items-center justify-between h-[28px]">
                    <span class="text-xs opacity-50 font-bold mr-1">$</span><span>${c.finalExpected.toLocaleString('en-US', {minimumFractionDigits:2})}</span>
                </div>
            </div>
            <div class="col-span-2">
                <input type="text" value="${c.rem.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" onchange="updateFeeDeviation('${c.poc}', 'remarks', this.value)" placeholder="Remarks for deviation (e.g. Subsidy applied)" class="w-full px-2 py-1 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-950 focus:outline-none focus:border-primary shadow-sm h-[28px]" ${c.isPaid ? 'disabled opacity-70' : ''}>
            </div>
        </div>
    </div>`;
});

cont.innerHTML = `
<div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-2 mb-3 flex flex-col gap-2">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div class="flex flex-wrap items-center gap-2 md:gap-3">
            <div class="flex items-center gap-1.5">
                <label class="text-[11px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider">Per-Pax (SGD):</label>
                <div class="relative flex items-center">
                    <span class="absolute left-1.5 text-xs font-bold text-gray-400">$</span>
                    <input type="text" value="${baseFee ? parseFloat(baseFee).toLocaleString('en-US', {minimumFractionDigits:2}) : '0.00'}" oninput="formatMoneyInput(this, false); financeConfig.perPersonFee = parseFloat(this.value.replace(/,/g, ''))||0; queueFinanceUpdate();" onblur="formatMoneyInput(this, true); updateFinanceConfig('perPersonFee', parseFloat(this.value.replace(/,/g, ''))||0)" class="w-[72px] text-xs font-black border border-gray-300 dark:border-gray-600 rounded pl-4 pr-1.5 py-1 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm text-right">
                </div>
            </div>
            <div class="flex items-center gap-1.5">
                <label class="text-[11px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider">PayNow:</label>
                <input type="text" maxlength="8" value="${financeConfig.payNowNumber || ''}" onchange="updateFinanceConfig('payNowNumber', this.value.trim())" class="w-20 text-xs font-black border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm text-center">
            </div>
            <label class="flex items-center gap-1.5 cursor-pointer bg-purple-50 dark:bg-purple-900/20 border ${financeConfig.showPaymentSection ? 'border-purple-500' : 'border-purple-200 dark:border-purple-800'} px-2.5 py-1 rounded-md transition-colors hover:bg-purple-100 dark:hover:bg-purple-900/40">
                <input type="checkbox" ${financeConfig.showPaymentSection ? 'checked' : ''} onchange="updateFinanceConfig('showPaymentSection', this.checked)" class="w-3.5 h-3.5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded">
                <span class="text-[11px] md:text-xs uppercase font-black ${financeConfig.showPaymentSection ? 'text-purple-700 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'} tracking-wider">SHOW PAYMENT QR CODE</span>
            </label>
        </div>
        
        <div class="flex items-center gap-3 bg-gray-50 dark:bg-gray-950 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 w-full md:w-auto justify-between md:justify-start">
            <div class="text-left">
                <span class="block text-[10px] uppercase font-bold text-gray-400 tracking-widest leading-none mb-0.5">Collected</span>
                <span class="text-xs font-black text-green-600 dark:text-green-400 leading-none">$ ${totalCollected.toLocaleString('en-US', {minimumFractionDigits:2})}</span>
            </div>
            <div class="w-px h-5 bg-gray-300 dark:bg-gray-700 hidden md:block"></div>
            <div class="text-right md:text-left">
                <span class="block text-[10px] uppercase font-bold text-gray-400 tracking-widest leading-none mb-0.5">Expected Total</span>
                <span class="text-xs font-black text-green-700 dark:text-green-400 leading-none">$ ${totalExpected.toLocaleString('en-US', {minimumFractionDigits:2})}</span>
            </div>
        </div>
    </div>
    
    <div class="relative">
        <input type="text" id="feeSearchInput" oninput="handleFeeSearch()" value="${finSearchQuery.replace(/"/g, '&quot;')}" placeholder="Fuzzy search families..." class="w-full py-1.5 pl-7 pr-7 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm transition">
        <svg class="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        <button onclick="clearSearch('feeSearchInput', 'handleFeeSearch')" class="absolute right-1.5 top-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
    </div>
</div>

<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
    ${cardsHtml || '<div class="col-span-full text-center py-6 text-gray-400 text-xs font-bold uppercase tracking-widest">No families match search.</div>'}
</div>
`;
}

window.updateDeviationLocal = function(poc, size) {
    const devInput = document.getElementById('dev-input-' + poc);
    const expectedDisplay = document.getElementById('expected-display-' + poc);
    if (!devInput || !expectedDisplay) return;
    const baseFee = financeConfig.perPersonFee || 0;
    const dev = parseFloat(devInput.value.replace(/,/g, '')) || 0;
    const finalExpected = (size * baseFee) + dev;
    expectedDisplay.innerHTML = `<span class="text-xs opacity-50 font-bold mr-1">$</span><span>${finalExpected.toLocaleString('en-US', {minimumFractionDigits:2})}</span>`;
}

function updateFeeDeviation(poc, field, value) {
if (!financeConfig.feeDeviations) financeConfig.feeDeviations = {};
if (!financeConfig.feeDeviations[poc]) financeConfig.feeDeviations[poc] = { amount: 0, remarks: '' };

if (field === 'amount') {
    financeConfig.feeDeviations[poc].amount = parseFloat(String(value).replace(/,/g, '')) || 0;
} else {
    financeConfig.feeDeviations[poc].remarks = value;
}

queueFinanceUpdate();


}

function toggleFeeReceived(poc, status) {
if (!financeConfig.feesReceived) financeConfig.feesReceived = {};
financeConfig.feesReceived[poc] = status;
queueFinanceUpdate();
renderFeeTracker();
}