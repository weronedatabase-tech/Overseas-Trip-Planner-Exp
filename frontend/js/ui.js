function showToast(msg, isError = false) {
 const t = document.getElementById('toast');
 if(!t) return;
 t.textContent = msg;
 t.className = `fixed top-12 left-1/2 transform -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-2xl z-[100] transition-opacity duration-300 text-sm font-bold border ${isError ? 'bg-red-600 text-white border-red-700' : 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-700 dark:border-gray-200'}`;
 t.classList.remove('opacity-0');
 setTimeout(() => t.classList.add('opacity-0'), 4000);
}

window.cleanTrailingComma = function(input) { setTimeout(() => { if (document.activeElement === input) return; if (input && input.value) { const names = input.value.split("|").map(x => x.trim()).filter(x => x !== ""); input.value = names.join(" | "); } }, 250); };
function setBtnLoading(btn, isLoading) {
 if (!btn) return;
 const spinner = btn.querySelector('.btn-spinner');
 const icon = btn.querySelector('.btn-icon');
 const text = btn.querySelector('.btn-text');

 if (isLoading) {
   btn.disabled = true; btn.classList.add('opacity-80', 'cursor-not-allowed');
   if (spinner) spinner.classList.remove('hidden-force');
   if (icon) icon.classList.add('opacity-0');
   // if (text) text.classList.add('opacity-0');
 } else {
   btn.disabled = false; btn.classList.remove('opacity-80', 'cursor-not-allowed');
   if (spinner) spinner.classList.add('hidden-force');
   if (icon) icon.classList.remove('opacity-0');
   // if (text) text.classList.remove('opacity-0');
 }
}

function toggleTheme() {
 document.documentElement.classList.toggle('dark');
 localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}

const projectColorPalette =[
 'bg-slate-100 border-slate-400 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-100',
 'bg-gray-100 border-gray-400 text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-slate-100',
 'bg-zinc-100 border-zinc-400 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-600 dark:text-zinc-100',
 'bg-neutral-100 border-neutral-400 text-neutral-900 dark:bg-neutral-900 dark:border-neutral-600 dark:text-neutral-100',
 'bg-stone-100 border-stone-400 text-stone-900 dark:bg-stone-900 dark:border-stone-600 dark:text-stone-100',
 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-900 dark:border-amber-600 dark:text-amber-100',
 'bg-yellow-100 border-yellow-400 text-yellow-900 dark:bg-yellow-900 dark:border-yellow-600 dark:text-yellow-100',
 'bg-lime-100 border-lime-400 text-lime-900 dark:bg-lime-900 dark:border-lime-600 dark:text-lime-100',
 'bg-green-100 border-green-400 text-green-900 dark:bg-green-900 dark:border-green-600 dark:text-green-100',
 'bg-emerald-100 border-emerald-400 text-emerald-900 dark:bg-emerald-900 dark:border-emerald-600 dark:text-emerald-100',
 'bg-teal-100 border-teal-400 text-teal-900 dark:bg-teal-900 dark:border-teal-600 dark:text-teal-100',
 'bg-cyan-100 border-cyan-400 text-cyan-900 dark:bg-cyan-900 dark:border-cyan-600 dark:text-cyan-100',
 'bg-sky-100 border-sky-400 text-sky-900 dark:bg-sky-900 dark:border-sky-600 dark:text-sky-100',
 'bg-green-100 border-green-400 text-green-900 dark:bg-green-900 dark:border-green-600 dark:text-green-100',
 'bg-indigo-100 border-indigo-400 text-indigo-900 dark:bg-indigo-900 dark:border-indigo-600 dark:text-indigo-100',
 'bg-violet-100 border-violet-400 text-violet-900 dark:bg-violet-900 dark:border-violet-600 dark:text-violet-100',
 'bg-purple-100 border-purple-400 text-purple-900 dark:bg-purple-900 dark:border-purple-600 dark:text-purple-100',
 'bg-fuchsia-100 border-fuchsia-400 text-fuchsia-900 dark:bg-fuchsia-900 dark:border-fuchsia-600 dark:text-fuchsia-100'
];

function getProjectColor(groupName) {
 if (!groupName || groupName === 'None') return 'bg-gray-100 border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100';
 if (appSettings && appSettings.projectColors && appSettings.projectColors[groupName]) return appSettings.projectColors[groupName];
 return 'bg-gray-100 border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100';
}

function getProjectAbbreviation(name) {
 const match = name.match(/\((.*?)\)/); if (match && match[1]) return match[1].substring(0,3).toUpperCase();
 const words = name.split(' ').filter(w => w.length > 0);
 if (words.length > 1) return words.slice(0,3).map(w => w[0]).join('').toUpperCase();
 return name.substring(0,3).toUpperCase();
}

