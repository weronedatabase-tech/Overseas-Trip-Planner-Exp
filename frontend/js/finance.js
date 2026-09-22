let financeOptions = [];
let pendingFinanceUpdates = new Map();
let pendingReceiptUpdates = new Map();
let locallyDeletedReceiptIds = new Set();
let pendingDeleteReceiptId = null;
let activeEditingReceipt = null;
var globalFinanceRates = { SGD: 1, MYR: 0.28 };
let globalReceipts = [];
let financeConfig = {
  globalPaxMode: "individual",
  globalPaxCount: 0,
  ts: 0,
  customRates: {},
  finalOptionId: null,
  perPersonFee: 0,
  feeDeviations: {},
  feesReceived: {},
};
let isFinanceCollapsed = false;
let financeSyncTimeout = null;
let receiptSyncTimeout = null;
let financePollInterval = null;
let isFinanceSyncing = false;
let isReceiptSyncing = false;
let finSearchQuery = "";
let receiptSearchQuery = "";
let receiptCategoryFilter = "all";

let finDndState = {
  active: false,
  row: null,
  placeholder: null,
  container: null,
  optId: null,
  yOffset: 0,
  xOffset: 0,
};

const defaultFinanceFields = [
  "Accommodation",
  "Transport",
  "Day 1 Lunch",
  "Day 1 Dinner",
  "Day 1 Activity",
  "Day 2 Breakfast",
  "Day 2 Lunch",
  "Day 2 Activity",
  "Logistics",
  "First Aid",
  "Miscellaneous",
  "Recce",
  "Insurance",
];

