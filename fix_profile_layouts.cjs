const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

// 1. Fix the tab selector
const navOld = `<div class="flex gap-2 mt-4 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] sticky bottom-4 z-[50] backdrop-blur-md bg-opacity-95 border-2 border-gray-200 dark:border-gray-700 mx-auto max-w-lg w-full mb-4">`;
const navNew = `<div class="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] fixed bottom-4 left-1/2 -translate-x-1/2 z-[50] backdrop-blur-md bg-opacity-95 border-2 border-gray-200 dark:border-gray-700 w-[calc(100%-2rem)] max-w-lg mb-0 transition-transform duration-300">`;
code = code.replace(navOld, navNew);

// 2. Fix the My Group section search sticking
const groupOld = `<div id="section-my-group" class="hidden-force bg-white dark:bg-gray-900 p-4 rounded-xl border-2 border-amber-200 dark:border-amber-800 shadow-md mb-4 pb-20">
        <div class="flex flex-col gap-2 border-b-2 border-amber-200 dark:border-amber-800 pb-3 mb-3">`;
const groupNew = `<div id="section-my-group" class="hidden-force bg-white dark:bg-gray-900 p-4 rounded-xl border-2 border-amber-200 dark:border-amber-800 shadow-md mb-4 pb-24 relative">
        <div class="flex flex-col gap-2 border-b-2 border-amber-200 dark:border-amber-800 pb-3 mb-3 sticky top-0 bg-white dark:bg-gray-900 z-10 pt-4 -mt-4">`;
code = code.replace(groupOld, groupNew);

// 3. Fix the My Attendance search sticking
const attOld = `<div id="section-my-attendance" class="hidden-force bg-white dark:bg-gray-900 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800 shadow-md mb-4">
        <div class="flex justify-between items-center border-b-2 border-blue-200 dark:border-blue-800 pb-2 mb-3">
            <h3 class="text-sm font-black text-blue-900 dark:text-blue-100 tracking-tight">
                <i class="fa-regular fa-calendar-check text-blue-500 mr-2"></i> Attendance
            </h3>
            <button onclick="promptAddIcJuncture()" class="text-[11px] bg-blue-50 text-blue-600 border-2 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 font-bold px-2 py-0.5 rounded hover:bg-blue-100 transition focus:outline-none">+ New</button>
        </div>
        <div class="mb-3 flex flex-col gap-2">
            <select id="icJunctureSelect" onchange="renderGroupAttendance()" class="w-full p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-bold">
                <option value="">Select a juncture...</option>
                <optgroup label="Admin Junctures" id="optgroup-admin-junctures"></optgroup>
                <optgroup label="My Custom Junctures" id="optgroup-ic-junctures"></optgroup>
            </select>
        </div>
        <div id="icAttendanceContainer" class="min-h-[100px] flex items-center justify-center text-sm font-bold text-gray-400">`;

const attNew = `<div id="section-my-attendance" class="hidden-force bg-white dark:bg-gray-900 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800 shadow-md mb-4 pb-24 relative">
        <div class="sticky top-0 bg-white dark:bg-gray-900 z-10 pt-4 -mt-4 pb-3 mb-3 border-b-2 border-blue-200 dark:border-blue-800 flex flex-col gap-3">
            <div class="flex justify-between items-center">
                <h3 class="text-sm font-black text-blue-900 dark:text-blue-100 tracking-tight">
                    <i class="fa-regular fa-calendar-check text-blue-500 mr-2"></i> Attendance
                </h3>
                <button onclick="promptAddIcJuncture()" class="text-[11px] bg-blue-50 text-blue-600 border-2 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 font-bold px-2 py-0.5 rounded hover:bg-blue-100 transition focus:outline-none">+ New</button>
            </div>
            <div class="flex flex-col gap-2">
                <select id="icJunctureSelect" onchange="renderGroupAttendance()" class="w-full p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-bold">
                    <option value="">Select a juncture...</option>
                    <optgroup label="Admin Junctures" id="optgroup-admin-junctures"></optgroup>
                    <optgroup label="My Custom Junctures" id="optgroup-ic-junctures"></optgroup>
                </select>
                <div class="relative w-full hidden-force" id="icAttendanceSearchWrapper">
                    <input type="text" id="myAttSearchInput" oninput="filterMyAtt()" placeholder="Search members..." class="w-full p-2 pl-8 border-2 border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 font-bold text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white shadow-sm transition">
                    <svg class="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
            </div>
        </div>
        <div id="icAttendanceContainer" class="min-h-[100px] flex items-center justify-center text-sm font-bold text-gray-400">`;

code = code.replace(attOld, attNew);

// 4. Update renderGroupAttendance to remove the search bar generation
const renderOld = `    let html = \`
    <div class="relative w-full mb-3">
        <input type="text" id="myAttSearchInput" oninput="filterMyAtt()" placeholder="Search members..." class="w-full p-2 pl-8 border-2 border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 font-bold text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white shadow-sm transition">
        <svg class="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
    </div>
    <div class="flex flex-col gap-2" id="myAttMembersGrid">\`;`;

const renderNew = `    const searchWrapper = document.getElementById('icAttendanceSearchWrapper');
    if (searchWrapper) searchWrapper.classList.remove('hidden-force');
    const searchInput = document.getElementById('myAttSearchInput');
    if (searchInput) searchInput.value = '';

    let html = \`
    <div class="flex flex-col gap-2" id="myAttMembersGrid">\`;`;

code = code.replace(renderOld, renderNew);

// Update renderGroupAttendance failure path to hide the search bar
const failOld = `    const container = document.getElementById('icAttendanceContainer');
    if (!juncture) {
        container.innerHTML = 'Select a juncture to take attendance';
        return;
    }`;

const failNew = `    const container = document.getElementById('icAttendanceContainer');
    const searchWrapper = document.getElementById('icAttendanceSearchWrapper');
    if (!juncture) {
        container.innerHTML = 'Select a juncture to take attendance';
        if (searchWrapper) searchWrapper.classList.add('hidden-force');
        return;
    }`;
code = code.replace(failOld, failNew);

fs.writeFileSync('frontend/js/profile.js', code);
console.log("Done");
