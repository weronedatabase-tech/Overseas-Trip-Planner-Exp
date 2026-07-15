// ==========================================
// Google Drive File & Folder Manager
// ==========================================
let currentDrivePath = []; // Stores { id: 'folderId', name: 'Folder Name' }
let driveClipboard = null; // Stores { action: 'copy'|'move', items: [{ id, name, isFolder }] }
let selectedDriveItems = new Map(); // Stores id -> { id, isFolder, name }

// Close add menu if clicked outside
document.addEventListener('click', (e) => {
const menu = document.getElementById('driveAddMenu');
if (menu && !menu.classList.contains('hidden-force')) {
  const addBtn = document.getElementById('btnDriveAdd');
  if (addBtn && !addBtn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add('hidden-force');
  }
}
});

function buildFilesUI() {
document.getElementById('tab-files').innerHTML = `
<div class="flex flex-col h-full w-full relative">
<!-- Header -->
<div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-2 md:p-3 shrink-0 flex items-center gap-2 shadow-sm rounded-t-xl md:rounded-none relative z-20">
  <button type="button" id="btnDriveBack" onclick="navigateDriveBack()" class="hidden-force p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition focus:outline-none shrink-0 active:scale-95">
     <svg class="w-5 h-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
  </button>
  
  <h3 id="driveCurrentFolderName" class="text-sm md:text-base font-black text-gray-900 dark:text-white tracking-tight truncate flex-1 min-w-0 pr-1">Trip Folder</h3>
  
  <div class="flex items-center gap-1 md:gap-1.5 shrink-0">
      <input type="file" id="driveFileInput" multiple class="hidden-force" onchange="handleFileSelect(event)">
      
      <!-- Paste Button -->
      <button type="button" id="btnDrivePaste" onclick="pasteFromDriveClipboard()" class="hidden-force p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-gray-800 transition focus:outline-none shrink-0 flex items-center gap-1 font-bold text-xs md:text-sm active:scale-95" title="Paste Item">
         <svg class="w-5 h-5 md:w-6 md:h-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
         <span class="hidden md:inline pointer-events-none" id="lblDrivePaste">Paste</span>
      </button>

      <!-- Add Menu Dropdown -->
      <div class="relative inline-block text-left z-30">
        <button type="button" id="btnDriveAdd" onclick="toggleDriveAddMenu(event)" class="p-1.5 rounded-lg text-primary hover:bg-blue-50 dark:hover:bg-gray-800 transition focus:outline-none shrink-0 flex items-center gap-1 font-bold text-xs md:text-sm active:scale-95" title="Add New">
           <svg class="w-5 h-5 md:w-6 md:h-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
           <span class="hidden md:inline pointer-events-none">Add</span>
        </button>
        <div id="driveAddMenu" class="hidden-force origin-top-right absolute right-0 mt-2 w-56 rounded-xl shadow-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 dark:divide-gray-700 z-[100]">
          <div class="py-1.5">
            <a href="#" onclick="toggleDriveAddMenu(); promptCreateFolder()" class="group flex items-center px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <svg class="mr-3 h-5 w-5 text-yellow-500 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg> New Folder
            </a>
            <a href="#" onclick="toggleDriveAddMenu(); triggerFileUpload()" class="group flex items-center px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <svg class="mr-3 h-5 w-5 text-blue-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> File Upload
            </a>
          </div>
          <div class="py-1.5">
            <a href="#" onclick="toggleDriveAddMenu(); promptCreateGoogleDoc('doc')" class="group flex items-center px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <svg class="mr-3 h-5 w-5 text-blue-600 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg> Google Doc
            </a>
            <a href="#" onclick="toggleDriveAddMenu(); promptCreateGoogleDoc('sheet')" class="group flex items-center px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <svg class="mr-3 h-5 w-5 text-green-600 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg> Google Sheet
            </a>
            <a href="#" onclick="toggleDriveAddMenu(); promptCreateGoogleDoc('slide')" class="group flex items-center px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <svg class="mr-3 h-5 w-5 text-yellow-600 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM10 8v8l6-4z"/></svg> Google Slides
            </a>
          </div>
        </div>
      </div>
      
      <button type="button" onclick="refreshCurrentDriveFolder(this)" class="p-1.5 rounded-lg text-primary hover:bg-blue-50 dark:hover:bg-gray-800 transition focus:outline-none shrink-0 relative z-30 flex items-center justify-center active:scale-95" title="Refresh">
         <svg class="w-5 h-5 md:w-6 md:h-6 btn-icon pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
         <div class="btn-spinner spinner-primary hidden-force !w-3 !h-3 md:!w-4 md:!h-4 border-2 absolute pointer-events-none"></div>
      </button>
  </div>
</div>

<!-- Bulk Actions Toolbar -->
<div id="driveBulkActions" class="hidden-force bg-blue-50 dark:bg-blue-900/30 p-2 md:p-3 shrink-0 flex justify-between items-center border-b border-blue-200 dark:border-blue-800 z-10 transition-all">
  <span id="driveBulkCount" class="text-xs md:text-sm font-black text-blue-800 dark:text-blue-300">0 selected</span>
  <div class="flex items-center gap-1.5 md:gap-2">
      <button onclick="bulkCopySelected()" class="px-2 py-1.5 text-[10px] md:text-xs font-bold bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded shadow-sm hover:bg-blue-100 transition focus:outline-none">Copy</button>
      <button onclick="bulkMoveSelected()" class="px-2 py-1.5 text-[10px] md:text-xs font-bold bg-white dark:bg-gray-800 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded shadow-sm hover:bg-orange-50 transition focus:outline-none">Move</button>
      <button onclick="bulkDeleteSelected()" class="px-2 py-1.5 text-[10px] md:text-xs font-bold bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded shadow-sm hover:bg-red-50 transition focus:outline-none">Delete</button>
      <button onclick="clearDriveSelection()" class="px-2 py-1.5 text-[10px] md:text-xs font-bold bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded shadow-sm hover:bg-gray-100 transition focus:outline-none ml-2">Cancel</button>
  </div>
</div>

<!-- Loading Overlay -->
<div id="driveLoadingOverlay" class="absolute inset-0 top-[50px] bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-20 hidden-force flex flex-col justify-center items-center">
   <div class="loader !w-8 !h-8 border-primary mb-2"></div>
   <span id="driveLoadingText" class="text-primary dark:text-blue-400 font-bold text-[10px] tracking-wide shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full mt-2">Loading folder...</span>
</div>

<!-- Contents List -->
<div id="driveContentsList" class="flex-grow overflow-y-auto p-2 md:p-3 space-y-1.5 bg-gray-50 dark:bg-gray-950 custom-scrollbar pb-10">
</div>
</div>
`;
updatePasteButtonState();
}