function generateFinanceUUID() {
  return "fin_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

function getCurrencyOptions(selected) {
  const top = ["SGD", "MYR"];
  const rest = [
    "USD",
    "EUR",
    "GBP",
    "AUD",
    "IDR",
    "THB",
    "JPY",
    "KRW",
    "TWD",
    "PHP",
    "VND",
  ];
  let html = "";
  top.forEach(
    (c) =>
      (html += `<option value="${c}" ${c === selected ? "selected" : ""}>${c}</option>`),
  );
  html += `<option disabled>──────────</option>`;
  rest.forEach(
    (c) =>
      (html += `<option value="${c}" ${c === selected ? "selected" : ""}>${c}</option>`),
  );
  return html;
}

function getActivePax(opt) {
  if (financeConfig.globalPaxMode === "auto") {
    return globalLogistics && globalLogistics.participants
      ? globalLogistics.participants.length
      : 0;
  } else if (financeConfig.globalPaxMode === "manual") {
    return parseInt(financeConfig.globalPaxCount) || 0;
  } else {
    return parseInt(opt.pax) || 0;
  }
}

function getActualRate(currency) {
  if (currency === "SGD") return 1;
  if (financeConfig.customRates && financeConfig.customRates[currency]) {
    return parseFloat(financeConfig.customRates[currency]);
  }
  return globalFinanceRates[currency] || 1;
}

async function buildFinanceUI() {
  await new Promise((resolve) => setTimeout(resolve, 10));

  const el_tab_finance = document.getElementById("tab-finance");
  if (el_tab_finance)
    el_tab_finance.innerHTML = `
<div class="sticky top-0 z-40 flex items-center justify-between bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-800 shrink-0 rounded-t-xl md:rounded-none pr-2 select-none">
    <div class="flex overflow-x-auto scrollbar-hide flex-1 px-2 pt-1 select-none">
        <button type="button" onclick="switchFinanceSubTab('finalized')" id="subTab-fin-finalized" class="subtab-btn px-3 py-2 font-semibold border-b-2 border-primary text-primary whitespace-nowrap text-xs md:text-sm transition focus:outline-none cursor-pointer select-none touch-manipulation"><span class="pointer-events-none select-none">1. Finalized Finances</span></button>
        <button type="button" onclick="switchFinanceSubTab('options')" id="subTab-fin-options" class="subtab-btn px-3 py-2 font-semibold border-b-2 border-transparent text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs md:text-sm transition focus:outline-none cursor-pointer select-none touch-manipulation"><span class="pointer-events-none select-none">2. Trip Options</span></button>
        <button type="button" onclick="switchFinanceSubTab('receipts')" id="subTab-fin-receipts" class="subtab-btn px-3 py-2 font-semibold border-b-2 border-transparent text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs md:text-sm transition focus:outline-none cursor-pointer select-none touch-manipulation"><span class="pointer-events-none select-none">3. Receipts</span></button>
        <button type="button" onclick="switchFinanceSubTab('fees')" id="subTab-fin-fees" class="subtab-btn px-3 py-2 font-semibold border-b-2 border-transparent text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs md:text-sm transition focus:outline-none cursor-pointer select-none touch-manipulation"><span class="pointer-events-none select-none">4. Fee Tracker</span></button>
    </div>
    <div class="flex items-center shrink-0 pl-2 border-l-2 border-gray-200 dark:border-gray-800 ml-1">
        <button id="btn-sync-finance" onclick="manualFinanceSync(this)" class="bg-green-50 text-green-700 border-2 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 text-xs md:text-xs font-bold px-3 py-1.5 rounded-md hover:bg-green-100 transition flex items-center shadow-md focus:outline-none shrink-0">
            <span class="btn-text">Saved</span>
            <div class="btn-spinner spinner-white ml-1.5 !w-3 !h-3 hidden-force border-2"></div>
        </button>
    </div>
</div>

<div id="finLoadingOverlay" class="absolute inset-0 top-[50px] bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-20 flex flex-col justify-center items-center hidden-force">
    <div class="loader !w-8 !h-8 border-primary mb-2"></div>
    <span class="text-primary dark:text-green-400 font-bold text-xs tracking-wide shadow-md bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full mt-2">Loading Planner...</span>
</div>

<div id="fin-tab-finalized" class="flex-1 w-full p-2 md:p-4 overflow-y-auto custom-scrollbar relative"></div>
<div id="fin-tab-options" class="hidden-force flex-1 w-full p-2 md:p-4 overflow-y-auto custom-scrollbar relative"></div>
<div id="fin-tab-receipts" class="hidden-force flex-1 w-full p-2 md:p-4 overflow-y-auto custom-scrollbar relative"></div>
<div id="fin-tab-fees" class="hidden-force flex-1 w-full p-2 md:p-4 overflow-y-auto custom-scrollbar relative"></div>
`;

  const overlay = document.getElementById("finLoadingOverlay");
  if (overlay) overlay.classList.remove("hidden-force");

  try {
    if (!globalLogistics) {
      try {
        const resLog = await apiCall("fetchLogistics");
        globalLogistics = resLog;
        if (typeof processDisplayNames === "function")
          processDisplayNames(globalLogistics.participants);
        if (typeof applyGlobalSorting === "function")
          globalLogistics.participants = applyGlobalSorting(
            globalLogistics.participants,
          );
      } catch (e) {}
    }

    if (window.financeConfig && window.financeConfig.ts) {
      financeConfig = window.financeConfig;
      financeOptions = window.financeOptions;
      globalFinanceRates = window.globalFinanceRates;
      globalReceipts = window.globalReceipts;

      renderAllFinanceTabs();
      startFinancePolling();
      const loader = document.getElementById("finLoadingOverlay");
      if (loader) loader.classList.add("hidden-force");
      return;
    }

    const [finRes, recRes] = await Promise.all([
      apiCall("fetchFinance").catch((e) => {
        console.warn("fetchFinance failed", e);
        return { data: { options: [], config: {} }, rates: { SGD: 1 } };
      }),
      apiCall("fetchReceipts").catch((e) => {
        console.warn("fetchReceipts failed", e);
        return { receipts: [] };
      }),
    ]);

    globalFinanceRates = finRes.rates || { SGD: 1, MYR: 0.28 };
    globalReceipts = recRes.receipts || [];

    const rawOptions =
      finRes.data?.options || (Array.isArray(finRes.data) ? finRes.data : []);
    financeConfig = finRes.data?.config || {
      globalPaxMode: "individual",
      globalPaxCount: 0,
      ts: Date.now(),
      customRates: {},
      finalOptionId: null,
      perPersonFee: 0,
      feeDeviations: {},
      feesReceived: {},
      payNowNumber: "",
      showPaymentSection: false,
    };

    if (!financeConfig.customRates) financeConfig.customRates = {};
    if (!financeConfig.feeDeviations) financeConfig.feeDeviations = {};
    if (!financeConfig.feesReceived) financeConfig.feesReceived = {};

    financeOptions = rawOptions.map((opt) => {
      if (opt.fields && !Array.isArray(opt.fields)) {
        const newFields = [];
        for (let [k, v] of Object.entries(opt.fields)) {
          newFields.push({
            id: generateFinanceUUID(),
            name: k,
            costType: "total",
            tax: 0,
            cost: parseFloat(v.cost) || 0,
            currency: v.currency || "MYR",
            remarks: v.remarks || "",
          });
        }
        opt.fields = newFields;
      } else if (opt.fields) {
        opt.fields.forEach((f) => {
          if (!f.costType) f.costType = "total";
          if (f.tax === undefined || isNaN(f.tax)) f.tax = 0;
        });
      }
      if (!opt.displayCurrency) opt.displayCurrency = "SGD";
      if (!opt.pax) opt.pax = 0;
      if (opt.widthSpan === undefined) opt.widthSpan = 2;
      if (!opt.ts) opt.ts = Date.now();
      if (opt._isCollapsed === undefined) opt._isCollapsed = isFinanceCollapsed;
      return opt;
    });

    window.financeConfig = financeConfig;
    window.financeOptions = financeOptions;
    window.globalFinanceRates = globalFinanceRates;
    window.globalReceipts = globalReceipts;

    if (financeOptions.length === 0) {
      addFinanceOption("Option 1", false);
    }

    renderAllFinanceTabs();
    startFinancePolling();
  } catch (e) {
    showToast("Failed to load finance data.", true);
  } finally {
    if (overlay) overlay.classList.add("hidden-force");
  }
}

function switchFinanceSubTab(tabId) {
  ["finalized", "options", "receipts", "fees"].forEach((id) => {
    const el = document.getElementById(`fin-tab-${id}`);
    if (el) el.classList.add("hidden-force");
    const btn = document.getElementById(`subTab-fin-${id}`);
    if (btn) {
      btn.classList.remove("border-primary", "text-primary");
      btn.classList.add(
        "border-transparent",
        "text-gray-500",
        "dark:text-gray-400",
      );
    }
  });
  const targetEl = document.getElementById(`fin-tab-${tabId}`);
  if (targetEl) targetEl.classList.remove("hidden-force");
  const targetBtn = document.getElementById(`subTab-fin-${tabId}`);
  if (targetBtn) {
    targetBtn.classList.remove(
      "border-transparent",
      "text-gray-500",
      "dark:text-gray-400",
    );
    targetBtn.classList.add("border-primary", "text-primary");
  }

  renderAllFinanceTabs();
}
window.switchFinanceSubTab = switchFinanceSubTab;
window.switchFinanceTab = switchFinanceSubTab;

function renderAllFinanceTabs() {
  renderFinalizedFinances();
  renderFinanceOptions();
  renderReceiptsBrowser();
  renderFeeTracker();
}

function updateFinanceConfig(key, value) {
  if (
    key === "globalPaxMode" ||
    key === "finalOptionId" ||
    key === "perPersonFee" ||
    key === "payNowNumber" ||
    key === "showPaymentSection"
  ) {
    financeConfig[key] = value;
  } else if (key === "globalPaxCount") {
    financeConfig[key] = parseInt(value) || 0;
  }
  queueFinanceUpdate();
  renderAllFinanceTabs();
}

function setFinanceSyncButtonState(state) {
  const btn = document.getElementById("btn-sync-finance");
  if (!btn) return;

  const textSpan = btn.querySelector(".btn-text");
  const spinner = btn.querySelector(".btn-spinner");

  btn.className =
    "text-xs md:text-xs px-3 py-1.5 rounded-md font-bold transition flex items-center justify-center border shadow-md focus:outline-none shrink-0";
  spinner.className = "btn-spinner ml-1.5 !w-3 !h-3 hidden-force border-2";

  if (state === "loading") {
    btn.classList.add(
      "bg-gray-100",
      "text-gray-500",
      "border-gray-200",
      "dark:bg-gray-800",
      "dark:text-gray-400",
      "dark:border-gray-700",
    );
    textSpan.textContent = "Loading...";
    spinner.classList.remove("hidden-force");
    spinner.classList.add("spinner-primary");
  } else if (state === "saving") {
    btn.classList.add(
      "bg-yellow-50",
      "text-yellow-700",
      "border-yellow-200",
      "dark:bg-yellow-900/30",
      "dark:text-yellow-300",
      "dark:border-yellow-800",
    );
    textSpan.textContent = "Saving...";
    spinner.classList.remove("hidden-force");
    spinner.classList.add("spinner-yellow");
  } else if (state === "saved") {
    btn.classList.add(
      "bg-green-50",
      "text-green-700",
      "border-green-200",
      "dark:bg-green-900/30",
      "dark:text-green-300",
      "dark:border-green-800",
    );
    textSpan.textContent = "Saved";
  } else if (state === "error") {
    btn.classList.add(
      "bg-red-50",
      "text-red-700",
      "border-red-200",
      "dark:bg-red-900/30",
      "dark:text-red-300",
      "dark:border-red-800",
    );
    textSpan.textContent = "Error";
  }
}

function queueFinanceUpdate(optId = null) {
  if (optId) {
    const opt = financeOptions.find((o) => o.id === optId);
    if (opt) {
      opt.ts = Date.now();
      pendingFinanceUpdates.set(optId, opt);
    }
  }
  financeConfig.ts = Date.now();
  setFinanceSyncButtonState("saving");
  if (financeSyncTimeout) clearTimeout(financeSyncTimeout);
  financeSyncTimeout = setTimeout(() => {
    executeFinanceSync();
  }, 1500);
}

async function executeFinanceSync() {
  if (pendingFinanceUpdates.size === 0 && !financeConfig.ts) return;

  isFinanceSyncing = true;
  setFinanceSyncButtonState("saving");

  const updates = Array.from(pendingFinanceUpdates.values());
  pendingFinanceUpdates.clear();

  const payload = { updates: updates, config: financeConfig };

  try {
    const res = await apiCall("saveFinance", { payload: payload });
    if (res.data) {
      if (res.data.config && res.data.config.ts > financeConfig.ts) {
        financeConfig = res.data.config;
        if (!financeConfig.customRates) financeConfig.customRates = {};
        if (!financeConfig.feeDeviations) financeConfig.feeDeviations = {};
        if (!financeConfig.feesReceived) financeConfig.feesReceived = {};
      }

      if (res.data.options && Array.isArray(res.data.options)) {
        res.data.options.forEach((sOpt) => {
          let lIdx = financeOptions.findIndex((o) => o.id === sOpt.id);
          if (lIdx === -1) {
            sOpt._isCollapsed = isFinanceCollapsed;
            financeOptions.push(sOpt);
          } else {
            let lOpt = financeOptions[lIdx];
            if (
              sOpt.ts > (lOpt.ts || 0) &&
              !pendingFinanceUpdates.has(sOpt.id)
            ) {
              sOpt._isCollapsed = lOpt._isCollapsed;
              financeOptions[lIdx] = sOpt;
            }
          }
        });

        const serverIds = res.data.options.map((o) => o.id);
        financeOptions = financeOptions.filter(
          (o) => serverIds.includes(o.id) || pendingFinanceUpdates.has(o.id),
        );
      }
    }
    setFinanceSyncButtonState("saved");
    if (
      !finDndState.active &&
      document.activeElement.tagName !== "INPUT" &&
      document.activeElement.tagName !== "TEXTAREA"
    ) {
      renderAllFinanceTabs();
    }
  } catch (e) {
    setFinanceSyncButtonState("error");
    updates.forEach((u) => pendingFinanceUpdates.set(u.id, u));
  } finally {
    isFinanceSyncing = false;
  }
}

function queueReceiptUpdate(receipt) {
  receipt.ts = Date.now();
  pendingReceiptUpdates.set(receipt.id, receipt);
  setFinanceSyncButtonState("saving");
  if (receiptSyncTimeout) clearTimeout(receiptSyncTimeout);
  receiptSyncTimeout = setTimeout(() => {
    executeReceiptSync();
  }, 1500);
}

async function executeReceiptSync() {
  if (pendingReceiptUpdates.size === 0) return;
  isReceiptSyncing = true;
  setFinanceSyncButtonState("saving");
  const updates = Array.from(pendingReceiptUpdates.values());
  pendingReceiptUpdates.clear();

  try {
    const res = await apiCall("syncReceipts", { updates: updates });
    if (res && res.receipts) {
      globalReceipts = res.receipts.map((r) => {
        if (locallyDeletedReceiptIds.has(r.id)) {
          return { ...r, isDeleted: true };
        }
        if (pendingReceiptUpdates.has(r.id)) {
          return { ...r, ...pendingReceiptUpdates.get(r.id) };
        }
        return r;
      });
    }
    setFinanceSyncButtonState("saved");
    renderReceiptsBrowser();
    renderFinalizedFinances();
    renderFeeTracker();
  } catch (e) {
    setFinanceSyncButtonState("error");
    updates.forEach((u) => pendingReceiptUpdates.set(u.id, u));
  } finally {
    isReceiptSyncing = false;
  }
}

function startFinancePolling() {
  if (financePollInterval) clearInterval(financePollInterval);

  financePollInterval = setInterval(async () => {
    const tab = document.getElementById("tab-finance");
    if (
      !tab ||
      tab.classList.contains("hidden-force") ||
      isFinanceSyncing ||
      isReceiptSyncing ||
      finDndState.active
    )
      return;

    const fetchStartTime = Date.now();

    try {
      const [finRes, recRes] = await Promise.all([
        apiCall("fetchFinance").catch((e) => {
          console.warn("fetchFinance failed", e);
          return { data: { options: [], config: {} }, rates: { SGD: 1 } };
        }),
        apiCall("fetchReceipts").catch((e) => {
          console.warn("fetchReceipts failed", e);
          return { receipts: [] };
        }),
      ]);

      if (lastLocalChange > fetchStartTime) return;

      let hasChanges = false;

      if (recRes.receipts) {
        const incoming = recRes.receipts;
        globalReceipts = incoming.map((r) => {
          if (pendingReceiptUpdates.has(r.id)) {
            return { ...r, ...pendingReceiptUpdates.get(r.id) };
          }
          if (locallyDeletedReceiptIds.has(r.id)) {
            return { ...r, isDeleted: true };
          }
          return r;
        });
        hasChanges = true;
      }

      if (finRes.data) {
        if (
          finRes.data.config &&
          finRes.data.config.ts > (financeConfig.ts || 0)
        ) {
          financeConfig = finRes.data.config;
          if (!financeConfig.customRates) financeConfig.customRates = {};
          if (!financeConfig.feeDeviations) financeConfig.feeDeviations = {};
          if (!financeConfig.feesReceived) financeConfig.feesReceived = {};
          hasChanges = true;
        }

        if (finRes.data.options && Array.isArray(finRes.data.options)) {
          finRes.data.options.forEach((sOpt) => {
            let lIdx = financeOptions.findIndex((o) => o.id === sOpt.id);
            if (lIdx === -1) {
              sOpt._isCollapsed = isFinanceCollapsed;
              financeOptions.push(sOpt);
              hasChanges = true;
            } else {
              let lOpt = financeOptions[lIdx];
              if (
                sOpt.ts > (lOpt.ts || 0) &&
                !pendingFinanceUpdates.has(sOpt.id)
              ) {
                sOpt._isCollapsed = lOpt._isCollapsed;
                financeOptions[lIdx] = sOpt;
                hasChanges = true;
              }
            }
          });
          const serverIds = finRes.data.options.map((o) => o.id);
          const initialLength = financeOptions.length;
          financeOptions = financeOptions.filter(
            (o) => serverIds.includes(o.id) || pendingFinanceUpdates.has(o.id),
          );
          if (financeOptions.length !== initialLength) hasChanges = true;
        }
      }

      if (
        hasChanges &&
        document.activeElement.tagName !== "INPUT" &&
        document.activeElement.tagName !== "TEXTAREA"
      ) {
        renderAllFinanceTabs();
        if (
          pendingFinanceUpdates.size === 0 &&
          pendingReceiptUpdates.size === 0
        )
          setFinanceSyncButtonState("saved");
      }
    } catch (e) {}
  }, 10000);
}

async function manualFinanceSync(btn) {
  setFinanceSyncButtonState("loading");
  try {
    if (pendingFinanceUpdates.size > 0 || financeConfig.ts)
      await executeFinanceSync();
    if (pendingReceiptUpdates.size > 0) await executeReceiptSync();
    showToast("Refreshed from server!");
  } catch (e) {
    showToast("Sync failed.", true);
  }
}

// ==========================================
// TAB 1: FINALIZED FINANCES & FEE COMPARISONS
// ==========================================
function getFeeSummaryTotals() {
  const baseFee = financeConfig.perPersonFee || 0;
  let totalFeesExpected = 0;
  let totalFeesCollected = 0;
  let totalPocCount = 0;
  let paidPocCount = 0;
  let totalParticipantsCount = 0;

  if (globalLogistics && Array.isArray(globalLogistics.participants)) {
    totalParticipantsCount = globalLogistics.participants.length;
    const groups = {};
    globalLogistics.participants.forEach((p) => {
      const targetPoc = p.pocNric || p.nric;
      if (!groups[targetPoc]) groups[targetPoc] = [];
      groups[targetPoc].push(p);
    });

    const pocKeys = Object.keys(groups);
    totalPocCount = pocKeys.length;

    pocKeys.forEach((poc) => {
      const members = groups[poc];
      const size = members.length;
      const dev = financeConfig.feeDeviations?.[poc]?.amount || 0;
      const isPaid = financeConfig.feesReceived?.[poc] === true;

      const finalExpected = size * baseFee + dev;
      totalFeesExpected += finalExpected;
      if (isPaid) {
        totalFeesCollected += finalExpected;
        paidPocCount++;
      }
    });
  }

  return {
    totalFeesExpected,
    totalFeesCollected,
    totalPocCount,
    paidPocCount,
    totalParticipantsCount,
    baseFee,
  };
}

function renderFinalizedFinances() {
  const cont = document.getElementById("fin-tab-finalized");
  if (!cont || cont.classList.contains("hidden-force")) return;

  if (!financeConfig.finalOptionId) {
    if (cont)
      cont.innerHTML = `
    <div id="finalized-empty-state" class="flex flex-col items-center justify-center p-12 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-700">
        <svg class="w-16 h-16 mb-4 opacity-50 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p class="font-bold text-base text-gray-700 dark:text-gray-300">No Finalized Option Selected</p>
        <p class="text-xs mt-2 text-center max-w-sm">Navigate to the <b>Trip Options</b> tab and click "Mark as Finalized" on the budget option you want to proceed with.</p>
    </div>`;
    return;
  }

  const opt = financeOptions.find(
    (o) => o.id === financeConfig.finalOptionId && !o.isDeleted,
  );
  if (!opt) {
    if (cont)
      cont.innerHTML = `
    <div id="finalized-empty-state" class="flex flex-col items-center justify-center p-12 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-700">
        <svg class="w-16 h-16 mb-4 opacity-50 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p class="font-bold text-base text-gray-700 dark:text-gray-300">No Finalized Option Selected</p>
        <p class="text-xs mt-2 text-center max-w-sm">Navigate to the <b>Trip Options</b> tab and click "Mark as Finalized" on the budget option you want to proceed with.</p>
    </div>`;
    return;
  }

  const pax = getActivePax(opt);
  const feeTotals = getFeeSummaryTotals();
  const totalFeesExpected = feeTotals.totalFeesExpected;
  const totalFeesCollected = feeTotals.totalFeesCollected;
  const totalPocCount = feeTotals.totalPocCount;
  const paidPocCount = feeTotals.paidPocCount;
  const baseFee = feeTotals.baseFee;

  let grandPlannedSgd = 0;

  // Build category mapping
  let optMap = {};
  if (financeConfig && financeConfig.finalOptionId) {
    const optObj = financeOptions.find((o) => o.id === financeConfig.finalOptionId);
    if (optObj && optObj.fields) optObj.fields.forEach((f) => (optMap[f.id] = f.name));
  }
  if (financeOptions) {
    financeOptions.forEach((o) => {
      if (o && o.fields) {
        o.fields.forEach((f) => {
          if (!optMap[f.id]) optMap[f.id] = f.name;
        });
      }
    });
  }

  const activeExpenseReceipts = globalReceipts.filter(
    (r) => !r.isDeleted && r.categoryId !== "Fees Payment Screenshot",
  );
  const grandActualSgd = activeExpenseReceipts.reduce(
    (sum, r) => sum + (r.sgdAmount || 0),
    0,
  );

  const matchedReceiptIds = new Set();
  let rowsHtml = "";

  opt.fields.forEach((f) => {
    const rate = getActualRate(f.currency);
    const baseCost = parseFloat(f.cost) || 0;
    const taxPct = parseFloat(f.tax) || 0;
    const rawCost = f.costType === "per_pax" ? baseCost * pax : baseCost;
    const plannedSgd = rawCost * (1 + taxPct / 100) * rate;

    const catReceipts = activeExpenseReceipts.filter((r) => {
      if (r.categoryId === f.id) return true;
      const rCatName =
        typeof getReceiptCategoryName === "function"
          ? getReceiptCategoryName(r, optMap)
          : r.categoryId || "";
      return (
        rCatName && rCatName.toLowerCase() === (f.name || "").toLowerCase()
      );
    });

    catReceipts.forEach((r) => matchedReceiptIds.add(r.id));
    const actualSgd = catReceipts.reduce(
      (sum, r) => sum + (r.sgdAmount || 0),
      0,
    );

    grandPlannedSgd += plannedSgd;

    const diff = plannedSgd - actualSgd;
    const diffClass =
      diff < 0
        ? "text-rose-600 dark:text-rose-500"
        : "text-purple-600 dark:text-purple-400";

    rowsHtml += `
    <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
        <td class="py-2 px-3 text-sm font-bold text-gray-900 dark:text-gray-100">
            ${f.name}
            ${catReceipts.length > 0 ? `<span class="ml-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500">(${catReceipts.length} receipt${catReceipts.length > 1 ? "s" : ""})</span>` : ""}
        </td>
        <td class="py-2 px-3 text-xs font-semibold text-gray-600 dark:text-gray-400 text-right whitespace-nowrap">SGD ${plannedSgd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
        <td class="py-2 px-3 text-xs font-bold text-green-700 dark:text-green-400 text-right whitespace-nowrap">SGD ${actualSgd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
        <td class="py-2 px-3 text-xs font-black ${diffClass} text-right whitespace-nowrap">${diff > 0 ? "+" : ""}${diff.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
    </tr>`;
  });

  // Check for any active expense receipts not matching the option's fields
  const unmatchedReceipts = activeExpenseReceipts.filter(
    (r) => !matchedReceiptIds.has(r.id),
  );
  if (unmatchedReceipts.length > 0) {
    const unmatchedActualSgd = unmatchedReceipts.reduce(
      (sum, r) => sum + (r.sgdAmount || 0),
      0,
    );
    rowsHtml += `
    <tr class="hover:bg-amber-50/50 dark:hover:bg-amber-950/20 bg-amber-50/30 dark:bg-amber-950/10 transition">
        <td class="py-2 px-3 text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            Other / Uncategorized Expenses
            <span class="text-[10px] font-bold text-amber-600/80 dark:text-amber-400">(${unmatchedReceipts.length} receipt${unmatchedReceipts.length > 1 ? "s" : ""})</span>
        </td>
        <td class="py-2 px-3 text-xs font-semibold text-gray-400 text-right whitespace-nowrap">SGD 0.00</td>
        <td class="py-2 px-3 text-xs font-bold text-green-700 dark:text-green-400 text-right whitespace-nowrap">SGD ${unmatchedActualSgd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
        <td class="py-2 px-3 text-xs font-black text-rose-600 dark:text-rose-500 text-right whitespace-nowrap">-SGD ${unmatchedActualSgd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
    </tr>`;
  }

  // Core Financial Comparisons
  // Comparison 1: Expected Fees vs. Planned Expenses
  const plannedDiff = totalFeesExpected - grandPlannedSgd;
  const isPlannedCovered = plannedDiff >= 0;

  // Comparison 2: Fees Collected vs. Actual Expenses
  const actualDiff = totalFeesCollected - grandActualSgd;
  const isActualSolvent = actualDiff >= 0;

  // Expense Budget Execution Variance (Planned Expenses - Actual Expenses)
  const expenseVariance = grandPlannedSgd - grandActualSgd;

  if (cont)
    cont.innerHTML = `
<div id="finalized-finances-container" class="bg-white dark:bg-gray-900 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-800 overflow-hidden">
    <!-- Header with Option Title & Quick Navigation -->
    <div id="finalized-budget-header" class="bg-green-50 dark:bg-green-900/20 p-4 border-b-2 border-green-100 dark:border-green-800 flex flex-wrap justify-between items-center gap-3">
        <div>
            <div class="flex items-center gap-2">
                <span class="p-1.5 rounded-lg bg-green-500 text-white shadow-sm flex items-center justify-center">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </span>
                <h3 class="font-black text-lg text-green-900 dark:text-green-300 tracking-tight">
                    Finalized Budget: ${opt.title}
                </h3>
            </div>
            <p class="text-xs font-bold text-green-700 dark:text-green-400 mt-1 uppercase tracking-wider">
                Active Pax: <span class="font-black">${pax}</span> | Target Fee: <span class="font-black">${baseFee > 0 ? "SGD " + baseFee.toFixed(2) + " / pax" : "Not Set"}</span> | Currency: <span class="font-black">SGD</span>
            </p>
        </div>
        <div class="flex items-center gap-2">
            <button id="btn-goto-fee-tracker" onclick="switchFinanceSubTab('fees')" class="text-xs font-bold px-3 py-1.5 rounded-lg border-2 border-green-300 dark:border-green-700 bg-white dark:bg-gray-800 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-gray-700 shadow-sm transition flex items-center gap-1.5 focus:outline-none">
                <svg class="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                Fee Tracker
            </button>
            <button id="btn-goto-receipts" onclick="switchFinanceSubTab('receipts')" class="text-xs font-bold px-3 py-1.5 rounded-lg border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm transition flex items-center gap-1.5 focus:outline-none">
                <svg class="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Receipts Browser
            </button>
        </div>
    </div>
    
    <!-- PRIMARY COMPARISONS SECTION: PLANNED vs EXPECTED & ACTUAL vs COLLECTED -->
    <div id="finalized-comparisons-block" class="p-4 bg-gray-50/50 dark:bg-gray-950/40 border-b-2 border-gray-200 dark:border-gray-800">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            <!-- COMPARISON 1: EXPECTED FEES vs. PLANNED EXPENSES -->
            <div id="finalized-planned-comparison-card" class="bg-white dark:bg-gray-900 rounded-xl p-4 border-2 border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between gap-2 pb-2 mb-3 border-b-2 border-gray-100 dark:border-gray-800">
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded-full bg-blue-500 shrink-0"></span>
                            <h4 class="font-black text-xs md:text-sm text-gray-900 dark:text-white uppercase tracking-wider">
                                Planned Expenses vs. Expected Fees
                            </h4>
                        </div>
                        <span class="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${isPlannedCovered ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700" : "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700"}">
                            ${isPlannedCovered ? "Budget Fully Funded" : "Funding Deficit"}
                        </span>
                    </div>

                    <div class="grid grid-cols-2 gap-3 mb-3">
                        <div class="bg-blue-50/40 dark:bg-blue-950/20 p-3 rounded-lg border-2 border-blue-100 dark:border-blue-900/40 flex flex-col">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 mb-1">Total Fees Expected</span>
                            <span class="text-base md:text-lg font-black text-blue-700 dark:text-blue-400 leading-tight">
                                SGD ${totalFeesExpected.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                            <span class="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mt-1">
                                ${totalPocCount > 0 ? `${totalPocCount} families expected` : "Set in Fee Tracker"}
                            </span>
                        </div>

                        <div class="bg-gray-50 dark:bg-gray-950 p-3 rounded-lg border-2 border-gray-200 dark:border-gray-800 flex flex-col">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Total Planned Expenses</span>
                            <span class="text-base md:text-lg font-black text-gray-900 dark:text-white leading-tight">
                                SGD ${grandPlannedSgd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                            <span class="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mt-1">
                                ${opt.fields.length} budget categories
                            </span>
                        </div>
                    </div>
                </div>

                <div class="pt-3 border-t-2 border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div>
                        <span class="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Projected Net Balance:</span>
                        <p class="text-[10px] text-gray-400 dark:text-gray-500">Expected Fees &minus; Planned Expenses</p>
                    </div>
                    <div class="text-right">
                        <span class="text-base md:text-lg font-black ${isPlannedCovered ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}">
                            ${plannedDiff >= 0 ? "+" : ""}SGD ${plannedDiff.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                        <span class="block text-[10px] font-bold ${isPlannedCovered ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"} uppercase tracking-wider">
                            ${isPlannedCovered ? "Projected Surplus" : "Projected Shortfall"}
                        </span>
                    </div>
                </div>
            </div>

            <!-- COMPARISON 2: FEES COLLECTED vs. ACTUAL EXPENSES -->
            <div id="finalized-actual-comparison-card" class="bg-white dark:bg-gray-900 rounded-xl p-4 border-2 border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between gap-2 pb-2 mb-3 border-b-2 border-gray-100 dark:border-gray-800">
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded-full bg-green-500 shrink-0"></span>
                            <h4 class="font-black text-xs md:text-sm text-gray-900 dark:text-white uppercase tracking-wider">
                                Actual Expenses vs. Fees Collected
                            </h4>
                        </div>
                        <span class="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${isActualSolvent ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700" : "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700"}">
                            ${isActualSolvent ? "Cash Surplus" : "Cash Deficit"}
                        </span>
                    </div>

                    <div class="grid grid-cols-2 gap-3 mb-3">
                        <div class="bg-green-50/40 dark:bg-green-950/20 p-3 rounded-lg border-2 border-green-100 dark:border-green-900/40 flex flex-col">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-green-800 dark:text-green-300 mb-1">Total Fees Collected</span>
                            <span class="text-base md:text-lg font-black text-green-700 dark:text-green-400 leading-tight">
                                SGD ${totalFeesCollected.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                            <span class="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mt-1">
                                ${paidPocCount}/${totalPocCount} families paid
                            </span>
                        </div>

                        <div class="bg-gray-50 dark:bg-gray-950 p-3 rounded-lg border-2 border-gray-200 dark:border-gray-800 flex flex-col">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Total Actual Expenses</span>
                            <span class="text-base md:text-lg font-black text-gray-900 dark:text-white leading-tight">
                                SGD ${grandActualSgd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                            <span class="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mt-1">
                                ${activeExpenseReceipts.length} expense receipts
                            </span>
                        </div>
                    </div>
                </div>

                <div class="pt-3 border-t-2 border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div>
                        <span class="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Current Cash Position:</span>
                        <p class="text-[10px] text-gray-400 dark:text-gray-500">Fees Collected &minus; Actual Expenses</p>
                    </div>
                    <div class="text-right">
                        <span class="text-base md:text-lg font-black ${isActualSolvent ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}">
                            ${actualDiff >= 0 ? "+" : ""}SGD ${actualDiff.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                        <span class="block text-[10px] font-bold ${isActualSolvent ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"} uppercase tracking-wider">
                            ${isActualSolvent ? "Cash In Hand" : "Cash Shortfall"}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- QUICK SUMMARY STRIP: EXPENSES VARIANCE & PER PAX -->
        <div id="finalized-metrics-strip" class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 pt-3 border-t-2 border-gray-200 dark:border-gray-800">
            <div class="bg-white dark:bg-gray-900 p-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-800 text-center flex flex-col justify-center">
                <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Planned / Pax</span>
                <span class="text-xs md:text-sm font-black text-gray-800 dark:text-gray-200 mt-0.5">
                    SGD ${(pax > 0 ? grandPlannedSgd / pax : 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
            </div>
            <div class="bg-white dark:bg-gray-900 p-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-800 text-center flex flex-col justify-center">
                <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Actual / Pax</span>
                <span class="text-xs md:text-sm font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                    SGD ${(pax > 0 ? grandActualSgd / pax : 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
            </div>
            <div class="bg-white dark:bg-gray-900 p-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-800 text-center flex flex-col justify-center">
                <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Expense Variance</span>
                <span class="text-xs md:text-sm font-black ${expenseVariance < 0 ? "text-rose-600 dark:text-rose-400" : "text-purple-600 dark:text-purple-400"} mt-0.5">
                    ${expenseVariance > 0 ? "+" : ""}SGD ${expenseVariance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
            </div>
            <div class="bg-white dark:bg-gray-900 p-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-800 text-center flex flex-col justify-center">
                <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fees Collection</span>
                <span class="text-xs md:text-sm font-black text-blue-600 dark:text-blue-400 mt-0.5">
                    ${totalFeesExpected > 0 ? Math.round((totalFeesCollected / totalFeesExpected) * 100) : 0}% (${paidPocCount}/${totalPocCount})
                </span>
            </div>
        </div>
    </div>

    <!-- Category Expense Breakdown Table -->
    <div class="p-3 bg-gray-100/70 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <span class="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Category Expense Breakdown</span>
        <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">${opt.fields.length} budget categories</span>
    </div>

    <div class="overflow-x-auto custom-scrollbar">
        <table id="finalized-categories-table" class="w-full text-left border-collapse min-w-[600px]">
            <thead class="bg-gray-100 dark:bg-gray-800 text-xs uppercase font-black text-gray-500 dark:text-gray-400 tracking-wider">
                <tr>
                    <th class="py-2 px-3">Category</th>
                    <th class="py-2 px-3 text-right">Planned (SGD)</th>
                    <th class="py-2 px-3 text-right">Actual (SGD)</th>
                    <th class="py-2 px-3 text-right">Variance</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                ${rowsHtml}
            </tbody>
            <tfoot class="bg-gray-50 dark:bg-gray-950/80 border-t-2 border-gray-300 dark:border-gray-700 font-bold">
                <tr>
                    <td class="py-2.5 px-3 text-xs uppercase tracking-wider font-black text-gray-900 dark:text-white">Total Expenses</td>
                    <td class="py-2.5 px-3 text-xs font-black text-gray-900 dark:text-white text-right whitespace-nowrap">SGD ${grandPlannedSgd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td class="py-2.5 px-3 text-xs font-black text-green-700 dark:text-green-400 text-right whitespace-nowrap">SGD ${grandActualSgd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td class="py-2.5 px-3 text-xs font-black ${expenseVariance < 0 ? "text-rose-600 dark:text-rose-400" : "text-purple-600 dark:text-purple-400"} text-right whitespace-nowrap">${expenseVariance > 0 ? "+" : ""}${expenseVariance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                </tr>
            </tfoot>
        </table>
    </div>
</div>
`;
}

// ==========================================
// TAB 2: TRIP OPTIONS (SANDBOX)
// ==========================================
function renderFinanceOptions() {
  const cont = document.getElementById("fin-tab-options");
  if (!cont || cont.classList.contains("hidden-force")) return;

  const autoPax = globalLogistics?.participants?.length || 0;

  let globalSettingsHtml = `
<div class="bg-white dark:bg-gray-800 p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-md flex flex-wrap justify-between items-center gap-3 mb-4">
    <div class="flex flex-wrap items-center gap-3 flex-1">
        <div class="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded px-2 py-1">
            <label class="text-xs uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider shrink-0">Pax Mode:</label>
            <select onchange="updateFinanceConfig('globalPaxMode', this.value)" class="text-sm font-bold bg-transparent text-gray-900 dark:text-white focus:outline-none cursor-pointer">
                <option value="individual" ${financeConfig.globalPaxMode === "individual" ? "selected" : ""}>Manual Override (Individual Options)</option>
                <option value="manual" ${financeConfig.globalPaxMode === "manual" ? "selected" : ""}>Manual Override (All Options)</option>
                <option value="auto" ${financeConfig.globalPaxMode === "auto" ? "selected" : ""}>Total Pax based on Sign up</option>
            </select>
        </div>
        <div class="flex items-center gap-1.5 ${financeConfig.globalPaxMode !== "manual" ? "hidden-force" : ""}">
            <label class="text-xs uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider shrink-0">Global Pax:</label>
            <input type="number" min="0" value="${financeConfig.globalPaxCount}" onchange="updateFinanceConfig('globalPaxCount', this.value)" class="hide-spinners w-16 text-xs font-bold border-2 border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-md text-center">
        </div>
        <div class="flex items-center gap-1.5 ${financeConfig.globalPaxMode !== "auto" ? "hidden-force" : ""}">
            <label class="text-xs uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider shrink-0">Active Pax:</label>
            <span class="text-xs font-black text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded border-2 border-green-200 dark:border-green-800 shadow-md">${autoPax}</span>
        </div>
    </div>
    <div class="flex items-center gap-2">
        <button onclick="addFinanceOption()" class="bg-green-50 text-green-600 border-2 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 text-xs md:text-xs font-bold px-2 py-1.5 rounded-md hover:bg-green-100 transition shadow-md focus:outline-none shrink-0">+ Add Option</button>
        <button onclick="openFinanceRatesModal()" class="text-xs md:text-xs font-bold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 border-2 border-green-200 dark:border-green-800 px-2.5 py-1.5 rounded shadow-md whitespace-nowrap shrink-0 transition focus:outline-none flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Rates
        </button>
        <button onclick="toggleFinanceCollapse()" class="text-xs md:text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 px-2.5 py-1.5 rounded shadow-md whitespace-nowrap shrink-0 transition focus:outline-none">
            ${isFinanceCollapsed ? "Expand All" : "Collapse All"}
        </button>
    </div>
</div>`;

  let html =
    '<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 w-full items-start pb-4 max-w-full mx-auto">';

  const activeOptions = financeOptions.filter((o) => !o.isDeleted);

  if (activeOptions.length === 0) {
    html += `<div class="w-full col-span-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 pt-10"><p class="font-bold text-sm">No options created yet.</p></div>`;
  } else {
    activeOptions.forEach((opt) => {
      const pax = getActivePax(opt);
      let totalSgd = 0;
      opt.fields.forEach((f) => {
        const rate = getActualRate(f.currency);
        const baseCost = parseFloat(f.cost) || 0;
        const taxPct = parseFloat(f.tax) || 0;
        const rawCost = f.costType === "per_pax" ? baseCost * pax : baseCost;
        totalSgd += rawCost * (1 + taxPct / 100) * rate;
      });

      const dispRate = getActualRate(opt.displayCurrency);
      const totalDisp = totalSgd / dispRate;
      const cppDisp = pax > 0 ? totalDisp / pax : 0;
      const paxInputDisabled = financeConfig.globalPaxMode !== "individual";
      const isLocalCollapsed =
        opt._isCollapsed !== undefined ? opt._isCollapsed : false;
      const spanClass =
        opt.widthSpan === 3
          ? "col-span-1 lg:col-span-2 xl:col-span-3"
          : opt.widthSpan === 2
            ? "col-span-1 lg:col-span-2 xl:col-span-2"
            : "col-span-1";

      const isFinal = financeConfig.finalOptionId === opt.id;
      const finalBadge = isFinal
        ? `<span class="bg-green-100 text-green-700 border-2 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800 text-[11px] font-black px-1.5 py-0.5 rounded shadow-md uppercase tracking-widest shrink-0">FINALIZED</span>`
        : "";

      html += `
        <div class="w-full shrink-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-md border ${isFinal ? "border-2 border-green-400 dark:border-green-600 shadow-[0_0_15px_rgba(74,222,128,0.2)]" : "border-2 border-gray-200 dark:border-gray-700"} overflow-hidden h-fit transition-all duration-300 ${spanClass}">
            <div class="p-2 md:p-3 ${isFinal ? "bg-green-50/50 dark:bg-green-900/20" : "bg-gray-50/80 dark:bg-gray-900/50"} flex justify-between items-center gap-2 shrink-0 ${isLocalCollapsed ? "" : "border-b-2 border-gray-200 dark:border-gray-700"}">
                <div class="flex items-center flex-1 min-w-0 gap-2">
                    <input type="text" value="${opt.title}" onchange="updateFinanceOption('${opt.id}', 'title', this.value)" class="font-black text-base md:text-lg bg-transparent border-b border-transparent focus:border-primary outline-none text-gray-900 dark:text-white flex-1 min-w-0 px-1 transition pb-0.5">
                    ${finalBadge}
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="updateFinanceConfig('finalOptionId', '${isFinal ? "" : opt.id}')" class="${isFinal ? "text-gray-500 hover:text-red-500 bg-gray-100 hover:bg-red-50" : "text-green-600 hover:text-white hover:bg-green-500 bg-green-50"} dark:bg-gray-800 px-2 py-1 rounded text-xs font-bold border transition focus:outline-none shadow-md" title="${isFinal ? "Remove Final Status" : "Mark as Finalized Budget"}">
                        ${isFinal ? "Unfinalize" : "Make Final"}
                    </button>
                    <button onclick="cycleFinanceOptionWidth('${opt.id}')" class="hidden lg:block text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 md:p-1.5 rounded transition bg-gray-100/50 dark:bg-gray-800/50 border-2 border-gray-200 dark:border-gray-700 focus:outline-none shadow-md" title="Toggle Width">
                        <svg class="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 8L4 12l4 4m8-8l4 4-4 4"></path></svg>
                    </button>
                    <button onclick="toggleIndividualFinanceCollapse('${opt.id}')" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 md:p-1.5 rounded transition bg-gray-100/50 dark:bg-gray-800/50 border-2 border-gray-200 dark:border-gray-700 focus:outline-none shadow-md" title="Collapse/Expand">
                        <svg class="w-4 h-4 md:w-5 md:h-5 transform transition-transform ${isLocalCollapsed ? "" : "rotate-180"}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button onclick="duplicateFinanceOption('${opt.id}')" class="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 p-1.5 rounded transition"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg></button>
                    <button onclick="removeFinanceOption('${opt.id}')" class="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 p-1.5 rounded transition"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                </div>
            </div>
            
            <div class="${isLocalCollapsed ? "hidden-force" : "flex flex-col"}">
                <div class="px-2 md:px-3 py-2 bg-white dark:bg-gray-800 border-b-2 border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <label class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Pax Count ${paxInputDisabled ? "(Global)" : ""}</label>
                    <input type="number" min="0" value="${pax}" ${paxInputDisabled ? "disabled" : ""} onchange="updateFinanceOption('${opt.id}', 'pax', this.value)" class="hide-spinners w-20 text-xs font-bold px-2 py-1 bg-white dark:bg-gray-950 border-2 border-gray-300 dark:border-gray-600 rounded text-center focus:outline-none focus:ring-1 focus:ring-primary ${paxInputDisabled ? "opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-500" : ""}">
                </div>
                
                <div class="fin-cat-container p-2 bg-white dark:bg-gray-800 flex flex-col gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar" data-opt-id="${opt.id}">
                    ${opt.fields
                      .map((f) => {
                        const costTypeColorClass =
                          f.costType === "per_pax"
                            ? "bg-purple-100 text-purple-900 border-purple-400 focus:border-purple-500 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700"
                            : "bg-green-100 text-green-900 border-green-400 focus:border-green-500 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700";
                        const displayCostStr = parseFloat(
                          f.cost || 0,
                        ).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        });
                        return `
                        <div class="fin-cat-row flex flex-col w-full bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-transparent focus-within:border-gray-300 dark:focus-within:border-gray-600 transition shadow-md" data-field-id="${f.id}">
                            <div class="flex items-center gap-2 w-full mb-1">
                                <div class="fin-drag-handle cursor-grab active:cursor-grabbing p-1 shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition" onmousedown="startFinDrag(event)" ontouchstart="startFinDrag(event)"><svg class="w-5 h-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8h16M4 16h16" /></svg></div>
                                <button onclick="removeFinanceCategory('${opt.id}', '${f.id}')" class="text-red-400 hover:text-red-600 p-1 shrink-0 transition" title="Delete Category"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                                <input type="text" value="${f.name}" onchange="updateFinanceField('${opt.id}', '${f.id}', 'name', this.value)" class="flex-1 min-w-[80px] bg-transparent text-sm font-bold text-gray-900 dark:text-gray-100 outline-none px-1 border-b border-transparent focus:border-primary transition" placeholder="Category Name">
                            </div>
                            <div class="flex items-center flex-wrap gap-2 pl-[42px] w-full">
                                <select onchange="updateFinanceField('${opt.id}', '${f.id}', 'currency', this.value)" class="w-[65px] shrink-0 bg-white dark:bg-gray-950 text-xs font-bold border-2 border-gray-300 dark:border-gray-600 rounded py-1.5 pl-1.5 pr-0 outline-none focus:border-primary shadow-md cursor-pointer">${getCurrencyOptions(f.currency)}</select>
                                <select onchange="updateFinanceField('${opt.id}', '${f.id}', 'costType', this.value)" class="w-[70px] shrink-0 text-xs font-extrabold border rounded py-1.5 px-1 outline-none shadow-md cursor-pointer transition-colors ${costTypeColorClass}"><option value="total" ${f.costType !== "per_pax" ? "selected" : ""}>Total</option><option value="per_pax" ${f.costType === "per_pax" ? "selected" : ""}>/Pax</option></select>
                                <input type="text" value="${displayCostStr}" oninput="formatMoneyInput(this, false); updateFinanceField('${opt.id}', '${f.id}', 'cost', this.value)" onblur="formatMoneyInput(this, true); updateFinanceField('${opt.id}', '${f.id}', 'cost', this.value)" class="w-[100px] shrink-0 bg-white dark:bg-gray-950 text-sm font-bold border-2 border-gray-300 dark:border-gray-600 rounded px-2 py-1 outline-none focus:border-primary shadow-md text-right" placeholder="0.00">
                                <div class="flex items-center gap-1 w-[70px] shrink-0 bg-white dark:bg-gray-950 border-2 border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 outline-none focus-within:border-primary shadow-md"><span class="text-xs font-bold text-gray-400">+</span><input type="number" step="0.1" min="0" value="${f.tax || ""}" onchange="updateFinanceField('${opt.id}', '${f.id}', 'tax', this.value)" class="hide-spinners w-full bg-transparent text-sm font-bold outline-none text-right" placeholder="Tax"><span class="text-xs font-bold text-gray-500">%</span></div>
                                <input type="text" value="${f.remarks}" onchange="updateFinanceField('${opt.id}', '${f.id}', 'remarks', this.value)" class="flex-1 min-w-[120px] bg-transparent text-xs font-medium text-gray-500 dark:text-gray-400 outline-none px-1 border-b border-transparent focus:border-primary transition" placeholder="Remarks...">
                            </div>
                        </div>`;
                      })
                      .join("")}
                    <div class="pt-2 px-1">
                        <button onclick="addFinanceCategory('${opt.id}')" class="w-full py-2 border border-dashed border-green-300 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-xs font-bold hover:bg-green-50 dark:hover:bg-green-900/20 transition">+ Add Custom Category</button>
                    </div>
                </div>
            </div>
            
            <div class="p-2 md:p-3 bg-green-50/80 dark:bg-green-900/20 shrink-0 flex flex-col gap-1.5 ${isLocalCollapsed ? "border-t-2 border-gray-200 dark:border-gray-700" : "border-t-2 border-green-100 dark:border-green-900/50"}">
                <div class="${isLocalCollapsed ? "hidden-force" : "flex"} justify-between items-center pb-2 border-b-2 border-green-200/50 dark:border-green-800/50 mb-1">
                    <span class="font-bold text-xs md:text-sm text-green-800 dark:text-green-300 uppercase tracking-widest">Currency for Totals</span>
                    <select onchange="updateFinanceOption('${opt.id}', 'displayCurrency', this.value)" class="w-[90px] text-xs font-bold px-2 py-1 bg-white dark:bg-gray-950 border-2 border-green-300 dark:border-green-700 rounded focus:outline-none cursor-pointer shadow-md text-green-900 dark:text-green-100">${getCurrencyOptions(opt.displayCurrency)}</select>
                </div>
                <div class="flex justify-between items-center">
                    <span class="font-black text-xs md:text-sm text-green-800 dark:text-green-300 uppercase tracking-widest">Total Estimated</span>
                    <span id="total_${opt.id}" class="font-black text-base md:text-lg text-green-700 dark:text-green-400 bg-white dark:bg-gray-900 px-2 py-1 rounded border-2 border-green-200 dark:border-green-800 shadow-md leading-none">${opt.displayCurrency} ${totalDisp.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="font-black text-xs md:text-sm text-emerald-800 dark:text-emerald-400 uppercase tracking-widest">Cost Per Pax</span>
                    <span id="cpp_${opt.id}" class="font-black text-base md:text-lg text-emerald-700 dark:text-emerald-400 bg-white dark:bg-gray-900 px-2 py-1 rounded border-2 border-emerald-200 dark:border-emerald-800 shadow-md leading-none">${opt.displayCurrency} ${cppDisp.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            </div>
        </div>`;
    });
  }
  html += "</div>";
  if (cont) cont.innerHTML = globalSettingsHtml + html;
}

function openFinanceRatesModal() {
  const list = document.getElementById("financeRatesList");
  let html =
    '<p class="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-tight">Override the live exchange rates used for calculations. You can input the rate in either direction.</p>';
  const predefined = [
    "MYR",
    "USD",
    "EUR",
    "GBP",
    "AUD",
    "IDR",
    "THB",
    "JPY",
    "KRW",
    "TWD",
    "PHP",
    "VND",
  ];
  const extra = Object.keys(globalFinanceRates).filter(
    (c) => c !== "SGD" && !predefined.includes(c),
  );
  const allCurrencies = [...predefined, ...extra];

  allCurrencies.forEach((c) => {
    const live = globalFinanceRates[c] || 0;
    let customToSgd = "";
    let customFromSgd = "";

    if (financeConfig.customRates && financeConfig.customRates[c]) {
      const val = financeConfig.customRates[c];
      customToSgd = val;
      customFromSgd = parseFloat((1 / val).toFixed(2));
    }

    let liveToSgdText = live > 0 ? live.toFixed(2) : "N/A";
    let liveFromSgdText = live > 0 ? (1 / live).toFixed(2) : "N/A";

    html += `
    <div class="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700 shadow-md flex flex-col gap-2 mb-2">
        <div class="font-black text-sm text-gray-800 dark:text-gray-200 border-b-2 border-gray-200 dark:border-gray-700 pb-1 mb-1">${c}</div>
        
        <div class="flex items-center justify-between">
            <div class="font-black text-xs text-gray-500 w-14 shrink-0">1 ${c}</div>
            <div class="font-bold text-xs text-gray-400 px-1 shrink-0">=</div>
            <div class="flex-1 min-w-0 pr-2">
                <input type="number" step="0.000001" id="rate_${c}_to_sgd" placeholder="Live: ${liveToSgdText}" value="${customToSgd}" 
                    oninput="handleRateInputSync('${c}', 'to_sgd', this.value)" 
                    onchange="handleRateChange('${c}', 'to_sgd', this.value)" 
                    class="w-full text-sm font-bold p-1.5 border-2 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-950 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-gray-900 dark:text-white transition shadow-md placeholder-gray-400">
            </div>
            <div class="font-black text-xs text-gray-500 w-10 shrink-0 text-right">SGD</div>
        </div>

        <div class="flex items-center justify-between">
            <div class="font-black text-xs text-gray-500 w-14 shrink-0">1 SGD</div>
            <div class="font-bold text-xs text-gray-400 px-1 shrink-0">=</div>
            <div class="flex-1 min-w-0 pr-2">
                <input type="number" step="0.000001" id="rate_sgd_to_${c}" placeholder="Live: ${liveFromSgdText}" value="${customFromSgd}" 
                    oninput="handleRateInputSync('${c}', 'from_sgd', this.value)" 
                    onchange="handleRateChange('${c}', 'from_sgd', this.value)" 
                    class="w-full text-sm font-bold p-1.5 border-2 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-950 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-gray-900 dark:text-white transition shadow-md placeholder-gray-400">
            </div>
            <div class="font-black text-xs text-gray-500 w-10 shrink-0 text-right">${c}</div>
        </div>
    </div>`;
  });
  if (list) list.innerHTML = html;
  document.getElementById("financeRatesModal").classList.remove("hidden-force");
}

function closeFinanceRatesModal() {
  document.getElementById("financeRatesModal").classList.add("hidden-force");
}

function handleRateInputSync(currency, mode, value) {
  const val = parseFloat(value);
  const inputToSgd = document.getElementById(`rate_${currency}_to_sgd`);
  const inputFromSgd = document.getElementById(`rate_sgd_to_${currency}`);

  if (isNaN(val) || val <= 0 || value.trim() === "") {
    if (value.trim() === "") {
      if (mode === "to_sgd" && inputFromSgd) inputFromSgd.value = "";
      if (mode === "from_sgd" && inputToSgd) inputToSgd.value = "";
    }
  } else {
    const inverse = 1 / val;
    if (mode === "to_sgd" && inputFromSgd) {
      inputFromSgd.value = parseFloat(inverse.toFixed(2));
    } else if (mode === "from_sgd" && inputToSgd) {
      inputToSgd.value = parseFloat(inverse.toFixed(2));
    }
  }
}

function handleRateChange(currency, mode, value) {
  const val = parseFloat(value);
  handleRateInputSync(currency, mode, value);

  if (isNaN(val) || val <= 0 || value.trim() === "") {
    if (financeConfig.customRates) delete financeConfig.customRates[currency];
  } else {
    const finalToSgdVal = mode === "to_sgd" ? val : 1 / val;
    if (!financeConfig.customRates) financeConfig.customRates = {};
    financeConfig.customRates[currency] = finalToSgdVal;
  }

  financeOptions.forEach((o) => updateTotals(o.id));
  renderFinanceOptions();
  queueFinanceUpdate();
}

function toggleFinanceCollapse() {
  isFinanceCollapsed = !isFinanceCollapsed;
  financeOptions.forEach((o) => (o._isCollapsed = isFinanceCollapsed));
  renderFinanceOptions();
}

function toggleIndividualFinanceCollapse(id) {
  const opt = financeOptions.find((o) => o.id === id);
  if (opt) {
    opt._isCollapsed = !opt._isCollapsed;
    renderFinanceOptions();
  }
}

function cycleFinanceOptionWidth(optId) {
  const opt = financeOptions.find((o) => o.id === optId);
  if (opt) {
    opt.widthSpan = (opt.widthSpan || 2) + 1;
    if (opt.widthSpan > 3) opt.widthSpan = 1;
    queueFinanceUpdate(optId);
    renderFinanceOptions();
  }
}

function updateFinanceOption(optId, key, value) {
  const opt = financeOptions.find((o) => o.id === optId);
  if (!opt) return;
  if (key === "title") opt.title = value;
  else if (key === "pax") {
    opt.pax = parseInt(value) || 0;
    updateTotals(optId);
  } else if (key === "displayCurrency") {
    opt.displayCurrency = value;
    updateTotals(optId);
  }
  queueFinanceUpdate(optId);
}

function updateFinanceField(optId, fieldId, key, value) {
  const opt = financeOptions.find((o) => o.id === optId);
  if (!opt) return;
  const field = opt.fields.find((f) => f.id === fieldId);
  if (!field) return;

  if (key === "cost") {
    field.cost = parseFloat(String(value).replace(/,/g, "")) || 0;
    updateTotals(optId);
  } else if (key === "tax") {
    field.tax = parseFloat(value) || 0;
    updateTotals(optId);
  } else if (key === "costType") {
    field.costType = value;
    updateTotals(optId);
  } else if (key === "currency") {
    field.currency = value;
    updateTotals(optId);
  } else if (key === "name") field.name = value;
  else if (key === "remarks") field.remarks = value;

  queueFinanceUpdate(optId);
  if (key === "costType") renderFinanceOptions();
}

function updateTotals(optId) {
  const opt = financeOptions.find((o) => o.id === optId);
  if (!opt) return;
  const pax = getActivePax(opt);
  let totalSgd = 0;
  opt.fields.forEach((f) => {
    const rate = getActualRate(f.currency);
    const rawCost =
      f.costType === "per_pax"
        ? (parseFloat(f.cost) || 0) * pax
        : parseFloat(f.cost) || 0;
    totalSgd += rawCost * (1 + (parseFloat(f.tax) || 0) / 100) * rate;
  });
  const dispRate = getActualRate(opt.displayCurrency);
  const totalDisp = totalSgd / dispRate;
  const cppDisp = pax > 0 ? totalDisp / pax : 0;

  const totEl = document.getElementById(`total_${opt.id}`);
  const cppEl = document.getElementById(`cpp_${opt.id}`);
  if (totEl)
    totEl.textContent = `${opt.displayCurrency} ${totalDisp.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (cppEl)
    cppEl.textContent = `${opt.displayCurrency} ${cppDisp.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function addFinanceOption(title = "New Option", reRender = true) {
  const newOpt = {
    id: generateFinanceUUID(),
    title: title,
    pax: 0,
    displayCurrency: "SGD",
    widthSpan: 2,
    ts: Date.now(),
    _isCollapsed: false,
    isDeleted: false,
    fields: [],
  };
  defaultFinanceFields.forEach((f) => {
    newOpt.fields.push({
      id: generateFinanceUUID(),
      name: f,
      costType: "total",
      tax: 0,
      cost: 0,
      currency: "MYR",
      remarks: "",
    });
  });
  financeOptions.unshift(newOpt);
  queueFinanceUpdate(newOpt.id);
  if (reRender) renderFinanceOptions();
}

function duplicateFinanceOption(id) {
  const opt = financeOptions.find((o) => o.id === id);
  if (!opt) return;
  const copy = JSON.parse(JSON.stringify(opt));
  copy.id = generateFinanceUUID();
  copy.title = opt.title + " (Copy)";
  copy.ts = Date.now();
  copy._isCollapsed = false;
  copy.isDeleted = false;
  copy.fields.forEach((f) => (f.id = generateFinanceUUID()));
  financeOptions.unshift(copy);
  queueFinanceUpdate(copy.id);
  renderFinanceOptions();
}

function removeFinanceOption(id) {
  if (!confirm("Are you sure you want to remove this option?")) return;
  const opt = financeOptions.find((o) => o.id === id);
  if (opt) {
    opt.isDeleted = true;
    opt.ts = Date.now();
    if (financeConfig.finalOptionId === id) financeConfig.finalOptionId = null;
    queueFinanceUpdate(id);
    renderAllFinanceTabs();
  }
}

function addFinanceCategory(optId) {
  const opt = financeOptions.find((o) => o.id === optId);
  if (!opt) return;
  opt.fields.push({
    id: generateFinanceUUID(),
    name: "New Category",
    costType: "total",
    tax: 0,
    cost: 0,
    currency: "MYR",
    remarks: "",
  });
  queueFinanceUpdate(optId);
  renderFinanceOptions();
}

function removeFinanceCategory(optId, fieldId) {
  const opt = financeOptions.find((o) => o.id === optId);
  if (!opt) return;
  opt.fields = opt.fields.filter((f) => f.id !== fieldId);
  queueFinanceUpdate(optId);
  renderFinanceOptions();
}

function startFinDrag(e) {
  if (e.type === "mousedown" && e.button !== 0) return;
  e.preventDefault();
  const handle = e.currentTarget;
  const row = handle.closest(".fin-cat-row");
  const container = row.closest(".fin-cat-container");
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
    placeholder: document.createElement("div"),
  };
  finDndState.placeholder.className =
    "fin-cat-placeholder bg-green-50/50 dark:bg-green-900/20 border-2 border-dashed border-primary/50 rounded-lg my-1 transition-all";
  finDndState.placeholder.style.height = rect.height + "px";
  row.parentNode.insertBefore(finDndState.placeholder, row);
  row.style.position = "fixed";
  row.style.zIndex = "9999";
  row.style.width = rect.width + "px";
  row.style.boxShadow = "0 10px 25px rgba(0,0,0,0.2)";
  row.classList.add("opacity-95");
  updateFinDragPosition(clientY, clientX);
  document.addEventListener("mousemove", moveFinDrag, { passive: false });
  document.addEventListener("touchmove", moveFinDrag, { passive: false });
  document.addEventListener("mouseup", endFinDrag);
  document.addEventListener("touchend", endFinDrag);
}

function moveFinDrag(e) {
  if (!finDndState.active) return;
  e.preventDefault();
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  updateFinDragPosition(clientY, clientX);
  const siblings = Array.from(
    finDndState.container.querySelectorAll(
      '.fin-cat-row:not(.fin-cat-placeholder):not([style*="position: fixed"])',
    ),
  );
  let nextElement = null;
  for (let sib of siblings) {
    const rect = sib.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      nextElement = sib;
      break;
    }
  }
  if (nextElement)
    finDndState.container.insertBefore(finDndState.placeholder, nextElement);
  else finDndState.container.appendChild(finDndState.placeholder);
}

function updateFinDragPosition(y, x) {
  finDndState.row.style.top = y - finDndState.yOffset + "px";
  finDndState.row.style.left = x - finDndState.xOffset + "px";
}

function endFinDrag(e) {
  if (!finDndState.active) return;
  finDndState.active = false;
  document.removeEventListener("mousemove", moveFinDrag);
  document.removeEventListener("touchmove", moveFinDrag);
  document.removeEventListener("mouseup", endFinDrag);
  document.removeEventListener("touchend", endFinDrag);
  finDndState.placeholder.parentNode.insertBefore(
    finDndState.row,
    finDndState.placeholder,
  );
  finDndState.placeholder.remove();
  finDndState.row.style = "";
  finDndState.row.classList.remove("opacity-95");
  reorderFieldsInModel(finDndState.optId);
  renderFinanceOptions();
}

function reorderFieldsInModel(optId) {
  const opt = financeOptions.find((o) => o.id === optId);
  if (!opt) return;
  const container = document.querySelector(
    `.fin-cat-container[data-opt-id="${optId}"]`,
  );
  if (!container) return;
  const newFields = [];
  container.querySelectorAll(".fin-cat-row").forEach((row) => {
    const fId = row.dataset.fieldId;
    const field = opt.fields.find((f) => f.id === fId);
    if (field) newFields.push(field);
  });
  opt.fields = newFields;
  queueFinanceUpdate(optId);
}

// ==========================================
// TAB 3: RECEIPTS BROWSER & UPLOAD
// ==========================================

function fuzzyMatchText(text, query) {
  if (!query) return true;
  if (!text) return false;
  text = String(text).toLowerCase();
  query = String(query).toLowerCase().trim();
  if (text.includes(query)) return true;
  if (query.length <= 2) return false;

  let qIdx = 0;
  for (let i = 0; i < text.length && qIdx < query.length; i++) {
    if (text[i] === query[qIdx]) {
      qIdx++;
    }
  }
  return qIdx === query.length;
}

function matchesReceiptFuzzy(r, query, optMap) {
  if (!query || !query.trim()) return true;
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);

  const catName = (optMap && optMap[r.categoryId] ? optMap[r.categoryId] : (r.categoryId || "")).toLowerCase();
  let uploaderName = (r.uploaderName || r.uploaderNric || "").toLowerCase();
  let payerName = (r.paidByNric || r.uploaderNric || "").toLowerCase();
  let uploaderShortName = "";
  let payerShortName = "";

  if (globalLogistics && globalLogistics.participants) {
    const up = globalLogistics.participants.find((x) => x.nric === r.uploaderNric);
    if (up) {
      uploaderName = (up.name || "").toLowerCase();
      uploaderShortName = (up.shortName || "").toLowerCase();
    }
    const pp = globalLogistics.participants.find((x) => x.nric === (r.paidByNric || r.uploaderNric));
    if (pp) {
      payerName = (pp.name || "").toLowerCase();
      payerShortName = (pp.shortName || "").toLowerCase();
    }
  }

  const dateStr = (
    typeof formatDDMmmYYYY === "function"
      ? formatDDMmmYYYY(r.ts)
      : new Date(r.ts).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
  ).toLowerCase();

  const searchableFields = [
    catName,
    (r.categoryId || "").toLowerCase(),
    uploaderName,
    uploaderShortName,
    (r.uploaderNric || "").toLowerCase(),
    payerName,
    payerShortName,
    (r.paidByNric || "").toLowerCase(),
    dateStr,
    (r.currency || "").toLowerCase(),
    String(r.amount || ""),
    String(r.sgdAmount || ""),
    (r.remarks || "").toLowerCase(),
    r.isReimbursed ? "reimbursed" : "pending",
    (r.id || "").toLowerCase(),
  ];

  const combined = searchableFields.join(" ");
  if (combined.includes(q)) return true;

  return tokens.every((token) => {
    return searchableFields.some((field) => fuzzyMatchText(field, token));
  });
}

