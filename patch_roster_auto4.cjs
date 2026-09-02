const fs = require('fs');

let parts = fs.readFileSync('frontend/js/participants.js', 'utf8');

parts = parts.replace(
    /<div class="resize-handle"[^>]*><\/div>/g,
    ''
);

fs.writeFileSync('frontend/js/participants.js', parts);
