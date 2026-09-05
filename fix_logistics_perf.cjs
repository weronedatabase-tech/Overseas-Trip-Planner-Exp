const fs = require('fs');
let content = fs.readFileSync('frontend/js/logistics.js', 'utf8');

const regex = /async function loadLogisticsData\(\) \{\s*const overlay = document\.getElementById\('logLoadingOverlay'\);\s*if \(overlay\) overlay\.classList\.remove\('hidden-force'\);/m;

const replacement = `async function loadLogisticsData() { 
if (globalLogistics && globalLogistics.rooms) {
    if (typeof processDisplayNames === "function") processDisplayNames(globalLogistics.participants);
    if (typeof applyGlobalSorting === "function") globalLogistics.participants = applyGlobalSorting(globalLogistics.participants);
    renderPairings();
    renderRooms();
    renderGroups();
    renderBuses();
    const overlay = document.getElementById('logLoadingOverlay');
    if(overlay) overlay.classList.add('hidden-force');
    return;
}
const overlay = document.getElementById('logLoadingOverlay');
if (overlay) overlay.classList.remove('hidden-force');`;

content = content.replace(regex, replacement);
fs.writeFileSync('frontend/js/logistics.js', content);