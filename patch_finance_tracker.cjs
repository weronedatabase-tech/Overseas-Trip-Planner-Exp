const fs = require('fs');
let code = fs.readFileSync('frontend/js/finance.js', 'utf8');

// 1. Freeze top of fee tracker and add the admin remarks toggle
code = code.replace(
  /<div class="bg-white dark:bg-gray-900 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-800 p-2 mb-3 flex flex-col gap-2">/,
  `<div class="bg-white dark:bg-gray-900 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-800 p-2 mb-3 flex flex-col gap-2 sticky top-[50px] md:top-[60px] z-[50]">`
);

code = code.replace(
  /<label class="flex items-center gap-1\.5 cursor-pointer bg-purple-50 dark:bg-purple-900\/20 border \$\{financeConfig\.showPaymentSection \? 'border-purple-500' : 'border-purple-200 dark:border-purple-800'\} px-2\.5 py-1 rounded-md transition-colors hover:bg-purple-100 dark:hover:bg-purple-900\/40">/,
  `<label class="flex items-center gap-1.5 cursor-pointer bg-blue-50 dark:bg-blue-900/20 border \${financeConfig.showAdminRemarks ? 'border-blue-500' : 'border-blue-200 dark:border-blue-800'} px-2.5 py-1 rounded-md transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/40">
      <input type="checkbox" \${financeConfig.showAdminRemarks ? 'checked' : ''} onchange="updateFinanceConfig('showAdminRemarks', this.checked)" class="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
      <span class="text-[11px] md:text-xs uppercase font-black \${financeConfig.showAdminRemarks ? 'text-blue-700 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'} tracking-wider">SHOW REMARKS TO USER</span>
  </label>
  <label class="flex items-center gap-1.5 cursor-pointer bg-purple-50 dark:bg-purple-900/20 border \${financeConfig.showPaymentSection ? 'border-purple-500' : 'border-purple-200 dark:border-purple-800'} px-2.5 py-1 rounded-md transition-colors hover:bg-purple-100 dark:hover:bg-purple-900/40">`
);

// 2 & 3. Include Remarks column with screenshot image, and Admin upload screenshot with remark
// Wait, `cardsHtml` generates the cards in `renderFeeTracker`.
// We need to inject an Edit button and Remarks.
code = code.replace(
  /if \(feeReceipts\.length > 0 && feeReceipts\[0\]\.fileUrl\) \{[\s\S]*?return \`[\s\S]*?<div class="mt-2 pt-2 border-t-2 border-gray-100 dark:border-gray-800">[\s\S]*?<a href="\$\{feeReceipts\[0\]\.fileUrl\}" target="_blank" class="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 w-max">[\s\S]*?View Uploaded Screenshot[\s\S]*?<\/a>[\s\S]*?<\/div>[\s\S]*?\`;[\s\S]*?\}/,
  `if (feeReceipts.length > 0 && feeReceipts[0].fileUrl) {
                return \`
                <div class="mt-2 pt-2 border-t-2 border-gray-100 dark:border-gray-800 flex flex-col gap-2">
                    <div class="flex items-start gap-2">
                        <a href="\${feeReceipts[0].fileUrl}" target="_blank" class="shrink-0">
                            <div class="w-12 h-12 rounded border-2 border-gray-300 dark:border-gray-600 overflow-hidden shadow-sm relative group bg-gray-100 flex items-center justify-center">
                                <img src="\${feeReceipts[0].fileUrl.replace(/\\/view.*/, '/preview')}" class="w-full h-full object-cover">
                            </div>
                        </a>
                        <div class="flex flex-col min-w-0 flex-1">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">User Uploaded Screenshot</span>
                            <span class="text-xs font-semibold text-gray-700 dark:text-gray-300 leading-tight whitespace-pre-wrap">\${feeReceipts[0].remarks || '<span class="italic opacity-50">No remarks provided</span>'}</span>
                        </div>
                    </div>
                    <div class="flex items-center justify-between mt-1">
                        <a href="\${feeReceipts[0].fileUrl}" target="_blank" class="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                            View Image
                        </a>
                        <button onclick="promptAdminUploadReceipt('\${c.poc}', '\${feeReceipts[0].remarks || ''}')" class="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            Edit/Re-upload
                        </button>
                    </div>
                </div>
                \`;
            } else {
                return \`<div class="mt-2 pt-2 border-t-2 border-gray-100 dark:border-gray-800 flex justify-end"><button onclick="promptAdminUploadReceipt('\${c.poc}', '')" class="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                            Upload Screenshot
                        </button></div>\`;
            }`
);

// Add the logic for promptAdminUploadReceipt
code += `
window.promptAdminUploadReceipt = function(nric, existingRemark) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/60 z-[120] flex justify-center items-center p-4 backdrop-blur-sm overflow-y-auto';
    modal.innerHTML = \`
    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border-2 border-gray-200 dark:border-gray-700 flex flex-col max-h-full my-4">
        <div class="bg-gray-100 dark:bg-gray-800 px-4 py-3 border-b-2 border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
            <h3 class="font-black text-gray-900 dark:text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                Upload / Edit Screenshot
            </h3>
            <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition focus:outline-none"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div class="p-4 overflow-y-auto min-h-0 flex-1">
            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">New Screenshot (Optional)</label>
                    <input type="file" id="adminUploadFile" accept="image/*,application/pdf" class="w-full text-xs text-gray-900 dark:text-white file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-primary file:text-white hover:file:bg-green-600 border border-gray-300 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-800">
                    <p class="text-[10px] text-gray-400 mt-1">Leave empty to keep existing image</p>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Remarks</label>
                    <textarea id="adminUploadRemarks" rows="3" class="w-full p-2 text-sm border-2 border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary">\${existingRemark.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}</textarea>
                </div>
            </div>
            <div class="mt-6 flex gap-2">
                <button onclick="this.closest('.fixed').remove()" class="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg border-2 border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition">Cancel</button>
                <button id="btnAdminUploadSubmit" onclick="submitAdminUpload('\${nric}')" class="flex-1 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow-md hover:bg-green-600 transition flex justify-center items-center"><span class="btn-text">Save Changes</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div></button>
            </div>
        </div>
    </div>\`;
    document.body.appendChild(modal);
};

window.submitAdminUpload = async function(nric) {
    const btn = document.getElementById('btnAdminUploadSubmit');
    const fileInput = document.getElementById('adminUploadFile');
    const remarks = document.getElementById('adminUploadRemarks').value;
    
    setBtnLoading(btn, true);
    try {
        let base64Data = null;
        let fileName = null;
        let mimeType = null;
        
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            base64Data = await getBase64(file);
            fileName = file.name;
            mimeType = file.type;
        }
        
        const payload = {
            id: 'RE_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
            nric: nric,
            paidByNric: nric,
            categoryId: 'Fees Payment Screenshot',
            amount: 0,
            remarks: remarks,
            hasFile: !!base64Data,
            fileData: base64Data,
            fileName: fileName,
            mimeType: mimeType
        };
        
        const res = await apiCall('uploadReceipt', { payload });
        if (res.status === 'success') {
            showToast('Receipt saved successfully.');
            await fetchReceiptsData();
            renderFeeTracker();
            btn.closest('.fixed').remove();
        } else {
            showToast(res.message || 'Failed to upload.', true);
        }
    } catch(e) {
        showToast('Error uploading.', true);
    }
    setBtnLoading(btn, false);
};
`;

fs.writeFileSync('frontend/js/finance.js', code);
console.log('Patched finance tracker UI');
