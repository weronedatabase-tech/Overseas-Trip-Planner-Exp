const fs = require('fs');
let code = fs.readFileSync('frontend/js/participants.js', 'utf8');

// Increase text sizes in the breakdown modal
code = code.replace(/text-sm text-gray-900/g, 'text-base md:text-lg text-gray-900');
code = code.replace(/text-xs font-bold shadow-sm/g, 'text-sm font-bold shadow-sm');
// Add text-sm or text-base to the grid items (TRN, VOL, CGV)
code = code.replace(/p-1\.5 rounded font-bold/g, 'p-2 rounded font-bold text-sm md:text-base');
code = code.replace(/border border-/g, 'border-2 border-');

// Also for the table text sizes:
code = code.replace(/text-xs font-medium/g, 'text-sm font-medium');
code = code.replace(/text-\[11px\] md:text-xs/g, 'text-xs md:text-sm');
code = code.replace(/text-xs md:text-xs font-black/g, 'text-sm md:text-sm font-black');
code = code.replace(/text-xs text-gray-500/g, 'text-sm text-gray-500');

fs.writeFileSync('frontend/js/participants.js', code);
