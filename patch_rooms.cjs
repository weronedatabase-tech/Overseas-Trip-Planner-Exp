const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

code = code.replace(
    /<div class="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">\s*<div id="roomListContainer"/s,
    `<div class="flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-colors bg-white dark:bg-gray-950">
            <div class="flex items-center justify-between px-2 py-1.5 shrink-0 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">Assigned Rooms</span>
                <button onclick="openManageRoomsSheet()" class="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-primary hover:border-primary transition focus:outline-none"><i class="fa-solid fa-cog mr-1"></i>Manage</button>
            </div>
            <div id="roomListContainer"`
);

// Remove the `addRoom()` button from header. Wait, it's:
// <button onclick="addRoom()" class="bg-gray-100 dark:bg-gray-800 p-1 md:p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition focus:outline-none border border-gray-200 dark:border-gray-700 shadow-sm shrink-0" title="Add Room(s)">
code = code.replace(
    /<button onclick="addRoom\(\)".*?<\/button>/s,
    ''
);

fs.writeFileSync('frontend/js/logistics.js', code);
