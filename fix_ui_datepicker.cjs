const fs = require('fs');
let c = fs.readFileSync('frontend/js/ui.js', 'utf8');

c = c.replace(/document\.addEventListener\("DOMContentLoaded", \(\) => {[\s\S]*?}\);/, `
function initDatePicker() {
    if (!document.getElementById('datePickerSheet')) {
        const div = document.createElement('div');
        div.id = "datePickerSheet";
        div.className = "fixed inset-0 bg-black/60 z-[120] hidden-force flex flex-col justify-end";
        div.innerHTML = \`<div class="bg-white dark:bg-gray-900 rounded-t-3xl w-full max-w-md mx-auto overflow-hidden shadow-2xl animate-slide-up border-t border-gray-200 dark:border-gray-800"><div class="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-800"><span class="font-bold text-lg text-gray-800 dark:text-gray-100">Select Date</span><button type="button" onclick="closePicker()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold px-2 focus:outline-none">&times;</button></div><div class="relative flex h-[200px] text-lg font-bold bg-white dark:bg-gray-950"><div class="picker-highlight"></div><div class="flex-1 picker-col" id="colDay"></div><div class="flex-1 picker-col" id="colMonth"></div><div class="flex-1 picker-col" id="colYear"></div></div><div class="p-5 border-t border-gray-200 dark:border-gray-800"><button type="button" onclick="confirmPicker()" class="w-full bg-primary text-white py-3.5 rounded-xl font-bold text-lg shadow-md focus:outline-none hover:bg-green-600 transition">Done</button></div></div>\`;
        document.body.appendChild(div);
    }
}
initDatePicker();
`);

c = c.replace(/window\.openDatePicker = function openDatePicker\(targetId, type\) {/, `
window.openDatePicker = function openDatePicker(targetId, type) {
  if (!document.getElementById('datePickerSheet')) initDatePicker();
`);

fs.writeFileSync('frontend/js/ui.js', c);
console.log("Updated datepicker");