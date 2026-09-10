const fs = require('fs');
const path = './frontend/js/attendance.js';
let content = fs.readFileSync(path, 'utf8');

const targetFn = `function generateAttCard(p, isChecked) {
const dynColor = getProjectColor(p.group);
const roleColor = p.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (p.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
const roleShort = p.role.substring(0,3).toUpperCase();
const dName = p.displayName || p.name;

return \`
<div id="att-card-\${p.nric}" class="relative bg-white dark:bg-gray-800 p-1.5 md:p-2 rounded border-2 border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-300 flex items-center justify-between gap-1 select-none active:scale-95 cursor-pointer hover:border-primary dark:hover:border-primary" onclick="toggleAttendanceStatus('\${p.nric}', \${!isChecked})">
  <div class="flex items-start min-w-0 flex-1">
      <div class="flex flex-col min-w-0 flex-1 gap-1">
          <span class="font-extrabold text-sm md:text-[12px] px-1.5 py-0.5 rounded shadow-md border \${dynColor} max-w-full break-words whitespace-normal leading-[1.1] text-left inline-block self-start" style="overflow-wrap: break-word;">\${dName}</span>
          <span class="text-[10px] font-black \${roleColor} w-max bg-gray-50 dark:bg-gray-700 px-1 py-0.5 rounded uppercase tracking-wider border-2 border-gray-100 dark:border-gray-600">\${roleShort}</span>
      </div>
  </div>
  <div class="shrink-0 flex items-center justify-center pl-1">
     <div class="w-5 h-5 rounded flex items-center justify-center border transition-colors \${isChecked ? 'bg-green-500 border-green-600 text-white shadow-inner' : 'bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-transparent'}">
         <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
     </div>
  </div>
</div>\`;
}`;

const replacementFn = `let attLongPressTimer = null;
let attLongPressFired = false;

window.startAttLongPress = function(nric, event) {
    attLongPressFired = false;
    if (event.type === 'mousedown' && event.button !== 0) return;
    
    attLongPressTimer = setTimeout(() => {
        attLongPressFired = true;
        if (typeof showParticipantSummaryModal === 'function') {
            showParticipantSummaryModal(nric);
        }
    }, 600); // 600ms for long press
};

window.cancelAttLongPress = function(event) {
    if (attLongPressTimer) {
        clearTimeout(attLongPressTimer);
        attLongPressTimer = null;
    }
};

window.handleAttClick = function(nric, isChecked, event) {
    if (attLongPressFired) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    toggleAttendanceStatus(nric, !isChecked);
};

function generateAttCard(p, isChecked) {
const dynColor = getProjectColor(p.group);
const roleColor = p.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (p.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
const roleShort = p.role.substring(0,3).toUpperCase();
const dName = p.displayName || p.name;

let relatedTraineeHtml = '';
if (p.role === 'CAREGIVER') {
    let tName = '';
    if (globalLogistics && globalLogistics.participants) {
        const myPoc = p.pocNric || p.nric;
        const trainee = globalLogistics.participants.find(x => x.role === 'TRAINEE' && (x.pocNric || x.nric) === myPoc);
        if (trainee) {
            tName = trainee.shortName || trainee.name;
        } else if (p.relatedTrainee) {
            tName = p.relatedTrainee;
        }
    }
    if (tName) {
        relatedTraineeHtml = \`<div class="text-[10px] text-gray-500 dark:text-gray-400 font-bold mt-0.5 leading-tight max-w-full break-words whitespace-normal" style="overflow-wrap: break-word;">[\${tName}]</div>\`;
    }
}

return \`
<div id="att-card-\${p.nric}" class="relative bg-white dark:bg-gray-800 p-1.5 md:p-2 rounded border-2 border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-300 flex items-center justify-between gap-1 select-none active:scale-95 cursor-pointer hover:border-primary dark:hover:border-primary" 
  onpointerdown="startAttLongPress('\${p.nric}', event)" 
  onpointerup="cancelAttLongPress(event)" 
  onpointerleave="cancelAttLongPress(event)" 
  onpointercancel="cancelAttLongPress(event)"
  oncontextmenu="if(attLongPressFired) { event.preventDefault(); return false; }"
  onclick="handleAttClick('\${p.nric}', \${isChecked}, event)">
  <div class="flex items-start min-w-0 flex-1">
      <div class="flex flex-col min-w-0 flex-1 gap-1">
          <span class="font-extrabold text-sm md:text-[12px] px-1.5 py-0.5 rounded shadow-md border \${dynColor} max-w-full break-words whitespace-normal leading-[1.1] text-left inline-block self-start" style="overflow-wrap: break-word;">\${dName}</span>
          \${relatedTraineeHtml}
          <span class="text-[10px] font-black \${roleColor} w-max bg-gray-50 dark:bg-gray-700 px-1 py-0.5 rounded uppercase tracking-wider border-2 border-gray-100 dark:border-gray-600 mt-0.5">\${roleShort}</span>
      </div>
  </div>
  <div class="shrink-0 flex items-center justify-center pl-1">
     <div class="w-5 h-5 rounded flex items-center justify-center border transition-colors \${isChecked ? 'bg-green-500 border-green-600 text-white shadow-inner' : 'bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-transparent'}">
         <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
     </div>
  </div>
</div>\`;
}`;

if (content.includes(targetFn)) {
    content = content.replace(targetFn, replacementFn);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Patched generateAttCard successfully.");
} else {
    console.log("Could not find generateAttCard to patch.");
}