function renderHeaderLegend() {
 const deskCont = document.getElementById('headerLegend');
 const mobCont = document.getElementById('mobHeaderLegend');
 if (!appSettings || !appSettings.activeProjects || appSettings.activeProjects.length === 0) {
   if(deskCont) deskCont.innerHTML = '';
   if(mobCont) mobCont.innerHTML = '';
   return;
 }
 let html = '';
 appSettings.activeProjects.forEach(proj => {
   if(!proj) return;
   const colorCls = getProjectColor(proj); const shortName = getProjectAbbreviation(proj);
   html += `<span class="px-1.5 py-0.5 rounded text-[11px] md:text-xs font-bold border shadow-sm cursor-help ${colorCls}" title="${proj}">${shortName}</span>`;
 });
 if(deskCont) deskCont.innerHTML = html;
 if(mobCont) mobCont.innerHTML = html;
}

window.getFamilyMembers = function(nric, allParticipants) {
    const target = allParticipants.find(p => p.nric === nric);
    if (!target) return [];
    const targetPoc = target.pocNric || target.nric;
    
    let myRelatedNames = [];
    if (target.relatedTrainee) {
        myRelatedNames = String(target.relatedTrainee).split(/[\|,]/).map(n => n.replace(/\s+/g, '').toLowerCase()).filter(n => n);
    }
    let myName = (target.fullName || '').replace(/\s+/g, '').toLowerCase();
    let myShortName = (target.shortName || '').replace(/\s+/g, '').toLowerCase();

    return allParticipants.filter(p => {
        if (p.pocNric === targetPoc && targetPoc) return true;
        
        let pName = (p.fullName || '').replace(/\s+/g, '').toLowerCase();
        let pShortName = (p.shortName || '').replace(/\s+/g, '').toLowerCase();
        
        // Am I a Caregiver for them?
        if (myRelatedNames.length > 0 && myRelatedNames.some(d => d.includes(pName) || pName.includes(d) || (pShortName && d.includes(pShortName)))) {
            return true;
        }
        
        // Are they a Caregiver for me?
        if (p.role === 'CAREGIVER' && p.relatedTrainee) {
            let theirRelated = String(p.relatedTrainee).split(/[\|,]/).map(n => n.replace(/\s+/g, '').toLowerCase()).filter(n => n);
            if (theirRelated.some(d => d.includes(myName) || myName.includes(d) || (myShortName && d.includes(myShortName)))) {
                return true;
            }
        }
        return false;
    });
};

window.isFamily = function(nric, allParticipants) {
    return window.getFamilyMembers(nric, allParticipants).length > 1;
};

function applyGlobalSorting(participants) {
 if(!appSettings) return participants;
 const rules = appSettings.sortingRules || ['project', 'family', 'role', 'name'];
 const familyCounts = {};
 participants.forEach(p => { 
    const poc = p.pocNric;
    familyCounts[poc] = (familyCounts[poc] || 0) + 1; 
 });

 return participants.sort((a, b) => {
   for (let rule of rules) {
       if (rule === 'none') continue;
       if (rule === 'project') {
           const aG = a.group || 'ZZZ';
           const bG = b.group || 'ZZZ';
           const cmp = aG.localeCompare(bG);
           if (cmp !== 0) return cmp;
       }
       if (rule === 'family') {
           const aPoc = a.pocNric;
           const bPoc = b.pocNric;
           const aFam = familyCounts[aPoc] > 1 ? 1 : 0;
           const bFam = familyCounts[bPoc] > 1 ? 1 : 0;
           if (aFam !== bFam) return bFam - aFam;
           if (aFam === 1 && bFam === 1) {
               const cmp = aPoc.localeCompare(bPoc);
               if (cmp !== 0) return cmp;
           }
       }
       if (rule === 'role') {
           const rW = { 'CAREGIVER': 1, 'TRAINEE': 2, 'VOLUNTEER': 3 };
           const aR = rW[a.role] || 9;
           const bR = rW[b.role] || 9;
           if (aR !== bR) return aR - bR;
       }
       if (rule === 'name') {
           const cmp = (a.displayName || a.name || '').localeCompare(b.displayName || b.name || '');
           if (cmp !== 0) return cmp;
       }
   }
   return 0;
 });
}

