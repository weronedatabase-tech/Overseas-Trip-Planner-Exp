const fs = require('fs');
let content = fs.readFileSync('frontend/js/logistics.js', 'utf8');
content = content.replace(
  'async function loadLogisticsData() {\nconst overlay = document.getElementById(\'logLoadingOverlay\');\nif (overlay) overlay.classList.remove(\'hidden-force\');',
  `async function loadLogisticsData() {
if (globalLogistics && globalLogistics.rooms) {
    if (typeof processDisplayNames === "function") processDisplayNames(globalLogistics.participants);
    if (typeof applyGlobalSorting === "function") globalLogistics.participants = applyGlobalSorting(globalLogistics.participants);
    renderPairings();
    renderRooms();
    renderGroups();
    renderBuses();
    return;
}
const overlay = document.getElementById('logLoadingOverlay');
if (overlay) overlay.classList.remove('hidden-force');`
);
fs.writeFileSync('frontend/js/logistics.js', content);
