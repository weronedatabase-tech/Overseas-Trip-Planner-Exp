let currentDrivePath = [];
let driveClipboard = null;
let selectedDriveItems = new Map();
let lastLoadedDriveFiles = [];

document.addEventListener("click", (e) => {
  const menu = document.getElementById("driveAddMenu");
  if (menu && !menu.classList.contains("hidden-force")) {
    const addBtn = document.getElementById("btnDriveAdd");
    if (addBtn && !addBtn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add("hidden-force");
    }
  }
});

function buildFilesUI() {
  const el_tab_files = document.getElementById("tab-files");
  if (el_tab_files)
    el_tab_files.innerHTML = `
<div class="flex flex-col h-full w-full relative">
<div class="bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-800 p-2 md:p-3 shrink-0 flex items-center gap-2 shadow-md rounded-t-xl md:rounded-none relative z-20">
 <button type="button" id="btnDriveBack" onclick="navigateDriveBack()" class="hidden-force p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition focus:outline-none shrink-0 active:scale-95">
    <svg class="w-5 h-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
 </button>
 
 <h3 id="driveCurrentFolderName" class="text-sm md:text-base font-black text-gray-900 dark:text-white tracking-tight truncate flex-1 min-w-0 pr-1">Trip Folder</h3>
 
 <div class="flex items-center gap-1 md:gap-1.5 shrink-0">
     <input type="file" id="driveFileInput" multiple class="hidden-force" onchange="handleFileSelect(event)">
     
     <button type="button" id="btnDrivePaste" onclick="pasteFromDriveClipboard()" class="hidden-force p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-gray-800 transition focus:outline-none shrink-0 flex items-center gap-1 font-bold text-xs md:text-sm active:scale-95" title="Paste Item">
        <svg class="w-5 h-5 md:w-6 md:h-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
        <span class="hidden md:inline pointer-events-none" id="lblDrivePaste">Paste</span>
     </button>

     <div class="relative inline-block text-left z-30">
       <button type="button" id="btnDriveExtract" onclick="document.getElementById('driveExtractMenu').classList.toggle('hidden-force')" class="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 dark:hover:bg-gray-800 transition focus:outline-none shrink-0 flex items-center gap-1 font-bold text-xs md:text-sm active:scale-95" title="Extract Data">
          <svg class="w-5 h-5 md:w-6 md:h-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <span class="hidden md:inline pointer-events-none">Extract</span>
       </button>
       <div id="driveExtractMenu" class="hidden-force origin-top-right absolute right-0 mt-2 w-56 rounded-xl shadow-2xl bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 dark:divide-gray-700 z-[100]">
         <div class="py-1.5">
           <a href="javascript:void(0)" onclick="document.getElementById('driveExtractMenu').classList.add('hidden-force'); showExtractionPopup('insurance')" class="group flex items-center px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
             <svg class="mr-3 h-5 w-5 text-blue-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> Insurance Extraction
           </a>
           <a href="javascript:void(0)" onclick="document.getElementById('driveExtractMenu').classList.add('hidden-force'); showExtractionPopup('bus')" class="group flex items-center px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
             <svg class="mr-3 h-5 w-5 text-purple-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> Bus for ICA Extraction
           </a>
           <a href="javascript:void(0)" onclick="document.getElementById('driveExtractMenu').classList.add('hidden-force'); showCustomExtractionPopup()" class="group flex items-center px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
             <svg class="mr-3 h-5 w-5 text-green-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg> Custom Extraction
           </a>
         </div>
       </div>
     </div>
     
     <div class="relative inline-block text-left z-30">
       <button type="button" id="btnDriveAdd" onclick="toggleDriveAddMenu(event)" class="p-1.5 rounded-lg text-primary hover:bg-green-50 dark:hover:bg-gray-800 transition focus:outline-none shrink-0 flex items-center gap-1 font-bold text-xs md:text-sm active:scale-95" title="Add New">
          <svg class="w-5 h-5 md:w-6 md:h-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
          <span class="hidden md:inline pointer-events-none">Add</span>
       </button>
       <div id="driveAddMenu" class="hidden-force origin-top-right absolute right-0 mt-2 w-56 rounded-xl shadow-2xl bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 dark:divide-gray-700 z-[100]">
         <div class="py-1.5">
           <a href="javascript:void(0)" onclick="toggleDriveAddMenu(); promptCreateFolder()" class="group flex items-center px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
             <svg class="mr-3 h-5 w-5 text-yellow-500 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg> New Folder
           </a>
           <a href="javascript:void(0)" onclick="toggleDriveAddMenu(); triggerFileUpload()" class="group flex items-center px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
             <svg class="mr-3 h-5 w-5 text-green-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> File Upload
           </a>
         </div>
         <div class="py-1.5">
           <a href="javascript:void(0)" onclick="toggleDriveAddMenu(); promptCreateGoogleDoc('doc')" class="group flex items-center px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
             <svg class="mr-3 h-5 w-5 text-green-600 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg> Google Doc
           </a>
           <a href="javascript:void(0)" onclick="toggleDriveAddMenu(); promptCreateGoogleDoc('sheet')" class="group flex items-center px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
             <svg class="mr-3 h-5 w-5 text-green-600 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg> Google Sheet
           </a>
           <a href="javascript:void(0)" onclick="toggleDriveAddMenu(); promptCreateGoogleDoc('slide')" class="group flex items-center px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
             <svg class="mr-3 h-5 w-5 text-yellow-600 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM10 8v8l6-4z"/></svg> Google Slides
           </a>
         </div>
       </div>
     </div>
     
     <button type="button" onclick="refreshCurrentDriveFolder(this)" class="p-1.5 rounded-lg text-primary hover:bg-green-50 dark:hover:bg-gray-800 transition focus:outline-none shrink-0 relative z-30 flex items-center justify-center active:scale-95" title="Refresh">
        <svg class="w-5 h-5 md:w-6 md:h-6 btn-icon pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        <div class="btn-spinner spinner-primary hidden-force !w-3 !h-3 md:!w-4 md:!h-4 border-2 absolute pointer-events-none"></div>
     </button>
 </div>
</div>

<div id="driveBulkActions" class="hidden-force bg-green-50 dark:bg-green-900/30 p-2 md:p-3 shrink-0 flex justify-between items-center border-b-2 border-green-200 dark:border-green-800 z-10 transition-all">
 <span id="driveBulkCount" class="text-xs md:text-sm font-black text-green-800 dark:text-green-300">0 selected</span>
 <div class="flex items-center gap-1.5 md:gap-2">
     <button onclick="bulkCopySelected()" class="px-2 py-1.5 text-xs md:text-xs font-bold bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 border-2 border-green-200 dark:border-green-700 rounded shadow-md hover:bg-green-100 transition focus:outline-none">Copy</button>
     <button onclick="bulkMoveSelected()" class="px-2 py-1.5 text-xs md:text-xs font-bold bg-white dark:bg-gray-800 text-orange-600 dark:text-orange-400 border-2 border-orange-200 dark:border-orange-800 rounded shadow-md hover:bg-orange-50 transition focus:outline-none">Move</button>
     <button onclick="bulkDeleteSelected()" class="px-2 py-1.5 text-xs md:text-xs font-bold bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-800 rounded shadow-md hover:bg-red-50 transition focus:outline-none">Delete</button>
     <button onclick="clearDriveSelection()" class="px-2 py-1.5 text-xs md:text-xs font-bold bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 rounded shadow-md hover:bg-gray-100 transition focus:outline-none ml-2">Cancel</button>
 </div>
</div>

<div id="driveLoadingOverlay" class="absolute inset-0 top-[50px] bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-20 hidden-force flex flex-col justify-center items-center">
  <div class="loader !w-8 !h-8 border-primary mb-2"></div>
  <span id="driveLoadingText" class="text-primary dark:text-green-400 font-bold text-xs tracking-wide shadow-md bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full mt-2">Loading folder...</span>
</div>

<div id="pinnedTripFilesBar" class="p-2 md:p-3 bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-800 shrink-0"></div>

<div id="driveContentsList" class="flex-grow overflow-y-auto p-2 md:p-3 space-y-1.5 bg-gray-50 dark:bg-gray-950 custom-scrollbar pb-10">
</div>
</div>
`;
  updatePasteButtonState();
  updatePinnedTripFilesUI();
}