function toggleDriveAddMenu(event) {
if (event) {
  event.stopPropagation();
}
const menu = document.getElementById('driveAddMenu');
if (menu) {
  menu.classList.toggle('hidden-force');
}
}

// ------------------------------------------------------------------
// MULTI-SELECTION & BULK ACTIONS
// ------------------------------------------------------------------

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
const bar = document.getElementById('driveBulkActions');
const countLbl = document.getElementById('driveBulkCount');
if (!bar || !countLbl) return;

if (selectedDriveItems.size > 0) {
  bar.classList.remove('hidden-force');
  countLbl.textContent = `${selectedDriveItems.size} item(s) selected`;
} else {
  bar.classList.add('hidden-force');
}
}

function clearDriveSelection() {
selectedDriveItems.clear();
document.querySelectorAll('.drive-item-checkbox').forEach(cb => cb.checked = false);
updateBulkActionsBar();
}

function setDriveClipboard(action, itemsArray) {
driveClipboard = { action, items: itemsArray };
showToast(`${action === 'copy' ? 'Copied' : 'Moving'} ${itemsArray.length} item(s). Navigate to target folder and paste.`);
clearDriveSelection();
updatePasteButtonState();
}

function bulkCopySelected() { setDriveClipboard('copy', Array.from(selectedDriveItems.values())); }
function bulkMoveSelected() { setDriveClipboard('move', Array.from(selectedDriveItems.values())); }
async function bulkDeleteSelected() {
if (!confirm(`Move ${selectedDriveItems.size} item(s) to Trash?`)) return;
const items = Array.from(selectedDriveItems.values());
clearDriveSelection();
const current = currentDrivePath[currentDrivePath.length - 1] || { id: 'root' };
await executeBulkAction('delete', items, current.id);
}

// Quick Actions (Single Items)
function actionSingleCopy(id, isFolder, name) { setDriveClipboard('copy', [{id, isFolder, name}]); }
function actionSingleMove(id, isFolder, name) { setDriveClipboard('move', [{id, isFolder, name}]); }

async function promptDeleteDriveItem(id, isFolder, name) {
if (!confirm(`Are you sure you want to delete the ${isFolder ? 'folder' : 'file'} "${name}"?\nThis will move it to the Drive Trash.`)) return;
const current = currentDrivePath[currentDrivePath.length - 1] || { id: 'root' };
await executeBulkAction('delete', [{id, isFolder, name}], current.id);
}

