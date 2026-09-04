let extractExcludedNrics = new Set();
let currentExtractType = '';

function showExtractionPopup(type) {
    currentExtractType = type;
    extractExcludedNrics.clear();
    
    let modal = document.getElementById('extractionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'extractionModal';
        modal.className = 'fixed inset-0 bg-black/60 z-[120] flex justify-center items-center p-4 backdrop-blur-sm hidden-force';
        modal.innerHTML = `
        <div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col h-[80vh] md:h-auto max-h-[90vh] overflow-hidden my-auto animate-slide-up relative">
            <button type="button" onclick="document.getElementById('extractionModal').classList.add('hidden-force')" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div class="p-5 md:p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0">
                <h2 id="extractionTitle" class="text-lg md:text-xl font-black text-gray-900 dark:text-white tracking-tight">Data Extraction</h2>
                <p class="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">Select participants to exclude</p>
            </div>
            <div class="p-5 md:p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                <div class="relative">
                    <input type="text" id="extractSearchInput" oninput="handleExtractSearch()" placeholder="Search participants to exclude..." class="w-full py-2.5 pl-9 pr-3 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-semibold bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary shadow-sm transition">
                    <svg class="w-4 h-4 absolute left-3 top-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                
                <div id="extractSearchResults" class="flex flex-col gap-2 empty:hidden"></div>
                
                <div class="pt-2">
                    <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-100 dark:border-gray-800 pb-1">Excluded Participants</h3>
                    <div id="extractExcludedList" class="flex flex-wrap gap-2 min-h-[50px] p-2 bg-gray-50 dark:bg-gray-950/50 rounded-lg border border-gray-100 dark:border-gray-800"></div>
                </div>
            </div>
            <div class="p-4 md:p-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0 flex justify-end gap-3">
                <button type="button" onclick="document.getElementById('extractionModal').classList.add('hidden-force')" class="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition">Cancel</button>
                <button type="button" onclick="performExtraction()" class="px-5 py-2.5 rounded-xl font-black text-sm text-white shadow-md transition flex items-center gap-2 bg-primary hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Extract to Drive
                </button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden-force');
        });
    }
    
    document.getElementById('extractionTitle').textContent = type === 'insurance' ? 'Insurance Extraction' : 'Bus for ICA Extraction';
    document.getElementById('extractSearchInput').value = '';
    renderExtractSearchResults();
    renderExtractExcluded();
    modal.classList.remove('hidden-force');
    setTimeout(() => document.getElementById('extractSearchInput').focus(), 100);
}

function handleExtractSearch() {
    renderExtractSearchResults();
}

function renderExtractSearchResults() {
    const query = (document.getElementById('extractSearchInput').value || '').toLowerCase().trim();
    const cont = document.getElementById('extractSearchResults');
    
    if (!query) {
        cont.innerHTML = '';
        return;
    }
    
    if (!globalRoster) return;
    
    // Fuzzy search same as roster
    const matches = globalRoster.filter(p => {
        if (extractExcludedNrics.has(p.nric)) return false;
        
        const terms = query.split(/\s+/);
        const nameMatch = String(p.fullName || '').toLowerCase();
        const shortMatch = String(p.shortName || '').toLowerCase();
        const grpMatch = String(p.projectGroup || '').toLowerCase();
        const roleMatch = String(p.role || '').toLowerCase();
        const passportMatch = String(p.passport || '').toLowerCase();
        
        return terms.every(term => 
            nameMatch.includes(term) || shortMatch.includes(term) || 
            grpMatch.includes(term) || roleMatch.includes(term) || 
            passportMatch.includes(term)
        );
    }).slice(0, 5); // Limit to top 5 results for clarity
    
    if (matches.length === 0) {
        cont.innerHTML = `<div class="text-xs text-center text-gray-400 py-2">No matching participants found.</div>`;
        return;
    }
    
    cont.innerHTML = matches.map(p => {
        const roleColor = p.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (p.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
        const roleStr = String(p.role || '').substring(0, 3);
        const fullNameUpper = (p.fullName || '').toUpperCase();
        const shortNameUpper = (p.shortName || '').toUpperCase();
        
        let projColor = 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300';
        if (typeof getProjectColor === 'function') projColor = getProjectColor(p.group);
        let projAbbr = (p.group || 'None').toUpperCase();
        if (typeof getProjectAbbreviation === 'function') projAbbr = getProjectAbbreviation(p.group || 'None');
        
        return `
        <div onclick="addExtractExcluded('${p.nric}')" class="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition shadow-sm">
            <div class="flex flex-col min-w-0 pr-2">
                <div class="font-bold text-xs md:text-sm text-gray-900 dark:text-gray-100 leading-tight whitespace-normal break-words">${fullNameUpper}</div>
                ${shortNameUpper && shortNameUpper !== fullNameUpper ? `<div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium whitespace-normal break-words">${shortNameUpper}</div>` : ''}
                <div class="flex items-center gap-1 mt-1.5 flex-wrap">
                    <span class="text-[11px] font-black ${roleColor} bg-gray-50 dark:bg-gray-900/50 px-1.5 py-[1.5px] leading-tight rounded border border-gray-200 dark:border-gray-700 uppercase tracking-widest">${roleStr}</span>
                    <span class="px-1.5 py-[1.5px] leading-tight rounded border shadow-sm text-[11px] font-bold ${projColor} whitespace-normal break-words inline-block" title="${(p.group || 'None').toUpperCase()}">${projAbbr}</span>
                </div>
                ${p.relatedTrainee && p.role === 'CAREGIVER' ? `<div class="mt-1.5 font-bold text-purple-600 dark:text-purple-400 text-xs tracking-tight">[${p.relatedTrainee.toUpperCase()}]</div>` : ''}
            </div>
            <button class="shrink-0 p-1.5 rounded-lg text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-red-500 transition focus:outline-none bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
            </button>
        </div>`;
    }).join('');
}

function renderExtractExcluded() {
    const cont = document.getElementById('extractExcludedList');
    if (extractExcludedNrics.size === 0) {
        cont.innerHTML = `<span class="text-xs text-gray-400 font-medium italic p-2">None selected.</span>`;
        return;
    }
    
    let html = '';
    extractExcludedNrics.forEach(nric => {
        const p = globalRoster.find(x => x.nric === nric);
        if(!p) return;
        
        const roleColor = p.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (p.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
        const roleStr = String(p.role || '').substring(0, 3);
        const fullNameUpper = (p.fullName || '').toUpperCase();
        const shortNameUpper = (p.shortName || '').toUpperCase();
        
        let projColor = 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300';
        if (typeof getProjectColor === 'function') projColor = getProjectColor(p.group);
        let projAbbr = (p.group || 'None').toUpperCase();
        if (typeof getProjectAbbreviation === 'function') projAbbr = getProjectAbbreviation(p.group || 'None');
        
        html += `
        <div onclick="removeExtractExcluded('${p.nric}')" class="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/10 cursor-pointer transition shadow-sm w-full">
            <div class="flex flex-col min-w-0 pr-2">
                <div class="font-bold text-xs md:text-sm text-gray-900 dark:text-gray-100 leading-tight whitespace-normal break-words line-through opacity-70">${fullNameUpper}</div>
                ${shortNameUpper && shortNameUpper !== fullNameUpper ? `<div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium whitespace-normal break-words line-through opacity-70">${shortNameUpper}</div>` : ''}
                <div class="flex items-center gap-1 mt-1.5 flex-wrap opacity-80">
                    <span class="text-[11px] font-black ${roleColor} bg-gray-50 dark:bg-gray-900/50 px-1.5 py-[1.5px] leading-tight rounded border border-gray-200 dark:border-gray-700 uppercase tracking-widest">${roleStr}</span>
                    <span class="px-1.5 py-[1.5px] leading-tight rounded border shadow-sm text-[11px] font-bold ${projColor} whitespace-normal break-words inline-block" title="${(p.group || 'None').toUpperCase()}">${projAbbr}</span>
                </div>
                ${p.relatedTrainee && p.role === 'CAREGIVER' ? `<div class="mt-1.5 font-bold text-purple-600 dark:text-purple-400 text-xs tracking-tight opacity-70">[${p.relatedTrainee.toUpperCase()}]</div>` : ''}
            </div>
            <button class="shrink-0 p-1.5 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition focus:outline-none bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>`;
    });
    cont.innerHTML = `<div class="flex flex-col gap-2 w-full">${html}</div>`;
}

