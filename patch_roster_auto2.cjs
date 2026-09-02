const fs = require('fs');

let parts = fs.readFileSync('frontend/js/participants.js', 'utf8');

// The first replacement we did targeted both header and td styles for `c.width`
// The header one is:
// <th ... style="white-space: nowrap; padding-left: 12px; padding-right: 12px;" ...

// We want to replace `const styleStr = \`style="white-space: nowrap; padding-left: 12px; padding-right: 12px;"\`;`
// with `const styleStr = \`\`;`

parts = parts.replace(
    'const styleStr = `style="white-space: nowrap; padding-left: 12px; padding-right: 12px;"`;',
    'const styleStr = ``;'
);

fs.writeFileSync('frontend/js/participants.js', parts);
