const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const injection = `       <div><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0.5">Contact & Email</p><div class="font-bold text-sm md:text-base flex items-center gap-1">\${renderPhoneLink(m.contact)} | \${m.email || 'N/A'}</div></div>
       <div class="md:col-span-2 border-t-2 border-gray-100 dark:border-gray-800 pt-3">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div><p class="font-bold text-gray-400 dark:text-gray-500 text-[10px] md:text-xs uppercase tracking-wider mb-0.5">Pairing</p><p class="font-black text-sm md:text-base text-indigo-700 dark:text-indigo-400 uppercase">\${m.pairings || 'UNASSIGNED'}</p></div>
                <div><p class="font-bold text-gray-400 dark:text-gray-500 text-[10px] md:text-xs uppercase tracking-wider mb-0.5">Group</p><p class="font-black text-sm md:text-base text-amber-700 dark:text-amber-400 uppercase">\${m.logisticsGroup || 'UNASSIGNED'}</p></div>
                <div><p class="font-bold text-gray-400 dark:text-gray-500 text-[10px] md:text-xs uppercase tracking-wider mb-0.5">Room</p><p class="font-black text-sm md:text-base text-teal-700 dark:text-teal-400 uppercase">\${m.room || 'UNASSIGNED'}</p></div>
                <div><p class="font-bold text-gray-400 dark:text-gray-500 text-[10px] md:text-xs uppercase tracking-wider mb-0.5">Bus</p><p class="font-black text-sm md:text-base text-rose-700 dark:text-rose-400 uppercase">\${m.bus || 'UNASSIGNED'}</p></div>
            </div>
       </div>`;

code = code.replace(
  /<div><p class="font-bold text-gray-400 dark:text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-0\.5">Contact & Email<\/p><div class="font-bold text-sm md:text-base flex items-center gap-1">\$\{renderPhoneLink\(m\.contact\)\} \| \$\{m\.email \|\| 'N\/A'\}<\/div><\/div>/,
  injection
);

fs.writeFileSync('frontend/js/profile.js', code);
console.log('Patched profile.js with logistics display');
