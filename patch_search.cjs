const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

// 1. renderGroups
code = code.replace(
    /if \(query\) \{\s*const dName = \(p\.displayName \|\| p\.name\)\.toLowerCase\(\);\s*match = dName\.includes\(query\) \|\| p\.nric\.toLowerCase\(\)\.includes\(query\) \|\| pGroup\.toLowerCase\(\)\.includes\(query\);\s*\}/,
    `if (query) {
            const dName = (p.displayName || p.name).toLowerCase();
            const fullName = (p.name || '').toLowerCase();
            match = dName.includes(query) || fullName.includes(query) || p.nric.toLowerCase().includes(query) || pGroup.toLowerCase().includes(query);
        }`
);

// 2. renderBuses
code = code.replace(
    /if \(query\) \{\s*const dName = \(p\.displayName \|\| p\.name\)\.toLowerCase\(\);\s*match = dName\.includes\(query\) \|\| p\.nric\.toLowerCase\(\)\.includes\(query\) \|\| pBus\.toLowerCase\(\)\.includes\(query\);\s*\}/,
    `if (query) {
            const dName = (p.displayName || p.name).toLowerCase();
            const fullName = (p.name || '').toLowerCase();
            match = dName.includes(query) || fullName.includes(query) || p.nric.toLowerCase().includes(query) || pBus.toLowerCase().includes(query);
        }`
);

// 3. renderPairings matchFn
code = code.replace(
    /const matchFn = \(p\) => \{\s*const dName = \(p\.displayName \|\| p\.name\)\.toLowerCase\(\);\s*return dName\.includes\(query\) \|\| p\.nric\.toLowerCase\(\)\.includes\(query\) \|\| p\.group\.toLowerCase\(\)\.includes\(query\);\s*\};/,
    `const matchFn = (p) => {
        const dName = (p.displayName || p.name).toLowerCase();
        const fullName = (p.name || '').toLowerCase();
        return dName.includes(query) || fullName.includes(query) || p.nric.toLowerCase().includes(query) || p.group.toLowerCase().includes(query);
    };`
);

// 4. renderRooms filteredUnassigned
code = code.replace(
    /filteredUnassigned = unassignedArr\.filter\(p => \{\s*const dName = \(p\.displayName \|\| p\.name\)\.toLowerCase\(\);\s*return dName\.includes\(query\) \|\| p\.nric\.toLowerCase\(\)\.includes\(query\) \|\| p\.group\.toLowerCase\(\)\.includes\(query\);\s*\}\);/,
    `filteredUnassigned = unassignedArr.filter(p => {
        const dName = (p.displayName || p.name).toLowerCase();
        const fullName = (p.name || '').toLowerCase();
        return dName.includes(query) || fullName.includes(query) || p.nric.toLowerCase().includes(query) || p.group.toLowerCase().includes(query);
    });`
);

// 5. renderRooms activeRooms.filter
code = code.replace(
    /const dName = \(p\.displayName \|\| p\.name\)\.toLowerCase\(\);\s*return dName\.includes\(query\) \|\| p\.nric\.toLowerCase\(\)\.includes\(query\) \|\| p\.group\.toLowerCase\(\)\.includes\(query\);/,
    `const dName = (p.displayName || p.name).toLowerCase();
            const fullName = (p.name || '').toLowerCase();
            return dName.includes(query) || fullName.includes(query) || p.nric.toLowerCase().includes(query) || p.group.toLowerCase().includes(query);`
);

// 6. renderRooms isMatch inside loop
code = code.replace(
    /if \(query\) \{\s*isMatch = dName\.toLowerCase\(\)\.includes\(query\) \|\| p\.nric\.toLowerCase\(\)\.includes\(query\) \|\| p\.group\.toLowerCase\(\)\.includes\(query\);\s*\}/,
    `if (query) {
                const fullName = (p.name || '').toLowerCase();
                isMatch = dName.toLowerCase().includes(query) || fullName.includes(query) || p.nric.toLowerCase().includes(query) || p.group.toLowerCase().includes(query);
            }`
);

// 7. filterBottomSheet
code = code.replace(
    /function filterBottomSheet\(\) \{\s*const query = document\.getElementById\('sheetSearchInput'\)\.value\.toLowerCase\(\);\s*const items = document\.querySelectorAll\('\.sheet-list-item'\);\s*items\.forEach\(item => \{\s*if \(item\.dataset\.name\.includes\(query\)\) item\.classList\.remove\('hidden-force'\);\s*else item\.classList\.add\('hidden-force'\);\s*\}\);\s*\}/,
    `function filterBottomSheet() {
    const query = document.getElementById('sheetSearchInput').value.toLowerCase();
    const items = document.querySelectorAll('.sheet-list-item');
    items.forEach(item => {
        if (item.dataset.name.includes(query) || (item.dataset.fullname && item.dataset.fullname.includes(query))) {
            item.classList.remove('hidden-force');
        } else {
            item.classList.add('hidden-force');
        }
    });
}`
);

// 8. openPairingSheet dataset fullname
code = code.replace(
    /const dName = t\.displayName \|\| t\.name;\s*html \+\= \`<div onclick="confirmPairing\('\$\{t\.nric\}'\)" class="sheet-list-item flex flex-col bg-white dark:bg-gray-800 p-2\.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-\[0_1px_2px_rgba\(0,0,0,0\.05\)\] cursor-pointer hover:border-primary transition mb-1\.5" data-name="\$\{dName\.toLowerCase\(\)\}">/g,
    `const dName = t.displayName || t.name;
    const fullName = (t.name || '').toLowerCase();

    html += \`<div onclick="confirmPairing('\${t.nric}')" class="sheet-list-item flex flex-col bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] cursor-pointer hover:border-primary transition mb-1.5" data-name="\${dName.toLowerCase()}" data-fullname="\${fullName}">\`
    `
);

// 9. openRoomAddSheet dataset fullname
code = code.replace(
    /const dName = t\.displayName \|\| t\.name;\s*html \+\= \`<div onclick="confirmRoomAdd\('\$\{t\.nric\}'\)" class="sheet-list-item flex flex-col bg-white dark:bg-gray-800 p-2\.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-\[0_1px_2px_rgba\(0,0,0,0\.05\)\] cursor-pointer hover:border-primary transition mb-1\.5" data-name="\$\{dName\.toLowerCase\(\)\}">/g,
    `const dName = t.displayName || t.name;
    const fullName = (t.name || '').toLowerCase();

    html += \`<div onclick="confirmRoomAdd('\${t.nric}')" class="sheet-list-item flex flex-col bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] cursor-pointer hover:border-primary transition mb-1.5" data-name="\${dName.toLowerCase()}" data-fullname="\${fullName}">\`
    `
);


fs.writeFileSync('frontend/js/logistics.js', code);
