const fs = require('fs');
let content = fs.readFileSync('frontend/js/finance.js', 'utf8');

const regex = /catch\(e\) \{\}\s*\}/;

const replacement = `catch(e) {}
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

content = content.replace(regex, replacement);
fs.writeFileSync('frontend/js/finance.js', content);