const fs = require('fs');

let code = fs.readFileSync('backend/Code.js', 'utf8');

// Add saveCustomViewsOrder to doPost
code = code.replace(
  "case 'saveSortingRules': result = saveSortingRules(data.rules, data.callerNric); break;",
  "case 'saveSortingRules': result = saveSortingRules(data.rules, data.callerNric); break;\ncase 'saveCustomViewsOrder': result = saveCustomViewsOrder(data.order, data.callerNric); break;"
);

// Add customViewsOrder to getAppConfig
code = code.replace(
  "sortingRules: props.getProperty('SORTING_RULES') ? JSON.parse(props.getProperty('SORTING_RULES')) : ['project', 'family', 'role', 'name'], ",
  "sortingRules: props.getProperty('SORTING_RULES') ? JSON.parse(props.getProperty('SORTING_RULES')) : ['project', 'family', 'role', 'name'],\ncustomViewsOrder: props.getProperty('CUSTOM_VIEWS_ORDER') ? JSON.parse(props.getProperty('CUSTOM_VIEWS_ORDER')) : ['reset_filter', 'medical.html', 'diet.html', 'expired.html', 'other.html'],"
);

// Add saveCustomViewsOrder function
const funcStr = `
function saveCustomViewsOrder(order, callerNric) { PropertiesService.getScriptProperties().setProperty('CUSTOM_VIEWS_ORDER', JSON.stringify(order)); return { status: 'success', customViewsOrder: order }; }
`;
code = code.replace(
  "function saveSortingRules(rules, callerNric) { PropertiesService.getScriptProperties().setProperty('SORTING_RULES', JSON.stringify(rules)); return { status: 'success', sortingRules: rules }; }",
  "function saveSortingRules(rules, callerNric) { PropertiesService.getScriptProperties().setProperty('SORTING_RULES', JSON.stringify(rules)); return { status: 'success', sortingRules: rules }; }" + funcStr
);

fs.writeFileSync('backend/Code.js', code);
