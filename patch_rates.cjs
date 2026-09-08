const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

const oldSetup = 'sheet.appendRow(["Currency Setup", "SGD to MYR Rate:", \'=GOOGLEFINANCE("CURRENCY:SGDMYR")\']);';
const newSetup = `
  sheet.appendRow(["MYR", "SGD to MYR Rate:", '=GOOGLEFINANCE("CURRENCY:SGDMYR")']);
  sheet.appendRow(["USD", "SGD to USD Rate:", '=GOOGLEFINANCE("CURRENCY:SGDUSD")']);
  sheet.appendRow(["EUR", "SGD to EUR Rate:", '=GOOGLEFINANCE("CURRENCY:SGDEUR")']);
  sheet.appendRow(["GBP", "SGD to GBP Rate:", '=GOOGLEFINANCE("CURRENCY:SGDGBP")']);
  sheet.appendRow(["AUD", "SGD to AUD Rate:", '=GOOGLEFINANCE("CURRENCY:SGDAUD")']);
  sheet.appendRow(["IDR", "SGD to IDR Rate:", '=GOOGLEFINANCE("CURRENCY:SGDIDR")']);
  sheet.appendRow(["THB", "SGD to THB Rate:", '=GOOGLEFINANCE("CURRENCY:SGDTHB")']);
  sheet.appendRow(["JPY", "SGD to JPY Rate:", '=GOOGLEFINANCE("CURRENCY:SGDJPY")']);
  sheet.appendRow(["KRW", "SGD to KRW Rate:", '=GOOGLEFINANCE("CURRENCY:SGDKRW")']);
  sheet.appendRow(["TWD", "SGD to TWD Rate:", '=GOOGLEFINANCE("CURRENCY:SGDTWD")']);
  sheet.appendRow(["PHP", "SGD to PHP Rate:", '=GOOGLEFINANCE("CURRENCY:SGDPHP")']);
  sheet.appendRow(["VND", "SGD to VND Rate:", '=GOOGLEFINANCE("CURRENCY:SGDVND")']);
`;

if (code.includes(oldSetup)) {
    code = code.replace(oldSetup, newSetup.trim());
} else if (code.includes('sheet.appendRow(["MYR", "SGD to MYR Rate:')) {
    // already patched
}

// In getFinanceData
const oldRates = 'ratesData.forEach(r => { if(r[0] && r[1] && !isNaN(r[2])) ratesObj[String(r[0])] = parseFloat(r[2]); });';
const newRates = 'ratesData.forEach(r => { if(r[0] && typeof r[0] === "string" && r[0].length === 3 && r[1] && !isNaN(r[2])) ratesObj[String(r[0])] = Math.round(parseFloat(r[2]) * 100) / 100; });';

if (code.includes(oldRates)) {
    code = code.replace(oldRates, newRates);
}

fs.writeFileSync('backend/Code.js', code);
console.log('Patched rates');
