const fs = require('fs');

let parts = fs.readFileSync('frontend/js/participants.js', 'utf8');

parts = parts.replace(
    /if \(typeof resizingCol !== 'undefined' && resizingCol\) \{\n    e\.preventDefault\(\);\n    return;\n\}/g,
    ''
);

// Fallback in case resizingCol is not wrapped in typeof
parts = parts.replace(
    /if \(resizingCol\) \{\n    e\.preventDefault\(\);\n    return;\n\}/g,
    ''
);

fs.writeFileSync('frontend/js/participants.js', parts);