// ------------------------------------------------------------------

function updatePasteButtonState() {
const btn = document.getElementById('btnDrivePaste');
const lbl = document.getElementById('lblDrivePaste');
if (btn && lbl) {
  if (driveClipboard && driveClipboard.items.length > 0) {
      btn.classList.remove('hidden-force');
      if (driveClipboard.action === 'copy') {
          lbl.textContent = `Paste (${driveClipboard.items.length})`;
          btn.classList.remove('text-orange-600', 'hover:bg-orange-50');
          btn.classList.add('text-green-600', 'hover:bg-green-50');
      } else {
          lbl.textContent = `Move Here (${driveClipboard.items.length})`;
          btn.classList.remove('text-green-600', 'hover:bg-green-50');
          btn.classList.add('text-orange-600', 'hover:bg-orange-50');
      }
  } else {
      btn.classList.add('hidden-force');
  }
}
}

async function pasteFromDriveClipboard() {
if (!driveClipboard || driveClipboard.items.length === 0) return;

const current = currentDrivePath[currentDrivePath.length - 1] || { id: 'root' };

let singleNewName = null;
if (driveClipboard.items.length === 1) {
  const item = driveClipboard.items[0];
  const defaultName = driveClipboard.action === 'copy' ? `Copy of ${item.name}` : item.name;
  singleNewName = prompt(`${driveClipboard.action === 'copy' ? 'Pasting' : 'Moving'} "${item.name}".\nEnter name:`, defaultName);
  if (!singleNewName || !singleNewName.trim()) return;
}

await executeBulkAction(driveClipboard.action, driveClipboard.items, current.id, singleNewName?.trim());

// Clear clipboard only if successfully initiated (re-render will clean up UI)
driveClipboard = null;
updatePasteButtonState();
}

async function executeBulkAction(actionType, items, targetFolderId, singleNewName = null) {
const overlay = document.getElementById('driveLoadingOverlay');
const loadText = document.getElementById('driveLoadingText');

if (overlay) {
  overlay.classList.remove('hidden-force');
  if (actionType === 'delete') loadText.textContent = `Deleting ${items.length} item(s)...`;
  else if (actionType === 'move') loadText.textContent = `Moving ${items.length} item(s)...`;
  else loadText.textContent = `Copying ${items.length} item(s)...`;
}

try {
  const res = await callBackend('bulkDriveOperation', { 
      actionType, 
      items, 
      targetFolderId, 
      singleNewName 
  });
  if (res.status === 'error') throw new Error(res.message);
  renderDriveContents(res.folders, res.files);
  showToast("Operation successful.");
} catch(e) {
  showToast("Failed: " + e.message, true);
} finally {
  if (overlay) overlay.classList.add('hidden-force');
}
}

async function promptCreateFolder() {
const folderName = prompt("Enter new folder name:");
if (!folderName || !folderName.trim()) return;

const current = currentDrivePath[currentDrivePath.length - 1] || { id: 'root' };
const overlay = document.getElementById('driveLoadingOverlay');
const loadText = document.getElementById('driveLoadingText');

if (overlay) {
overlay.classList.remove('hidden-force');
loadText.textContent = "Creating folder...";
}

try {
const res = await callBackend('createDriveFolder', { parentFolderId: current.id, folderName: folderName.trim() });
if (res.status === 'error') throw new Error(res.message);
renderDriveContents(res.folders, res.files);
showToast("Folder created.");
} catch(e) {
showToast("Failed to create folder.", true);
} finally {
if (overlay) overlay.classList.add('hidden-force');
}
}

async function promptCreateGoogleDoc(docType) {
const labels = {
  'doc': 'Google Doc',
  'sheet': 'Google Sheet',
  'slide': 'Google Slide'
};
const fileName = prompt(`Enter name for new ${labels[docType]}:`, `Untitled ${labels[docType]}`);
if (!fileName || !fileName.trim()) return;

const current = currentDrivePath[currentDrivePath.length - 1] || { id: 'root' };
const overlay = document.getElementById('driveLoadingOverlay');
const loadText = document.getElementById('driveLoadingText');

if (overlay) {
  overlay.classList.remove('hidden-force');
  loadText.textContent = `Creating ${labels[docType]}...`;
}

try {
  const res = await callBackend('createGoogleDoc', { 
      folderId: current.id, 
      fileName: fileName.trim(),
      docType: docType
  });
  if (res.status === 'error') throw new Error(res.message);
  renderDriveContents(res.folders, res.files);
  showToast(`${labels[docType]} created successfully.`);
} catch(e) {
  showToast(`Failed to create ${labels[docType]}.`, true);
} finally {
  if (overlay) overlay.classList.add('hidden-force');
}
}

