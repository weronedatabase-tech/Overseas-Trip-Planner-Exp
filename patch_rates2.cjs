const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

const getFinanceDataStart = /function getFinanceData\(forceRebuild = false\) \{/g;
const repairLogic = `
function getFinanceData(forceRebuild = false) {
  const ss = getDatabase();
  let sheet = ss.getSheetByName("Finance Options");
  if (!sheet) {
    sheet = ss.insertSheet("Finance Options");
    sheet.getRange("A1").setValue("JSON Data - Do Not Edit");
  }
  
  // Repair old structure
  try {
      const firstRate = sheet.getRange("A3").getValue();
      if (firstRate === "Currency Setup" || !firstRate) {
          const formulas = [
              ["MYR", "SGD to MYR Rate:", '=GOOGLEFINANCE("CURRENCY:SGDMYR")'],
              ["USD", "SGD to USD Rate:", '=GOOGLEFINANCE("CURRENCY:SGDUSD")'],
              ["EUR", "SGD to EUR Rate:", '=GOOGLEFINANCE("CURRENCY:SGDEUR")'],
              ["GBP", "SGD to GBP Rate:", '=GOOGLEFINANCE("CURRENCY:SGDGBP")'],
              ["AUD", "SGD to AUD Rate:", '=GOOGLEFINANCE("CURRENCY:SGDAUD")'],
              ["IDR", "SGD to IDR Rate:", '=GOOGLEFINANCE("CURRENCY:SGDIDR")'],
              ["THB", "SGD to THB Rate:", '=GOOGLEFINANCE("CURRENCY:SGDTHB")'],
              ["JPY", "SGD to JPY Rate:", '=GOOGLEFINANCE("CURRENCY:SGDJPY")'],
              ["KRW", "SGD to KRW Rate:", '=GOOGLEFINANCE("CURRENCY:SGDKRW")'],
              ["TWD", "SGD to TWD Rate:", '=GOOGLEFINANCE("CURRENCY:SGDTWD")'],
              ["PHP", "SGD to PHP Rate:", '=GOOGLEFINANCE("CURRENCY:SGDPHP")'],
              ["VND", "SGD to VND Rate:", '=GOOGLEFINANCE("CURRENCY:SGDVND")']
          ];
          sheet.getRange(3, 1, formulas.length, 3).setValues(formulas);
          SpreadsheetApp.flush();
      }
  } catch(e) {}
`;

code = code.replace(/function getFinanceData\(forceRebuild = false\) \{[\s\S]*?let ratesObj = \{ "SGD": 1 \};/, repairLogic + '\nlet ratesObj = { "SGD": 1 };');

fs.writeFileSync('backend/Code.js', code);
console.log('Patched getFinanceData with repair');