function toggleDriveAddMenu(event) {
  if (event) {
    event.stopPropagation();
  }
  const menu = document.getElementById("driveAddMenu");
  if (menu) {
    menu.classList.toggle("hidden-force");
  }
}

function toggleDriveItemSelection(event, id, isFolder, name) {
  event.stopPropagation();
  if (event.target.checked) {
    selectedDriveItems.set(id, { id, isFolder, name });
  } else {
    selectedDriveItems.delete(id);
  }
  updateBulkActionsBar();
}

function updateBulkActionsBar() {
  const bar = document.getElementById("driveBulkActions");
  const countLbl = document.getElementById("driveBulkCount");
  if (!bar || !countLbl) return;

  if (selectedDriveItems.size > 0) {
    bar.classList.remove("hidden-force");
    countLbl.textContent = `${selectedDriveItems.size} item(s) selected`;
  } else {
    bar.classList.add("hidden-force");
  }
}

function clearDriveSelection() {
  selectedDriveItems.clear();
  document
    .querySelectorAll(".drive-item-checkbox")
    .forEach((cb) => (cb.checked = false));
  updateBulkActionsBar();
}

function setDriveClipboard(action, itemsArray) {
  driveClipboard = { action, items: itemsArray };
  showToast(
    `${action === "copy" ? "Copied" : "Moving"} ${itemsArray.length} item(s). Navigate to target folder and paste.`,
  );
  clearDriveSelection();
  updatePasteButtonState();
}

function bulkCopySelected() {
  setDriveClipboard("copy", Array.from(selectedDriveItems.values()));
}
function bulkMoveSelected() {
  setDriveClipboard("move", Array.from(selectedDriveItems.values()));
}
async function bulkDeleteSelected() {
  if (!confirm(`Move ${selectedDriveItems.size} item(s) to Trash?`)) return;
  const items = Array.from(selectedDriveItems.values());
  clearDriveSelection();
  const current = currentDrivePath[currentDrivePath.length - 1] || {
    id: "root",
  };
  await executeBulkAction("delete", items, current.id);
}

