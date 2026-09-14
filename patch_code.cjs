const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

if (!code.includes('case \'modifyICJunctures\':')) {
    code = code.replace(
        "case 'modifyJunctures': result = modifyJunctures(data.actionType, data.oldName, data.newName); break;",
        "case 'modifyJunctures': result = modifyJunctures(data.actionType, data.oldName, data.newName); break;\ncase 'modifyICJunctures': result = modifyICJunctures(data.actionType, data.oldName, data.newName, data.groupName); break;"
    );
}

if (!code.includes('function modifyICJunctures')) {
    const fn = `
function modifyICJunctures(actionType, oldName, newName, groupName) {
    const props = PropertiesService.getScriptProperties(); 
    const key = 'IC_JUNCTURES_' + groupName.replace(/\\s+/g, '_').toUpperCase();
    let list = JSON.parse(props.getProperty(key) || '[]');
    if (actionType === 'add' && newName && !list.includes(newName)) list.push(newName);
    else if (actionType === 'remove' && oldName) list = list.filter(j => j !== oldName);
    else if (actionType === 'edit' && oldName && newName) { const idx = list.indexOf(oldName); if (idx > -1) list[idx] = newName; }
    props.setProperty(key, JSON.stringify(list)); 
    return { status: 'success', icJunctures: list };
}
`;
    code = code.replace('function saveSortingRules', fn + '\nfunction saveSortingRules');
}

// Ensure getProfile returns icJunctures
if (!code.includes('icJunctures: icJunctures')) {
    code = code.replace(
        "let groupMembers = [];",
        "let groupMembers = []; let icJunctures = [];"
    );
    code = code.replace(
        "const myGrp = String(currentUserRecord.logisticsGroup).trim();",
        "const myGrp = String(currentUserRecord.logisticsGroup).trim();\n const props = PropertiesService.getScriptProperties();\n icJunctures = JSON.parse(props.getProperty('IC_JUNCTURES_' + myGrp.replace(/\\s+/g, '_').toUpperCase()) || '[]');"
    );
    code = code.replace(
        "return { status: 'success', family: family, groupMembers: groupMembers, logisticsGroup: currentUserRecord.logisticsGroup, isGroupIC: currentUserRecord.isGroupIC };",
        "return { status: 'success', family: family, groupMembers: groupMembers, logisticsGroup: currentUserRecord.logisticsGroup, isGroupIC: currentUserRecord.isGroupIC, icJunctures: icJunctures };"
    );
}

fs.writeFileSync('backend/Code.js', code);
