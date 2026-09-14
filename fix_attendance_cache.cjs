const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

// Ensure lastFetchedJuncture exists
if (!code.includes('let lastFetchedJuncture = "";')) {
    code = code.replace('let pendingIcAttendanceUpdates = new Map();', 'let pendingIcAttendanceUpdates = new Map();\nlet lastFetchedJuncture = "";');
}

const renderStart = `    const searchWrapper = document.getElementById('icAttendanceSearchWrapper');
    if (!juncture) {
        container.innerHTML = 'Select a juncture to take attendance';
        if (searchWrapper) searchWrapper.classList.add('hidden-force');
        return;
    }

    container.innerHTML = '<div class="loader w-6 h-6 border-blue-500 mx-auto"></div>';
    
    try {
        const res = await apiCall('fetchAttendanceData', { juncture: juncture, forceRebuild });
        currentIcAttendanceData = res.data || {};
    } catch(e) {
        console.error("Failed to load attendance", e);
        container.innerHTML = '<div class="text-red-500">Failed to load attendance data.</div>';
        return;
    }`;

const renderNew = `    const searchWrapper = document.getElementById('icAttendanceSearchWrapper');
    if (!juncture) {
        container.innerHTML = 'Select a juncture to take attendance';
        if (searchWrapper) searchWrapper.classList.add('hidden-force');
        return;
    }

    if (forceRebuild || juncture !== lastFetchedJuncture) {
        container.innerHTML = '<div class="loader w-6 h-6 border-blue-500 mx-auto"></div>';
        
        try {
            const res = await apiCall('fetchAttendanceData', { juncture: juncture, forceRebuild });
            currentIcAttendanceData = res.data || {};
            lastFetchedJuncture = juncture;
        } catch(e) {
            console.error("Failed to load attendance", e);
            container.innerHTML = '<div class="text-red-500">Failed to load attendance data.</div>';
            return;
        }
    }`;

code = code.replace(renderStart, renderNew);
fs.writeFileSync('frontend/js/profile.js', code);
console.log("Cached attendance");