function processDisplayNames(participants) {
 if(!participants) return;
 const nameCounts = {};
 participants.forEach(p => {
     p.shortName = p.shortName ? p.shortName.trim() : '';
     p.name = p.name ? p.name.trim() : '';
     const sName = p.shortName || p.name;
     nameCounts[sName] = (nameCounts[sName] || 0) + 1;
 });
 participants.forEach(p => {
     const sName = p.shortName || p.name;
     if (nameCounts[sName] > 1) {
         const roleChar = p.role ? p.role.charAt(0).toUpperCase() : 'U';
         const projAcr = p.group ? getProjectAbbreviation(p.group) : 'N/A';
         p.displayName = `${sName} (${roleChar}) (${projAcr})`;
     } else {
         p.displayName = sName;
     }
 });
 const displayCounts = {};
 participants.forEach(p => { displayCounts[p.displayName] = (displayCounts[p.displayName] || 0) + 1; });
 participants.forEach(p => {
     if (displayCounts[p.displayName] > 1) {
         const sName = p.shortName || p.name;
         const roleChar = p.role ? p.role.charAt(0).toUpperCase() : 'U';
         const projAcr = p.group ? getProjectAbbreviation(p.group) : 'N/A';
         const words = p.name.split(' ');
         let extraChar = '';
         if (words.length > 1) {
             const diffWord = words.find(w => w.toLowerCase() !== sName.toLowerCase());
             if(diffWord) extraChar = diffWord.charAt(0).toUpperCase() + '.';
             else extraChar = words[1].charAt(0).toUpperCase() + '.';
         } else {
             extraChar = p.name.charAt(0).toUpperCase() + '.';
         }
         p.displayName = `${sName} ${extraChar} (${roleChar}) (${projAcr})`;
     }
 });
 const finalCounts = {};
 participants.forEach(p => { finalCounts[p.displayName] = (finalCounts[p.displayName] || 0) + 1; });
 participants.forEach(p => {
     if (finalCounts[p.displayName] > 1 && p.nric) {
         p.displayName = `${p.displayName} [${p.nric.slice(-4)}]`;
     }
 });
}

async function updateApp(btn) {
 setBtnLoading(btn, true);
 showToast("Clearing global database cache & updating app...");
 try {
   await apiCall('clearCache');
   if ('caches' in window) {
     const cacheNames = await caches.keys();
     await Promise.all(cacheNames.map(name => caches.delete(name)));
   }
   if ('serviceWorker' in navigator) {
     const regs = await navigator.serviceWorker.getRegistrations();
     for (let r of regs) await r.unregister();
   }
 } catch(e) { console.error(e); }
 setTimeout(() => {
   const url = new URL(window.location.href);
   url.searchParams.set('v', new Date().getTime());
   window.location.replace(url.toString());
 }, 500);
}

function handleEnter(e, func) { if(e.key === 'Enter') func(); }

function clearSearch(inputId, callbackName) {
 const input = document.getElementById(inputId);
 if (input) {
     input.value = '';
     if (typeof window[callbackName] === 'function') window[callbackName]();
 }
}

window.formatMoneyInput = function(input, isBlur) {
 let cursorStart = input.selectionStart;
 let oldLen = input.value.length;
 
  let val = input.value.replace(/[^0-9.-]/g, '');
 if(val !== '') {
     let isNegative = val[0] === '-';
     val = val.replace(/-/g, '');
     if(isNegative) val = '-' + val;
 }
 if(val === '') {
     input.value = '';
     return;
 }
 
 let parts = val.split('.');
 if(parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
 
 if (isBlur) {
     let number = parseFloat(val);
     if(!isNaN(number)) {
         input.value = number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
     } else {
         input.value = '0.00';
     }
 } else {
     parts = val.split('.');
     let whole = parts[0] ? parseFloat(parts[0]).toLocaleString('en-US') : '0';
     
     if(parts.length > 1) {
         input.value = whole + '.' + parts[1].substring(0, 2);
     } else {
         input.value = whole;
     }
     
     let newLen = input.value.length;
     let diff = newLen - oldLen;
     let newCursor = cursorStart + diff;
     try { input.setSelectionRange(newCursor, newCursor); } catch(e){}
 }
};

window.applyCaregiverLabels = function(participants) {
    if (!participants) return;
    const traineeMap = {};
    participants.forEach(p => {
        if (p.role === 'TRAINEE') {
            const nameToUse = p.shortName || p.fullName || p.name;
            const searchKey = String(p.nric || '').toLowerCase();
            const searchKey2 = String(p.fullName || p.name || '').toLowerCase();
            const searchKey3 = String(p.shortName || '').toLowerCase();
            traineeMap[searchKey] = nameToUse;
            traineeMap[searchKey2] = nameToUse;
            traineeMap[searchKey3] = nameToUse;
        }
    });

    participants.forEach(p => {
        if (p.role === 'CAREGIVER') {
            if (p.relatedTrainee) {
                let parts = String(p.relatedTrainee).split(/[\|,]/).filter(Boolean);
                let mapped = parts.map(n => {
                    let raw = n.trim();
                    let k = raw.toLowerCase();
                    let lookupName = raw.replace(/\s*\(.*?\)\s*/g, '').toLowerCase().trim();
                    if (traineeMap[k]) return traineeMap[k];
                    if (traineeMap[lookupName]) return traineeMap[lookupName];
                    const match = raw.match(/\((.*?)\)/);
                    if (match && match[1]) return match[1].trim();
                    return raw.replace(/\s*\(.*?\)\s*/g, '').trim();
                });
                p.caregiverFor = mapped.join(', ');
            }
        }
    });
};

window.renderPhoneLink = function(phone, extraClasses = '') {
    if (!phone || phone === '-' || String(phone).trim() === '' || String(phone).toLowerCase() === 'n/a') return '-';
    let cleaned = String(phone).replace(/[^\d+]/g, '');
    let dialNum = cleaned;
    
    if (cleaned.length === 8 && (cleaned.startsWith('8') || cleaned.startsWith('9') || cleaned.startsWith('3') || cleaned.startsWith('6'))) {
        cleaned = '65' + cleaned;
        dialNum = '+65' + dialNum; // Ensure proper dial format with country code for local numbers
    } else if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
        // dialNum retains the '+'
    }
    
    return `<span class="inline-flex items-center gap-2 ${extraClasses}">
        <span class="font-medium truncate">${phone}</span>
        <span class="inline-flex items-center gap-1.5 shrink-0">
            <a href="https://wa.me/${cleaned}" target="_blank" class="text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300 transition-colors bg-green-50 dark:bg-green-900/30 p-1.5 rounded-md border border-green-200 dark:border-green-800/50 shadow-sm" title="Chat on WhatsApp" onclick="event.stopPropagation()">
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
            </a>
            <a href="tel:${dialNum}" title="Call" class="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors bg-blue-50 dark:bg-blue-900/30 p-1.5 rounded-md border border-blue-200 dark:border-blue-800/50 shadow-sm" onclick="event.stopPropagation()">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
            </a>
        </span>
    </span>`;
};

