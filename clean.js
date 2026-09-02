import fs from 'fs';
let mCode = fs.readFileSync('frontend/js/main.js', 'utf8');
mCode = mCode.replace(/window\.handleGpmRelatedSearch[\s\S]*?(?=\nwindow\.deleteParticipant|\nasync function deleteParticipant|\nfunction clearGpmSearch)/m, '');
fs.writeFileSync('frontend/js/main.js', mCode);

let pCode = fs.readFileSync('frontend/js/profile.js', 'utf8');
pCode = pCode.replace(/window\.handleProfileRelatedSearch[\s\S]*?(?=\nasync function saveProfileEdit|\nwindow\.saveProfileEdit)/m, '');
fs.writeFileSync('frontend/js/profile.js', pCode);