function getReceiptCategoryName(r, optMap) {
  if (!r) return "Uncategorized";
  if (r.categoryId && optMap && optMap[r.categoryId]) {
    return optMap[r.categoryId];
  }
  return r.categoryId || "Uncategorized";
}

function populateFinReceiptCategories(selectEl) {
  if (!selectEl) selectEl = document.getElementById("finRecCategory");
  if (!selectEl) return;

  const currentVal = selectEl.value;
  let optionsHtml = "";
  const seenNames = new Set();

  if (financeConfig && financeConfig.finalOptionId) {
    const opt = financeOptions.find((o) => o.id === financeConfig.finalOptionId);
    if (opt && opt.fields && opt.fields.length > 0) {
      opt.fields.forEach((f) => {
        const name = (f.name || "").trim();
        if (name && !seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase());
          optionsHtml += `<option value="${f.id}">${f.name}</option>`;
        }
      });
    }
  }

  // If no finalOptionId fields found, check any available finance option
  if (!optionsHtml && financeOptions && financeOptions.length > 0) {
    financeOptions.forEach((opt) => {
      if (opt && opt.fields) {
        opt.fields.forEach((f) => {
          const name = (f.name || "").trim();
          if (name && !seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase());
            optionsHtml += `<option value="${f.id}">${f.name}</option>`;
          }
        });
      }
    });
  }

  // Fallback defaults
  if (!optionsHtml && typeof defaultFinanceFields !== "undefined") {
    defaultFinanceFields.forEach((name) => {
      const trimmed = (name || "").trim();
      if (trimmed && !seenNames.has(trimmed.toLowerCase())) {
        seenNames.add(trimmed.toLowerCase());
        optionsHtml += `<option value="${trimmed}">${trimmed}</option>`;
      }
    });
  }

  selectEl.innerHTML = '<option value="" disabled selected>Select Category</option>' + optionsHtml;
  if (currentVal) selectEl.value = currentVal;
}