function actionSingleCopy(id, isFolder, name) {
  setDriveClipboard("copy", [{ id, isFolder, name }]);
}
function actionSingleMove(id, isFolder, name) {
  setDriveClipboard("move", [{ id, isFolder, name }]);
}

async function promptDeleteDriveItem(id, isFolder, name) {
  if (
    !confirm(
      `Are you sure you want to delete the ${isFolder ? "folder" : "file"} "${name}"?\nThis will move it to the Drive Trash.`,
    )
  )
    return;
  const current = currentDrivePath[currentDrivePath.length - 1] || {
    id: "root",
  };
  await executeBulkAction("delete", [{ id, isFolder, name }], current.id);
}

function updatePasteButtonState() {
  const btn = document.getElementById("btnDrivePaste");
  const lbl = document.getElementById("lblDrivePaste");
  if (btn && lbl) {
    if (driveClipboard && driveClipboard.items.length > 0) {
      btn.classList.remove("hidden-force");
      if (driveClipboard.action === "copy") {
        lbl.textContent = `Paste (${driveClipboard.items.length})`;
        btn.classList.remove("text-orange-600", "hover:bg-orange-50");
        btn.classList.add("text-green-600", "hover:bg-green-50");
      } else {
        lbl.textContent = `Move Here (${driveClipboard.items.length})`;
        btn.classList.remove("text-green-600", "hover:bg-green-50");
        btn.classList.add("text-orange-600", "hover:bg-orange-50");
      }
    } else {
      btn.classList.add("hidden-force");
    }
  }
}

async function pasteFromDriveClipboard() {
  if (!driveClipboard || driveClipboard.items.length === 0) return;

  const current = currentDrivePath[currentDrivePath.length - 1] || {
    id: "root",
  };

  let singleNewName = null;
  if (driveClipboard.items.length === 1) {
    const item = driveClipboard.items[0];
    const defaultName =
      driveClipboard.action === "copy" ? `Copy of ${item.name}` : item.name;
    singleNewName = prompt(
      `${driveClipboard.action === "copy" ? "Pasting" : "Moving"} "${item.name}".\nEnter name:`,
      defaultName,
    );
    if (!singleNewName || !singleNewName.trim()) return;
  }

  await executeBulkAction(
    driveClipboard.action,
    driveClipboard.items,
    current.id,
    singleNewName?.trim(),
  );
  driveClipboard = null;
  updatePasteButtonState();
}

async function executeBulkAction(
  actionType,
  items,
  targetFolderId,
  singleNewName = null,
) {
  const overlay = document.getElementById("driveLoadingOverlay");
  const loadText = document.getElementById("driveLoadingText");

  if (overlay) {
    overlay.classList.remove("hidden-force");
    if (actionType === "delete")
      loadText.textContent = `Deleting ${items.length} item(s)...`;
    else if (actionType === "move")
      loadText.textContent = `Moving ${items.length} item(s)...`;
    else loadText.textContent = `Copying ${items.length} item(s)...`;
  }

  try {
    const res = await apiCall("bulkDriveOperation", {
      actionType,
      items,
      targetFolderId,
      singleNewName,
    });
    renderDriveContents(res.folders, res.files);
    showToast("Operation successful.");
  } catch (e) {
    showToast("Failed: " + e.message, true);
  } finally {
    if (overlay) overlay.classList.add("hidden-force");
  }
}

async function promptCreateFolder() {
  const folderName = prompt("Enter new folder name:");
  if (!folderName || !folderName.trim()) return;

  const current = currentDrivePath[currentDrivePath.length - 1] || {
    id: "root",
  };
  const overlay = document.getElementById("driveLoadingOverlay");
  const loadText = document.getElementById("driveLoadingText");

  if (overlay) {
    overlay.classList.remove("hidden-force");
    loadText.textContent = "Creating folder...";
  }

  try {
    const res = await apiCall("createDriveFolder", {
      parentFolderId: current.id,
      folderName: folderName.trim(),
    });
    renderDriveContents(res.folders, res.files);
    showToast("Folder created.");
  } catch (e) {
    showToast("Failed to create folder.", true);
  } finally {
    if (overlay) overlay.classList.add("hidden-force");
  }
}

async function promptCreateGoogleDoc(docType) {
  const labels = {
    doc: "Google Doc",
    sheet: "Google Sheet",
    slide: "Google Slide",
  };
  const fileName = prompt(
    `Enter name for new ${labels[docType]}:`,
    `Untitled ${labels[docType]}`,
  );
  if (!fileName || !fileName.trim()) return;

  const current = currentDrivePath[currentDrivePath.length - 1] || {
    id: "root",
  };
  const overlay = document.getElementById("driveLoadingOverlay");
  const loadText = document.getElementById("driveLoadingText");

  if (overlay) {
    overlay.classList.remove("hidden-force");
    loadText.textContent = `Creating ${labels[docType]}...`;
  }

  try {
    const res = await apiCall("createGoogleDoc", {
      folderId: current.id,
      fileName: fileName.trim(),
      docType: docType,
    });
    renderDriveContents(res.folders, res.files);
    showToast(`${labels[docType]} created successfully.`);
  } catch (e) {
    showToast(`Failed to create ${labels[docType]}.`, true);
  } finally {
    if (overlay) overlay.classList.add("hidden-force");
  }
}

