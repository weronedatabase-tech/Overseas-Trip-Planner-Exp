const fs = require('fs');
const path = './frontend/js/attendance.js';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `<h3 class="text-xs md:text-sm font-black text-gray-900 dark:text-white tracking-tight hidden md:block">Live Attendance</h3>`;
const newStr = `<h3 class="text-xs md:text-sm font-black text-gray-900 dark:text-white tracking-tight shrink-0">Live Attendance</h3>`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, newStr);
    
    // Also fix the layout of the top row to ensure it aligns well on mobile
    const topRowOld = `<div class="flex justify-between items-center gap-1">
     <h3 class="text-xs md:text-sm font-black text-gray-900 dark:text-white tracking-tight shrink-0">Live Attendance</h3>
     
     <div class="flex bg-gray-200 dark:bg-gray-700 p-0.5 rounded border border-gray-300 dark:border-gray-600 shrink-0 mx-auto md:mx-0">`;
     
    const topRowNew = `<div class="flex justify-between items-center gap-2 w-full">
     <h3 class="text-xs md:text-sm font-black text-gray-900 dark:text-white tracking-tight shrink-0">Live Attendance</h3>
     
     <div class="flex bg-gray-200 dark:bg-gray-700 p-0.5 rounded border border-gray-300 dark:border-gray-600 shrink-0 ml-auto">`;

    if (content.includes(`<div class="flex justify-between items-center gap-1">`)) {
         content = content.replace(
             `<div class="flex justify-between items-center gap-1">
     <h3 class="text-xs md:text-sm font-black text-gray-900 dark:text-white tracking-tight shrink-0">Live Attendance</h3>
     
     <div class="flex bg-gray-200 dark:bg-gray-700 p-0.5 rounded border border-gray-300 dark:border-gray-600 shrink-0 mx-auto md:mx-0">`,
             topRowNew
         );
    }
    
    fs.writeFileSync(path, content, 'utf8');
    console.log("Patched Live Attendance visibility.");
} else {
    console.log("Target string not found.");
}