function toggleFinReceiptUpload() {
  const wrapper = document.getElementById("finReceiptFormWrapper");
  const icon = document.getElementById("finReceiptExpandIcon");
  if (!wrapper) return;
  const isHidden = wrapper.classList.contains("hidden-force");
  if (isHidden) {
    wrapper.classList.remove("hidden-force");
    if (icon) icon.classList.add("rotate-180");
    populateFinReceiptCategories();

    // Prefill user details if available
    const nricInput = document.getElementById("finRecNric");
    const nameInput = document.getElementById("finRecName");
    if (currentUser) {
      if (nricInput && !nricInput.value && currentUser.nric && currentUser.nric !== "ADMIN") {
        nricInput.value = currentUser.nric;
      }
      if (nameInput && !nameInput.value && currentUser.name && currentUser.name !== "Admin") {
        nameInput.value = currentUser.name;
      }
    }
  } else {
    wrapper.classList.add("hidden-force");
    if (icon) icon.classList.remove("rotate-180");
  }
}

function finRecCurChange() {
  const curSelect = document.getElementById("finRecCurrency");
  if (!curSelect) return;
  const cur = curSelect.value;
  const rateContainer = document.getElementById("finRecBidirectionalRate");
  const rateInput = document.getElementById("finRecRate");

  if (cur === "SGD") {
    if (rateContainer) rateContainer.classList.add("hidden-force");
    if (rateInput) rateInput.value = "1";
  } else {
    if (rateContainer) rateContainer.classList.remove("hidden-force");
    const label1 = document.getElementById("finRecCurLabel1");
    const label2 = document.getElementById("finRecCurLabel2");
    if (label1) label1.innerText = cur;
    if (label2) label2.innerText = cur;

    let rate = getActualRate(cur);
    if (cur === "MYR" && rate === 1) rate = 0.28;

    if (rateInput) rateInput.value = rate;
    const toSgd = document.getElementById("finRecRateToSgd");
    const fromSgd = document.getElementById("finRecRateFromSgd");
    if (toSgd) toSgd.value = rate.toFixed(2);
    if (fromSgd) fromSgd.value = (1 / rate).toFixed(2);
  }
  finRecCalcSgd();
}