function triggerFileUpload() {
  document.getElementById("driveFileInput").click();
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Error reading file"));
    reader.readAsDataURL(file);
  });
}

async function handleFileSelect(event) {
  const selectedFiles = Array.from(event.target.files);
  if (selectedFiles.length === 0) return;

  let validFiles = [];
  let skippedFiles = [];

  for (let f of selectedFiles) {
    if (f.size > 4194304) skippedFiles.push(f.name);
    else validFiles.push(f);
  }

  if (skippedFiles.length > 0)
    showToast(`Skipped ${skippedFiles.length} file(s) larger than 4MB.`, true);

  if (validFiles.length === 0) {
    event.target.value = "";
    return;
  }

  const current = currentDrivePath[currentDrivePath.length - 1] || {
    id: "root",
  };
  const overlay = document.getElementById("driveLoadingOverlay");
  const loadText = document.getElementById("driveLoadingText");

  if (overlay) overlay.classList.remove("hidden-force");

  let successCount = 0;
  let lastRes = null;

  for (let i = 0; i < validFiles.length; i++) {
    const file = validFiles[i];
    if (loadText)
      loadText.textContent = `Uploading file ${i + 1} of ${validFiles.length}...`;

    try {
      const base64Data = await readFileAsBase64(file);
      const res = await apiCall("uploadDriveFile", {
        folderId: current.id,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileData: base64Data,
      });
      lastRes = res;
      successCount++;
    } catch (err) {
      showToast(`Failed to upload ${file.name}: ${err.message}`, true);
    }
  }

  if (lastRes) renderDriveContents(lastRes.folders, lastRes.files);

  if (overlay) overlay.classList.add("hidden-force");
  event.target.value = "";

  if (successCount > 0)
    showToast(`Successfully uploaded ${successCount} file(s).`);
}

async function promptRenameDriveItem(id, isFolder, oldName) {
  const newName = prompt(
    `Enter new name for the ${isFolder ? "folder" : "file"}:`,
    oldName,
  );
  if (!newName || !newName.trim() || newName.trim() === oldName) return;

  const current = currentDrivePath[currentDrivePath.length - 1] || {
    id: "root",
  };
  const overlay = document.getElementById("driveLoadingOverlay");
  const loadText = document.getElementById("driveLoadingText");

  if (overlay) {
    overlay.classList.remove("hidden-force");
    loadText.textContent = "Renaming item...";
  }

  try {
    const res = await apiCall("renameDriveItem", {
      itemId: id,
      isFolder: isFolder,
      newName: newName.trim(),
      currentFolderId: current.id,
    });
    renderDriveContents(res.folders, res.files);
    showToast("Item renamed successfully.");
  } catch (e) {
    showToast("Failed to rename item.", true);
  } finally {
    if (overlay) overlay.classList.add("hidden-force");
  }
}

async function loadDriveFolder(folderId, folderName, isBack = false) {
  if (!isBack) {
    if (
      currentDrivePath.length === 0 ||
      currentDrivePath[currentDrivePath.length - 1].id !== folderId
    ) {
      currentDrivePath.push({ id: folderId, name: folderName });
    }
  }

  updateDriveHeader();
  const overlay = document.getElementById("driveLoadingOverlay");
  const loadText = document.getElementById("driveLoadingText");
  if (overlay) {
    overlay.classList.remove("hidden-force");
    loadText.textContent = "Loading folder...";
  }

  try {
    const res = await apiCall("getDriveContents", { folderId: folderId });

    if (currentDrivePath.length === 1 && folderId === "root") {
      currentDrivePath[0].name = res.currentFolderName;
      currentDrivePath[0].id = res.currentFolderId;
      updateDriveHeader();
    }

    renderDriveContents(res.folders, res.files);
  } catch (e) {
    showToast("Failed to load folder contents.", true);
    if (!isBack && currentDrivePath.length > 1) {
      currentDrivePath.pop();
      updateDriveHeader();
    }
  } finally {
    if (overlay) overlay.classList.add("hidden-force");
  }
}

function updateDriveHeader() {
  const backBtn = document.getElementById("btnDriveBack");
  const title = document.getElementById("driveCurrentFolderName");
  if (!backBtn || !title) return;

  if (currentDrivePath.length > 1) backBtn.classList.remove("hidden-force");
  else backBtn.classList.add("hidden-force");

  const current = currentDrivePath[currentDrivePath.length - 1];
  title.textContent = current ? current.name : "Trip Folder";
}

function navigateDriveBack() {
  if (currentDrivePath.length > 1) {
    currentDrivePath.pop();
    const target = currentDrivePath[currentDrivePath.length - 1];
    loadDriveFolder(target.id, target.name, true);
    clearDriveSelection();
  }
}

