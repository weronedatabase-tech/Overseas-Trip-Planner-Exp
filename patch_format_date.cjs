const fs = require('fs');

let ui = fs.readFileSync('frontend/js/ui.js', 'utf8');
ui = ui.replace(
    'window.formatDDMmmYYYY = function(dateStr) {',
    'window.formatDDMmmYYYY = function(dateStr) {\n    if (dateStr instanceof Date) {\n        if (isNaN(dateStr.getTime())) return \'-\';\n        const day = String(dateStr.getDate()).padStart(2, \'0\');\n        const months = [\'Jan\', \'Feb\', \'Mar\', \'Apr\', \'May\', \'Jun\', \'Jul\', \'Aug\', \'Sep\', \'Oct\', \'Nov\', \'Dec\'];\n        return `${day} ${months[dateStr.getMonth()]} ${dateStr.getFullYear()}`;\n    }\n    if (typeof dateStr === \'number\') dateStr = new Date(dateStr);'
);
ui = ui.replace(
    'if (!dateStr || dateStr.trim() === \'\') return \'-\';',
    'if (!dateStr || (typeof dateStr === \'string\' && dateStr.trim() === \'\')) return \'-\';'
);
fs.writeFileSync('frontend/js/ui.js', ui);