function handleFinRecRateInputSync(mode, value) {
  const val = parseFloat(value);
  const inputToSgd = document.getElementById("finRecRateToSgd");
  const inputFromSgd = document.getElementById("finRecRateFromSgd");
  const hiddenRate = document.getElementById("finRecRate");

  if (isNaN(val) || val <= 0 || value.trim() === "") {
    if (value.trim() === "") {
      if (mode === "to_sgd" && inputFromSgd) inputFromSgd.value = "";
      if (mode === "from_sgd" && inputToSgd) inputToSgd.value = "";
    }
    if (hiddenRate) hiddenRate.value = 1;
  } else {
    const inverse = 1 / val;
    if (mode === "to_sgd") {
      if (inputFromSgd) inputFromSgd.value = inverse.toFixed(2);
      if (hiddenRate) hiddenRate.value = val;
    } else if (mode === "from_sgd") {
      if (inputToSgd) inputToSgd.value = inverse.toFixed(2);
      if (hiddenRate) hiddenRate.value = inverse;
    }
  }
  finRecCalcSgd();
}

function finRecCalcSgd() {
  const amtInput = document.getElementById("finRecAmount");
  const rateInput = document.getElementById("finRecRate");
  const sgdInput = document.getElementById("finRecSgd");
  if (!amtInput || !sgdInput) return;
  const amt = parseFloat(amtInput.value) || 0;
  const rate = parseFloat(rateInput ? rateInput.value : 1) || 1;
  sgdInput.value = (amt * rate).toFixed(2);
}

async function submitFinReceiptUpload(e) {
  e.preventDefault();
  const btn = document.getElementById("finRecBtn");
  const err = document.getElementById("finReceiptError");
  const succ = document.getElementById("finReceiptSuccess");
  if (err) err.classList.add("hidden-force");
  if (succ) succ.classList.add("hidden-force");

  const nricInput = document.getElementById("finRecNric");
  const nric = nricInput ? nricInput.value.trim().toUpperCase() : "";
  const nameField = document.getElementById("finRecName");
  const uploaderName = nameField ? nameField.value.trim() : "";
  const amountInput = document.getElementById("finRecAmount");
  const amount = parseFloat(amountInput ? amountInput.value : 0) || 0;
  const catInput = document.getElementById("finRecCategory");
  const category = catInput ? catInput.value.trim() : "";
  const remarksInput = document.getElementById("finRecRemarks");
  const remarks = remarksInput ? remarksInput.value.trim() : "";
  const fileInput = document.getElementById("finRecFile");

  const showError = (msg) => {
    if (err) {
      err.textContent = msg;
      err.classList.remove("hidden-force");
    } else if (typeof showToast === "function") {
      showToast(msg, true);
    }
  };

  if (!nric) {
    return showError("Uploader NRIC is required.");
  }
  if (typeof isValidNRIC === "function" && !isValidNRIC(nric) && nric.length < 5) {
    return showError("Invalid NRIC/FIN or Passport format.");
  }
  if (amount <= 0) {
    return showError("Amount must be greater than 0.");
  }
  if (!category) {
    return showError("Category is required.");
  }
  if (!fileInput || !fileInput.files.length) {
    return showError("Please select a file.");
  }

  const file = fileInput.files[0];
  if (file.size > 4 * 1024 * 1024) {
    return showError("File exceeds 4MB limit.");
  }

  if (btn) setBtnLoading(btn, true);
  try {
    const base64 = await toBase64(file);

    const ext = file.name.split(".").pop() || "png";
    const receiptNo = `${nric.slice(-4)}${Date.now().toString().slice(-4)}`;
    const finalFileName = `${uploaderName || nric} - ${receiptNo}.${ext}`;

    const curEl = document.getElementById("finRecCurrency");
    const rateEl = document.getElementById("finRecRate");
    const sgdEl = document.getElementById("finRecSgd");

    const payload = {
      uploaderNric: nric,
      uploaderName: uploaderName,
      currency: curEl ? curEl.value : "SGD",
      amount: amount,
      rate: parseFloat(rateEl ? rateEl.value : 1) || 1,
      sgdAmount: parseFloat(sgdEl ? sgdEl.value : amount) || amount,
      categoryId: category,
      remarks: remarks,
      fileName: finalFileName,
      mimeType: file.type,
      fileData: base64.split(",")[1],
    };

    const res = await apiCall("uploadReceipt", { payload: payload });

    if (succ) {
      succ.textContent = "Receipt uploaded successfully!";
      succ.classList.remove("hidden-force");
    }

    const form = document.getElementById("finReceiptForm");
    if (form) form.reset();

    // Reset currency to SGD & update rates
    if (curEl) curEl.value = "SGD";
    finRecCurChange();

    // Restore prefilled NRIC and Name if logged in
    if (currentUser) {
      if (nricInput && currentUser.nric && currentUser.nric !== "ADMIN") {
        nricInput.value = currentUser.nric;
      }
      if (nameField && currentUser.name && currentUser.name !== "Admin") {
        nameField.value = currentUser.name;
      }
    }

    if (typeof showToast === "function") {
      showToast("Receipt uploaded successfully!");
    }

    // Auto refresh the Receipts page to show the update
    if (res && res.receipts && Array.isArray(res.receipts)) {
      globalReceipts = res.receipts;
      window.globalReceipts = globalReceipts;
    } else {
      const recRes = await apiCall("fetchReceipts", { force: true });
      if (recRes && recRes.receipts) {
        globalReceipts = recRes.receipts;
        window.globalReceipts = globalReceipts;
      }
    }

    renderReceiptsBrowser();
    if (typeof calculateAndUpdateFinalized === "function") {
      calculateAndUpdateFinalized();
    }
  } catch (error) {
    showError(error.message || "Failed to upload receipt.");
  } finally {
    if (btn) setBtnLoading(btn, false);
  }
}

function handleReceiptSearch() {
  const input = document.getElementById("receiptSearchInput");
  if (!input) return;
  receiptSearchQuery = input.value;
  const start = input.selectionStart;
  const end = input.selectionEnd;

  renderReceiptsBrowser();

  const newInput = document.getElementById("receiptSearchInput");
  if (newInput) {
    newInput.focus();
    try {
      newInput.setSelectionRange(start, end);
    } catch (e) {}
  }
}

function handleReceiptCategoryFilter(catVal) {
  receiptCategoryFilter = catVal || "all";
  renderReceiptsBrowser();
}

function resetReceiptFilters() {
  receiptSearchQuery = "";
  receiptCategoryFilter = "all";
  const input = document.getElementById("receiptSearchInput");
  if (input) input.value = "";
  const catSelect = document.getElementById("receiptCategoryFilter");
  if (catSelect) catSelect.value = "all";
  renderReceiptsBrowser();
}