function refreshCurrentDriveFolder(btn) {
  setBtnLoading(btn, true);
  const current = currentDrivePath[currentDrivePath.length - 1] || {
    id: "root",
    name: "Trip Folder",
  };
  loadDriveFolder(current.id, current.name, true).finally(() => {
    setBtnLoading(btn, false);
  });
  clearDriveSelection();
}

function openDriveFile(url) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function renderDriveContents(folders, files) {
  lastLoadedDriveFiles = files || [];
  updatePinnedTripFilesUI();
  const container = document.getElementById("driveContentsList");
  if (!container) return;
  let html = "";

  if (folders.length === 0 && files.length === 0) {
    container.innerHTML =
      '<div class="flex flex-col items-center justify-center p-8 text-gray-400 dark:text-gray-500"><svg class="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg><p class="text-xs font-bold">This folder is empty.</p></div>';
    return;
  }

  const copyIcon = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`;
  const moveIcon = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"></path></svg>`;
  const trashIcon = `<svg class="w-4 h-4 text-red-500 hover:text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`;
  const pencilIcon = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>`;

  folders.forEach((f) => {
    const safeName = f.name.replace(/'/g, "\\'");
    const isChecked = selectedDriveItems.has(f.id) ? "checked" : "";
    html += `
 <div class="flex items-center gap-1 bg-white dark:bg-gray-800 p-1 md:p-1.5 rounded-lg border-2 border-gray-200 dark:border-gray-700 shadow-md hover:border-primary transition group">
    <div class="flex items-center pl-2 shrink-0" onclick="event.stopPropagation()">
       <input type="checkbox" class="drive-item-checkbox w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer" ${isChecked} onchange="toggleDriveItemSelection(event, '${f.id}', true, '${safeName}')">
    </div>
    <div onclick="loadDriveFolder('${f.id}', '${safeName}')" class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer select-none active:scale-[0.98] px-2 py-1">
        <div class="w-8 h-8 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
          <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
        </div>
        <span class="font-bold text-sm text-gray-900 dark:text-white truncate group-hover:text-primary transition-colors">${f.name}</span>
    </div>
    <div class="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button onclick="actionSingleCopy('${f.id}', true, '${safeName}')" class="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-gray-700 rounded-md transition focus:outline-none shrink-0" title="Copy Folder">
           ${copyIcon}
        </button>
        <button onclick="actionSingleMove('${f.id}', true, '${safeName}')" class="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-md transition focus:outline-none shrink-0" title="Move Folder">
           ${moveIcon}
        </button>
        <button onclick="promptRenameDriveItem('${f.id}', true, '${safeName}')" class="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-gray-700 rounded-md transition focus:outline-none shrink-0" title="Rename Folder">
           ${pencilIcon}
        </button>
        <button onclick="promptDeleteDriveItem('${f.id}', true, '${safeName}')" class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-gray-700 rounded-md transition focus:outline-none shrink-0" title="Delete Folder">
           ${trashIcon}
        </button>
    </div>
 </div>
`;
  });

  files.forEach((f) => {
    const safeName = f.name.replace(/'/g, "\\'");
    const isChecked = selectedDriveItems.has(f.id) ? "checked" : "";
    let iconHtml = "";
    let bgClass = "bg-gray-50 dark:bg-gray-700";

    if (f.mimeType.includes("folder")) {
      bgClass = "bg-gray-100 dark:bg-gray-800";
      iconHtml = `<svg class="w-5 h-5 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
    } else if (f.mimeType.includes("spreadsheet")) {
      bgClass = "bg-green-50 dark:bg-green-900/30";
      iconHtml = `<svg class="w-5 h-5 text-green-600 dark:text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
    } else if (f.mimeType.includes("document")) {
      bgClass = "bg-blue-50 dark:bg-blue-900/30";
      iconHtml = `<svg class="w-5 h-5 text-blue-600 dark:text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
    } else if (f.mimeType.includes("presentation")) {
      bgClass = "bg-yellow-50 dark:bg-yellow-900/30";
      iconHtml = `<svg class="w-5 h-5 text-yellow-600 dark:text-yellow-500" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM10 8v8l6-4z"/></svg>`;
    } else if (f.mimeType.includes("pdf")) {
      bgClass = "bg-red-50 dark:bg-red-900/30";
      iconHtml = `<svg class="w-5 h-5 text-red-600 dark:text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM16.5 9h-1v2h1V9z"/><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z"/></svg>`;
    } else if (f.mimeType.includes("image")) {
      bgClass = "bg-indigo-50 dark:bg-indigo-900/30";
      iconHtml = `<svg class="w-5 h-5 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>`;
    } else {
      iconHtml = `<svg class="w-5 h-5 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm6 1.5L18.5 9H12V3.5z"/></svg>`;
    }

    const isInfographic = Boolean(
      (appSettings && appSettings.tripInfographicId && f.id === appSettings.tripInfographicId) ||
      (appSettings && appSettings.tripInfographicName && f.name === appSettings.tripInfographicName)
    );
    const isInfoDoc = Boolean(
      (appSettings && appSettings.tripInfoDocId && f.id === appSettings.tripInfoDocId) ||
      (appSettings && appSettings.tripInfoDocName && f.name === appSettings.tripInfoDocName)
    );

    let badgesHtml = "";
    if (isInfographic) {
      badgesHtml += `<span class="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800 shrink-0 shadow-sm"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg> Infographic</span>`;
    }
    if (isInfoDoc) {
      badgesHtml += `<span class="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 shrink-0 shadow-sm"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg> Trip Info Doc</span>`;
    }

    const shortcutBadge = f.isShortcut
      ? `<div class="absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full shadow-md p-0.5"><svg class="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></div>`
      : "";
    const nameHtml = f.isShortcut
      ? `<div class="flex flex-col min-w-0"><div class="flex items-center gap-1.5 flex-wrap"><span class="font-bold text-sm text-gray-900 dark:text-white truncate group-hover:text-primary transition-colors">${f.name}</span>${badgesHtml}</div><span class="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-black">Shortcut</span></div>`
      : `<div class="flex items-center gap-1.5 min-w-0 flex-wrap"><span class="font-bold text-sm text-gray-900 dark:text-white truncate group-hover:text-primary transition-colors">${f.name}</span>${badgesHtml}</div>`;

    html += `
 <div class="flex items-center gap-1 bg-white dark:bg-gray-800 p-1 md:p-1.5 rounded-lg border-2 ${isInfographic ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/20' : (isInfoDoc ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/20' : 'border-gray-200 dark:border-gray-700')} shadow-md hover:border-gray-300 dark:hover:border-gray-500 transition group">
    <div class="flex items-center pl-2 shrink-0" onclick="event.stopPropagation()">
       <input type="checkbox" class="drive-item-checkbox w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer" ${isChecked} onchange="toggleDriveItemSelection(event, '${f.id}', false, '${safeName}')">
    </div>
    <div onclick="openDriveFile('${f.url}')" class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer select-none active:scale-[0.98] px-2 py-1">
        <div class="relative w-8 h-8 rounded ${bgClass} flex items-center justify-center shrink-0">
          ${iconHtml}
          ${shortcutBadge}
        </div>
        ${nameHtml}
    </div>
    <div class="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button onclick="actionSetTripFile('infographic', '${f.id}', '${safeName}', '${f.url}')" class="p-2 ${isInfographic ? 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/60 font-black' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-700'} rounded-md transition focus:outline-none shrink-0" title="${isInfographic ? 'Currently Set as Landing Infographic' : 'Set as Landing Page Infographic'}">
           <svg class="w-4 h-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
        </button>
        <button onclick="actionSetTripFile('infoDoc', '${f.id}', '${safeName}', '${f.url}')" class="p-2 ${isInfoDoc ? 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/60 font-black' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-gray-700'} rounded-md transition focus:outline-none shrink-0" title="${isInfoDoc ? 'Currently Set as Profile Trip Info Doc' : 'Set as Profile Trip Info Doc'}">
           <svg class="w-4 h-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
        </button>
        <button onclick="actionSingleCopy('${f.id}', false, '${safeName}')" class="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-gray-700 rounded-md transition focus:outline-none shrink-0" title="Copy File">
           ${copyIcon}
        </button>
        <button onclick="actionSingleMove('${f.id}', false, '${safeName}')" class="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-md transition focus:outline-none shrink-0" title="Move File">
           ${moveIcon}
        </button>
        <button onclick="promptRenameDriveItem('${f.id}', false, '${safeName}')" class="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-gray-700 rounded-md transition focus:outline-none shrink-0" title="Rename File">
           ${pencilIcon}
        </button>
        <button onclick="promptDeleteDriveItem('${f.id}', false, '${safeName}')" class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-gray-700 rounded-md transition focus:outline-none shrink-0" title="Delete File">
           ${trashIcon}
        </button>
    </div>
 </div>
`;
  });

  container.innerHTML = html;
}

