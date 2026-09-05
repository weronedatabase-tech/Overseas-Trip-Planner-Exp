const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

// We just replace .getValues() with .getDisplayValues()!
// Wait! Does .getDisplayValues() return the right dates? The user explicitly said:
// "explicitly cast all incoming spreadsheet values to strings before any formatting logic is applied"

// A simpler way: just wrap ANY .getValues() call (that is not already in getSafeValues) with our getSafeValues helper!
code = code.replace(/(\b[a-zA-Z0-9_$.]+(?:\.getRange\(.*?\)|\.getDataRange\(\)|\w+))\.getValues\(\)/g, function(match, p1) {
    if (p1 === 'range') return match;
    // Just find what's before .getValues() by counting parens back? No, let's just do a simple replacement for all lines with .getValues():
    return match; // skip regex, we'll do line by line processing
});

let lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.includes('.getValues()') && !line.includes('function getSafeValues') && !line.includes('range.getValues()')) {
        // e.g. const data = sheet.getRange(...).getValues();
        // -> const data = getSafeValues(sheet.getRange(...));
        
        // Find .getValues()
        let idx = line.indexOf('.getValues()');
        
        // We need to find the start of the range expression.
        // It's usually something like `sheet.getRange(...)` or `tRange`.
        // Let's just find the `=` sign or space before the expression?
        
        // Or simpler: replace `.getValues()` with `.getValues().map(row => row.map(cell => (cell instanceof Date) ? Utilities.formatDate(cell, Session.getScriptTimeZone(), "yyyy-MM-dd") : (cell != null ? String(cell) : "")))`
        
        lines[i] = line.replace(/\.getValues\(\)/g, '.getValues().map(row => row.map(cell => (cell instanceof Date) ? Utilities.formatDate(cell, Session.getScriptTimeZone(), "yyyy-MM-dd") : (cell != null ? String(cell) : "")))');
    }
}

fs.writeFileSync('backend/Code.js', lines.join('\n'));