function renderReceiptsBrowser() {
  const cont = document.getElementById("fin-tab-receipts");
  if (!cont || cont.classList.contains("hidden-force")) return;

  const activeReceipts = (globalReceipts || [])
    .filter((r) => !r.isDeleted && r.categoryId !== "Fees Payment Screenshot")
    .sort((a, b) => b.ts - a.ts);

  let optMap = {};
  if (financeConfig && financeConfig.finalOptionId) {
    const opt = financeOptions.find((o) => o.id === financeConfig.finalOptionId);
    if (opt && opt.fields) opt.fields.forEach((f) => (optMap[f.id] = f.name));
  }
  if (financeOptions && financeOptions.length > 0) {
    financeOptions.forEach((opt) => {
      if (opt && opt.fields) {
        opt.fields.forEach((f) => {
          if (!optMap[f.id]) optMap[f.id] = f.name;
        });
      }
    });
  }

  // Check if outer skeleton exists
  let listContainer = document.getElementById("financeReceiptsListContainer");
  if (!listContainer) {
    cont.innerHTML = `
      <div class="flex flex-col gap-3 pb-6 max-w-5xl mx-auto w-full">
        <!-- UPLOAD RECEIPT BOX (Identical to landing page) -->
        <div id="finReceiptUploadBox" class="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl shadow-md border-2 border-gray-200 dark:border-gray-700 w-full border-t-4 border-t-purple-500 transition-all">
          <button
            type="button"
            id="finReceiptToggleBtn"
            onclick="toggleFinReceiptUpload()"
            class="w-full flex justify-between items-center focus:outline-none cursor-pointer"
          >
            <div class="flex items-center gap-3">
              <div class="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <div class="text-left">
                <h3 class="text-base font-black text-gray-900 dark:text-white tracking-tight">
                  Upload Receipt
                </h3>
                <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Click to add and record trip expenses
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-purple-600 dark:text-purple-400 hidden sm:inline">Add Receipt</span>
              <svg
                id="finReceiptExpandIcon"
                class="w-6 h-6 text-gray-400 transition-transform duration-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          <div id="finReceiptFormWrapper" class="hidden-force mt-5 text-left border-t-2 border-gray-100 dark:border-gray-700/60 pt-4">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-4 font-bold">
              Please fill in the details of the receipt.
            </p>
            <div
              id="finReceiptError"
              class="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 p-3 rounded-lg text-sm mb-4 font-bold hidden-force border-2 border-red-200 dark:border-red-800"
            ></div>
            <div
              id="finReceiptSuccess"
              class="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 p-3 rounded-lg text-sm mb-4 font-bold hidden-force border-2 border-green-200 dark:border-green-800"
            ></div>
            <form id="finReceiptForm" onsubmit="submitFinReceiptUpload(event)" class="flex flex-col gap-4">
              <div>
                <label for="finRecNric" class="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Uploader NRIC
                </label>
                <input
                  type="text"
                  id="finRecNric"
                  required
                  oninput="if (typeof isValidNRIC === 'function' && isValidNRIC(this.value)) { const err = document.getElementById('finReceiptError'); if (err) err.classList.add('hidden-force'); }"
                  class="w-full p-2.5 border-2 border-gray-300 dark:border-gray-700 rounded-xl uppercase font-bold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  placeholder="S1234567A"
                />
              </div>
              <div>
                <label for="finRecName" class="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name (Optional)
                </label>
                <input
                  type="text"
                  id="finRecName"
                  class="w-full p-2.5 border-2 border-gray-300 dark:border-gray-700 rounded-xl font-bold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  placeholder="John Doe"
                />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="finRecCurrency" class="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Currency
                  </label>
                  <select
                    id="finRecCurrency"
                    onchange="finRecCurChange()"
                    required
                    class="w-full p-2.5 border-2 border-gray-300 dark:border-gray-700 rounded-xl font-bold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="SGD" selected>SGD</option>
                    <option value="MYR">MYR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="AUD">AUD</option>
                    <option value="IDR">IDR</option>
                    <option value="THB">THB</option>
                    <option value="JPY">JPY</option>
                    <option value="KRW">KRW</option>
                  </select>
                </div>
                <div>
                  <label for="finRecAmount" class="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    id="finRecAmount"
                    oninput="finRecCalcSgd()"
                    required
                    class="w-full p-2.5 border-2 border-gray-300 dark:border-gray-700 rounded-xl font-bold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-right"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div id="finRecBidirectionalRate" class="hidden-force flex flex-col gap-2 p-2.5 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50">
                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b-2 border-gray-200 dark:border-gray-700 pb-1 mb-1">
                  Exchange Rate
                </label>
                <div class="flex items-center justify-between">
                  <div class="font-black text-xs text-gray-500 w-12 shrink-0">
                    1 <span id="finRecCurLabel1">MYR</span>
                  </div>
                  <div class="font-bold text-xs text-gray-400 px-1 shrink-0">=</div>
                  <div class="flex-1 min-w-0 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      id="finRecRateToSgd"
                      placeholder="0.00"
                      oninput="handleFinRecRateInputSync('to_sgd', this.value)"
                      class="w-full text-sm font-bold p-1.5 border-2 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-950 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-gray-900 dark:text-white transition shadow-md placeholder-gray-400 text-right"
                    />
                  </div>
                  <div class="font-black text-xs text-gray-500 w-10 shrink-0 text-right">SGD</div>
                </div>
                <div class="flex items-center justify-between">
                  <div class="font-black text-xs text-gray-500 w-12 shrink-0">1 SGD</div>
                  <div class="font-bold text-xs text-gray-400 px-1 shrink-0">=</div>
                  <div class="flex-1 min-w-0 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      id="finRecRateFromSgd"
                      placeholder="0.00"
                      oninput="handleFinRecRateInputSync('from_sgd', this.value)"
                      class="w-full text-sm font-bold p-1.5 border-2 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-950 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-gray-900 dark:text-white transition shadow-md placeholder-gray-400 text-right"
                    />
                  </div>
                  <div class="font-black text-xs text-gray-500 w-10 shrink-0 text-right">
                    <span id="finRecCurLabel2">MYR</span>
                  </div>
                </div>
                <input type="hidden" id="finRecRate" value="1" />
              </div>

              <div>
                <label for="finRecSgd" class="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  SGD Equiv
                </label>
                <input
                  type="number"
                  step="0.01"
                  id="finRecSgd"
                  readonly
                  class="w-full p-2.5 border-2 border-gray-200 dark:border-gray-700 rounded-xl font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-right"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label for="finRecCategory" class="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Category
                </label>
                <select
                  id="finRecCategory"
                  required
                  class="w-full p-2.5 border-2 border-gray-300 dark:border-gray-700 rounded-xl font-bold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="" disabled selected>Loading categories...</option>
                </select>
              </div>
              <div>
                <label for="finRecFile" class="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Receipt File
                </label>
                <input
                  type="file"
                  id="finRecFile"
                  required
                  accept="image/*,.pdf"
                  class="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-gray-700 dark:file:bg-gray-700 dark:file:text-gray-200 hover:file:bg-gray-200 dark:hover:file:bg-gray-600 cursor-pointer"
                />
              </div>
              <div>
                <label for="finRecRemarks" class="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Remarks (Optional)
                </label>
                <input
                  type="text"
                  id="finRecRemarks"
                  class="w-full p-2.5 border-2 border-gray-300 dark:border-gray-700 rounded-xl font-bold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  placeholder="Details..."
                />
              </div>
              <button
                type="submit"
                id="finRecBtn"
                class="w-full bg-purple-600 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-purple-700 transition flex justify-center items-center shadow-lg focus:outline-none mt-2 cursor-pointer"
              >
                <span class="btn-text">Upload</span>
                <div class="btn-spinner spinner-white hidden-force ml-2"></div>
              </button>
            </form>
          </div>
        </div>

        <!-- SEARCH AND FILTER TOOLBAR -->
        <div id="receiptsFilterToolbar" class="bg-white dark:bg-gray-800 p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <!-- Fuzzy search input -->
          <div class="relative flex-1 min-w-0">
            <input
              type="text"
              id="receiptSearchInput"
              oninput="handleReceiptSearch()"
              value="${receiptSearchQuery.replace(/"/g, '&quot;')}"
              placeholder="Fuzzy search receipts (category, name, NRIC, remarks, amount...)"
              class="w-full py-2 pl-9 pr-8 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition"
            />
            <svg class="w-4 h-4 absolute left-3 top-2.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <button
              type="button"
              id="clearReceiptSearchBtn"
              onclick="clearSearch('receiptSearchInput', 'handleReceiptSearch')"
              class="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none ${receiptSearchQuery ? '' : 'hidden-force'}"
              title="Clear search"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <!-- Category filter dropdown -->
          <div class="flex items-center gap-2 shrink-0">
            <label for="receiptCategoryFilter" class="text-xs font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Category:
            </label>
            <select
              id="receiptCategoryFilter"
              onchange="handleReceiptCategoryFilter(this.value)"
              class="py-2 px-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-xs font-bold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition max-w-[220px]"
            >
              <option value="all">All Categories</option>
            </select>
          </div>
        </div>

        <!-- RESULTS SUMMARY -->
        <div id="receiptResultsSummary" class="flex justify-between items-center px-1 text-xs text-gray-500 dark:text-gray-400">
          <div id="receiptResultsCount" class="font-bold">0 receipts</div>
          <div id="receiptResultsTotalSgd" class="font-extrabold text-purple-600 dark:text-purple-400">Total: SGD 0.00</div>
        </div>

        <!-- LIST CONTAINER -->
        <div id="financeReceiptsListContainer" class="flex flex-col gap-3"></div>
      </div>
    `;

    populateFinReceiptCategories();
    listContainer = document.getElementById("financeReceiptsListContainer");
  }

  // Update clear button visibility
  const clearBtn = document.getElementById("clearReceiptSearchBtn");
  if (clearBtn) {
    if (receiptSearchQuery) clearBtn.classList.remove("hidden-force");
    else clearBtn.classList.add("hidden-force");
  }

  // Populate category filter options (deduplicated by category name)
  const catFilterSelect = document.getElementById("receiptCategoryFilter");
  if (catFilterSelect) {
    // 1. Gather primary category names matching the upload receipt dropdown
    const primaryCategoryNames = [];
    const seenCategoryNames = new Set();

    if (financeConfig && financeConfig.finalOptionId) {
      const opt = financeOptions.find((o) => o.id === financeConfig.finalOptionId);
      if (opt && opt.fields && opt.fields.length > 0) {
        opt.fields.forEach((f) => {
          const name = (f.name || "").trim();
          if (name && !seenCategoryNames.has(name.toLowerCase())) {
            seenCategoryNames.add(name.toLowerCase());
            primaryCategoryNames.push(name);
          }
        });
      }
    }

    if (primaryCategoryNames.length === 0 && financeOptions && financeOptions.length > 0) {
      financeOptions.forEach((opt) => {
        if (opt && opt.fields) {
          opt.fields.forEach((f) => {
            const name = (f.name || "").trim();
            if (name && !seenCategoryNames.has(name.toLowerCase())) {
              seenCategoryNames.add(name.toLowerCase());
              primaryCategoryNames.push(name);
            }
          });
        }
      });
    }

    if (primaryCategoryNames.length === 0 && typeof defaultFinanceFields !== "undefined") {
      defaultFinanceFields.forEach((fName) => {
        const name = (fName || "").trim();
        if (name && !seenCategoryNames.has(name.toLowerCase())) {
          seenCategoryNames.add(name.toLowerCase());
          primaryCategoryNames.push(name);
        }
      });
    }

    // 2. Count active receipts per category name
    const catNameCounts = {};
    activeReceipts.forEach((r) => {
      const cName = getReceiptCategoryName(r, optMap);
      const key = cName.toLowerCase();
      catNameCounts[key] = (catNameCounts[key] || 0) + 1;
    });

    // 3. Include any extra categories present in existing receipts
    const extraCategoryNames = [];
    activeReceipts.forEach((r) => {
      const cName = getReceiptCategoryName(r, optMap);
      if (cName && !seenCategoryNames.has(cName.toLowerCase())) {
        seenCategoryNames.add(cName.toLowerCase());
        extraCategoryNames.push(cName);
      }
    });
    extraCategoryNames.sort((a, b) => a.localeCompare(b));

    const filterCategories = [...primaryCategoryNames, ...extraCategoryNames];

    // Normalize receiptCategoryFilter if previously set to an ID
    if (receiptCategoryFilter && receiptCategoryFilter !== "all") {
      if (optMap[receiptCategoryFilter]) {
        receiptCategoryFilter = optMap[receiptCategoryFilter];
      }
    }

    let catFilterHtml = `<option value="all" ${receiptCategoryFilter === "all" ? "selected" : ""}>All Categories (${activeReceipts.length})</option>`;
    filterCategories.forEach((catName) => {
      const count = catNameCounts[catName.toLowerCase()] || 0;
      const isSelected = receiptCategoryFilter.toLowerCase() === catName.toLowerCase();
      catFilterHtml += `<option value="${catName.replace(/"/g, "&quot;")}" ${isSelected ? "selected" : ""}>${catName} (${count})</option>`;
    });

    catFilterSelect.innerHTML = catFilterHtml;
  }

  // Filter receipts
  let filteredReceipts = activeReceipts;

  if (receiptCategoryFilter && receiptCategoryFilter !== "all") {
    const filterLower = receiptCategoryFilter.toLowerCase();
    filteredReceipts = filteredReceipts.filter((r) => {
      const rCatName = getReceiptCategoryName(r, optMap);
      return (
        rCatName.toLowerCase() === filterLower ||
        (r.categoryId && r.categoryId.toLowerCase() === filterLower)
      );
    });
  }

  if (receiptSearchQuery && receiptSearchQuery.trim()) {
    filteredReceipts = filteredReceipts.filter((r) => matchesReceiptFuzzy(r, receiptSearchQuery, optMap));
  }

  // Update stats & summary
  const summaryCountEl = document.getElementById("receiptResultsCount");
  const summaryTotalEl = document.getElementById("receiptResultsTotalSgd");
  const filteredTotalSgd = filteredReceipts.reduce((sum, r) => sum + (parseFloat(r.sgdAmount) || 0), 0);
  const allTotalSgd = activeReceipts.reduce((sum, r) => sum + (parseFloat(r.sgdAmount) || 0), 0);

  if (summaryCountEl) {
    if (receiptCategoryFilter !== "all" || (receiptSearchQuery && receiptSearchQuery.trim())) {
      summaryCountEl.innerHTML = `Showing ${filteredReceipts.length} of ${activeReceipts.length} receipts <button type="button" onclick="resetReceiptFilters()" class="ml-2 text-primary hover:underline font-bold text-xs cursor-pointer">Clear filters</button>`;
    } else {
      summaryCountEl.textContent = `${activeReceipts.length} ${activeReceipts.length === 1 ? "receipt" : "receipts"}`;
    }
  }

  if (summaryTotalEl) {
    if (receiptCategoryFilter !== "all" || (receiptSearchQuery && receiptSearchQuery.trim())) {
      summaryTotalEl.textContent = `Filtered Total: SGD ${filteredTotalSgd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      summaryTotalEl.textContent = `Total: SGD ${allTotalSgd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  // Render cards or empty state
  if (!listContainer) return;

  if (activeReceipts.length === 0) {
    listContainer.innerHTML = `
      <div class="w-full py-12 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800/40 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6">
        <div class="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-full mb-3">
          <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p class="text-sm font-black text-gray-700 dark:text-gray-300 mb-1">No Receipts Uploaded Yet</p>
        <p class="text-xs text-gray-400 dark:text-gray-500 text-center max-w-sm mb-4">Click "Upload Receipt" above to record official trip expenses.</p>
        <button type="button" onclick="toggleFinReceiptUpload()" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-md transition cursor-pointer">
          Upload First Receipt
        </button>
      </div>
    `;
    return;
  }

  if (filteredReceipts.length === 0) {
    listContainer.innerHTML = `
      <div class="w-full py-10 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800/40 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6">
        <svg class="w-10 h-10 mb-2 opacity-50 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p class="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">No receipts match your search or filter</p>
        <p class="text-xs text-gray-400 dark:text-gray-500 mb-3">Try adjusting your keywords or category filter</p>
        <button type="button" onclick="resetReceiptFilters()" class="px-3.5 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-xs font-bold transition cursor-pointer">
          Clear Search & Filters
        </button>
      </div>
    `;
    return;
  }

  let rowsHtml = "";
  filteredReceipts.forEach((r) => {
    const dateStr =
      typeof formatDDMmmYYYY === "function"
        ? formatDDMmmYYYY(r.ts)
        : new Date(r.ts).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
    const catName = optMap[r.categoryId] || "Unknown Category";

    let uploaderName = r.uploaderNric;
    let payerName = r.paidByNric || r.uploaderNric;

    if (globalLogistics && globalLogistics.participants) {
      const up = globalLogistics.participants.find((x) => x.nric === r.uploaderNric);
      if (up) uploaderName = up.shortName || up.name;
      else if (r.uploaderName) uploaderName = r.uploaderName;

      const pp = globalLogistics.participants.find((x) => x.nric === payerName);
      if (pp) payerName = pp.shortName || pp.name;
      else if (r.uploaderName && payerName === r.uploaderNric) payerName = r.uploaderName;
    }

    const isReimClass = r.isReimbursed
      ? "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-800 shadow-md"
      : "text-gray-500 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700";

    let rateHtml = "";
    if (r.currency !== "SGD" && r.amount > 0 && r.sgdAmount > 0) {
      const toSgd = (r.sgdAmount / r.amount).toFixed(2);
      const fromSgd = (r.amount / r.sgdAmount).toFixed(2);
      rateHtml = `
        <div class="mt-1 flex flex-col gap-0.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-lg border-2 border-gray-100 dark:border-gray-700/50">
          <div class="flex justify-between"><span>1 ${r.currency}</span><span>= ${toSgd} SGD</span></div>
          <div class="flex justify-between"><span>1 SGD</span><span>= ${fromSgd} ${r.currency}</span></div>
        </div>
      `;
    }

    rowsHtml += `
    <div id="receipt-card-${r.id}" class="bg-white dark:bg-gray-800/50 p-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-md flex flex-col md:flex-row md:items-center gap-3 relative transition hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600">
        <!-- Top row on mobile / Left group on desktop -->
        <div class="flex justify-between items-start md:items-center w-full md:w-auto md:flex-1">
            <div class="flex flex-col">
                <span class="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-0.5 tracking-wider uppercase">${dateStr}</span>
                <span class="text-sm font-black text-primary truncate max-w-[200px]" title="${catName}">${catName}</span>
                <div class="flex md:hidden flex-col mt-1.5 leading-tight">
                    <span class="text-xs font-bold text-gray-800 dark:text-gray-200 truncate max-w-[180px]">Up: ${uploaderName}</span>
                    <span class="text-[11px] font-black text-green-600 dark:text-green-400 uppercase truncate max-w-[180px]">Paid: ${payerName}</span>
                </div>
            </div>
            <div class="flex flex-col items-end md:hidden">
                <span class="text-xs font-bold text-gray-500 dark:text-gray-400">${r.currency} ${r.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                <span class="text-sm font-black text-purple-600 dark:text-purple-400 mt-0.5 mb-1">SGD ${r.sgdAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                ${rateHtml}
            </div>
        </div>

        <!-- Users on desktop -->
        <div class="hidden md:flex flex-col text-xs leading-tight md:w-[140px] shrink-0 border-l-2 border-gray-100 dark:border-gray-700 pl-4">
           <div class="font-bold text-gray-800 dark:text-gray-200 truncate" title="Uploaded by: ${uploaderName}">Up: ${uploaderName}</div>
           <div class="font-black text-green-600 dark:text-green-400 uppercase mt-0.5 truncate" title="Paid by: ${payerName}">Paid: ${payerName}</div>
        </div>
        
        <!-- Amounts on desktop -->
        <div class="hidden md:flex flex-col items-end text-right md:w-[120px] shrink-0 border-l-2 border-gray-100 dark:border-gray-700 pl-4">
            <span class="text-xs font-bold text-gray-500 dark:text-gray-400">${r.currency} ${r.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            <span class="text-sm font-black text-purple-600 dark:text-purple-400 mt-0.5">SGD ${r.sgdAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            ${rateHtml ? `<div class="w-full mt-1.5">${rateHtml}</div>` : ""}
        </div>

        <!-- Remarks -->
        ${r.remarks ? `<div class="text-xs font-medium text-gray-500 dark:text-gray-400 italic md:w-[140px] shrink-0 truncate md:border-l md:border-gray-100 dark:md:border-gray-700 md:pl-4" title="${r.remarks}">"${r.remarks}"</div>` : `<div class="hidden md:block md:w-[140px] shrink-0 md:border-l md:border-gray-100 dark:md:border-gray-700 md:pl-4"></div>`}

        <!-- Actions -->
        <div class="flex items-center justify-between md:justify-end gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-gray-700 w-full md:w-auto md:border-l md:border-gray-100 dark:md:border-gray-700 md:pl-4 shrink-0">
            <button id="btn-reimbursed-${r.id}" onclick="toggleReceiptReimbursed('${r.id}', ${!r.isReimbursed})" class="text-[10px] sm:text-xs font-bold px-2.5 py-1.5 rounded border transition focus:outline-none uppercase tracking-wider whitespace-nowrap ${isReimClass}">
                ${r.isReimbursed ? "Reimbursed" : "Pending"}
            </button>
            <div class="flex items-center gap-1.5">
                ${r.fileUrl ? `<a id="btn-view-receipt-${r.id}" href="${r.fileUrl}" target="_blank" class="text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400 p-1.5 bg-green-50 dark:bg-green-900/30 rounded focus:outline-none flex items-center justify-center transition" title="View Receipt"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></a>` : ""}
                <button id="btn-edit-receipt-${r.id}" onclick="openEditReceiptModal('${r.id}')" class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded focus:outline-none flex items-center justify-center cursor-pointer" title="Edit Receipt">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
                <button id="btn-delete-receipt-${r.id}" onclick="openDeleteReceiptModal('${r.id}')" class="text-red-500 hover:text-red-600 transition p-1.5 bg-red-50 dark:bg-red-900/30 rounded focus:outline-none flex items-center justify-center cursor-pointer" title="Delete Receipt">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
            </div>
        </div>
    </div>`;
  });

  listContainer.innerHTML = rowsHtml;
}

window.fuzzyMatchText = fuzzyMatchText;
window.matchesReceiptFuzzy = matchesReceiptFuzzy;
window.getReceiptCategoryName = getReceiptCategoryName;
window.populateFinReceiptCategories = populateFinReceiptCategories;
window.toggleFinReceiptUpload = toggleFinReceiptUpload;
window.finRecCurChange = finRecCurChange;
window.handleFinRecRateInputSync = handleFinRecRateInputSync;
window.finRecCalcSgd = finRecCalcSgd;
window.submitFinReceiptUpload = submitFinReceiptUpload;
window.handleReceiptSearch = handleReceiptSearch;
window.handleReceiptCategoryFilter = handleReceiptCategoryFilter;
window.resetReceiptFilters = resetReceiptFilters;
window.renderReceiptsBrowser = renderReceiptsBrowser;

function toggleReceiptReimbursed(id, status) {
  const rec = globalReceipts.find((r) => r.id === id);
  if (rec) {
    rec.isReimbursed = status;
    queueReceiptUpdate(rec);
    renderReceiptsBrowser();
  }
}

// ==========================================
// DELETE RECEIPT MODAL & FLOW
// ==========================================
function openDeleteReceiptModal(id) {
  const rec = globalReceipts.find((r) => r.id === id);
  if (!rec) return;
  pendingDeleteReceiptId = id;

  let optMap = {};
  if (financeConfig.finalOptionId) {
    const opt = financeOptions.find((o) => o.id === financeConfig.finalOptionId);
    if (opt) opt.fields.forEach((f) => (optMap[f.id] = f.name));
  }
  const catName = optMap[rec.categoryId] || rec.categoryId || "General Expense";

  let uploaderName = rec.uploaderNric;
  if (globalLogistics && globalLogistics.participants) {
    const up = globalLogistics.participants.find((x) => x.nric === rec.uploaderNric);
    if (up) uploaderName = `${up.shortName || up.name} (${rec.uploaderNric})`;
    else if (rec.uploaderName) uploaderName = `${rec.uploaderName} (${rec.uploaderNric})`;
  } else if (rec.uploaderName) {
    uploaderName = `${rec.uploaderName} (${rec.uploaderNric})`;
  }

  const dateStr =
    typeof formatDDMmmYYYY === "function"
      ? formatDDMmmYYYY(rec.ts)
      : new Date(rec.ts).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });

  const detailsEl = document.getElementById("deleteRecDetails");
  if (detailsEl) {
    detailsEl.innerHTML = `
      <div class="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
        <span class="text-gray-500 dark:text-gray-400">Category:</span>
        <span class="font-bold text-gray-900 dark:text-white">${catName}</span>
      </div>
      <div class="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
        <span class="text-gray-500 dark:text-gray-400">Amount:</span>
        <span class="font-bold text-gray-900 dark:text-white">${rec.currency} ${Number(rec.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} (SGD ${Number(rec.sgdAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })})</span>
      </div>
      <div class="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
        <span class="text-gray-500 dark:text-gray-400">Uploader:</span>
        <span class="font-bold text-gray-900 dark:text-white">${uploaderName}</span>
      </div>
      <div class="flex justify-between py-1 border-b border-gray-200 dark:border-gray-700">
        <span class="text-gray-500 dark:text-gray-400">Date:</span>
        <span class="font-bold text-gray-900 dark:text-white">${dateStr}</span>
      </div>
      ${rec.remarks ? `
      <div class="flex justify-between py-1">
        <span class="text-gray-500 dark:text-gray-400">Remarks:</span>
        <span class="font-bold text-gray-900 dark:text-white italic truncate max-w-[200px]">${rec.remarks}</span>
      </div>` : ""}
    `;
  }

  const modal = document.getElementById("deleteReceiptModal");
  if (modal) modal.classList.remove("hidden-force");
}

function closeDeleteReceiptModal() {
  pendingDeleteReceiptId = null;
  const modal = document.getElementById("deleteReceiptModal");
  if (modal) modal.classList.add("hidden-force");
}

async function executeDeleteReceiptConfirmed() {
  if (!pendingDeleteReceiptId) return;
  const id = pendingDeleteReceiptId;
  closeDeleteReceiptModal();

  const rec = globalReceipts.find((r) => r.id === id);
  if (rec) {
    rec.isDeleted = true;
    rec.ts = Date.now();
    locallyDeletedReceiptIds.add(id);
    pendingReceiptUpdates.set(id, rec);

    renderReceiptsBrowser();
    renderFinalizedFinances();
    renderFeeTracker();

    await executeReceiptSync();
    if (typeof showToast === "function") showToast("Receipt deleted successfully.");
  }
}

function deleteReceipt(id) {
  openDeleteReceiptModal(id);
}

// ==========================================
// EDIT RECEIPT MODAL & FLOW
// ==========================================
function openEditReceiptModal(id) {
  const rec = globalReceipts.find((r) => r.id === id);
  if (!rec) return;
  activeEditingReceipt = rec;

  const modal = document.getElementById("editReceiptModal");
  if (!modal) return;

  document.getElementById("editRecId").value = rec.id;
  document.getElementById("editRecTs").value = rec.ts || Date.now();
  document.getElementById("editRecIdLabel").textContent = `ID: ${rec.id}`;

  // Populate Participants dropdowns
  const uploaderSelect = document.getElementById("editRecUploaderSelect");
  const paidBySelect = document.getElementById("editRecPaidBySelect");

  let participantOptions = '<option value="">Select participant...</option>';
  if (globalLogistics && globalLogistics.participants) {
    const sorted = [...globalLogistics.participants].sort((a, b) => {
      const nameA = a.shortName || a.name || "";
      const nameB = b.shortName || b.name || "";
      return nameA.localeCompare(nameB);
    });
    sorted.forEach((p) => {
      const name = p.shortName || p.name || p.fullName || "";
      participantOptions += `<option value="${p.nric}">${name} (${p.nric}${p.role ? " - " + p.role : ""})</option>`;
    });
  }

  if (uploaderSelect) uploaderSelect.innerHTML = participantOptions;
  if (paidBySelect) paidBySelect.innerHTML = participantOptions;

  // Set uploader values
  if (uploaderSelect) uploaderSelect.value = rec.uploaderNric || "";
  document.getElementById("editRecUploaderNric").value = rec.uploaderNric || "";
  
  let currentUploaderName = rec.uploaderName || "";
  if (!currentUploaderName && globalLogistics && globalLogistics.participants) {
    const up = globalLogistics.participants.find((x) => x.nric === rec.uploaderNric);
    if (up) currentUploaderName = up.fullName || up.name || up.shortName || "";
  }
  document.getElementById("editRecUploaderName").value = currentUploaderName;

  // Set paid by values
  const payerNric = rec.paidByNric || rec.uploaderNric || "";
  if (paidBySelect) paidBySelect.value = payerNric;
  document.getElementById("editRecPaidByNric").value = payerNric;

  // Populate categories
  const categorySelect = document.getElementById("editRecCategory");
  let catOptions = "";
  let foundCategory = false;

  if (financeConfig.finalOptionId) {
    const opt = financeOptions.find((o) => o.id === financeConfig.finalOptionId);
    if (opt && opt.fields) {
      opt.fields.forEach((f) => {
        if (f.id === rec.categoryId) foundCategory = true;
        catOptions += `<option value="${f.id}">${f.name}</option>`;
      });
    }
  } else if (financeOptions.length > 0) {
    // Check all options
    const uniqueFields = new Map();
    financeOptions.forEach((o) => {
      if (o.fields) {
        o.fields.forEach((f) => uniqueFields.set(f.id, f.name));
      }
    });
    uniqueFields.forEach((name, fId) => {
      if (fId === rec.categoryId) foundCategory = true;
      catOptions += `<option value="${fId}">${name}</option>`;
    });
  }

  // Fees Payment Screenshot option
  if ("Fees Payment Screenshot" === rec.categoryId) foundCategory = true;
  catOptions += `<option value="Fees Payment Screenshot">Fees Payment Screenshot</option>`;

  // If the category ID is a custom or legacy ID, preserve it
  if (!foundCategory && rec.categoryId) {
    catOptions += `<option value="${rec.categoryId}">${rec.categoryId}</option>`;
  }

  if (categorySelect) {
    categorySelect.innerHTML = catOptions;
    categorySelect.value = rec.categoryId;
  }

  // Currency & Amounts
  const cur = rec.currency || "SGD";
  document.getElementById("editRecCurrency").value = cur;
  document.getElementById("editRecAmount").value = rec.amount !== undefined ? rec.amount : "";
  
  const rate = rec.rate || 1;
  document.getElementById("editRecRate").value = rate;
  document.getElementById("editRecInverseRate").value = rate > 0 ? parseFloat((1 / rate).toFixed(4)) : 1;
  document.getElementById("editRecSgdAmount").value = rec.sgdAmount !== undefined ? rec.sgdAmount : "";

  // File
  const fileLink = document.getElementById("editRecFileLink");
  const noFileText = document.getElementById("editRecNoFileText");
  const fileUrlInput = document.getElementById("editRecFileUrl");
  const fileInput = document.getElementById("editRecFileInput");
  if (fileInput) fileInput.value = "";

  if (rec.fileUrl) {
    if (fileLink) {
      fileLink.href = rec.fileUrl;
      fileLink.classList.remove("hidden-force");
    }
    if (noFileText) noFileText.classList.add("hidden-force");
    if (fileUrlInput) fileUrlInput.value = rec.fileUrl;
  } else {
    if (fileLink) fileLink.classList.add("hidden-force");
    if (noFileText) noFileText.classList.remove("hidden-force");
    if (fileUrlInput) fileUrlInput.value = "";
  }

  // Remarks
  document.getElementById("editRecRemarks").value = rec.remarks || "";

  // Reimbursed
  document.getElementById("editRecIsReimbursed").checked =
    rec.isReimbursed === true || String(rec.isReimbursed).toUpperCase() === "TRUE";

  handleEditCurrencyChange(cur);

  const errorEl = document.getElementById("editRecError");
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.classList.add("hidden-force");
  }

  modal.classList.remove("hidden-force");
}

