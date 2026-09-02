const fs = require('fs');

let parts = fs.readFileSync('frontend/js/participants.js', 'utf8');

const strToReplace = `function initResize(e, colId) {
e.stopPropagation();
resizingCol = colId;
if (e.touches) {
   startX = e.touches[0].clientX;
} else {
   startX = e.clientX;
}
const colDef = colId === 'fullName' ? {width: Math.min(250, window.innerWidth / 3)} : rosterCols.find(c => c.id === colId);
startWidth = colDef.width || 150;
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mouseup', onMouseUp);
document.addEventListener('touchmove', onMouseMove, {passive: false});
document.addEventListener('touchend', onMouseUp);
}

function onMouseMove(e) {
if (!resizingCol) return;
let clientX = e.touches ? e.touches[0].clientX : e.clientX;
const diff = clientX - startX;
let newWidth = Math.max(50, startWidth + diff);

if (resizingCol === 'fullName') {
   const cells = document.querySelectorAll('.roster-col-fullName');
   cells.forEach(c => { c.style.width = newWidth + 'px'; c.style.minWidth = newWidth + 'px'; c.style.maxWidth = newWidth + 'px'; });
} else {
   const cDef = rosterCols.find(c => c.id === resizingCol);
   if (cDef) {
       cDef.width = newWidth;
       const cells = document.querySelectorAll(\`.roster-col-\${resizingCol}\`);
       cells.forEach(c => { c.style.width = newWidth + 'px'; c.style.minWidth = newWidth + 'px'; c.style.maxWidth = newWidth + 'px'; });
   }
}
}

function onMouseUp() {
if (resizingCol && resizingCol !== 'fullName') {
   localStorage.setItem('rosterCols', JSON.stringify(rosterCols));
}
resizingCol = null;
document.removeEventListener('mousemove', onMouseMove);
document.removeEventListener('mouseup', onMouseUp);
document.removeEventListener('touchmove', onMouseMove);
document.removeEventListener('touchend', onMouseUp);
}`;

parts = parts.replace(strToReplace, '');

fs.writeFileSync('frontend/js/participants.js', parts);
