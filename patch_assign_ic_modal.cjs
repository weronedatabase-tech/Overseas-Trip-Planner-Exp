const fs = require('fs');
let html = fs.readFileSync('grouping.html', 'utf8');

const modalHtml = `<!-- ASSIGN IC MODAL -->
<div id="assignICModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm hidden z-[70] flex items-center justify-center p-4 transition-opacity duration-300">
<div class="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl border-2 border-gray-200 dark:border-zinc-800 flex flex-col max-h-[90vh] shadow-2xl">
<div class="p-4 border-b-2 border-gray-200 dark:border-zinc-800 flex justify-between items-center shrink-0">
<h3 class="text-gray-900 dark:text-white font-bold text-lg"><i class="fa-solid fa-crown mr-2 text-yellow-500"></i>Assign ICs</h3>
<button onclick="closeAssignICModal()" class="text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"><i class="fa-solid fa-xmark text-xl"></i></button>
</div>
<div class="p-4 flex-grow overflow-y-auto custom-scrollbar pb-12">
<p class="text-xs text-gray-500 dark:text-gray-400 mb-4">Select ICs for each group and location. The dropdowns only show eligible volunteers.</p>
<div id="assignICContainer">
<!-- JS injected content -->
</div>
</div>
<div class="p-4 border-t-2 border-gray-200 dark:border-zinc-800 flex justify-end gap-3 shrink-0">
<button onclick="closeAssignICModal()" class="px-5 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg text-sm font-bold border-2 border-gray-300 dark:border-zinc-700 transition-colors shadow-md">Done</button>
</div>
</div>
</div>
`;

if (!html.includes('id="assignICModal"')) {
    html = html.replace('<!-- FULL PAGE STATUS OVERLAY -->', modalHtml + '\n<!-- FULL PAGE STATUS OVERLAY -->');
    fs.writeFileSync('grouping.html', html, 'utf8');
    console.log("Modal injected");
} else {
    console.log("Modal already exists");
}
