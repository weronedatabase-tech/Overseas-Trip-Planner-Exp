const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

// 1. Re-position navHtml
const oldNav = `let navHtml = '';
if (isCurrentUserGroupIC && loadedGroupMembers.length > 0) {
    navHtml = \`
    <div class="flex gap-2 mb-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg shadow-inner sticky top-[60px] z-[30] backdrop-blur-md bg-opacity-90">
        <button id="nav-btn-profile" onclick="switchProfileTab('profile')" class="flex-1 text-xs font-bold py-2 rounded shadow bg-white dark:bg-gray-700 text-primary transition-all">My Profile</button>
        <button id="nav-btn-group" onclick="switchProfileTab('group')" class="flex-1 text-xs font-bold py-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all"><i class="fa-solid fa-crown mr-1"></i> My Group</button>
<button id="nav-btn-attendance" onclick="switchProfileTab('attendance')" class="flex-1 text-xs font-bold py-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all"><i class="fa-regular fa-calendar-check mr-1"></i> Attendance</button>
    </div>
    \`;
}`;

const newNav = `let navHtml = '';
if (isCurrentUserGroupIC && loadedGroupMembers.length > 0) {
    navHtml = \`
    <div class="flex gap-2 mt-4 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] sticky bottom-4 z-[50] backdrop-blur-md bg-opacity-95 border-2 border-gray-200 dark:border-gray-700 mx-auto max-w-lg w-full mb-4">
        <button id="nav-btn-profile" onclick="switchProfileTab('profile')" class="flex-1 text-xs font-bold py-2.5 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-primary transition-all">My Profile</button>
        <button id="nav-btn-group" onclick="switchProfileTab('group')" class="flex-1 text-xs font-bold py-2.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all"><i class="fa-solid fa-crown mr-1"></i> My Group</button>
        <button id="nav-btn-attendance" onclick="switchProfileTab('attendance')" class="flex-1 text-xs font-bold py-2.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all"><i class="fa-regular fa-calendar-check mr-1"></i> Attendance</button>
    </div>
    \`;
}`;

code = code.replace(oldNav, newNav);

// 2. Change innerHTML order
const oldInner = `tabProfile.innerHTML = navHtml + topBannersHtml + personalDetailsHeader + profilesHtml + receiptsHtml + paymentHtml + '</div>' + myGroupHtml + myAttendanceHtml;`;
const newInner = `
// Sort loadedGroupMembers using special sort logic if available
if (window.sortParticipantsSpecial) {
    window.sortParticipantsSpecial(loadedGroupMembers, globalLogistics && globalLogistics.participants ? globalLogistics.participants : loadedGroupMembers);
}

// Regenerate myGroupHtml after sorting
let myGroupSortedHtml = ""; 
if (isCurrentUserGroupIC && loadedGroupMembers.length > 0) { 
    myGroupSortedHtml = \`<div id="section-my-group" class="hidden-force bg-white dark:bg-gray-900 p-4 rounded-xl border-2 border-amber-200 dark:border-amber-800 shadow-md mb-4 pb-20">
        <div class="flex flex-col gap-2 border-b-2 border-amber-200 dark:border-amber-800 pb-3 mb-3">
            <h3 class="text-sm font-black text-amber-900 dark:text-amber-100 tracking-tight"><i class="fa-solid fa-crown text-amber-500 mr-2"></i> My Group (\${loadedLogisticsGroup})</h3>
            <div class="relative w-full">
                <input type="text" id="myGroupSearchInput" oninput="filterMyGroup()" placeholder="Search members..." class="w-full p-2 pl-8 border-2 border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 font-bold text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-gray-900 dark:text-white shadow-sm transition">
                <svg class="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
        </div>
        <p class="text-[11px] text-gray-500 dark:text-gray-400 mb-3 font-semibold">Click on a member to view their full details.</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="myGroupMembersGrid">\` + 
        loadedGroupMembers.map(member => { 
            return \`<div class="my-group-card p-3 bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-lg cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 transition shadow-sm" onclick="showPairingDetails('\${member.nric}')" data-name="\${(member.fullName||'').toLowerCase()} \${(member.shortName||'').toLowerCase()} \${(member.role||'').toLowerCase()}">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-gray-900 dark:text-white text-sm">\${member.fullName} \${member.shortName ? "(" + member.shortName + ")" : ""}</span>
                    <span class="text-[10px] uppercase font-black \${member.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (member.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400')} bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded shadow-sm">\${member.role}</span>
                </div>
                <div class="flex flex-col gap-1 mt-2">
                    <div class="text-[11px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><i class="fa-solid fa-utensils w-4 text-center"></i> <span class="text-gray-700 dark:text-gray-300">\${member.diet || "None"}</span></div>
                    <div class="text-[11px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><i class="fa-solid fa-bus w-4 text-center"></i> <span class="text-gray-700 dark:text-gray-300">\${member.bus || "None"}</span></div>
                </div>
            </div>\`; 
        }).join("") + 
        \`</div></div>\`; 
}

tabProfile.innerHTML = topBannersHtml + personalDetailsHeader + profilesHtml + receiptsHtml + paymentHtml + '</div>' + myGroupSortedHtml + myAttendanceHtml + navHtml;
`;

