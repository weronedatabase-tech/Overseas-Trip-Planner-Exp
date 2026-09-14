const fs = require('fs');
let file = fs.readFileSync('frontend/js/participants.js', 'utf8');

const target = `    <div class="py-1 px-2 md:px-3 bg-gray-50 dark:bg-gray-950 border-b-2 border-gray-200 dark:border-gray-800 shrink-0 flex items-center gap-2">
        <div class="relative w-full flex-1">
            <input type="text" id="rosterSearch" oninput="handleRosterSearch()" placeholder="Fuzzy search across all fields..." class="w-full p-2 pl-9 pr-8 border-2 border-gray-300 dark:border-gray-700 rounded-lg text-sm font-semibold bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-md transition">
            <svg class="w-4 h-4 absolute left-3 top-3 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <button onclick="clearSearch('rosterSearch', 'handleRosterSearch')" class="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        </div>
        <div class="relative">`;

const replacement = `    <div class="py-2 px-2 md:px-3 bg-gray-50 dark:bg-gray-950 border-b-2 border-gray-200 dark:border-gray-800 shrink-0 flex flex-col md:flex-row items-stretch md:items-center gap-2">
        <div class="relative w-full md:flex-1">
            <input type="text" id="rosterSearch" oninput="handleRosterSearch()" placeholder="Fuzzy search across all fields..." class="w-full p-2 pl-9 pr-8 border-2 border-gray-300 dark:border-gray-700 rounded-lg text-sm font-semibold bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-md transition">
            <svg class="w-4 h-4 absolute left-3 top-3 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <button onclick="clearSearch('rosterSearch', 'handleRosterSearch')" class="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        </div>
        <div class="flex items-center justify-end gap-2 shrink-0">
            <div class="relative">`;

const match = file.indexOf(target);
if (match === -1) {
    console.log("Not found using exact match, trying flexible whitespace...");
    // Let's just use regex
    const regex = /<div class="py-1 px-2 md:px-3 bg-gray-50 dark:bg-gray-950 border-b-2 border-gray-200 dark:border-gray-800 shrink-0 flex items-center gap-2">\s*<div class="relative w-full flex-1">[\s\S]*?<div class="relative">/;
    if (regex.test(file)) {
        file = file.replace(regex, replacement);
        fs.writeFileSync('frontend/js/participants.js', file);
        console.log("Replaced successfully with regex!");
    } else {
        console.log("Regex also failed.");
    }
} else {
    file = file.replace(target, replacement);
    fs.writeFileSync('frontend/js/participants.js', file);
    console.log("Replaced successfully!");
}
