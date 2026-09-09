const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

// I am going to make clickHandler always applied to see if it fixes it, or at least check currentUser role case insensitive.
code = code.replace(
    /const isVol = currentUser && currentUser\.role === 'VOLUNTEER';/g,
    'const isVol = currentUser && (currentUser.role === \'VOLUNTEER\' || currentUser.role === \'volunteer\');'
);

// Actually, I should just make it clickable for anyone to see if that works, or I can just check if it's a z-index issue.
// Let's also add z-50 or relative z-10 to the span.
code = code.replace(
    /const clickHandler = isVol \? \`onclick="window\.showPairingDetails\('\$\{tp\.nric\}'\)" class="cursor-pointer hover:underline decoration-2 underline-offset-2"\` : '';/g,
    'const clickHandler = `onclick="window.showPairingDetails(\'${tp.nric}\')" class="cursor-pointer hover:underline decoration-2 underline-offset-2 relative z-10"`; // Always allow clicking for now to debug'
);

fs.writeFileSync('frontend/js/profile.js', code);