window.formatDDMmmYYYY = function(dateStr) {
    if (dateStr instanceof Date) {
        if (isNaN(dateStr.getTime())) return '-';
        const day = String(dateStr.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${day} ${months[dateStr.getMonth()]} ${dateStr.getFullYear()}`;
    }
    if (typeof dateStr === 'number') dateStr = new Date(dateStr);
    if (!dateStr || (typeof dateStr === 'string' && dateStr.trim() === '')) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

window.sortParticipantsSpecial = function(arr, allParticipants) {
    if (!arr || !allParticipants) return;
    const famMap = {};
    allParticipants.forEach(x => {
        const poc = x.pocNric;
        if(!famMap[poc]) famMap[poc] = { count: 0, hasCaregiver: false };
        famMap[poc].count++;
            });

    const specialSortMap = new Map();
    arr.forEach(p => {
        const poc = p.pocNric;
        const info = famMap[poc];
        const isFamily = info ? (info.count > 1) : false;
        let catScore = 4;
        if (isFamily) catScore = 1;
        else if (p.role === 'TRAINEE') catScore = 2;
        else if (p.role === 'VOLUNTEER') catScore = 3;
        let roleScore = p.role === 'TRAINEE' ? 1 : (p.role === 'CAREGIVER' ? 2 : 3);
        specialSortMap.set(p.nric, {
            group: (p.group || '').toLowerCase(),
            catScore,
            poc: poc.toLowerCase(),
            roleScore,
            name: (p.fullName || p.name || '').toLowerCase()
        });
    });

    arr.sort((a, b) => {
        let keyA = specialSortMap.get(a.nric);
        let keyB = specialSortMap.get(b.nric);
        if (!keyA || !keyB) return 0;

        if (keyA.group < keyB.group) return -1;
        if (keyA.group > keyB.group) return 1;
        
        if (keyA.catScore < keyB.catScore) return -1;
        if (keyA.catScore > keyB.catScore) return 1;
        
        if (keyA.catScore === 1) {
            if (keyA.poc < keyB.poc) return -1;
            if (keyA.poc > keyB.poc) return 1;
        }
        
        if (keyA.roleScore < keyB.roleScore) return -1;
        if (keyA.roleScore > keyB.roleScore) return 1;
        
        if (keyA.name < keyB.name) return -1;
        if (keyA.name > keyB.name) return 1;
        return 0;
    });
};

window.setupTokenInput = function(inputId, getSuggestionsCallback) {
    const originalInput = document.getElementById(inputId);
    if (!originalInput || originalInput.dataset.tokenized) return;
    originalInput.dataset.tokenized = "true";

    // Hide original input but keep its functionality
    originalInput.style.display = 'none';

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = "flex flex-wrap items-center gap-1.5 w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus-within:ring-1 focus-within:ring-primary cursor-text min-h-[42px]";
    
    const chipContainer = document.createElement('div');
    chipContainer.className = "flex flex-wrap gap-1.5 items-center";
    
    const inputField = document.createElement('input');
    inputField.type = "text";
    inputField.className = "flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-xs font-semibold text-gray-900 dark:text-white min-w-[60px] p-0";
    inputField.placeholder = "Search trainee...";
    
    const dropdown = document.createElement('div');
    dropdown.className = "absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl mt-1 hidden-force max-h-48 overflow-y-auto";
    
    // Wrapper must be relative for dropdown
    const outerWrapper = document.createElement('div');
    outerWrapper.className = "relative w-full";
    
    originalInput.parentNode.insertBefore(outerWrapper, originalInput);
    outerWrapper.appendChild(originalInput);
    outerWrapper.appendChild(wrapper);
    outerWrapper.appendChild(dropdown);
    
    wrapper.appendChild(chipContainer);
    wrapper.appendChild(inputField);

    let tokens = (originalInput.value || '').split(/[\|,]/).map(s => s.trim()).filter(Boolean);
    
    function renderTokens() {
        chipContainer.innerHTML = '';
        const currentTokens = window._tokenInputs[inputId] ? window._tokenInputs[inputId].tokens : tokens;
        currentTokens.forEach((t, i) => {
            const chip = document.createElement('span');
            chip.className = "inline-flex items-center px-2 py-1 rounded-md text-xs font-black bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 uppercase tracking-widest";
            chip.innerHTML = `
                ${t}
                <button type="button" class="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 focus:outline-none flex-shrink-0" onclick="event.stopPropagation(); window.removeTokenFromInput('${inputId}', ${i})">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                </button>
            `;
            chipContainer.appendChild(chip);
        });
        originalInput.value = currentTokens.join(' | ');
        originalInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    if (!window._tokenInputs) window._tokenInputs = {};
    window._tokenInputs[inputId] = {
        tokens,
        render: renderTokens,
        getInputField: () => inputField
    };
    
    window.removeTokenFromInput = function(id, index) {
        if(window._tokenInputs[id]) {
            window._tokenInputs[id].tokens.splice(index, 1);
            window._tokenInputs[id].render();
        }
    };

    renderTokens();

    wrapper.addEventListener('click', () => {
        inputField.focus();
    });

    inputField.addEventListener('input', () => {
        const query = inputField.value.trim().toLowerCase();
        if (query) {
             const suggestions = getSuggestionsCallback(query);
             renderDropdown(suggestions);
        } else {
             dropdown.classList.add('hidden-force');
        }
    });

    function renderDropdown(suggestions) {
        if (!suggestions || suggestions.length === 0) {
            dropdown.innerHTML = '<div class="p-2 text-xs text-gray-500 text-center italic pointer-events-none">No matches found</div>';
        } else {
            dropdown.innerHTML = '';
            suggestions.forEach(s => {
                const item = document.createElement('div');
                item.className = "px-3 py-2 text-sm font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition border-b border-gray-100 dark:border-gray-700 last:border-0";
                item.textContent = s.label;
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // prevent blur
                    const currentTokens = window._tokenInputs[inputId].tokens;
                    if (!currentTokens.includes(s.value)) {
                        currentTokens.push(s.value);
                    }
                    inputField.value = '';
                    dropdown.classList.add('hidden-force');
                    renderTokens();
                });
                dropdown.appendChild(item);
            });
        }
        dropdown.classList.remove('hidden-force');
    }

    inputField.addEventListener('focus', () => {
         const suggestions = getSuggestionsCallback(inputField.value.trim().toLowerCase());
         renderDropdown(suggestions);
    });

    inputField.addEventListener('blur', () => {
        setTimeout(() => dropdown.classList.add('hidden-force'), 150);
    });
};


window.isValidNRIC = function(str) {
    if (!str || str.length !== 9) return false;
    str = str.toUpperCase();
    const prefix = str.charAt(0);
    const digits = str.substring(1, 8);
    const suffix = str.charAt(8);

    if (!['S', 'T', 'F', 'G', 'M'].includes(prefix)) return false;
    if (!/^\d{7}$/.test(digits)) return false;

    const weights = [2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 7; i++) {
        sum += parseInt(digits.charAt(i), 10) * weights[i];
    }

    if (prefix === 'T' || prefix === 'G') sum += 4;
    if (prefix === 'M') sum += 3;

    const remainder = sum % 11;

    const st = ['J', 'Z', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
    const fgm = ['X', 'W', 'U', 'T', 'R', 'Q', 'P', 'N', 'M', 'L', 'K'];

    let expectedSuffix = '';
    if (prefix === 'S' || prefix === 'T') expectedSuffix = st[remainder];
    else if (prefix === 'F' || prefix === 'G' || prefix === 'M') expectedSuffix = fgm[remainder];

    return suffix === expectedSuffix;
};

const TOP_NATIONALITIES = ["Singaporean", "Malaysian", "Indonesian", "Filipino", "Burmese", "Indian"];
const ALL_NATIONALITIES = [
  "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan", "Antiguans", "Argentinean", "Armenian", "Australian", "Austrian", "Azerbaijani",
  "Bahamian", "Bahraini", "Bangladeshi", "Barbadian", "Barbudans", "Batswana", "Belarusian", "Belgian", "Belizean", "Beninese", "Bhutanese", "Bolivian", "Bosnian", "Brazilian", "British", "Bruneian", "Bulgarian", "Burkinabe", "Burmese", "Burundian",
  "Cambodian", "Cameroonian", "Canadian", "Cape Verdean", "Central African", "Chadian", "Chilean", "Chinese", "Colombian", "Comoran", "Congolese", "Costa Rican", "Croatian", "Cuban", "Cypriot", "Czech",
  "Danish", "Djibouti", "Dominican", "Dutch",
  "East Timorese", "Ecuadorean", "Egyptian", "Emirian", "Equatorial Guinean", "Eritrean", "Estonian", "Ethiopian",
  "Fijian", "Filipino", "Finnish", "French",
  "Gabonese", "Gambian", "Georgian", "German", "Ghanaian", "Greek", "Grenadian", "Guatemalan", "Guinea-Bissauan", "Guinean", "Guyanese",
  "Haitian", "Herzegovinian", "Honduran", "Hungarian",
  "I-Kiribati", "Icelander", "Indian", "Indonesian", "Iranian", "Iraqi", "Irish", "Israeli", "Italian", "Ivorian",
  "Jamaican", "Japanese", "Jordanian",
  "Kazakhstani", "Kenyan", "Kittian and Nevisian", "Kuwaiti", "Kyrgyz",
  "Laotian", "Latvian", "Lebanese", "Liberian", "Libyan", "Liechtensteiner", "Lithuanian", "Luxembourger",
  "Macedonian", "Malagasy", "Malawian", "Malaysian", "Maldivan", "Malian", "Maltese", "Marshallese", "Mauritanian", "Mauritian", "Mexican", "Micronesian", "Moldovan", "Monacan", "Mongolian", "Moroccan", "Mosotho", "Motswana", "Mozambican",
  "Namibian", "Nauruan", "Nepalese", "New Zealander", "Nicaraguan", "Nigerian", "Nigerien", "North Korean", "Northern Irish", "Norwegian",
  "Omani",
  "Pakistani", "Palauan", "Palestinian", "Panamanian", "Papua New Guinean", "Paraguayan", "Peruvian", "Polish", "Portuguese",
  "Qatari",
  "Romanian", "Russian", "Rwandan",
  "Saint Lucian", "Salvadoran", "Samoan", "San Marinese", "Sao Tomean", "Saudi", "Scottish", "Senegalese", "Serbian", "Seychellois", "Sierra Leonean", "Singaporean", "Slovakian", "Slovenian", "Solomon Islander", "Somali", "South African", "South Korean", "Spanish", "Sri Lankan", "Sudanese", "Surinamer", "Swazi", "Swedish", "Swiss", "Syrian",
  "Taiwanese", "Tajik", "Tanzanian", "Thai", "Togolese", "Tongan", "Trinidadian or Tobagonian", "Tunisian", "Turkish", "Tuvaluan",
  "Ugandan", "Ukrainian", "Uruguayan", "Uzbekistani",
  "Venezuelan", "Vietnamese",
  "Welsh",
  "Yemenite",
  "Zambian", "Zimbabwean"
];
const OTHER_NATIONALITIES = ALL_NATIONALITIES.filter(n => !TOP_NATIONALITIES.includes(n)).sort((a, b) => a.localeCompare(b));
window.NATIONALITIES_LIST = [...TOP_NATIONALITIES, ...OTHER_NATIONALITIES];

window.setupNationalityDropdown = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.natInit) return;
    input.dataset.natInit = "true";

    // Hide original input
    input.classList.add('hidden-force');
    
    // Create UI container
    const wrapper = document.createElement('div');
    wrapper.className = 'relative w-full';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const displayBtn = document.createElement('button');
    displayBtn.type = 'button';
    displayBtn.className = 'w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary flex justify-between items-center text-left min-h-[42px]';
    
    const displaySpan = document.createElement('span');
    displaySpan.className = 'truncate text-sm ' + (input.value ? 'font-semibold' : 'text-gray-400');
    displaySpan.textContent = input.value || 'Select Nationality';
    
    const chevron = document.createElement('div');
    chevron.innerHTML = '<svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';
    
    displayBtn.appendChild(displaySpan);
    displayBtn.appendChild(chevron);
    wrapper.appendChild(displayBtn);

    const dropdown = document.createElement('div');
    dropdown.className = 'absolute z-[100] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl hidden-force flex flex-col max-h-64 overflow-hidden';
    
    const searchHeader = document.createElement('div');
    searchHeader.className = 'p-2 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search...';
    searchInput.className = 'flex-1 p-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary';
    
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.title = "Clear Field";
    clearBtn.className = 'p-1.5 text-gray-400 hover:text-red-500 transition focus:outline-none';
    clearBtn.innerHTML = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    
    searchHeader.appendChild(searchInput);
    searchHeader.appendChild(clearBtn);
    dropdown.appendChild(searchHeader);

    const listCont = document.createElement('div');
    listCont.className = 'overflow-y-auto custom-scrollbar flex-1';
    dropdown.appendChild(listCont);
    wrapper.appendChild(dropdown);

    const renderList = (query) => {
        const q = (query || '').toLowerCase();
        let html = '';
        const filtered = window.NATIONALITIES_LIST.filter(n => n.toLowerCase().includes(q));
        
        if (filtered.length === 0) {
            html = '<div class="p-3 text-xs text-center text-gray-500">No results found</div>';
        } else {
            html = filtered.map(n => {
                const isTop = TOP_NATIONALITIES.includes(n);
                const styling = isTop ? 'font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900/30' : 'font-medium text-gray-700 dark:text-gray-300';
                return `<div class="p-2.5 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-sm ${styling} nat-opt" data-val="${n}">${n}</div>`;
            }).join('');
        }
        listCont.innerHTML = html;
        
        Array.from(listCont.getElementsByClassName('nat-opt')).forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = opt.dataset.val;
                input.value = val;
                input.dispatchEvent(new Event('input', {bubbles:true}));
                input.dispatchEvent(new Event('change', {bubbles:true}));
                displaySpan.textContent = val;
                displaySpan.className = 'truncate text-sm font-semibold';
                dropdown.classList.add('hidden-force');
            });
        });
    };

    displayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = dropdown.classList.contains('hidden-force');
        document.querySelectorAll('.nat-dropdown-open').forEach(d => {
            if(d !== dropdown) d.classList.add('hidden-force');
        });
        if (isHidden) {
            dropdown.classList.remove('hidden-force');
            dropdown.classList.add('nat-dropdown-open');
            searchInput.value = '';
            renderList('');
            setTimeout(() => searchInput.focus(), 50);
        } else {
            dropdown.classList.add('hidden-force');
            dropdown.classList.remove('nat-dropdown-open');
        }
    });

    searchInput.addEventListener('input', (e) => {
        renderList(e.target.value);
    });

    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        input.value = '';
        input.dispatchEvent(new Event('input', {bubbles:true}));
        input.dispatchEvent(new Event('change', {bubbles:true}));
        displaySpan.textContent = 'Select Nationality';
        displaySpan.className = 'truncate text-sm text-gray-400';
        dropdown.classList.add('hidden-force');
        dropdown.classList.remove('nat-dropdown-open');
    });

    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.classList.add('hidden-force');
            dropdown.classList.remove('nat-dropdown-open');
        }
    });
};


document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById('datePickerSheet')) {
        const div = document.createElement('div');
        div.id = "datePickerSheet";
        div.className = "fixed inset-0 bg-black/60 z-[120] hidden-force flex flex-col justify-end";
        div.innerHTML = `<div class="bg-white dark:bg-gray-900 rounded-t-3xl w-full max-w-md mx-auto overflow-hidden shadow-2xl animate-slide-up border-t border-gray-200 dark:border-gray-800"><div class="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-800"><span class="font-bold text-lg text-gray-800 dark:text-gray-100">Select Date</span><button type="button" onclick="closePicker()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold px-2 focus:outline-none">&times;</button></div><div class="relative flex h-[200px] text-lg font-bold bg-white dark:bg-gray-950"><div class="picker-highlight"></div><div class="flex-1 picker-col" id="colDay"></div><div class="flex-1 picker-col" id="colMonth"></div><div class="flex-1 picker-col" id="colYear"></div></div><div class="p-5 border-t border-gray-200 dark:border-gray-800"><button type="button" onclick="confirmPicker()" class="w-full bg-primary text-white py-3.5 rounded-xl font-bold text-lg shadow-md focus:outline-none hover:bg-green-600 transition">Done</button></div></div>`;
        document.body.appendChild(div);
    }
});

let currentPickerTarget = null; 
const monthsArr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

window.openDatePicker = function openDatePicker(targetId, type) {
  currentPickerTarget = targetId; 
  document.getElementById('datePickerSheet').classList.remove('hidden-force');
  
  const colD = document.getElementById('colDay'); 
  const colM = document.getElementById('colMonth'); 
  const colY = document.getElementById('colYear');
  const spacer = '<div style="height: 80px;"></div>'; 
  
  let dHtml = spacer; 
  for(let i=1; i<=31; i++) { 
    let val = String(i).padStart(2,'0'); 
    dHtml += `<div class="picker-item text-gray-400" data-val="${val}" onclick="scrollToIndex('colDay', ${i-1})">${val}</div>`; 
  } 
  dHtml += spacer;
  
  let mHtml = spacer; 
  monthsArr.forEach((m, i) => { 
    mHtml += `<div class="picker-item text-gray-400" data-val="${m}" onclick="scrollToIndex('colMonth', ${i})">${m}</div>`; 
  }); 
  mHtml += spacer;
  
  let yHtml = spacer; 
  const curYear = new Date().getFullYear(); 
  let startYear, endYear, step;
  
  if(type === 'dob') { 
    startYear = curYear; endYear = 1920; step = -1; 
  } else { 
    startYear = curYear; endYear = curYear + 20; step = 1; 
  }
  
  let idx = 0; 
  for(let i = startYear; type === 'dob' ? i >= endYear : i <= endYear; i += step) { 
    yHtml += `<div class="picker-item text-gray-400" data-val="${i}" onclick="scrollToIndex('colYear', ${idx})">${i}</div>`; 
    idx++; 
  } 
  yHtml += spacer;
  
  colD.innerHTML = dHtml; colM.innerHTML = mHtml; colY.innerHTML = yHtml;
  colD.onscroll = () => highlightCenterItem('colDay'); 
  colM.onscroll = () => highlightCenterItem('colMonth'); 
  colY.onscroll = () => highlightCenterItem('colYear');
  
  const curVal = document.getElementById(targetId).value;
  setTimeout(() => {
    if(curVal) { 
      const parts = curVal.split(' '); 
      if(parts.length === 3) {
        const dIdx = Array.from(colD.querySelectorAll('.picker-item')).findIndex(el => el.dataset.val === parts[0]); 
        const mIdx = Array.from(colM.querySelectorAll('.picker-item')).findIndex(el => el.dataset.val === parts[1]); 
        const yIdx = Array.from(colY.querySelectorAll('.picker-item')).findIndex(el => el.dataset.val === parts[2]);
        if(dIdx > -1) colD.scrollTop = dIdx * 40; 
        if(mIdx > -1) colM.scrollTop = mIdx * 40; 
        if(yIdx > -1) colY.scrollTop = yIdx * 40;
      } 
    } else { 
      colD.scrollTop = 0; colM.scrollTop = 0; colY.scrollTop = 0; 
    }
    highlightCenterItem('colMonth'); highlightCenterItem('colYear'); highlightCenterItem('colDay');
  }, 10);
}

window.scrollToIndex = function scrollToIndex(colId, index) { 
  document.getElementById(colId).scrollTo({ top: index * 40, behavior: 'smooth' }); 
}

function highlightCenterItem(colId) {
  const col = document.getElementById(colId); 
  const visibleItems = Array.from(col.querySelectorAll('.picker-item')).filter(i => !i.classList.contains('hidden-force'));
  if(!visibleItems.length) return; 
  
  let index = Math.round(col.scrollTop / 40); 
  if (index >= visibleItems.length) index = visibleItems.length - 1; 
  
  visibleItems.forEach((item, i) => {
    if(i === index) { 
      item.classList.remove('text-gray-400'); 
      item.classList.add('text-primary', 'font-extrabold', 'text-3xl'); 
      item.dataset.selected = "true"; 
    } else { 
      item.classList.add('text-gray-400'); 
      item.classList.remove('text-primary', 'font-extrabold', 'text-3xl'); 
      item.dataset.selected = "false"; 
    }
  });
  
  if(colId === 'colMonth' || colId === 'colYear') updateValidDays();
}

function updateValidDays() {
  const mItem = document.querySelector('#colMonth .picker-item[data-selected="true"]'); 
  const yItem = document.querySelector('#colYear .picker-item[data-selected="true"]'); 
  if(!mItem || !yItem) return;
  
  const maxDays = new Date(parseInt(yItem.dataset.val), monthsArr.indexOf(mItem.dataset.val) + 1, 0).getDate(); 
  const colD = document.getElementById('colDay');
  
  colD.querySelectorAll('.picker-item').forEach((item) => {
    const shouldHide = parseInt(item.dataset.val) > maxDays;
    if(shouldHide && !item.classList.contains('hidden-force')) item.classList.add('hidden-force'); 
    if(!shouldHide && item.classList.contains('hidden-force')) item.classList.remove('hidden-force');
  });
  
  if (colD.scrollTop > (maxDays - 1) * 40) scrollToIndex('colDay', maxDays - 1);
}

window.confirmPicker = function confirmPicker() {
  const d = document.querySelector('#colDay .picker-item[data-selected="true"]'); 
  const m = document.querySelector('#colMonth .picker-item[data-selected="true"]'); 
  const y = document.querySelector('#colYear .picker-item[data-selected="true"]');
  if(d && m && y && currentPickerTarget) {
    document.getElementById(currentPickerTarget).value = `${d.dataset.val} ${m.dataset.val} ${y.dataset.val}`; 
  }
  closePicker();
}

window.closePicker = function closePicker() { 
  document.getElementById('datePickerSheet').classList.add('hidden-force'); 
}