code = code.replace(oldInner, newInner);

// 3. Add search input logic to Attendance HTML
const oldAttHtml = `<div class="flex justify-between items-center border-b-2 border-blue-200 dark:border-blue-800 pb-2 mb-3">
            <h3 class="text-sm font-black text-blue-900 dark:text-blue-100 tracking-tight">
                <i class="fa-regular fa-calendar-check text-blue-500 mr-2"></i> Attendance
            </h3>
            <button onclick="promptAddIcJuncture()" class="text-[11px] bg-blue-50 text-blue-600 border-2 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 font-bold px-2 py-0.5 rounded hover:bg-blue-100 transition focus:outline-none">+ New</button>
        </div>
        <div class="mb-3">
            <select id="icJunctureSelect" onchange="renderGroupAttendance()" class="w-full p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-bold">`;

const newAttHtml = `<div class="flex justify-between items-center border-b-2 border-blue-200 dark:border-blue-800 pb-2 mb-3">
            <h3 class="text-sm font-black text-blue-900 dark:text-blue-100 tracking-tight">
                <i class="fa-regular fa-calendar-check text-blue-500 mr-2"></i> Attendance
            </h3>
            <button onclick="promptAddIcJuncture()" class="text-[11px] bg-blue-50 text-blue-600 border-2 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 font-bold px-2 py-0.5 rounded hover:bg-blue-100 transition focus:outline-none">+ New</button>
        </div>
        <div class="mb-3 flex flex-col gap-2">
            <select id="icJunctureSelect" onchange="renderGroupAttendance()" class="w-full p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-bold">`;

code = code.replace(oldAttHtml, newAttHtml);

// 4. Update renderGroupAttendance to sort using special logic
const oldSort = `    // Sort logic
    let sortedMembers = [...loadedGroupMembers];
    sortedMembers.sort((a,b) => String(a.fullName).localeCompare(String(b.fullName)));`;

const newSort = `    // Sort logic
    let sortedMembers = [...loadedGroupMembers];
    if (window.sortParticipantsSpecial) {
        window.sortParticipantsSpecial(sortedMembers, globalLogistics && globalLogistics.participants ? globalLogistics.participants : sortedMembers);
    } else {
        sortedMembers.sort((a,b) => String(a.fullName).localeCompare(String(b.fullName)));
    }`;

code = code.replace(oldSort, newSort);

// 5. Add search bar and class to attendance cards
const oldHtmlVar = `let html = '<div class="flex flex-col gap-2">';`;
const newHtmlVar = `
    let html = \`
    <div class="relative w-full mb-3">
        <input type="text" id="myAttSearchInput" oninput="filterMyAtt()" placeholder="Search members..." class="w-full p-2 pl-8 border-2 border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 font-bold text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white shadow-sm transition">
        <svg class="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
    </div>
    <div class="flex flex-col gap-2" id="myAttMembersGrid">\`;
`;
code = code.replace(oldHtmlVar, newHtmlVar);

const oldCard = `<div class="flex items-center justify-between p-2 rounded-lg border-2 \${bgClass} cursor-pointer select-none transition-colors" onclick="toggleIcAttendance('\${member.nric}')" id="att-card-\${member.nric}">`;
const newCard = `<div class="my-att-card flex items-center justify-between p-2 rounded-lg border-2 \${bgClass} cursor-pointer select-none transition-colors" onclick="toggleIcAttendance('\${member.nric}')" id="att-card-\${member.nric}" data-name="\${(member.fullName||'').toLowerCase()} \${(member.shortName||'').toLowerCase()} \${(member.role||'').toLowerCase()}">`;
code = code.replace(oldCard, newCard);


// 6. Add the filter scripts
const filters = `
window.filterMyGroup = function() {
    const query = (document.getElementById('myGroupSearchInput').value || '').toLowerCase().trim();
    const cards = document.querySelectorAll('.my-group-card');
    cards.forEach(card => {
        const nameData = card.getAttribute('data-name');
        if (nameData.includes(query)) card.style.display = '';
        else card.style.display = 'none';
    });
};

window.filterMyAtt = function() {
    const query = (document.getElementById('myAttSearchInput').value || '').toLowerCase().trim();
    const cards = document.querySelectorAll('.my-att-card');
    cards.forEach(card => {
        const nameData = card.getAttribute('data-name');
        if (nameData.includes(query)) card.style.display = '';
        else card.style.display = 'none';
    });
};
`;

code += '\n' + filters;

fs.writeFileSync('frontend/js/profile.js', code);
