const fs = require('fs');
let c = fs.readFileSync('frontend/js/extraction.js', 'utf8');

const oldPerform = `function performExtraction() {
    if (!extractGlobalRoster) {
        showToast("Roster data not loaded yet.");
        return;
    }
    
    document.getElementById('extractionModal').classList.add('hidden-force');
    
    if (typeof showOverlay === 'function') showOverlay("Extracting data to Drive...");
    
    const excluded = Array.from(extractExcludedNrics);
    
    apiCall('extractData', {
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
}`;

const newPerform = `function performExtraction() {
    if (!extractGlobalRoster) {
        showToast("Roster data not loaded yet.");
        return;
    }
    
    document.getElementById('extractionModal').classList.add('hidden-force');
    
    let overlay = document.getElementById('extractOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'extractOverlay';
        overlay.className = 'fixed inset-0 bg-white/80 dark:bg-black/80 z-[200] flex flex-col justify-center items-center backdrop-blur-sm hidden-force text-gray-800 dark:text-white';
        overlay.innerHTML = '<div class="loader !w-10 !h-10 border-primary mb-4"></div><div class="font-bold tracking-widest uppercase text-sm">Extracting to Drive...</div>';
        document.body.appendChild(overlay);
    }
    overlay.classList.remove('hidden-force');
    
    const excluded = Array.from(extractExcludedNrics);
    
    apiCall('extractData', {
        extractType: currentExtractType,
        excludedNrics: excluded
    }).then(res => {
        overlay.classList.add('hidden-force');
        if (res.status === 'success') {
            showToast("Extraction successful!");
            if (typeof refreshCurrentDriveFolder === 'function') {
                if (typeof currentDrivePath !== 'undefined' && currentDrivePath.length <= 1) {
                    refreshCurrentDriveFolder(null);
                }
            }
        } else {
            showToast("Extraction failed: " + res.message, 'error');
        }
    }).catch(err => {
        overlay.classList.add('hidden-force');
        showToast("Error extracting data.", 'error');
    });
}`;

c = c.replace(oldPerform, newPerform);
fs.writeFileSync('frontend/js/extraction.js', c);
console.log("Updated extraction.js");