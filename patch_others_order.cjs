const fs = require('fs');
let code = fs.readFileSync('frontend/js/ui.js', 'utf8');

// Remove 'Others' from NATIONALITIES_LIST
code = code.replace(
    /window\.NATIONALITIES_LIST = \[\.\.\.TOP_NATIONALITIES, \.\.\.OTHER_NATIONALITIES, 'Others'\];/,
    "window.NATIONALITIES_LIST = [...TOP_NATIONALITIES, ...OTHER_NATIONALITIES];"
);

const oldRenderListRegex = /const renderList = \(query\) => \{[\s\S]*?listCont\.innerHTML = html;/;
const newRenderList = `const renderList = (query) => {
        const q = (query || '').toLowerCase();
        let html = '';
        
        const filtered = window.NATIONALITIES_LIST.filter(n => n !== 'Others' && n.toLowerCase().includes(q));
        
        const othersHtml = \`<div class="p-2.5 border-b-2 border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-bold text-primary italic bg-green-50/50 dark:bg-green-900/20 nat-opt" data-val="Others">Others (Please specify)</div>\`;
        
        const mappedFiltered = filtered.map(n => {
            const isTop = TOP_NATIONALITIES.includes(n);
            let styling = isTop ? 'font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900/30' : 'font-medium text-gray-700 dark:text-gray-300';
            return \`<div class="p-2.5 border-b-2 border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-sm \${styling} nat-opt" data-val="\${n}">\${n}</div>\`;
        }).join('');

        if (q === '') {
            html += othersHtml + mappedFiltered;
        } else {
            if (filtered.length === 0) {
                html += '<div class="p-3 text-xs text-center text-gray-500">No results found in list. Use "Others" below to specify manually.</div>';
            } else {
                html += mappedFiltered;
            }
            html += othersHtml;
        }
        
        listCont.innerHTML = html;`;

code = code.replace(oldRenderListRegex, newRenderList);

fs.writeFileSync('frontend/js/ui.js', code);
console.log("Patched others order");
