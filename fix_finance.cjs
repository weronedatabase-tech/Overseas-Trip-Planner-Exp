const fs = require('fs');
let content = fs.readFileSync('frontend/js/finance.js', 'utf8');

const target = `    if(!globalLogistics) {
        try {
            const resLog = await apiCall('fetchLogistics'); 
            globalLogistics = resLog; 
            if (typeof processDisplayNames === "function") processDisplayNames(globalLogistics.participants);
            if (typeof applyGlobalSorting === "function") globalLogistics.participants = applyGlobalSorting(globalLogistics.participants);
        } catch(e) {}
    }`;

const replacement = `    if(!globalLogistics) {
        try {
            const resLog = await apiCall('fetchLogistics'); 
            globalLogistics = resLog; 
            if (typeof processDisplayNames === "function") processDisplayNames(globalLogistics.participants);
            if (typeof applyGlobalSorting === "function") globalLogistics.participants = applyGlobalSorting(globalLogistics.participants);
        } catch(e) {}
    }

    if (window.financeConfig && window.financeConfig.ts) {
        financeConfig = window.financeConfig;
        financeOptions = window.financeOptions;
        globalFinanceRates = window.globalFinanceRates;
        globalReceipts = window.globalReceipts;
        
        renderAllFinanceTabs();
        startFinancePolling();
        const loader = document.getElementById('finLoadingOverlay');
        if(loader) loader.classList.add('hidden-force');
        return;
    }`;

content = content.replace(target, replacement);

const target2 = `        if(opt._isCollapsed === undefined) opt._isCollapsed = isFinanceCollapsed;
        return opt;
    });`;

const replacement2 = `        if(opt._isCollapsed === undefined) opt._isCollapsed = isFinanceCollapsed;
        return opt;
    });
    
    window.financeConfig = financeConfig;
    window.financeOptions = financeOptions;
    window.globalFinanceRates = globalFinanceRates;
    window.globalReceipts = globalReceipts;`;

content = content.replace(target2, replacement2);
fs.writeFileSync('frontend/js/finance.js', content);