function triggerFileUpload() {
document.getElementById('driveFileInput').click();
}

function readFileAsBase64(file) {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload = (e) => resolve(e.target.result.split(',')[1]);
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
if (f.size > 4194304) {
    skippedFiles.push(f.name);
} else {
    validFiles.push(f);
}
}

if (skippedFiles.length > 0) {
showToast(`Skipped ${skippedFiles.length} file(s) larger than 4MB.`, true);
}

if (validFiles.length === 0) {
event.target.value = '';
return;
}

const current = currentDrivePath[currentDrivePath.length - 1] || { id: 'root' };
const overlay = document.getElementById('driveLoadingOverlay');
const loadText = document.getElementById('driveLoadingText');

if (overlay) {
overlay.classList.remove('hidden-force');
}

let successCount = 0;
let lastRes = null;

for (let i = 0; i < validFiles.length; i++) {
const file = validFiles[i];
if (loadText) {
    loadText.textContent = `Uploading file ${i + 1} of ${validFiles.length}...`;
}

try {
    const base64Data = await readFileAsBase64(file);
    const res = await callBackend('uploadDriveFile', { 
        folderId: current.id, 
        fileName: file.name, 
        mimeType: file.type || 'application/octet-stream', 
        fileData: base64Data 
    });
    
    if (res.status === 'error') throw new Error(res.message);
    lastRes = res;
    successCount++;
} catch(err) {
    showToast(`Failed to upload ${file.name}: ${err.message}`, true);
}
}

if (lastRes) {
renderDriveContents(lastRes.folders, lastRes.files);
}

if (overlay) {
overlay.classList.add('hidden-force');
}

event.target.value = '';

if (successCount > 0) {
showToast(`Successfully uploaded ${successCount} file(s).`);
}
}

async function promptRenameDriveItem(id, isFolder, oldName) {
const newName = prompt(`Enter new name for the ${isFolder ? 'folder' : 'file'}:`, oldName);
if (!newName || !newName.trim() || newName.trim() === oldName) return;

const current = currentDrivePath[currentDrivePath.length - 1] || { id: 'root' };
const overlay = document.getElementById('driveLoadingOverlay');
const loadText = document.getElementById('driveLoadingText');

if (overlay) {
overlay.classList.remove('hidden-force');
loadText.textContent = "Renaming item...";
}

try {
const res = await callBackend('renameDriveItem', { itemId: id, isFolder: isFolder, newName: newName.trim(), currentFolderId: current.id });
if (res.status === 'error') throw new Error(res.message);
renderDriveContents(res.folders, res.files);
showToast("Item renamed successfully.");
} catch(e) {
showToast("Failed to rename item.", true);
} finally {
if (overlay) overlay.classList.add('hidden-force');
}
}

async function loadDriveFolder(folderId, folderName, isBack = false) {
if (!isBack) {
if (currentDrivePath.length === 0 || currentDrivePath[currentDrivePath.length - 1].id !== folderId) {
currentDrivePath.push({ id: folderId, name: folderName });
}
}

updateDriveHeader();
const overlay = document.getElementById('driveLoadingOverlay');
const loadText = document.getElementById('driveLoadingText');
if (overlay) {
overlay.classList.remove('hidden-force');
loadText.textContent = "Loading folder...";
}

try {
const res = await callBackend('getDriveContents', { folderId: folderId });
if (res.status === 'error') {
throw new Error(res.message);
}

if (currentDrivePath.length === 1 && folderId === 'root') {
  currentDrivePath[0].name = res.currentFolderName;
  currentDrivePath[0].id = res.currentFolderId;
  updateDriveHeader();
}

renderDriveContents(res.folders, res.files);
} catch(e) {
showToast("Failed to load folder contents.", true);
if (!isBack && currentDrivePath.length > 1) {
  currentDrivePath.pop();
  updateDriveHeader();
}
} finally {
if (overlay) overlay.classList.add('hidden-force');
}
}

function updateDriveHeader() {
const backBtn = document.getElementById('btnDriveBack');
const title = document.getElementById('driveCurrentFolderName');

if (!backBtn || !title) return;

if (currentDrivePath.length > 1) {
backBtn.classList.remove('hidden-force');
} else {
backBtn.classList.add('hidden-force');
}

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
const current = currentDrivePath[currentDrivePath.length - 1] || { id: 'root', name: 'Trip Folder' };
loadDriveFolder(current.id, current.name, true).finally(() => {
setBtnLoading(btn, false);
});
clearDriveSelection();
}

