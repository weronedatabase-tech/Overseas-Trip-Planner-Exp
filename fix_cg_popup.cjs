const fs = require('fs');
let c = fs.readFileSync('frontend/js/registration.js', 'utf8');

const modalLogic = `
function ensureCaregiverPopupModal() {
    if (document.getElementById('caregiverPopupModal')) return;
    const div = document.createElement('div');
    div.id = 'caregiverPopupModal';
    div.className = 'fixed inset-0 bg-black/60 z-[120] hidden-force flex justify-center items-center backdrop-blur-sm p-4';
    div.innerHTML = \`<div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 animate-scale-up">
            <div class="p-5 border-b border-gray-200 dark:border-gray-800">
                <h3 class="text-lg font-black text-gray-900 dark:text-white">Caregiver Details</h3>
            </div>
            <div class="p-5 space-y-4">
                <div>
                    <label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Related Trainee Name <span class="text-red-500">*</span></label>
                    <input type="text" id="cgPopupTraineeName" class="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg font-medium bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary">
                </div>
                <div>
                    <label class="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">Relationship to Trainee <span class="text-red-500">*</span></label>
                    <select id="cgPopupRelation" class="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-lg font-medium bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary">
                        <option value="">Select Relationship</option>
                        <option value="Mother">Mother</option>
                        <option value="Father">Father</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Relative">Relative</option>
                        <option value="Helper">Helper</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>
            <div class="p-4 bg-gray-50 dark:bg-gray-800 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onclick="cancelCaregiverPopup()" class="px-4 py-2 rounded-lg font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm transition">Cancel</button>
                <button type="button" onclick="confirmCaregiverPopup()" class="px-6 py-2 rounded-lg font-bold text-white bg-primary hover:bg-green-600 shadow-md transition">Confirm</button>
            </div>
        </div>\`;
    document.body.appendChild(div);
}
ensureCaregiverPopupModal();
`;

c = c.replace(/function openCaregiverPopup\(idx\) \{/, modalLogic + '\nfunction openCaregiverPopup(idx) {\n    ensureCaregiverPopupModal();');

fs.writeFileSync('frontend/js/registration.js', c);
console.log("Updated registration caregiver modal");
