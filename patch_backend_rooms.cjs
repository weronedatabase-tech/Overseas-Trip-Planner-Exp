const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

code = code.replace(
    /if\(dataChanged\) sheet\.getRange\(1, 1, data\.length, data\[0\]\.length\)\.setValues\(data\);\s*\/\/ Atomic Write-Through Cache\s*fetchRoomsOnly\(true\);\s*fetchLogistics\(true\);\s*return fetchRoomsOnly\(\);/,
    `if(dataChanged) sheet.getRange(1, 1, data.length, data[0].length).setValues(data);

// Clear cache instead of forcing a full sync fetch
removeLargeCache(getCacheKey('ROOMS'));
removeLargeCache(getCacheKey('LOGISTICS'));
return fetchRoomsOnly();`
);

fs.writeFileSync('backend/Code.js', code);
