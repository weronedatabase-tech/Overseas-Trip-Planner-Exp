const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const navOld = `<div class="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] fixed bottom-4 left-1/2 -translate-x-1/2 z-[50] backdrop-blur-md bg-opacity-95 border-2 border-gray-200 dark:border-gray-700 w-[calc(100%-2rem)] max-w-lg mb-0 transition-transform duration-300">
        <button id="nav-btn-profile" onclick="switchProfileTab('profile')" class="flex-1 text-xs font-bold py-2.5 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-primary transition-all">My Profile</button>
        <button id="nav-btn-group" onclick="switchProfileTab('group')" class="flex-1 text-xs font-bold py-2.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all"><i class="fa-solid fa-crown mr-1"></i> My Group</button>
        <button id="nav-btn-attendance" onclick="switchProfileTab('attendance')" class="flex-1 text-xs font-bold py-2.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all"><i class="fa-regular fa-calendar-check mr-1"></i> Attendance</button>
    </div>`;

const navNew = `<div class="flex gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-2xl shadow-[0_-15px_50px_rgba(0,0,0,0.3)] fixed bottom-4 left-1/2 -translate-x-1/2 z-[50] backdrop-blur-md bg-opacity-95 border-2 border-gray-300 dark:border-gray-600 w-[calc(100%-2rem)] max-w-lg mb-0 transition-transform duration-300">
        <button id="nav-btn-profile" onclick="switchProfileTab('profile')" class="flex-1 text-sm font-black py-3 rounded-xl shadow-md bg-white dark:bg-gray-700 text-primary transition-all border border-gray-200 dark:border-gray-600 scale-[1.02]">My Profile</button>
        <button id="nav-btn-group" onclick="switchProfileTab('group')" class="flex-1 text-sm font-bold py-3 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-all border border-transparent"><i class="fa-solid fa-crown mr-1"></i> My Group</button>
        <button id="nav-btn-attendance" onclick="switchProfileTab('attendance')" class="flex-1 text-sm font-bold py-3 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-all border border-transparent"><i class="fa-regular fa-calendar-check mr-1"></i> Attendance</button>
    </div>`;

code = code.replace(navOld, navNew);

const switchOld = `    btnProfile.className = "flex-1 text-xs font-bold py-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all";
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
    }`;

const switchNew = `    btnProfile.className = "flex-1 text-sm font-bold py-3 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-all border border-transparent";
    btnGroup.className = "flex-1 text-sm font-bold py-3 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-all border border-transparent";
    btnAttendance.className = "flex-1 text-sm font-bold py-3 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-all border border-transparent";
    
    secProfile.classList.add('hidden-force');
    secGroup.classList.add('hidden-force');
    secAttendance.classList.add('hidden-force');

    if(tab === 'profile') {
        btnProfile.className = "flex-1 text-sm font-black py-3 rounded-xl shadow-md bg-white dark:bg-gray-700 text-primary transition-all border border-gray-200 dark:border-gray-600 scale-[1.02]";
        secProfile.classList.remove('hidden-force');
    } else if(tab === 'group') {
        btnGroup.className = "flex-1 text-sm font-black py-3 rounded-xl shadow-md bg-white dark:bg-gray-700 text-amber-500 transition-all border border-amber-200 dark:border-amber-700 scale-[1.02]";
        secGroup.classList.remove('hidden-force');
    } else if(tab === 'attendance') {
        btnAttendance.className = "flex-1 text-sm font-black py-3 rounded-xl shadow-md bg-white dark:bg-gray-700 text-blue-500 transition-all border border-blue-200 dark:border-blue-700 scale-[1.02]";
        secAttendance.classList.remove('hidden-force');
        if (typeof renderGroupAttendance === 'function') renderGroupAttendance();
    }`;

code = code.replace(switchOld, switchNew);
fs.writeFileSync('frontend/js/profile.js', code);
console.log("Done");
