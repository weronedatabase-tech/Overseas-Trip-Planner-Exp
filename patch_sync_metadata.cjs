const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

code = code.replace(
  /case 'fetchRoomsOnly': result = fetchRoomsOnly\(\); break;/,
  `case 'fetchRoomsOnly': result = fetchRoomsOnly(); break;\ncase 'fetchSyncMetadata': result = fetchSyncMetadata(); break;\ncase 'updateSyncMetadata': result = updateSyncMetadata(data.payload); break;`
);

const newMethods = `
function fetchSyncMetadata() {
    const props = PropertiesService.getScriptProperties();
    return {
        status: 'success',
        groups: props.getProperty('LOGISTICS_GROUPS') ? JSON.parse(props.getProperty('LOGISTICS_GROUPS')) : [],
        buses: props.getProperty('LOGISTICS_BUSES') ? JSON.parse(props.getProperty('LOGISTICS_BUSES')) : [],
        junctures: props.getProperty('ATTENDANCE_JUNCTURES') ? JSON.parse(props.getProperty('ATTENDANCE_JUNCTURES')) : ['Morning Assembly']
    };
}
function updateSyncMetadata(payload) {
    const props = PropertiesService.getScriptProperties();
    if (payload.groups) props.setProperty('LOGISTICS_GROUPS', JSON.stringify(payload.groups));
    if (payload.buses) props.setProperty('LOGISTICS_BUSES', JSON.stringify(payload.buses));
    if (payload.junctures) props.setProperty('ATTENDANCE_JUNCTURES', JSON.stringify(payload.junctures));
    
    // Clear config cache so getAppConfig will pick it up (for junctures)
    clearCacheByPrefix('APP_CONFIG');
    
    return { status: 'success' };
}
`;

code += newMethods;
fs.writeFileSync('backend/Code.js', code);
console.log('Patched backend for sync metadata');
