const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

if (!code.includes('let hidePairedVols = false;')) {
    code = code.replace(/let altSwapMode = false;/, "let altSwapMode = false;\nlet hidePairedVols = false;\nlet hidePairedTrainees = false;\nwindow.toggleHidePaired = function(type, el) {\n  if (type === 'VOLUNTEER') hidePairedVols = el.checked;\n  if (type === 'TRAINEE') hidePairedTrainees = el.checked;\n  renderPairings();\n};\n");
}

let filterCode = `
const isSourceVol = !altSwapMode;
let sourceArr = isSourceVol ? vols : trainees;
let targetArr = isSourceVol ? trainees : vols;
`;

let replacementFilterCode = `
const isSourceVol = !altSwapMode;
let sourceArr = isSourceVol ? vols : trainees;
let targetArr = isSourceVol ? trainees : vols;

if (hidePairedVols) {
    const pairedVolNrics = new Set(activePairings.map(p => p.volNric));
    if (isSourceVol) sourceArr = sourceArr.filter(p => !pairedVolNrics.has(p.nric));
    else targetArr = targetArr.filter(p => !pairedVolNrics.has(p.nric));
}
if (hidePairedTrainees) {
    const pairedTraineeNrics = new Set(activePairings.map(p => p.traineeNric));
    if (!isSourceVol) sourceArr = sourceArr.filter(p => !pairedTraineeNrics.has(p.nric));
    else targetArr = targetArr.filter(p => !pairedTraineeNrics.has(p.nric));
}
`;
code = code.replace(filterCode.trim(), replacementFilterCode.trim());

// We need to change the headers to have checkboxes.
let headerCodeOld = `
sourceTitle.innerText = isSourceVol ? "Volunteers" : "Trainees";
targetTitle.innerText = isSourceVol ? "Trainees" : "Volunteers";
sourceTitle.className = \`font-black text-xs py-1.5 shrink-0 text-center uppercase tracking-widest shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b \${isSourceVol ? volTitleClass : traineeTitleClass}\`;
targetTitle.className = \`font-black text-xs py-1.5 shrink-0 text-center uppercase tracking-widest shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b \${!isSourceVol ? volTitleClass : traineeTitleClass}\`;
`;

let headerCodeNew = `
const volLabel = \`<div class="flex items-center justify-between px-2"><span></span><span>Volunteers</span><label class="flex items-center gap-1 cursor-pointer" onclick="event.stopPropagation()"><input type="checkbox" \${hidePairedVols ? 'checked' : ''} onchange="toggleHidePaired('VOLUNTEER', this)" class="w-3 h-3 text-orange-600 focus:ring-0 rounded-sm cursor-pointer"><span class="text-[9px] font-bold tracking-normal normal-case">Unpaired</span></label></div>\`;
const traineeLabel = \`<div class="flex items-center justify-between px-2"><span></span><span>Trainees</span><label class="flex items-center gap-1 cursor-pointer" onclick="event.stopPropagation()"><input type="checkbox" \${hidePairedTrainees ? 'checked' : ''} onchange="toggleHidePaired('TRAINEE', this)" class="w-3 h-3 text-green-600 focus:ring-0 rounded-sm cursor-pointer"><span class="text-[9px] font-bold tracking-normal normal-case">Unpaired</span></label></div>\`;

sourceTitle.innerHTML = isSourceVol ? volLabel : traineeLabel;
targetTitle.innerHTML = isSourceVol ? traineeLabel : volLabel;
sourceTitle.className = \`font-black text-xs py-1.5 shrink-0 text-center uppercase tracking-widest shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b \${isSourceVol ? volTitleClass : traineeTitleClass}\`;
targetTitle.className = \`font-black text-xs py-1.5 shrink-0 text-center uppercase tracking-widest shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b \${!isSourceVol ? volTitleClass : traineeTitleClass}\`;
`;

code = code.replace(headerCodeOld.trim(), headerCodeNew.trim());

// Changing the colors
code = code.replace(/const volColClass = "bg-green-50\/30 dark:bg-green-900\/10";/, 'const volColClass = "bg-orange-50/30 dark:bg-orange-900/10";');
code = code.replace(/const volTitleClass = "bg-green-100 dark:bg-green-900\/50 text-green-800 dark:text-green-300 border-b border-green-200 dark:border-green-800";/, 'const volTitleClass = "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 border-b border-orange-200 dark:border-orange-800";');

fs.writeFileSync('frontend/js/logistics.js', code);