function closeEditReceiptModal() {
  activeEditingReceipt = null;
  const modal = document.getElementById("editReceiptModal");
  if (modal) modal.classList.add("hidden-force");
}

function handleEditUploaderSelect(nric) {
  if (!nric) return;
  document.getElementById("editRecUploaderNric").value = nric;
  if (globalLogistics && globalLogistics.participants) {
    const up = globalLogistics.participants.find((x) => x.nric === nric);
    if (up) {
      document.getElementById("editRecUploaderName").value =
        up.fullName || up.name || up.shortName || "";
    }
  }

  const paidByNric = document.getElementById("editRecPaidByNric").value.trim();
  if (!paidByNric) {
    document.getElementById("editRecPaidByNric").value = nric;
    const paidBySelect = document.getElementById("editRecPaidBySelect");
    if (paidBySelect) paidBySelect.value = nric;
  }
}

function handleEditPaidBySelect(nric) {
  if (nric) {
    document.getElementById("editRecPaidByNric").value = nric;
  }
}

function handleEditCurrencyChange(currency) {
  const rateCurElements = document.querySelectorAll(".rateCurCode");
  rateCurElements.forEach((el) => (el.textContent = currency));

  const curLabel = document.getElementById("editRecCurLabel");
  if (curLabel) curLabel.textContent = currency;

  const rateContainer = document.getElementById("editRecRateContainer");

  if (currency === "SGD") {
    if (rateContainer) rateContainer.classList.add("hidden-force");
    document.getElementById("editRecRate").value = 1;
    document.getElementById("editRecInverseRate").value = 1;
    const amt = parseFloat(document.getElementById("editRecAmount").value) || 0;
    document.getElementById("editRecSgdAmount").value = amt.toFixed(2);
  } else {
    if (rateContainer) rateContainer.classList.remove("hidden-force");
    const currentRate = parseFloat(document.getElementById("editRecRate").value);
    if (isNaN(currentRate) || currentRate <= 0 || currentRate === 1) {
      const defaultRate =
        (financeConfig.customRates && financeConfig.customRates[currency]) ||
        globalFinanceRates[currency] ||
        (currency === "MYR" ? 0.28 : 1);
      document.getElementById("editRecRate").value = defaultRate;
      document.getElementById("editRecInverseRate").value =
        parseFloat((1 / defaultRate).toFixed(4));
    }
    handleEditAmountInput();
  }
}

function handleEditAmountInput() {
  const amt = parseFloat(document.getElementById("editRecAmount").value) || 0;
  const cur = document.getElementById("editRecCurrency").value;
  if (cur === "SGD") {
    document.getElementById("editRecSgdAmount").value = amt.toFixed(2);
  } else {
    const rate = parseFloat(document.getElementById("editRecRate").value) || 1;
    document.getElementById("editRecSgdAmount").value = (amt * rate).toFixed(2);
  }
}

function handleEditRateInput(val) {
  const r = parseFloat(val);
  if (r > 0) {
    document.getElementById("editRecInverseRate").value = parseFloat(
      (1 / r).toFixed(4),
    );
  }
  handleEditAmountInput();
}

function handleEditInverseRateInput(val) {
  const inv = parseFloat(val);
  if (inv > 0) {
    const r = 1 / inv;
    document.getElementById("editRecRate").value = parseFloat(r.toFixed(6));
    handleEditAmountInput();
  }
}

function handleEditSgdAmountInput() {
  const cur = document.getElementById("editRecCurrency").value;
  if (cur === "SGD") {
    document.getElementById("editRecAmount").value =
      document.getElementById("editRecSgdAmount").value;
  } else {
    const amt = parseFloat(document.getElementById("editRecAmount").value);
    const sgd = parseFloat(document.getElementById("editRecSgdAmount").value);
    if (amt > 0 && sgd > 0) {
      const r = sgd / amt;
      document.getElementById("editRecRate").value = parseFloat(r.toFixed(6));
      document.getElementById("editRecInverseRate").value = parseFloat(
        (1 / r).toFixed(4),
      );
    }
  }
}

