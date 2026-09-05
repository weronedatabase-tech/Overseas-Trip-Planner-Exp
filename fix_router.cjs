const fs = require('fs');
let c = fs.readFileSync('frontend/js/main.js', 'utf8');
c = c.replace(
    /!link.getAttribute\('href'\).startsWith\('#'\) && !link.getAttribute\('target'\)/g,
    "!link.getAttribute('href').startsWith('#') && !link.getAttribute('href').startsWith('javascript:') && !link.getAttribute('target')"
);
fs.writeFileSync('frontend/js/main.js', c);