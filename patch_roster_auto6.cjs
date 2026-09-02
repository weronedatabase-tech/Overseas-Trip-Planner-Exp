const fs = require('fs');

let parts = fs.readFileSync('frontend/js/participants.js', 'utf8');

const s1 = parts.indexOf('let resizingCol = null;');
if (s1 !== -1) {
    const e1 = parts.indexOf(';', parts.indexOf('let startWidth = 0')) + 1;
    parts = parts.substring(0, s1) + parts.substring(e1);
}

const s2 = parts.indexOf('function initResize');
if (s2 !== -1) {
    let e2 = parts.indexOf('function onMouseUp');
    e2 = parts.indexOf('}', e2);
    // Find the end of onMouseUp
    e2 = parts.indexOf('}', e2 + 1); // might need to go one more depending on blocks
    // Let's just use simple match
    parts = parts.replace(/function initResize\(e, colId\) \{[\s\S]*?function onMouseUp\(e\) \{[\s\S]*?\}\s*\}/, '');
}
fs.writeFileSync('frontend/js/participants.js', parts);
