const fs = require('fs');
let c = fs.readFileSync('frontend/js/files.js', 'utf8');

c = c.replace(
    /bg-yellow-50 dark:bg-yellow-900\/30 flex items-center justify-center shrink-0">\s*<svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400"/,
    'bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">\n          <svg class="w-5 h-5 text-gray-600 dark:text-gray-400"'
);

const oldFilesBlock = `if (f.mimeType.includes('folder')) {
   bgClass = 'bg-yellow-50 dark:bg-yellow-900/30';
   iconHtml = \`<svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>\`;
} else if (f.mimeType.includes('spreadsheet')) {
   bgClass = 'bg-green-50 dark:bg-green-900/30';
   iconHtml = \`<svg class="w-5 h-5 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>\`;
} else if (f.mimeType.includes('document')) {
   bgClass = 'bg-green-50 dark:bg-green-900/30';
   iconHtml = \`<svg class="w-5 h-5 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>\`;
} else if (f.mimeType.includes('presentation')) {
   bgClass = 'bg-yellow-50 dark:bg-yellow-900/30';
   iconHtml = \`<svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM10 8v8l6-4z"/></svg>\`;
} else if (f.mimeType.includes('pdf')) {
   bgClass = 'bg-red-50 dark:bg-red-900/30';
   iconHtml = \`<svg class="w-5 h-5 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM16.5 9h-1v2h1V9z"/><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z"/></svg>\`;
}`;

const newFilesBlock = `if (f.mimeType.includes('folder')) {
   bgClass = 'bg-gray-100 dark:bg-gray-800';
   iconHtml = \`<svg class="w-5 h-5 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>\`;
} else if (f.mimeType.includes('spreadsheet')) {
   bgClass = 'bg-green-50 dark:bg-green-900/30';
   iconHtml = \`<svg class="w-5 h-5 text-green-600 dark:text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>\`;
} else if (f.mimeType.includes('document')) {
   bgClass = 'bg-blue-50 dark:bg-blue-900/30';
   iconHtml = \`<svg class="w-5 h-5 text-blue-600 dark:text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>\`;
} else if (f.mimeType.includes('presentation')) {
   bgClass = 'bg-yellow-50 dark:bg-yellow-900/30';
   iconHtml = \`<svg class="w-5 h-5 text-yellow-600 dark:text-yellow-500" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM10 8v8l6-4z"/></svg>\`;
} else if (f.mimeType.includes('pdf')) {
   bgClass = 'bg-red-50 dark:bg-red-900/30';
   iconHtml = \`<svg class="w-5 h-5 text-red-600 dark:text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM16.5 9h-1v2h1V9z"/><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z"/></svg>\`;
}`;

c = c.replace(oldFilesBlock, newFilesBlock);
fs.writeFileSync('frontend/js/files.js', c);