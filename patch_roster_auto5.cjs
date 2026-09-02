const fs = require('fs');

let parts = fs.readFileSync('frontend/js/participants.js', 'utf8');

parts = parts.replace(
    /function initResize[\s\S]*?function onMouseUp\(e\) \{[\s\S]*?\}\n/g,
    ''
);

// Also remove global variables for resize if present
parts = parts.replace(/let resizingCol = null;\nlet startX = 0;\nlet startWidth = 0;\n/, '');

fs.writeFileSync('frontend/js/participants.js', parts);
