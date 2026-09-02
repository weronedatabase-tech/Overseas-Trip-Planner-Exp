const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

code = code.replace(
    /pairingSyncTimeout = setTimeout\(\(\) => \{ executePairingSync\(\); \}, 800\);/,
    'pairingSyncTimeout = setTimeout(() => { executePairingSync(); }, 2500);'
);

code = code.replace(
    /roomSyncTimeout = setTimeout\(\(\) => \{ executeRoomSync\(\); \}, 1500\);/,
    'roomSyncTimeout = setTimeout(() => { executeRoomSync(); }, 2500);'
);

code = code.replace(
    /groupSyncTimeout = setTimeout\(executeGroupSync, 800\);/,
    'groupSyncTimeout = setTimeout(executeGroupSync, 2500);'
);

code = code.replace(
    /busSyncTimeout = setTimeout\(executeBusSync, 800\);/,
    'busSyncTimeout = setTimeout(executeBusSync, 2500);'
);

fs.writeFileSync('frontend/js/logistics.js', code);
