const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

// Insert getSafeValues helper
if (!code.includes('function getSafeValues')) {
  const helper = `
function getSafeValues(range) {
  var tz = Session.getScriptTimeZone();
  try { tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(); } catch(e){}
  return range.getValues().map(function(row) {
    return row.map(function(cell) {
      if (cell instanceof Date) return Utilities.formatDate(cell, tz, "yyyy-MM-dd");
      return cell != null ? String(cell) : "";
    });
  });
}
`;
  code = code.replace('function doPost(e) {', helper + '\nfunction doPost(e) {');
}

// Replace .getValues() calls
code = code.replace(/([a-zA-Z0-9_$.]+(?:getRange|getDataRange)\([^)]*\))\.getValues\(\)/g, 'getSafeValues($1)');

code = code.replace(/([a-zA-Z0-9_]+)\.getValues\(\)/g, function(match, p1) {
  if (p1 === 'range') return match; 
  if (p1 === 'rowRange' || p1 === 'tRange' || p1 === 'vRange' || p1 === 'mRange' || p1 === 'juncRange' || p1 === 'volPairedRange' || p1 === 'searchRange') {
     return 'getSafeValues(' + p1 + ')';
  }
  return match;
});

fs.writeFileSync('backend/Code.js', code);