function openDriveFile(url) {
const a = document.createElement('a');
a.href = url;
a.target = '_blank';
a.rel = 'noopener noreferrer';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
}

function renderDriveContents(folders, files) {
const container = document.getElementById('driveContentsList');
let html = '';

if (folders.length === 0 && files.length === 0) {
container.innerHTML = '<div class="flex flex-col items-center justify-center p-8 text-gray-400 dark:text-gray-500"><svg class="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg><p class="text-xs font-bold">This folder is empty.</p></div>';
return;
}

const copyIcon = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`;
const moveIcon = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"></path></svg>`;
const trashIcon = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`;
const pencilIcon = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>`;

// Render Folders
folders.forEach(f => {
const safeName = f.name.replace(/'/g, "\\'");
const isChecked = selectedDriveItems.has(f.id) ? 'checked' : '';
html += `
  <div class="flex items-center gap-1 bg-white dark:bg-gray-800 p-1 md:p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:border-primary transition group">
     <div class="flex items-center pl-2 shrink-0" onclick="event.stopPropagation()">
        <input type="checkbox" class="drive-item-checkbox w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer" ${isChecked} onchange="toggleDriveItemSelection(event, '${f.id}', true, '${safeName}')">
     </div>
     <div onclick="loadDriveFolder('${f.id}', '${safeName}')" class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer select-none active:scale-[0.98] px-2 py-1">
         <div class="w-8 h-8 rounded bg-yellow-50 dark:bg-yellow-900/30 flex items-center justify-center shrink-0">
           <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
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
         <button onclick="promptRenameDriveItem('${f.id}', true, '${safeName}')" class="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-md transition focus:outline-none shrink-0" title="Rename Folder">
            ${pencilIcon}
         </button>
         <button onclick="promptDeleteDriveItem('${f.id}', true, '${safeName}')" class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-gray-700 rounded-md transition focus:outline-none shrink-0" title="Delete Folder">
            ${trashIcon}
         </button>
     </div>
  </div>
`;
});

// Render Files & Shortcuts
files.forEach(f => {
const safeName = f.name.replace(/'/g, "\\'");
const isChecked = selectedDriveItems.has(f.id) ? 'checked' : '';
let iconHtml = '';
let bgClass = 'bg-gray-50 dark:bg-gray-700';

if (f.mimeType.includes('folder')) {
    bgClass = 'bg-yellow-50 dark:bg-yellow-900/30';
    iconHtml = `<svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
} else if (f.mimeType.includes('spreadsheet')) {
    bgClass = 'bg-green-50 dark:bg-green-900/30';
    iconHtml = `<svg class="w-5 h-5 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
} else if (f.mimeType.includes('document')) {
    bgClass = 'bg-blue-50 dark:bg-blue-900/30';
    iconHtml = `<svg class="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
} else if (f.mimeType.includes('presentation')) {
    bgClass = 'bg-yellow-50 dark:bg-yellow-900/30';
    iconHtml = `<svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM10 8v8l6-4z"/></svg>`;
} else if (f.mimeType.includes('pdf')) {
    bgClass = 'bg-red-50 dark:bg-red-900/30';
    iconHtml = `<svg class="w-5 h-5 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM16.5 9h-1v2h1V9z"/><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z"/></svg>`;
} else {
    iconHtml = `<svg class="w-5 h-5 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm6 1.5L18.5 9H12V3.5z"/></svg>`;
}

const shortcutBadge = f.isShortcut ? `<div class="absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full shadow-sm p-0.5"><svg class="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></div>` : '';
const nameHtml = f.isShortcut 
   ? `<div class="flex flex-col min-w-0"><span class="font-bold text-sm text-gray-900 dark:text-white truncate group-hover:text-primary transition-colors">${f.name}</span><span class="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-black">Shortcut</span></div>`
   : `<span class="font-bold text-sm text-gray-900 dark:text-white truncate group-hover:text-primary transition-colors">${f.name}</span>`;

html += `
  <div class="flex items-center gap-1 bg-white dark:bg-gray-800 p-1 md:p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:border-gray-300 dark:hover:border-gray-500 transition group">
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
         <button onclick="actionSingleCopy('${f.id}', false, '${safeName}')" class="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-gray-700 rounded-md transition focus:outline-none shrink-0" title="Copy File">
            ${copyIcon}
         </button>
         <button onclick="actionSingleMove('${f.id}', false, '${safeName}')" class="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-md transition focus:outline-none shrink-0" title="Move File">
            ${moveIcon}
         </button>
         <button onclick="promptRenameDriveItem('${f.id}', false, '${safeName}')" class="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-md transition focus:outline-none shrink-0" title="Rename File">
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