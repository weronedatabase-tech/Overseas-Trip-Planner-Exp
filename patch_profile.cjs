const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

// 1. Add caregiverFor to the enrichment block (around line 454)
const enrichOld1 = `        if (fullProfile) {
            if (!member.pocNric && fullProfile.pocNric) member.pocNric = fullProfile.pocNric;
            if (!member.group && fullProfile.group) member.group = fullProfile.group;
        }`;
const enrichNew1 = `        if (fullProfile) {
            if (!member.pocNric && fullProfile.pocNric) member.pocNric = fullProfile.pocNric;
            if (!member.group && fullProfile.group) member.group = fullProfile.group;
            if (fullProfile.caregiverFor) member.caregiverFor = fullProfile.caregiverFor;
        }`;
code = code.replace(enrichOld1, enrichNew1);

// 2. Add caregiverFor to myGroupSortedHtml data-name and UI
const cardOld1 = `            return \`<div class="my-group-card p-3 bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-lg cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 transition shadow-sm" onclick="showPairingDetails('\${member.nric}')" data-name="\${(member.fullName||'').toLowerCase()} \${(member.shortName||'').toLowerCase()} \${(member.role||'').toLowerCase()}">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-gray-900 dark:text-white text-sm">\${member.fullName} \${member.shortName ? "(" + member.shortName + ")" : ""}</span>
                    <span class="text-[10px] uppercase font-black \${member.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (member.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400')} bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded shadow-sm">\${member.role}</span>
                </div>`;
const cardNew1 = `            return \`<div class="my-group-card p-3 bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-lg cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 transition shadow-sm" onclick="showPairingDetails('\${member.nric}')" data-name="\${(member.fullName||'').toLowerCase()} \${(member.shortName||'').toLowerCase()} \${(member.role||'').toLowerCase()} \${(member.caregiverFor||'').toLowerCase()}">
                <div class="flex justify-between items-start mb-1">
                    <div>
                        <div class="font-bold text-gray-900 dark:text-white text-sm leading-tight">\${member.fullName} \${member.shortName ? "(" + member.shortName + ")" : ""}</div>
                        \${member.caregiverFor ? \`<div class="mt-0.5 font-bold text-purple-600 dark:text-purple-400 text-xs">[\${member.caregiverFor.toUpperCase()}]</div>\` : ''}
                    </div>
                    <span class="text-[10px] uppercase font-black \${member.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (member.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400')} bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded shadow-sm ml-2 shrink-0">\${member.role}</span>
                </div>`;
code = code.replace(cardOld1, cardNew1);


// 3. Add caregiverFor to renderGroupAttendance enrichment
const enrichOld2 = `            if (fullProfile) {
                if (!member.pocNric && fullProfile.pocNric) member.pocNric = fullProfile.pocNric;
                if (!member.group && fullProfile.group) member.group = fullProfile.group;
            }`;
const enrichNew2 = `            if (fullProfile) {
                if (!member.pocNric && fullProfile.pocNric) member.pocNric = fullProfile.pocNric;
                if (!member.group && fullProfile.group) member.group = fullProfile.group;
                if (fullProfile.caregiverFor) member.caregiverFor = fullProfile.caregiverFor;
            }`;
code = code.replace(enrichOld2, enrichNew2);

// 4. Update data-name and UI in renderGroupAttendance HTML map
const attCardOld = `        html += \`
        <div class="my-att-card flex items-center justify-between p-2 rounded-lg border-2 \${bgClass} cursor-pointer select-none transition-colors" onclick="toggleIcAttendance('\${member.nric}')" id="att-card-\${member.nric}" data-name="\${(member.fullName||'').toLowerCase()} \${(member.shortName||'').toLowerCase()} \${(member.role||'').toLowerCase()}">
            <div class="flex items-center gap-2 overflow-hidden flex-1">
                <div class="shrink-0 w-5 h-5 rounded border-2 \${isPresent ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'} flex items-center justify-center transition-colors" id="att-check-\${member.nric}">
                    \${isPresent ? '<svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}
                </div>
                <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-1.5">
                        <span class="text-[9px] font-black uppercase \${roleColor} bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">\${shortRole}</span>
                        <span class="font-bold text-gray-900 dark:text-white text-sm truncate">\${dName}</span>
                    </div>
                </div>
            </div>`;

const attCardNew = `        html += \`
        <div class="my-att-card flex items-center justify-between p-2 rounded-lg border-2 \${bgClass} cursor-pointer select-none transition-colors" onclick="toggleIcAttendance('\${member.nric}')" id="att-card-\${member.nric}" data-name="\${(member.fullName||'').toLowerCase()} \${(member.shortName||'').toLowerCase()} \${(member.role||'').toLowerCase()} \${(member.caregiverFor||'').toLowerCase()}">
            <div class="flex items-center gap-2 overflow-hidden flex-1">
                <div class="shrink-0 w-5 h-5 rounded border-2 \${isPresent ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'} flex items-center justify-center transition-colors" id="att-check-\${member.nric}">
                    \${isPresent ? '<svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}
                </div>
                <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-1.5">
                        <span class="text-[9px] font-black uppercase \${roleColor} bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">\${shortRole}</span>
                        <span class="font-bold text-gray-900 dark:text-white text-sm truncate">\${dName}</span>
                    </div>
                    \${member.caregiverFor ? \`<div class="mt-0.5 font-bold text-purple-600 dark:text-purple-400 text-[10px]">[\${member.caregiverFor.toUpperCase()}]</div>\` : ''}
                </div>
            </div>`;
code = code.replace(attCardOld, attCardNew);

fs.writeFileSync('frontend/js/profile.js', code);
console.log("Replaced UI logic");