function addExtractExcluded(nric) {
    extractExcludedNrics.add(nric);
    document.getElementById('extractSearchInput').value = '';
    renderExtractSearchResults();
    renderExtractExcluded();
}

function removeExtractExcluded(nric) {
    extractExcludedNrics.delete(nric);
    renderExtractSearchResults();
    renderExtractExcluded();
}

function performExtraction() {
    if (!globalRoster) {
        showToast("Roster data not loaded yet.");
        return;
    }
    
    document.getElementById('extractionModal').classList.add('hidden-force');
    
    if (typeof showOverlay === 'function') showOverlay("Extracting data to Drive...");
    
    const excluded = Array.from(extractExcludedNrics);
    
    apiCall({
        action: 'extractData',
        extractType: currentExtractType,
        excludedNrics: excluded
    }).then(res => {
        if (typeof hideOverlay === 'function') hideOverlay();
        if (res.status === 'success') {
            showToast("Extraction successful!");
            if (typeof renderDriveList === 'function' && window.currentDrivePath) {
                // Refresh drive view if we are on the root level or let it be if deeply nested
                if(window.currentDrivePath.length === 0) refreshCurrentDriveFolder(null);
            }
        } else {
            showToast("Extraction failed: " + res.message, 'error');
        }
    }).catch(err => {
        if (typeof hideOverlay === 'function') hideOverlay();
        showToast("Error extracting data.", 'error');
    });
}
