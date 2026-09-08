const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

let html = fs.readFileSync('finance.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "outside-only" });
const window = dom.window;
const document = window.document;

// Mock global variables
window.globalFinanceRates = { "SGD": 1, "MYR": 0.28 };
window.financeConfig = { customRates: {} };

let financeJs = fs.readFileSync('frontend/js/finance.js', 'utf8');
window.eval(financeJs);

try {
    window.openFinanceRatesModal();
    console.log("Modal classes:", document.getElementById('financeRatesModal').className);
    console.log("List innerHTML:", document.getElementById('financeRatesList').innerHTML);
} catch (e) {
    console.error(e);
}
