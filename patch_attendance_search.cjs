const fs = require('fs');
const path = './frontend/js/attendance.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove attSearchResults
content = content.replace(
    `<ul id="attSearchResults" class="absolute z-20 w-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-md shadow-2xl mt-1 max-h-56 overflow-y-auto hidden-force custom-scrollbar"></ul>`,
    ``
);

// 2. Remove click listener
const listenerRegex = /document\.addEventListener\('click',\s*\(e\)\s*=>\s*\{[\s\S]*?\}\);/;
content = content.replace(listenerRegex, '');

// 3. Update renderAttendanceLists' filter
const filterOld = `const participants = globalLogistics.participants.filter(p => {
    if (assignment === 'ALL') return true;
    if (assignment.startsWith('PROJ::')) return p.group === assignment.split('::')[1];
    if (assignment.startsWith('GRP::')) return p.logisticsGroup === assignment.split('::')[1];
    if (assignment.startsWith('BUS::')) return p.bus === assignment.split('::')[1];
    return p.group === assignment;
});`;

const filterNew = `const participants = globalLogistics.participants.filter(p => {
    let matchAssignment = false;
    if (assignment === 'ALL') matchAssignment = true;
    else if (assignment.startsWith('PROJ::')) matchAssignment = (p.group === assignment.split('::')[1]);
    else if (assignment.startsWith('GRP::')) matchAssignment = (p.logisticsGroup === assignment.split('::')[1]);
    else if (assignment.startsWith('BUS::')) matchAssignment = (p.bus === assignment.split('::')[1]);
    else matchAssignment = (p.group === assignment);
    
    if (!matchAssignment) return false;
    
    const searchInput = document.getElementById('attSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    if (query) {
        const dName = p.displayName || p.name || '';
        const fullName = p.name || '';
        if (!dName.toLowerCase().includes(query) && !fullName.toLowerCase().includes(query)) return false;
    }
    return true;
});`;

content = content.replace(filterOld, filterNew);

// 4. Update handleAttendanceSearch
const handleSearchRegex = /function handleAttendanceSearch\(\)\s*\{[\s\S]*?\}\s*function selectFromSearch\(nric\)\s*\{[\s\S]*?\}/;
content = content.replace(handleSearchRegex, `function handleAttendanceSearch() {\n  renderAttendanceLists();\n}`);

if (content.includes('function selectFromSearch')) {
   // Fallback in case the regex above missed something due to formatting
   const handleSearchFallback = /function handleAttendanceSearch\(\)\s*\{[\s\S]*?resultsContainer\.classList\.remove\('hidden-force'\);\n\}/;
   content = content.replace(handleSearchFallback, `function handleAttendanceSearch() {\n  renderAttendanceLists();\n}`);
}

// 5. Update hasChanges block in startAttendancePolling
const hasChangesOld = `     if(hasChanges) {
         renderAttendanceLists();
         const searchInput = document.getElementById('attSearchInput');
         const searchResults = document.getElementById('attSearchResults');
         if (searchInput && searchInput.value && searchResults && !searchResults.classList.contains('hidden-force')) {
             handleAttendanceSearch();
         }
     }`;

const hasChangesNew = `     if(hasChanges) {
         renderAttendanceLists();
     }`;
content = content.replace(hasChangesOld, hasChangesNew);


fs.writeFileSync(path, content, 'utf8');
console.log("Attendance search patched.");