function updatePinnedTripFilesUI() {
  const container = document.getElementById("pinnedTripFilesBar");
  if (!container) return;

  const infoId = (appSettings && appSettings.tripInfographicId) || "";
  const infoName = (appSettings && appSettings.tripInfographicName) || "";
  const infoUrl = (appSettings && appSettings.tripInfographicUrl) || "";

  const docId = (appSettings && appSettings.tripInfoDocId) || "";
  const docName = (appSettings && appSettings.tripInfoDocName) || "";
  const docUrl = (appSettings && appSettings.tripInfoDocUrl) || "";

  const infoSet = Boolean(infoId || infoName || infoUrl);
  const docSet = Boolean(docId || docName || docUrl);

  container.innerHTML = `
  <div class="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 p-2.5">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-1.5">
        <span class="p-1 rounded bg-primary/10 text-primary dark:text-green-400">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
        </span>
        <h4 class="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-200">Trip Display Files</h4>
      </div>
      <span class="text-[11px] text-gray-500 dark:text-gray-400 font-bold">Drive View Rights: Anyone with link</span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      <!-- Infographic Card -->
      <div class="p-2.5 rounded-lg border-2 ${infoSet ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'} flex flex-col justify-between transition">
        <div>
          <div class="flex items-center justify-between gap-1 mb-1">
            <span class="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-tight flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
              Landing Page Infographic
            </span>
            ${infoSet ? '<span class="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded">Active on Landing</span>' : '<span class="text-[10px] font-bold text-gray-400">Not Set</span>'}
          </div>
          <p class="text-xs ${infoSet ? 'font-bold text-gray-900 dark:text-white truncate' : 'text-gray-500 dark:text-gray-400'} mb-2">
            ${infoSet ? (infoName || 'Infographic File') : 'Displays directly as an image on the landing page.'}
          </p>
        </div>
        <div class="flex items-center gap-1.5 pt-1 border-t border-gray-200 dark:border-gray-700/60">
          <button onclick="openTripFilePickerModal('infographic')" class="px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm transition active:scale-95">
            ${infoSet ? 'Change' : 'Choose File'}
          </button>
          ${infoSet && (infoUrl || infoId) ? `<button onclick="openDriveFile('${infoUrl || ('https://drive.google.com/file/d/' + infoId + '/view')}')" class="px-2.5 py-1 text-xs font-bold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition">View</button>` : ''}
          ${infoSet ? `<button onclick="actionClearTripFile('infographic')" class="px-2 py-1 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md ml-auto transition">Clear</button>` : ''}
        </div>
      </div>

      <!-- Info Doc Card -->
      <div class="p-2.5 rounded-lg border-2 ${docSet ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'} flex flex-col justify-between transition">
        <div>
          <div class="flex items-center justify-between gap-1 mb-1">
            <span class="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-tight flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              Participant Trip Info Doc
            </span>
            ${docSet ? '<span class="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">Active in Profiles</span>' : '<span class="text-[10px] font-bold text-gray-400">Not Set</span>'}
          </div>
          <p class="text-xs ${docSet ? 'font-bold text-gray-900 dark:text-white truncate' : 'text-gray-500 dark:text-gray-400'} mb-2">
            ${docSet ? (docName || 'Info Doc File') : 'Linked via "Trip Info" button on participant profiles.'}
          </p>
        </div>
        <div class="flex items-center gap-1.5 pt-1 border-t border-gray-200 dark:border-gray-700/60">
          <button onclick="openTripFilePickerModal('infoDoc')" class="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-sm transition active:scale-95">
            ${docSet ? 'Change' : 'Choose File'}
          </button>
          ${docSet && (docUrl || docId) ? `<button onclick="openDriveFile('${docUrl || ('https://drive.google.com/file/d/' + docId + '/view')}')" class="px-2.5 py-1 text-xs font-bold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition">View</button>` : ''}
          ${docSet ? `<button onclick="actionClearTripFile('infoDoc')" class="px-2 py-1 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md ml-auto transition">Clear</button>` : ''}
        </div>
      </div>
    </div>
  </div>
  `;
}

