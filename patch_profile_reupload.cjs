const fs = require('fs');

let pf = fs.readFileSync('frontend/js/profile.js', 'utf8');

pf = pf.replace(
    /function generateReceiptFormHtml\(\) \{[\s\S]*?\}<\/form>\`;\n\}/,
    `function generateReceiptFormHtml(suffix = "") {
return \\\`<form id="uploadReceiptForm\${suffix}" onsubmit="submitReceipt(event, '\${suffix}')" class="flex flex-col gap-4 flex-1">
   <div id="recError\${suffix}" class="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 p-2 rounded-lg text-xs mb-2 font-bold hidden-force"></div>
   <div id="recSuccess\${suffix}" class="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 p-2 rounded-lg text-xs mb-2 font-bold hidden-force"></div>
   
   <div>
       <label class="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">Screenshot File (Max 4MB)</label>
       <input type="file" id="recFile\${suffix}" required accept="image/*,.pdf" class="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-gray-700 dark:file:bg-gray-700 dark:file:text-gray-200 hover:file:bg-gray-200 dark:hover:file:bg-gray-600">
       <p class="text-[10px] text-gray-400 mt-1 italic">Note: Re-uploading will automatically overwrite any previously submitted screenshot.</p>
   </div>
   <div>
       <label class="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">Remarks (Optional)</label>
       <input type="text" id="recRemarks\${suffix}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary shadow-sm" placeholder="Any details...">
   </div>
   <div class="mt-auto pt-2">
       <button type="submit" class="w-full bg-purple-600 text-white text-xs font-bold py-2.5 rounded-lg shadow-sm hover:bg-purple-700 transition flex justify-center items-center focus:outline-none">
          <span class="btn-text">Upload Confirmation</span><div class="btn-spinner spinner-white hidden-force ml-2 !w-3 !h-3 border-2"></div>
       </button>
   </div>
</form>\\\`;
}`
);

pf = pf.replace(
    'async function submitReceipt(e) {',
    'async function submitReceipt(e, suffix = "") {'
);
pf = pf.replace("const err = document.getElementById('recError');", "const err = document.getElementById('recError' + suffix);");
pf = pf.replace("const succ = document.getElementById('recSuccess');", "const succ = document.getElementById('recSuccess' + suffix);");
pf = pf.replace("const remarks = document.getElementById('recRemarks').value.trim();", "const remarks = document.getElementById('recRemarks' + suffix).value.trim();");
pf = pf.replace("const fileInput = document.getElementById('recFile');", "const fileInput = document.getElementById('recFile' + suffix);");

// Now modify generateMyReceiptsHtml
pf = pf.replace(
    '       }\n   </div>\n`;\n}',
    `       }
       <button onclick="document.getElementById('reuploadFormContainer').classList.toggle('hidden-force')" class="mt-6 text-xs text-primary font-bold hover:underline flex items-center gap-1">
           <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
           Incorrect file? Re-upload screenshot
       </button>
       <div id="reuploadFormContainer" class="hidden-force mt-4 w-full max-w-lg mx-auto bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-left">
           \${generateReceiptFormHtml('_re')}
       </div>
   </div>
\`;
}`
);

pf = pf.replace(
    "document.getElementById('uploadReceiptForm').reset();",
    "const frm = document.getElementById('uploadReceiptForm' + suffix); if(frm) frm.reset();"
);

fs.writeFileSync('frontend/js/profile.js', pf);
