const fs = require('fs');
let code = fs.readFileSync('frontend/js/attendance.js', 'utf8');

const longPressLogic = `
let attPressTimer = null;
let attIsLongPress = false;
let attStartX = 0;
let attStartY = 0;

window.attStartPress = function(e, nric, targetState) {
    if (e.type.startsWith('mouse') && e.button !== 0) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    attStartX = clientX;
    attStartY = clientY;
    attIsLongPress = false;
    attPressTimer = setTimeout(() => {
        attIsLongPress = true;
        if(typeof showParticipantSummaryModal === 'function') {
            showParticipantSummaryModal(nric);
        }
    }, 600);
};

window.attEndPress = function(e, nric, targetState) {
    if (attPressTimer) clearTimeout(attPressTimer);
    if (!attIsLongPress) {
        toggleAttendanceStatus(nric, targetState);
    }
    attIsLongPress = false;
};

window.attCancelPress = function(e) {
    if (attPressTimer) clearTimeout(attPressTimer);
    attIsLongPress = false;
};

window.attMovePress = function(e) {
    if (!attPressTimer) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    if (Math.abs(clientX - attStartX) > 15 || Math.abs(clientY - attStartY) > 15) {
        clearTimeout(attPressTimer);
    }
};
`;

code = code.replace(/function generateAttCard/, longPressLogic + '\nfunction generateAttCard');

code = code.replace(
  /onclick="toggleAttendanceStatus\('\$\{p\.nric\}', \$\{!isChecked\}\)"/,
  `onmousedown="attStartPress(event, '\${p.nric}', \${!isChecked})" onmouseup="attEndPress(event, '\${p.nric}', \${!isChecked})" onmouseleave="attCancelPress(event)" onmousemove="attMovePress(event)" ontouchstart="attStartPress(event, '\${p.nric}', \${!isChecked})" ontouchend="attEndPress(event, '\${p.nric}', \${!isChecked})" ontouchcancel="attCancelPress(event)" ontouchmove="attMovePress(event)"`
);

fs.writeFileSync('frontend/js/attendance.js', code);
console.log('Patched attendance long press');
