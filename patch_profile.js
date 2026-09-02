import fs from 'fs';
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const target0 = `       \${m.role === 'CAREGIVER' ? \`<div class="md:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[9px] uppercase tracking-wider mb-0.5">Caregiver For</p><p class="font-semibold">\${m.relatedTrainee} (\${m.relationship})</p></div>\` : ''} `;

code = code.replace(target0, '');

const target1 = `        <div class="\${m.role==='CAREGIVER'?'block':'hidden-force'} relative"><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Caregiver For</label><input type="text" id="edRelated_\${i}" placeholder="Comma-separated" value="\${m.relatedTrainee || ''}" autocomplete="off" oninput="handleProfileRelatedSearch(\${i}, this.value)" onfocus="handleProfileRelatedSearch(\${i}, this.value)" onblur="cleanTrailingComma(this)" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"><div id="edRelatedDropdown_\${i}" class="absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl mt-1 hidden-force max-h-48 overflow-y-auto"></div></div>
        <div class="\${m.role==='CAREGIVER'?'block':'hidden-force'}"><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Relationship</label><input type="text" id="edRelation_\${i}" value="\${m.relationship || ''}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>`;

const rep1 = `        <div class="\${m.role==='CAREGIVER'?'block':'hidden-force'} relative"><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Related Trainees' Name</label><input type="text" id="edRelated_\${i}" placeholder="Search trainee..." value="\${m.relatedTrainee || ''}" autocomplete="off" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
        <div class="\${m.role==='CAREGIVER'?'block':'hidden-force'}"><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Relationship to Trainee(s)</label><input type="text" id="edRelation_\${i}" value="\${m.relationship || ''}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>`;

code = code.replace(target1, rep1);

const target2 = `  document.getElementById('familyCards').innerHTML = html;
}`;

const rep2 = `  document.getElementById('familyCards').innerHTML = html;

  if (typeof setupTokenInput === 'function') {
      setTimeout(() => {
          familyData.forEach((m, i) => {
              if (document.getElementById(\`edRelated_\${i}\`)) {
                  setupTokenInput(\`edRelated_\${i}\`, function(query) {
                      const trainees = familyData.filter(p => p.role === 'TRAINEE');
                      const results = trainees.filter(t => (t.fullName || '').toLowerCase().includes(query) || (t.shortName || '').toLowerCase().includes(query));
                      return results.map(t => ({ label: \`\${t.fullName} \${t.shortName ? '(' + t.shortName + ')' : ''}\`, value: t.fullName }));
                  });
              }
          });
      }, 50);
  }
}`;

code = code.replace(target2, rep2);

fs.writeFileSync('frontend/js/profile.js', code);
