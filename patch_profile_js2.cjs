const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const target = `shadow-sm animate-pulse text-purple-700`;
const replacement = `shadow-sm animate-pulse-button text-purple-700`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
} else {
    console.log("target not found in profile.js");
}

fs.writeFileSync('frontend/js/profile.js', code);
