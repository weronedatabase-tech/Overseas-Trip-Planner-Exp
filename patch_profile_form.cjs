const fs = require('fs');

let pf = fs.readFileSync('frontend/js/profile.js', 'utf8');

pf = pf.replace(
    '<input type="file" id="recFile" required accept="image/*,.pdf" class="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-gray-700 dark:file:bg-gray-700 dark:file:text-gray-200 hover:file:bg-gray-200 dark:hover:file:bg-gray-600">',
    '<input type="file" id="recFile" required accept="image/*,.pdf" class="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-gray-700 dark:file:bg-gray-700 dark:file:text-gray-200 hover:file:bg-gray-200 dark:hover:file:bg-gray-600">\n       <p class="text-[10px] text-gray-400 mt-1 italic">Note: Re-uploading will automatically overwrite any previously submitted screenshot.</p>'
);

fs.writeFileSync('frontend/js/profile.js', pf);
