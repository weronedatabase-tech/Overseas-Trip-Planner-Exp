const fs = require('fs');

// Patch main.js
let mainCode = fs.readFileSync('frontend/js/main.js', 'utf8');
mainCode = mainCode.replace(
    /if\(typeof loadParticipantsData === 'function'\) loadParticipantsData\(\);/,
    "setTimeout(() => window.location.reload(), 800);"
);
fs.writeFileSync('frontend/js/main.js', mainCode);

// Patch profile.js
let profileCode = fs.readFileSync('frontend/js/profile.js', 'utf8');
profileCode = profileCode.replace(
    /showToast\("Profile Updated!"\);\s*loadProfileData\(\);/,
    "showToast(\"Profile Updated!\");\n  setTimeout(() => window.location.reload(), 800);"
);
fs.writeFileSync('frontend/js/profile.js', profileCode);

console.log("Patched reloading.");
