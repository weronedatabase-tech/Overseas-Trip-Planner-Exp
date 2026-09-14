const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

// Add Attendance Tab to navigation
const searchStr = `<button id="nav-btn-group" onclick="switchProfileTab('group')" class="flex-1 text-xs font-bold py-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all"><i class="fa-solid fa-crown mr-1"></i> My Group</button>`;
const replaceStr = `<button id="nav-btn-group" onclick="switchProfileTab('group')" class="flex-1 text-xs font-bold py-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all"><i class="fa-solid fa-crown mr-1"></i> My Group</button>
<button id="nav-btn-attendance" onclick="switchProfileTab('attendance')" class="flex-1 text-xs font-bold py-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all"><i class="fa-regular fa-calendar-check mr-1"></i> Attendance</button>`;

code = code.replace(searchStr, replaceStr);

// Modify switchProfileTab
const oldSwitch = `window.switchProfileTab = function(tab) {
    const btnProfile = document.getElementById('nav-btn-profile');
    const btnGroup = document.getElementById('nav-btn-group');
    const secProfile = document.getElementById('section-my-profile');
    const secGroup = document.getElementById('section-my-group');
    
    if(!btnProfile || !btnGroup || !secProfile || !secGroup) return;

    if(tab === 'profile') {
        btnProfile.className = "flex-1 text-xs font-bold py-2 rounded shadow bg-white dark:bg-gray-700 text-primary transition-all";
        btnGroup.className = "flex-1 text-xs font-bold py-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all";
        secProfile.classList.remove('hidden-force');
        secGroup.classList.add('hidden-force');
    } else {
        btnGroup.className = "flex-1 text-xs font-bold py-2 rounded shadow bg-white dark:bg-gray-700 text-amber-500 transition-all";
        btnProfile.className = "flex-1 text-xs font-bold py-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all";
        secGroup.classList.remove('hidden-force');
        secProfile.classList.add('hidden-force');
    }
};`;

const newSwitch = `window.switchProfileTab = function(tab) {
    const btnProfile = document.getElementById('nav-btn-profile');
    const btnGroup = document.getElementById('nav-btn-group');
    const btnAttendance = document.getElementById('nav-btn-attendance');
    const secProfile = document.getElementById('section-my-profile');
    const secGroup = document.getElementById('section-my-group');
    const secAttendance = document.getElementById('section-my-attendance');
    
    if(!btnProfile || !btnGroup || !secProfile || !secGroup || !btnAttendance || !secAttendance) return;

    btnProfile.className = "flex-1 text-xs font-bold py-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all";
    btnGroup.className = "flex-1 text-xs font-bold py-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all";
    btnAttendance.className = "flex-1 text-xs font-bold py-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all";
    
    secProfile.classList.add('hidden-force');
    secGroup.classList.add('hidden-force');
    secAttendance.classList.add('hidden-force');

    if(tab === 'profile') {
        btnProfile.className = "flex-1 text-xs font-bold py-2 rounded shadow bg-white dark:bg-gray-700 text-primary transition-all";
        secProfile.classList.remove('hidden-force');
    } else if(tab === 'group') {
        btnGroup.className = "flex-1 text-xs font-bold py-2 rounded shadow bg-white dark:bg-gray-700 text-amber-500 transition-all";
        secGroup.classList.remove('hidden-force');
    } else if(tab === 'attendance') {
        btnAttendance.className = "flex-1 text-xs font-bold py-2 rounded shadow bg-white dark:bg-gray-700 text-blue-500 transition-all";
        secAttendance.classList.remove('hidden-force');
        if (typeof renderGroupAttendance === 'function') renderGroupAttendance();
    }
};`;

code = code.replace(oldSwitch, newSwitch);

// Declare variable to hold icJunctures
if (!code.includes('let loadedIcJunctures = [];')) {
    code = code.replace(
        'let isCurrentUserGroupIC = false;',
        'let isCurrentUserGroupIC = false;\nlet loadedIcJunctures = [];'
    );
    code = code.replace(
        'isCurrentUserGroupIC = profRes.isGroupIC === true;',
        'isCurrentUserGroupIC = profRes.isGroupIC === true;\n loadedIcJunctures = profRes.icJunctures || [];'
    );
}

fs.writeFileSync('frontend/js/profile.js', code);
