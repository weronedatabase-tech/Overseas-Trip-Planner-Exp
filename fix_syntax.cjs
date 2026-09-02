const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

code = code.replace(
    /data-fullname="\$\{fullName\}">\`\s*<div class="flex justify-between items-start w-full gap-2">/g,
    `data-fullname="\${fullName}">
    <div class="flex justify-between items-start w-full gap-2">`
);

fs.writeFileSync('frontend/js/logistics.js', code);
