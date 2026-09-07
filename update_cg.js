const fs = require('fs');
let code = fs.readFileSync('frontend/js/participants.js', 'utf8');

code = code.replace(/const groups = new Set\(\);/, 'const groups = new Set();');
// We need to modify openChatGroupsModal and generateChatGroupsList