async function saveEditedReceipt(e) {
  e.preventDefault();

  const id = document.getElementById("editRecId").value;
  const rec = globalReceipts.find((r) => r.id === id);
  if (!rec) {
    alert("Receipt not found.");
    return;
  }

  const saveBtn = document.getElementById("editRecSaveBtn");
  const errorEl = document.getElementById("editRecError");
  if (errorEl) errorEl.classList.add("hidden-force");

  const uploaderNric = document.getElementById("editRecUploaderNric").value.trim().toUpperCase();
  const uploaderName = document.getElementById("editRecUploaderName").value.trim();
  const paidByNric = (document.getElementById("editRecPaidByNric").value.trim() || uploaderNric).toUpperCase();
  const categoryId = document.getElementById("editRecCategory").value;
  const currency = document.getElementById("editRecCurrency").value;
  const amount = parseFloat(document.getElementById("editRecAmount").value);
  const rate = parseFloat(document.getElementById("editRecRate").value) || 1;
  const sgdAmount = parseFloat(document.getElementById("editRecSgdAmount").value);
  const remarks = document.getElementById("editRecRemarks").value.trim();
  const isReimbursed = document.getElementById("editRecIsReimbursed").checked;

  if (!uploaderNric) {
    if (errorEl) {
      errorEl.textContent = "Please enter the uploader NRIC.";
      errorEl.classList.remove("hidden-force");
    }
    return;
  }

  if (isNaN(amount) || amount < 0) {
    if (errorEl) {
      errorEl.textContent = "Please enter a valid amount.";
      errorEl.classList.remove("hidden-force");
    }
    return;
  }

  let finalFileUrl = document.getElementById("editRecFileUrl").value.trim() || rec.fileUrl || "";

  // Check if a new file was chosen
  const fileInput = document.getElementById("editRecFileInput");
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Uploading File...</span>
      `;
    }

    try {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result;
          const commaIdx = res.indexOf(",");
          resolve(commaIdx !== -1 ? res.substring(commaIdx + 1) : res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const uploadResp = await fetch("/api/upload-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          fileData: base64Data,
          API_URL: typeof SCRIPT_URL !== "undefined" ? SCRIPT_URL : "",
        }),
      });
      const uploadJson = await uploadResp.json();
      if (uploadJson && (uploadJson.fileUrl || uploadJson.localUrl)) {
        finalFileUrl = uploadJson.fileUrl || uploadJson.localUrl;
      }
    } catch (err) {
      console.warn("File upload error:", err);
    }
  }

  // Update receipt object
  rec.uploaderNric = uploaderNric;
  rec.uploaderName = uploaderName;
  rec.paidByNric = paidByNric;
  rec.categoryId = categoryId;
  rec.currency = currency;
  rec.amount = amount;
  rec.rate = rate;
  rec.sgdAmount = isNaN(sgdAmount) ? (amount * rate) : sgdAmount;
  rec.fileUrl = finalFileUrl;
  rec.remarks = remarks;
  rec.isReimbursed = isReimbursed;
  rec.ts = Date.now();

  pendingReceiptUpdates.set(rec.id, rec);

  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.innerHTML = "<span>Save Changes</span>";
  }

  closeEditReceiptModal();
  renderReceiptsBrowser();
  renderFinalizedFinances();
  renderFeeTracker();

  await executeReceiptSync();
  if (typeof showToast === "function") showToast("Receipt updated successfully!");
}

// ==========================================
// TAB 4: TRIP FEES TRACKER
// ==========================================
function handleFeeSearch() {
  const input = document.getElementById("feeSearchInput");
  finSearchQuery = input.value;
  const start = input.selectionStart;
  const end = input.selectionEnd;

  renderFeeTracker();

  const newInput = document.getElementById("feeSearchInput");
  if (newInput) {
    newInput.focus();
    try {
      newInput.setSelectionRange(start, end);
    } catch (e) {}
  }
}

function renderFeeTracker() {
  const cont = document.getElementById("fin-tab-fees");
  if (!cont || cont.classList.contains("hidden-force")) return;
  if (!globalLogistics || !globalLogistics.participants) return;

  const groups = {};
  globalLogistics.participants.forEach((p) => {
    let targetPoc = p.pocNric;

    if (!groups[targetPoc]) groups[targetPoc] = [];
    groups[targetPoc].push(p);
  });

  const baseFee = financeConfig.perPersonFee || 0;
  let totalExpected = 0;
  let totalCollected = 0;
  let cardsData = [];

  Object.keys(groups).forEach((poc) => {
    processFeeCard(poc, groups[poc]);
  });

  function processFeeCard(poc, members) {
    const size = members.length;
    const dev = financeConfig.feeDeviations?.[poc]?.amount || 0;
    const rem = financeConfig.feeDeviations?.[poc]?.remarks || "";
    const isPaid = financeConfig.feesReceived?.[poc] === true;

    const finalExpected = size * baseFee + dev;

    totalExpected += finalExpected;
    if (isPaid) totalCollected += finalExpected;

    let match = true;
    const searchLower = finSearchQuery.toLowerCase().trim();
    if (searchLower) {
      const _hash = poc
        .split("")
        .reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
      const orderNo =
        poc.substring(0, 4).toUpperCase() +
        "-" +
        Math.abs(_hash).toString(10).slice(-4).padStart(4, "0");
      const orderNoLower = orderNo.toLowerCase();
      match =
        members.some((m) => {
          const dName = String(m.shortName || "").toLowerCase();
          const fullName = String(m.fullName || m.name || "").toLowerCase();
          return (
            dName.includes(searchLower) ||
            fullName.includes(searchLower) ||
            m.nric.toLowerCase().includes(searchLower)
          );
        }) || orderNoLower.includes(searchLower);
    }

    if (match)
      cardsData.push({ poc, members, size, dev, rem, isPaid, finalExpected });
  }

  cardsData.sort((a, b) => {
    if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
    return b.size - a.size;
  });

  let cardsHtml = "";
  cardsData.forEach((c) => {
    let membersHtml = c.members
      .map((m) => {
        const roleColor =
          m.role === "TRAINEE"
            ? "text-green-600 dark:text-green-400"
            : m.role === "CAREGIVER"
              ? "text-purple-600 dark:text-purple-400"
              : "text-orange-600 dark:text-orange-400";
        return `<span class="inline-block mr-1.5"><span class="${roleColor} font-black text-[11px] mr-0.5 border border-current px-0.5 rounded">${m.role.substring(0, 3)}</span><span class="font-bold text-xs text-gray-800 dark:text-gray-200">${m.shortName || m.name}</span></span>`;
      })
      .join("");

    const paidClass = c.isPaid
      ? "bg-green-50 dark:bg-green-900/10 border-green-300 dark:border-green-800"
      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700";
    const checkColor = c.isPaid
      ? "text-green-600 dark:text-green-400 bg-green-200 dark:bg-green-900"
      : "text-transparent bg-gray-100 dark:bg-gray-700";

    cardsHtml += `
    <div class="flex flex-col p-3 rounded-xl border ${paidClass} shadow-md transition relative overflow-hidden h-full">
        <div class="flex justify-between items-start gap-3 mb-3">
            <div class="flex flex-col flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span class="text-[11px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded border-2 border-gray-200 dark:border-gray-700">Size: ${c.size}</span>
                    ${c.isPaid ? `<span class="text-[11px] font-black uppercase tracking-widest text-green-700 bg-green-200 dark:bg-green-900 px-1.5 py-0.5 rounded border-2 border-green-300 dark:border-green-700">Paid</span>` : ""}
                </div>
                <div class="leading-tight">${membersHtml}</div>
            </div>
            
            <div class="flex items-center gap-2 shrink-0">
                <button onclick="showContactPaymentPopup('${c.poc}')" class="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary hover:border-primary transition shadow-md focus:outline-none" title="Payment QR & Contact">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                </button>
                <button onclick="toggleFeeReceived('${c.poc}', ${!c.isPaid})" class="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center shrink-0 transition shadow-md hover:scale-110 focus:outline-none ${c.isPaid ? "border-green-500 ring-2 ring-green-400 ring-offset-1 dark:ring-offset-gray-900" : ""}">
                    <div class="w-6 h-6 rounded-full flex items-center justify-center transition-colors ${checkColor}">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                    </div>
                </button>
            </div>
        </div>
        
        ${(() => {
          const feeReceipts = globalReceipts
            .filter(
              (r) =>
                !r.isDeleted &&
                r.categoryId === "Fees Payment Screenshot" &&
                (r.uploaderNric === c.poc || r.paidByNric === c.poc),
            )
            .sort((a, b) => b.ts - a.ts);
          if (feeReceipts.length > 0 && feeReceipts[0].fileUrl) {
            return `
                <div class="mt-2 pt-2 border-t-2 border-gray-100 dark:border-gray-800">
                    <a href="${feeReceipts[0].fileUrl}" target="_blank" class="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 w-max">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                        View Uploaded Screenshot
                    </a>
                </div>
                `;
          }
          return "";
        })()}

        <div class="grid grid-cols-2 gap-2 p-2 bg-gray-50/50 dark:bg-gray-900/50 rounded-lg border-2 border-gray-100 dark:border-gray-800 mt-auto">
            <div>
                <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Deviation (+/- SGD)</label>
                <div class="relative flex items-center">
                    <span class="absolute left-2 text-xs font-bold text-gray-400">$</span>
                    <input type="text" id="dev-input-${c.poc}" value="${c.dev ? parseFloat(c.dev).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}" oninput="formatMoneyInput(this, false); updateDeviationLocal('${c.poc}', ${c.size}); if(!financeConfig.feeDeviations['${c.poc}']) financeConfig.feeDeviations['${c.poc}'] = {}; financeConfig.feeDeviations['${c.poc}'].amount = parseFloat(this.value.replace(/,/g, ''))||0; queueFinanceUpdate();" onblur="formatMoneyInput(this, true); updateFeeDeviation('${c.poc}', 'amount', this.value)" class="w-full pl-5 pr-2 py-1 text-xs font-bold border-2 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-950 focus:outline-none focus:border-primary shadow-md text-right h-[28px]" ${c.isPaid ? "disabled opacity-70" : ""}>
                </div>
            </div>
            <div>
                <label class="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Expected (SGD)</label>
                <div id="expected-display-${c.poc}" class="w-full px-2 py-1 text-sm font-black text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded border-2 border-green-200 dark:border-green-800 shadow-md text-right flex items-center justify-between h-[28px]">
                    <span class="text-xs opacity-50 font-bold mr-1">$</span><span>${c.finalExpected.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
            </div>
            <div class="col-span-2">
                <input type="text" value="${c.rem.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" onchange="updateFeeDeviation('${c.poc}', 'remarks', this.value)" placeholder="Remarks for deviation (e.g. Subsidy applied)" class="w-full px-2 py-1 text-xs font-medium border-2 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-950 focus:outline-none focus:border-primary shadow-md h-[28px]" ${c.isPaid ? "disabled opacity-70" : ""}>
            </div>
        </div>
    </div>`;
  });

  if (cont)
    cont.innerHTML = `
<div class="bg-white dark:bg-gray-900 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-800 p-2 mb-3 flex flex-col gap-2">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div class="flex flex-wrap items-center gap-2 md:gap-3">
            <div class="flex items-center gap-1.5">
                <label class="text-[11px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider">Per-Pax (SGD):</label>
                <div class="relative flex items-center">
                    <span class="absolute left-1.5 text-xs font-bold text-gray-400">$</span>
                    <input type="text" value="${baseFee ? parseFloat(baseFee).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}" oninput="formatMoneyInput(this, false); financeConfig.perPersonFee = parseFloat(this.value.replace(/,/g, ''))||0; queueFinanceUpdate();" onblur="formatMoneyInput(this, true); updateFinanceConfig('perPersonFee', parseFloat(this.value.replace(/,/g, ''))||0)" class="w-[72px] text-xs font-black border-2 border-gray-300 dark:border-gray-600 rounded pl-4 pr-1.5 py-1 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-md text-right">
                </div>
            </div>
            <div class="flex items-center gap-1.5">
                <label class="text-[11px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider">PayNow:</label>
                <input type="text" maxlength="8" value="${financeConfig.payNowNumber || ""}" onchange="updateFinanceConfig('payNowNumber', this.value.trim())" class="w-20 text-xs font-black border-2 border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-md text-center">
            </div>
            <label class="flex items-center gap-1.5 cursor-pointer bg-purple-50 dark:bg-purple-900/20 border ${financeConfig.showPaymentSection ? "border-purple-500" : "border-purple-200 dark:border-purple-800"} px-2.5 py-1 rounded-md transition-colors hover:bg-purple-100 dark:hover:bg-purple-900/40">
                <input type="checkbox" ${financeConfig.showPaymentSection ? "checked" : ""} onchange="updateFinanceConfig('showPaymentSection', this.checked)" class="w-3.5 h-3.5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded">
                <span class="text-[11px] md:text-xs uppercase font-black ${financeConfig.showPaymentSection ? "text-purple-700 dark:text-purple-400" : "text-gray-500 dark:text-gray-400"} tracking-wider">SHOW PAYMENT QR CODE</span>
            </label>
        </div>
        
        <div class="flex items-center gap-3 bg-gray-50 dark:bg-gray-950 px-3 py-1.5 rounded-lg border-2 border-gray-200 dark:border-gray-700 w-full md:w-auto justify-between md:justify-start">
            <div class="text-left">
                <span class="block text-[10px] uppercase font-bold text-gray-400 tracking-widest leading-none mb-0.5">Collected</span>
                <span class="text-xs font-black text-green-600 dark:text-green-400 leading-none">$ ${totalCollected.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="w-px h-5 bg-gray-300 dark:bg-gray-700 hidden md:block"></div>
            <div class="text-right md:text-left">
                <span class="block text-[10px] uppercase font-bold text-gray-400 tracking-widest leading-none mb-0.5">Expected Collection</span>
                <span class="text-xs font-black text-green-700 dark:text-green-400 leading-none">$ ${totalExpected.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
        </div>
    </div>
    
    <div class="relative">
        <input type="text" id="feeSearchInput" oninput="handleFeeSearch()" value="${finSearchQuery.replace(/"/g, "&quot;")}" placeholder="Fuzzy search families..." class="w-full py-1.5 pl-7 pr-7 border-2 border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-md transition">
        <svg class="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        <button onclick="clearSearch('feeSearchInput', 'handleFeeSearch')" class="absolute right-1.5 top-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
    </div>
</div>

<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
    ${cardsHtml || '<div class="col-span-full text-center py-6 text-gray-400 text-xs font-bold uppercase tracking-widest">No families match search.</div>'}
</div>
`;
}

window.updateDeviationLocal = function (poc, size) {
  const devInput = document.getElementById("dev-input-" + poc);
  const expectedDisplay = document.getElementById("expected-display-" + poc);
  if (!devInput || !expectedDisplay) return;
  const baseFee = financeConfig.perPersonFee || 0;
  const dev = parseFloat(devInput.value.replace(/,/g, "")) || 0;
  const finalExpected = size * baseFee + dev;
  if (expectedDisplay)
    expectedDisplay.innerHTML = `<span class="text-xs opacity-50 font-bold mr-1">$</span><span>${finalExpected.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>`;
};

function updateFeeDeviation(poc, field, value) {
  if (!financeConfig.feeDeviations) financeConfig.feeDeviations = {};
  if (!financeConfig.feeDeviations[poc])
    financeConfig.feeDeviations[poc] = { amount: 0, remarks: "" };

  if (field === "amount") {
    financeConfig.feeDeviations[poc].amount =
      parseFloat(String(value).replace(/,/g, "")) || 0;
  } else {
    financeConfig.feeDeviations[poc].remarks = value;
  }

  queueFinanceUpdate();
  renderFinalizedFinances();
}

function toggleFeeReceived(poc, status) {
  if (!financeConfig.feesReceived) financeConfig.feesReceived = {};
  financeConfig.feesReceived[poc] = status;
  queueFinanceUpdate();
  renderFeeTracker();
  renderFinalizedFinances();
}

function generateAdminPayNowStr(proxyType, proxyValue, amount, ref) {
  const formatTlv = (id, value) => {
    const len = value.length.toString().padStart(2, "0");
    return `${id}${len}${value}`;
  };
  const crc16 = (str) => {
    let crc = 0xffff;
    for (let c = 0; c < str.length; c++) {
      crc ^= str.charCodeAt(c) << 8;
      for (let i = 0; i < 8; i++) {
        if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
        else crc = crc << 1;
      }
    }
    return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
  };
  const pFormat = formatTlv("00", "01");
  const init = formatTlv("01", "12");
  const guid = formatTlv("00", "SG.PAYNOW");
  const type = formatTlv("01", proxyType);
  const val = formatTlv("02", proxyValue);
  const edit = formatTlv("03", "1");
  const accountInfo = formatTlv("26", guid + type + val + edit);
  const mcc = formatTlv("52", "0000");
  const cur = formatTlv("53", "702");
  const amt = formatTlv("54", parseFloat(amount).toFixed(2));
  const country = formatTlv("58", "SG");
  const merchant = formatTlv("59", "MYG Trip");
  const city = formatTlv("60", "Singapore");
  const additional = ref ? formatTlv("62", formatTlv("01", ref)) : "";
  let str =
    pFormat +
    init +
    accountInfo +
    mcc +
    cur +
    amt +
    country +
    merchant +
    city +
    additional +
    "6304";
  str += crc16(str);
  return str;
}

window.showContactPaymentPopup = function (pocNric) {
  let modal = document.getElementById("adminPaymentContactModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "adminPaymentContactModal";
    modal.className =
      "fixed inset-0 bg-black/60 z-[120] flex justify-center items-center p-4 backdrop-blur-sm hidden-force overflow-y-auto";
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl border-2 border-gray-200 dark:border-gray-700 animate-slide-up flex flex-col overflow-hidden my-auto relative">
            <button type="button" onclick="document.getElementById('adminPaymentContactModal').classList.add('hidden-force')" class="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 focus:outline-none">&times;</button>
            <div id="apcm-content" class="p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto custom-scrollbar"></div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden-force");
    });
  }

  if (!globalLogistics || !globalLogistics.participants) return;
  const members = globalLogistics.participants.filter(
    (p) => p.pocNric === pocNric,
  );
  if (!members.length) return;

  const baseFee = financeConfig.perPersonFee || 0;
  const size = members.length;
  const dev = financeConfig.feeDeviations?.[pocNric]?.amount || 0;
  const finalExpected = size * baseFee + dev;
  const isPaid = financeConfig.feesReceived?.[pocNric] === true;
  const pocMember = members.find((m) => m.nric === pocNric) || members[0];

  let linksHtml = "";
  if (pocMember.contact) {
    const cleanPhone = pocMember.contact.replace(/\D/g, "");
    linksHtml = `
            <div class="grid grid-cols-2 gap-3 mb-2">
                <a href="tel:${cleanPhone}" class="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 py-2.5 rounded-lg font-bold text-xs transition">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg> Call
                </a>
                <a href="https://wa.me/${cleanPhone.startsWith("65") ? cleanPhone : "65" + cleanPhone}" target="_blank" class="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-lg font-bold text-xs transition shadow-md">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg> WhatsApp
                </a>
            </div>
        `;
  }

  let qrHtml = "";
  const payNowNum = financeConfig.payNowNumber
    ? "+65" + financeConfig.payNowNumber
    : "";
  if (payNowNum && finalExpected > 0) {
    const _hash = pocNric
      .split("")
      .reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
    const orderNo =
      pocNric.substring(0, 4).toUpperCase() +
      "-" +
      Math.abs(_hash).toString(10).slice(-4).padStart(4, "0");
    const qrStr = generateAdminPayNowStr(
      "0",
      payNowNum,
      finalExpected,
      orderNo,
    );
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrStr)}`;
    qrHtml = `
            <div class="border-t-2 border-gray-100 dark:border-gray-700 pt-4 mt-2">
                <p class="text-[11px] font-bold uppercase tracking-widest text-center text-gray-500 dark:text-gray-400 mb-3">Family Payment QR</p>
                <div class="flex justify-center bg-white p-3 rounded-xl border-2 border-gray-200 w-max mx-auto shadow-md">
                    <img src="${qrUrl}" alt="PayNow QR" class="w-48 h-48 object-contain rounded">
                </div>
                <div class="text-center mt-3 text-xs font-bold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-900 rounded-lg py-2">
                    PayNow Ref: <span class="font-mono ml-1 text-primary">${orderNo}</span>
                </div>
            </div>
        `;
  } else if (finalExpected <= 0) {
    qrHtml = `<div class="border-t-2 border-gray-100 dark:border-gray-700 pt-4 mt-2 text-center text-xs font-bold text-gray-400">No pending fees.</div>`;
  } else {
    qrHtml = `<div class="border-t-2 border-gray-100 dark:border-gray-700 pt-4 mt-2 text-center text-xs font-bold text-gray-400">PayNow number not configured.</div>`;
  }

  const modalCont = document.getElementById("apcm-content");
  if (modalCont) {
    modalCont.innerHTML = `
        <div>
            <h3 class="text-base font-black text-gray-900 dark:text-white mb-1">Contact & Payment</h3>
            <p class="text-xs font-bold text-gray-500 mb-4 uppercase tracking-widest">POC: ${pocMember.shortName || pocMember.fullName}</p>
        </div>
        ${linksHtml}
        <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 mb-2">
            <span class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Expected</span>
            <span class="text-base font-black text-green-700 dark:text-green-400">$${finalExpected.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
        </div>
        ${qrHtml}
    `;
  }
  modal.classList.remove("hidden-force");
};

window.renderFinalizedFinances = renderFinalizedFinances;
window.calculateAndUpdateFinalized = renderFinalizedFinances;
window.getFeeSummaryTotals = getFeeSummaryTotals;
