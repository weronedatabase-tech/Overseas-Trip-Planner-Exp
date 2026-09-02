import fs from 'fs';
let code = fs.readFileSync('frontend/js/registration.js', 'utf8');

const target1 = `document.getElementById('membersContainer').insertAdjacentHTML('beforeend', finalHtml);
}`;

const rep1 = `document.getElementById('membersContainer').insertAdjacentHTML('beforeend', finalHtml);

  // Apply token input
  setTimeout(() => {
      if (typeof setupTokenInput === 'function') {
          setupTokenInput(\`reg-f-related-\${idx}\`, function(query) {
              let localTrainees = [];
              const allBlocks = Array.from(document.getElementsByClassName('member-block'));
              for (let b of allBlocks) {
                 const role = b.querySelector('.reg-f-role').value;
                 if (role === 'TRAINEE') {
                     const tName = b.querySelector('.reg-f-name').value.trim();
                     const tShort = b.querySelector('.reg-f-shortname').value.trim();
                     if (tName) {
                         localTrainees.push({name: tName, shortName: tShort});
                     }
                 }
              }
              let allTrainees = [...publicTrainees, ...localTrainees];
              const seen = new Set();
              allTrainees = allTrainees.filter(t => {
                 const k = t.name.toLowerCase();
                 if(seen.has(k)) return false;
                 seen.add(k);
                 return true;
              });
              let matches = allTrainees;
              if (query) {
                matches = allTrainees.filter(t => 
                     t.name.toLowerCase().includes(query) || 
                     (t.shortName && t.shortName.toLowerCase().includes(query))
                );
              }
              return matches.map(t => ({ label: \`\${t.name} \${t.shortName ? '(' + t.shortName + ')' : ''}\`, value: t.name }));
          });
      }
  }, 50);
}`;

code = code.replace(target1, rep1);

const target2 = `         <input required disabled type="text" id="reg-f-related-\${idx}" onclick="showTraineeDropdown(\${idx})" onfocus="showTraineeDropdown(\${idx})" oninput="filterTraineeDropdown(\${idx}); this.dataset.manual='true';" onblur="hideTraineeDropdown(\${idx})" class="reg-f-related w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary" autocomplete="off" placeholder="Comma-separated for multiple">
         <ul id="trainee-dropdown-\${idx}" class="absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl mt-1 max-h-48 overflow-y-auto hidden-force custom-scrollbar"></ul>`;

const rep2 = `         <input required disabled type="text" id="reg-f-related-\${idx}" class="reg-f-related w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary" autocomplete="off" placeholder="Comma-separated for multiple">`;

code = code.replace(target2, rep2);

fs.writeFileSync('frontend/js/registration.js', code);
