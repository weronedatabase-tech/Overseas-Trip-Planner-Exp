const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

const newCardHtmlStr = `
    const dynColor = getProjectColor(item.group);
    const shortName = item.shortName || item.displayName || item.name;
    const roleColor = item.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (item.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
    const roleShort = item.role.substring(0,3).toUpperCase();
    const isFam = item.role === 'TRAINEE' && item.caregiverFor; 
    const cgBadge = item.caregiverFor ? \`<div class="mt-1 font-bold text-purple-600 dark:text-purple-400 text-[10px] uppercase">[\${item.caregiverFor}]</div>\` : '';
    
    return \`
    <div class="dnd-group-draggable relative bg-white dark:bg-gray-800 p-1 md:p-1.5 rounded-md border-2 border-gray-200 dark:border-gray-700 shadow-md cursor-grab active:cursor-grabbing hover:border-primary transition select-none flex flex-col gap-1 w-full" data-nric="\${item.nric}" onclick="openGroupAssignSheet('\${item.nric}')">
        <div class="font-bold text-gray-900 dark:text-gray-100 text-xs md:text-sm leading-tight whitespace-normal break-words">\${shortName.toUpperCase()}</div>
        <div class="flex items-center gap-1 flex-wrap">
            <span class="text-[10px] md:text-[10px] font-black \${roleColor} bg-gray-50 dark:bg-gray-800 px-1 py-[1px] leading-tight rounded-sm border-2 border-gray-200 dark:border-gray-700 uppercase tracking-wide">\${roleShort}</span>
            <span class="px-1 py-[1px] leading-tight rounded-sm border shadow-md text-[10px] md:text-[10px] font-bold \${dynColor} whitespace-normal break-words inline-block" title="\${(item.group || 'None').toUpperCase()}">\${getProjectAbbreviation(item.group || 'None')}</span>
        </div>
        \${cgBadge}
        \${isAssigned ? \`<div class="remove-x" onclick="unassignFromGroup('\${item.nric}')">×</div>\` : ''}
    </div>
    \`;
`;

const newBusHtmlStr = newCardHtmlStr.replace(/openGroupAssignSheet/g, 'openBusAssignSheet').replace(/unassignFromGroup/g, 'unassignFromBus').replace(/dnd-group-draggable/g, 'dnd-bus-draggable');

code = code.replace(
    /function generateGroupCardHtml\(item, isAssigned = false\) \{[\s\S]*?return \`[\s\S]*?    \}[\s\S]*?    \`;\n\}/,
    `function generateGroupCardHtml(item, isAssigned = false) {${newCardHtmlStr}}`
);

code = code.replace(
    /function generateBusCardHtml\(item, isAssigned = false\) \{[\s\S]*?return \`[\s\S]*?    \}[\s\S]*?    \`;\n\}/,
    `function generateBusCardHtml(item, isAssigned = false) {${newBusHtmlStr}}`
);

fs.writeFileSync('frontend/js/logistics.js', code);
console.log('Patched group and bus card html');
