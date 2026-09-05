const fs = require('fs');
let content = fs.readFileSync('frontend/js/finance.js', 'utf8');

const target = `    const overlay = document.getElementById('finLoadingOverlay');
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
        ]);`;

const replacement = `    
    try {
        if(!globalLogistics) {
            try {
                const resLog = await apiCall('fetchLogistics'); 
                globalLogistics = resLog; 
                if (typeof processDisplayNames === "function") processDisplayNames(globalLogistics.participants);
                if (typeof applyGlobalSorting === "function") globalLogistics.participants = applyGlobalSorting(globalLogistics.participants);
            } catch(e) {}
        }

        if (window.financeConfig && window.financeConfig.ts) {
            // Already cached
            // do not fetch
        } else {
            const overlay = document.getElementById('finLoadingOverlay');
            if (overlay) overlay.classList.remove('hidden-force');
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

            window.financeConfig = financeConfig;
        }`;

content = content.replace(target, replacement);

fs.writeFileSync('frontend/js/finance.js', content);