const fs = require('fs');
let content = fs.readFileSync('frontend/js/profile.js', 'utf8');

// 1. Add the navigation HTML
const navHtml = `
let navHtml = '';
if (isCurrentUserGroupIC && loadedGroupMembers.length > 0) {
    navHtml = \`
    <div class="flex gap-2 mb-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg shadow-inner sticky top-[60px] z-[30] backdrop-blur-md bg-opacity-90">
        <button id="nav-btn-profile" onclick="switchProfileTab('profile')" class="flex-1 text-xs font-bold py-2 rounded shadow bg-white dark:bg-gray-700 text-primary transition-all">My Profile</button>
        <button id="nav-btn-group" onclick="switchProfileTab('group')" class="flex-1 text-xs font-bold py-2 rounded text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all"><i class="fa-solid fa-crown mr-1"></i> My Group</button>
    </div>
    \`;
}
`;

// 2. Modify the myGroupHtml string to be hidden by default
const searchStr = `let myGroupHtml = ""; if (isCurrentUserGroupIC && loadedGroupMembers.length > 0) { myGroupHtml = \`<div class="bg-white dark:bg-gray-900 p-4 rounded-xl border-2 border-amber-200 dark:border-amber-800 shadow-md mb-4">`;
const replaceStr = `let myGroupHtml = ""; if (isCurrentUserGroupIC && loadedGroupMembers.length > 0) { myGroupHtml = \`<div id="section-my-group" class="hidden-force bg-white dark:bg-gray-900 p-4 rounded-xl border-2 border-amber-200 dark:border-amber-800 shadow-md mb-4">`;

content = content.replace(searchStr, replaceStr);

// 3. Wrap personal details in a section
content = content.replace('let personalDetailsHeader = \'\';', 'let personalDetailsHeader = \'<div id="section-my-profile">\';');

// 4. Update the final innerHTML assignment and close the div
const oldInnerHTML = `tabProfile.innerHTML = topBannersHtml + myGroupHtml + personalDetailsHeader + profilesHtml + receiptsHtml + paymentHtml;`;
const newInnerHTML = `
${navHtml}
tabProfile.innerHTML = navHtml + topBannersHtml + myGroupHtml + personalDetailsHeader + profilesHtml + receiptsHtml + paymentHtml + '</div>';
`;
content = content.replace(oldInnerHTML, newInnerHTML);


// 5. Add the switchProfileTab function
const switchTabFunc = `
window.switchProfileTab = function(tab) {
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
};
`;

content += '\n' + switchTabFunc;

fs.writeFileSync('frontend/js/profile.js', content);