async function actionSetTripFile(fileType, fileId, fileName, fileUrl) {
  const isInfographic = fileType === "infographic";
  const title = isInfographic ? "Landing Page Infographic" : "Participant Trip Info Doc";
  const message = isInfographic
    ? `Set "${fileName}" as the Trip Infographic?\n\n• The file's view rights in Google Drive will be set to 'Anyone with link able to view'.\n• It will appear directly as an image on the landing page.`
    : `Set "${fileName}" as the Trip Info Doc?\n\n• The file's view rights in Google Drive will be set to 'Anyone with link able to view'.\n• It will be accessible from all participants' profiles via the "Trip Info" button.`;

  if (!confirm(message)) return;

  const overlay = document.getElementById("driveLoadingOverlay");
  const loadText = document.getElementById("driveLoadingText");
  if (overlay) {
    overlay.classList.remove("hidden-force");
    if (loadText) loadText.textContent = `Setting ${title} & updating Drive permissions...`;
  }

  try {
    const res = await apiCall("setTripFile", {
      fileType: fileType,
      fileId: fileId,
      fileName: fileName,
      fileUrl: fileUrl
    });

    if (isInfographic) {
      appSettings.tripInfographicId = fileId;
      appSettings.tripInfographicName = fileName;
      appSettings.tripInfographicUrl = fileUrl;
    } else {
      appSettings.tripInfoDocId = fileId;
      appSettings.tripInfoDocName = fileName;
      appSettings.tripInfoDocUrl = fileUrl;
    }
    localStorage.setItem("appSettings", JSON.stringify(appSettings));

    showToast(`"${fileName}" set as ${title}! Google Drive view rights updated to anyone with link.`);
    updatePinnedTripFilesUI();
    const current = currentDrivePath[currentDrivePath.length - 1] || { id: "root", name: "Trip Folder" };
    loadDriveFolder(current.id, current.name, true);
  } catch (err) {
    showToast("Failed to set file: " + err.message, true);
  } finally {
    if (overlay) overlay.classList.add("hidden-force");
  }
}

