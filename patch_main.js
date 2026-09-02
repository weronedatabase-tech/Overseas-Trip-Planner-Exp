import fs from 'fs';
let code = fs.readFileSync('frontend/js/main.js', 'utf8');

const target1 = `          <div class="\${m.role==='CAREGIVER'?'block':'hidden-force'} relative"><label class="text-[10px] font-bold mb-0.5 text-gray-500 block uppercase">Caregiver For</label><input type="text" id="gpmRelated" placeholder="Comma-separated" value="\${m.relatedTrainee || ''}" autocomplete="off" oninput="handleGpmRelatedSearch(this.value)" onfocus="handleGpmRelatedSearch(this.value)" onblur="cleanTrailingComma(this)" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"><div id="gpmRelatedDropdown" class="absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl mt-1 hidden-force max-h-48 overflow-y-auto"></div></div>
          <div class="\${m.role==='CAREGIVER'?'block':'hidden-force'}"><label class="text-[10px] font-bold mb-0.5 text-gray-500 block uppercase">Relationship</label><input type="text" id="gpmRelation" value="\${m.relationship || ''}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"></div>`;

const rep1 = `          <div class="\${m.role==='CAREGIVER'?'block':'hidden-force'} relative"><label class="text-[10px] font-bold mb-0.5 text-gray-500 block uppercase">Related Trainees' Name</label><input type="text" id="gpmRelated" placeholder="Search trainee..." value="\${m.relatedTrainee || ''}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
          <div class="\${m.role==='CAREGIVER'?'block':'hidden-force'}"><label class="text-[10px] font-bold mb-0.5 text-gray-500 block uppercase">Relationship to Trainee(s)</label><input type="text" id="gpmRelation" value="\${m.relationship || ''}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"></div>`;

code = code.replace(target1, rep1);

fs.writeFileSync('frontend/js/main.js', code);