async function actionClearTripFile(fileType) {
  const isInfographic = fileType === "infographic";
  const title = isInfographic ? "Landing Page Infographic" : "Participant Trip Info Doc";
  if (!confirm(`Are you sure you want to clear the ${title}?`)) return;

  const overlay = document.getElementById("driveLoadingOverlay");
  const loadText = document.getElementById("driveLoadingText");
  if (overlay) {
    overlay.classList.remove("hidden-force");
    if (loadText) loadText.textContent = `Clearing ${title}...`;
  }

  try {
    await apiCall("setTripFile", {
      fileType: fileType,
      fileId: "",
      fileName: "",
      fileUrl: ""
    });

    if (isInfographic) {
      appSettings.tripInfographicId = "";
      appSettings.tripInfographicName = "";
      appSettings.tripInfographicUrl = "";
    } else {
      appSettings.tripInfoDocId = "";
      appSettings.tripInfoDocName = "";
      appSettings.tripInfoDocUrl = "";
    }
    localStorage.setItem("appSettings", JSON.stringify(appSettings));

    showToast(`${title} cleared successfully.`);
    updatePinnedTripFilesUI();
    const current = currentDrivePath[currentDrivePath.length - 1] || { id: "root", name: "Trip Folder" };
    loadDriveFolder(current.id, current.name, true);
  } catch (err) {
    showToast("Failed to clear file: " + err.message, true);
  } finally {
    if (overlay) overlay.classList.add("hidden-force");
  }
}

function openTripFilePickerModal(fileType) {
  const isInfographic = fileType === "infographic";
  const title = isInfographic ? "Choose Landing Page Infographic" : "Choose Profile Trip Info Doc";

  let modal = document.getElementById("tripFilePickerModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "tripFilePickerModal";
    modal.className = "fixed inset-0 bg-black/60 z-[120] flex justify-center items-center p-3 backdrop-blur-sm";
    document.body.appendChild(modal);
  }

  const filesToPick = (lastLoadedDriveFiles || []).filter(f => !f.mimeType.includes("folder"));

  let filesListHtml = "";
  if (filesToPick.length === 0) {
    filesListHtml = `
      <div class="py-8 text-center text-gray-500 dark:text-gray-400">
        <svg class="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        <p class="font-bold text-sm">No files in current folder</p>
        <p class="text-xs mt-1">Navigate to a folder with files or upload a new file first.</p>
      </div>`;
  } else {
    filesListHtml = filesToPick.map(f => {
      const safeName = f.name.replace(/'/g, "\\'");
      const isCur = isInfographic 
        ? (appSettings.tripInfographicId === f.id || appSettings.tripInfographicName === f.name)
        : (appSettings.tripInfoDocId === f.id || appSettings.tripInfoDocName === f.name);

      return `
        <div class="flex items-center justify-between p-2.5 rounded-lg border-2 ${isCur ? 'border-primary bg-green-50/50 dark:bg-green-950/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'} hover:border-primary transition">
          <div class="flex items-center gap-2.5 min-w-0 pr-2">
            <div class="w-7 h-7 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 text-gray-600 dark:text-gray-300">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <div class="min-w-0">
              <p class="font-bold text-xs md:text-sm text-gray-900 dark:text-white truncate">${f.name}</p>
              <span class="text-[10px] text-gray-400 dark:text-gray-500">${f.mimeType || 'File'}</span>
            </div>
          </div>
          <button onclick="document.getElementById('tripFilePickerModal').classList.add('hidden-force'); actionSetTripFile('${fileType}', '${f.id}', '${safeName}', '${f.url}')" class="px-3 py-1.5 text-xs font-bold rounded-lg ${isCur ? 'bg-green-600 text-white' : 'bg-primary hover:bg-green-600 text-white'} shadow-sm shrink-0 active:scale-95 transition">
            ${isCur ? 'Currently Selected' : 'Select'}
          </button>
        </div>
      `;
    }).join("");
  }

  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl border-2 border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-slide-up max-h-[85vh]">
      <div class="flex items-center justify-between p-3.5 border-b-2 border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
        <div>
          <h3 class="text-sm font-black text-gray-900 dark:text-white">${title}</h3>
          <p class="text-[11px] text-gray-500 dark:text-gray-400">Select a file from current folder. Google Drive view rights will be set to 'Anyone with link'.</p>
        </div>
        <button onclick="document.getElementById('tripFilePickerModal').classList.add('hidden-force')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold px-2">&times;</button>
      </div>
      <div class="p-3 overflow-y-auto space-y-2 flex-grow custom-scrollbar">
        ${filesListHtml}
      </div>
      <div class="p-3 border-t-2 border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex justify-between items-center">
        <span class="text-[11px] text-gray-500 dark:text-gray-400">Current folder: <span class="font-bold text-gray-800 dark:text-gray-200">${(currentDrivePath[currentDrivePath.length - 1] || {}).name || 'Trip Folder'}</span></span>
        <button onclick="document.getElementById('tripFilePickerModal').classList.add('hidden-force')" class="px-3 py-1.5 text-xs font-bold bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition">Close</button>
      </div>
    </div>
  `;

  modal.classList.remove("hidden-force");
}
