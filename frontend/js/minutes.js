let minutesMap = new Map();
let pendingMinutesUpdates = new Map();
let minutesSyncTimeout = null;
let minutesPollInterval = null;
let isMinutesSyncing = false;
let minutesSearchQuery = '';

function generateUUID() {
  return 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatYMD(dateVal) {
   if (!dateVal) return '';
   // If it's already YYYY-MM-DD, return as is
   if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
       return dateVal.trim();
   }
   // Parse Google Sheets timestamp strings securely to local YMD
   const d = new Date(dateVal);
   if (!isNaN(d.getTime())) {
       const yyyy = d.getFullYear();
       const mm = String(d.getMonth() + 1).padStart(2, '0');
       const dd = String(d.getDate()).padStart(2, '0');
       return `${yyyy}-${mm}-${dd}`;
   }
   return String(dateVal);
}

function buildMinutesUI() {
  document.getElementById('tab-minutes').innerHTML = `
  <div class="flex flex-col h-full w-full relative">
      <div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-3 shrink-0 flex flex-col md:flex-row justify-between items-center z-10 shadow-sm rounded-t-xl md:rounded-none gap-3">
          <div class="flex items-center gap-2 w-full md:w-auto">
              <h3 class="text-sm md:text-base font-black text-gray-900 dark:text-white tracking-tight">Meeting Notes</h3>
              <span id="minutesSyncStatus" class="ml-2 text-[9px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded shadow-inner uppercase tracking-wider">Synced</span>
          </div>
          
          <div class="flex w-full md:w-auto items-center gap-2 justify-end">
              <div class="relative w-full md:w-48 shrink-0">
                  <input type="text" id="minutesSearchInput" oninput="handleMinutesSearch()" placeholder="Fuzzy search notes..." class="w-full p-2 pl-8 border border-gray-300 dark:border-gray-700 rounded-md text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm transition">
                  <svg class="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
              <button onclick="addMinuteNote()" class="w-auto bg-primary text-white text-[10px] md:text-xs font-bold px-3 py-2 rounded-md hover:bg-blue-600 transition flex items-center justify-center shadow-sm focus:outline-none shrink-0">
                  <svg class="w-3.5 h-3.5 md:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"></path></svg>
                  <span class="hidden md:inline">New Note</span>
              </button>
          </div>
      </div>

      <div id="minutesLoadingOverlay" class="absolute inset-0 top-[60px] bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-20 flex flex-col justify-center items-center hidden-force">
          <div class="loader !w-8 !h-8 border-primary mb-2"></div>
          <span class="text-primary dark:text-blue-400 font-bold text-[10px] tracking-wide shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full">Loading Notes...</span>
      </div>

      <div class="flex-grow overflow-y-auto p-2 md:p-4 bg-gray-50 dark:bg-gray-950 custom-scrollbar pb-10">
          <div id="minutesListContainer" class="flex flex-col gap-3 max-w-4xl mx-auto">
              <!-- Notes injected here -->
          </div>
      </div>
  </div>
  `;

  loadInitialMinutes();
}

async function loadInitialMinutes() {
  const overlay = document.getElementById('minutesLoadingOverlay');
  if (overlay) overlay.classList.remove('hidden-force');
  
  try {
      const res = await callBackend('fetchMinutes');
      minutesMap.clear();
      if (res.minutes && Array.isArray(res.minutes)) {
          res.minutes.forEach(m => minutesMap.set(m.id, m));
      }
      renderAllMinutes();
      startMinutesPolling();
  } catch(e) {
      showToast("Failed to load meeting notes.", true);
  } finally {
      if (overlay) overlay.classList.add('hidden-force');
  }
}

function handleMinutesSearch() {
  minutesSearchQuery = document.getElementById('minutesSearchInput').value.toLowerCase().trim();
  renderAllMinutes();
}

function addMinuteNote() {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  const newNote = {
      id: generateUUID(),
      date: today,
      content: '',
      assignedTo: '',
      ts: Date.now(),
      updatedBy: currentUser.name || 'Admin',
      isDeleted: false
  };
  
  minutesMap.set(newNote.id, newNote);
  queueMinuteUpdate(newNote.id);
  
  // Clear search if they are adding a new note so it doesn't get filtered out
  const searchInput = document.getElementById('minutesSearchInput');
  if (searchInput && searchInput.value) {
      searchInput.value = '';
      minutesSearchQuery = '';
      renderAllMinutes();
  }
  
  // Inject at the top immediately if not fully re-rendered
  const container = document.getElementById('minutesListContainer');
  if(container && !minutesSearchQuery) {
      const emptyMsg = container.querySelector('.empty-notes-msg');
      if(emptyMsg) emptyMsg.remove();
      
      const noteEl = createNoteDOM(newNote);
      if (!document.getElementById(`min-card-${newNote.id}`)) {
          container.insertBefore(noteEl, container.firstChild);
      }
      
      setTimeout(() => {
          const ta = document.getElementById(`min-card-${newNote.id}`)?.querySelector('textarea');
          if(ta) ta.focus();
      }, 50);
  }
}

function deleteMinuteNote(id) {
  if (!confirm("Delete this meeting note?")) return;
  const note = minutesMap.get(id);
  if(note) {
      note.isDeleted = true;
      note.ts = Date.now();
      note.updatedBy = currentUser.name || 'Admin';
      queueMinuteUpdate(id);
      
      const el = document.getElementById(`min-card-${id}`);
      if(el) {
          el.classList.add('opacity-0', 'scale-95');
          setTimeout(() => el.remove(), 200);
      }
  }
}

function handleMinuteInput(id, field, value) {
  const note = minutesMap.get(id);
  if(note) {
      note[field] = value;
      note.ts = Date.now();
      note.updatedBy = currentUser.name || 'Admin';
      queueMinuteUpdate(id);
      
      // Update DOM meta info (Updated By & Time) locally
      const byEl = document.getElementById(`min-by-${id}`);
      if(byEl) {
          byEl.textContent = `Just now by ${note.updatedBy}`;
          byEl.classList.add('text-primary');
          setTimeout(() => byEl.classList.remove('text-primary'), 2000);
      }
  }
}

function queueMinuteUpdate(id) {
  pendingMinutesUpdates.set(id, minutesMap.get(id));
  updateMinutesSyncUI('saving');
  
  if (minutesSyncTimeout) clearTimeout(minutesSyncTimeout);
  minutesSyncTimeout = setTimeout(() => {
      executeMinutesSync();
  }, 1500); // 1.5s debounce for typing
}

async function executeMinutesSync() {
  if (pendingMinutesUpdates.size === 0) return;
  
  isMinutesSyncing = true;
  updateMinutesSyncUI('saving');
  
  const updates = Array.from(pendingMinutesUpdates.values());
  pendingMinutesUpdates.clear();
  
  try {
      const res = await callBackend('syncMinutes', { updates: updates, takenBy: currentUser.name });
      
      // Process returned LWW merge securely (Mutex protection)
      if (res.minutes) {
          res.minutes.forEach(sNote => {
              const lNote = minutesMap.get(sNote.id);
              if (!lNote || (sNote.ts > lNote.ts && !pendingMinutesUpdates.has(sNote.id))) {
                  minutesMap.set(sNote.id, sNote);
                  updateNoteDOM(sNote);
              }
          });
      }
      updateMinutesSyncUI('saved');
  } catch(e) {
      // Revert to pending
      updates.forEach(u => pendingMinutesUpdates.set(u.id, u));
      updateMinutesSyncUI('error');
  } finally {
      isMinutesSyncing = false;
  }
}

function startMinutesPolling() {
  if (minutesPollInterval) clearInterval(minutesPollInterval);
  
  minutesPollInterval = setInterval(async () => {
      const tab = document.getElementById('tab-minutes');
      if (!tab || tab.classList.contains('hidden-force') || isMinutesSyncing) return;
      
      try {
          const res = await callBackend('fetchMinutes');
          if (res.minutes) {
              let hasRemoteChanges = false;
              res.minutes.forEach(sNote => {
                  const lNote = minutesMap.get(sNote.id);
                  // Standard LWW merge: If server note is newer AND no local edit is pending, apply it
                  if (!lNote || (sNote.ts > lNote.ts && !pendingMinutesUpdates.has(sNote.id))) {
                      minutesMap.set(sNote.id, sNote);
                      updateNoteDOM(sNote);
                      hasRemoteChanges = true;
                  }
              });
              
              if (hasRemoteChanges && pendingMinutesUpdates.size === 0) {
                  updateMinutesSyncUI('saved');
              }
          }
      } catch(e) {
          // silent polling fail
      }
  }, 8000);
}

function renderAllMinutes() {
  const container = document.getElementById('minutesListContainer');
  if (!container) return;
  
  let sorted = Array.from(minutesMap.values())
      .filter(n => !n.isDeleted)
      .sort((a, b) => b.ts - a.ts); // Newest first
      
  if (minutesSearchQuery) {
      sorted = sorted.filter(n => {
          return (n.content && n.content.toLowerCase().includes(minutesSearchQuery)) ||
                 (n.assignedTo && n.assignedTo.toLowerCase().includes(minutesSearchQuery)) ||
                 (n.date && n.date.toLowerCase().includes(minutesSearchQuery)) ||
                 (n.updatedBy && n.updatedBy.toLowerCase().includes(minutesSearchQuery));
      });
  }
      
  if (sorted.length === 0) {
      if (minutesSearchQuery) {
          container.innerHTML = `<div class="empty-notes-msg w-full py-10 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500"><p class="text-xs font-bold uppercase tracking-widest">No matching notes found.</p></div>`;
      } else {
          container.innerHTML = `<div class="empty-notes-msg w-full py-10 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500"><svg class="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg><p class="text-xs font-bold uppercase tracking-widest">No meeting notes found</p></div>`;
      }
      return;
  }
  
  container.innerHTML = '';
  sorted.forEach(note => {
      container.appendChild(createNoteDOM(note));
  });
}

function updateNoteDOM(note) {
  const card = document.getElementById(`min-card-${note.id}`);
  
  // If it's deleted, remove it.
  if (note.isDeleted) {
      if (card) card.remove();
      return;
  }
  
  // If search query active, check if it still matches
  if (minutesSearchQuery) {
      const matches = (note.content && note.content.toLowerCase().includes(minutesSearchQuery)) ||
                      (note.assignedTo && note.assignedTo.toLowerCase().includes(minutesSearchQuery)) ||
                      (note.date && note.date.toLowerCase().includes(minutesSearchQuery)) ||
                      (note.updatedBy && note.updatedBy.toLowerCase().includes(minutesSearchQuery));
      if (!matches) {
          if (card) card.remove();
          return;
      }
  }
  
  if (!card) {
      // Exists in data but not DOM (likely added from another user via poll or now matches search)
      const container = document.getElementById('minutesListContainer');
      if (container) {
          const emptyMsg = container.querySelector('.empty-notes-msg');
          if(emptyMsg) emptyMsg.remove();
          container.insertBefore(createNoteDOM(note), container.firstChild);
      }
      return;
  }
  
  // Safely update values IF they are not currently focused by the user
  const dateEl = card.querySelector('.note-date');
  const contentEl = card.querySelector('.note-content');
  const assignedEl = card.querySelector('.note-assigned');
  const metaEl = card.querySelector('.note-meta');
  
  if (document.activeElement !== dateEl) dateEl.value = formatYMD(note.date);
  if (document.activeElement !== contentEl) contentEl.value = note.content;
  if (document.activeElement !== assignedEl) assignedEl.value = note.assignedTo;
  
  if (metaEl) {
      const timeStr = new Date(note.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      metaEl.textContent = `${timeStr} by ${note.updatedBy}`;
  }
}

function createNoteDOM(note) {
  const div = document.createElement('div');
  div.id = `min-card-${note.id}`;
  div.className = "bg-white dark:bg-gray-800 rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1)] border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 transform";
  
  const timeStr = note.ts ? new Date(note.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'New';
  
  div.innerHTML = `
      <div class="flex justify-between items-center bg-gray-50/80 dark:bg-gray-900/50 p-2 md:p-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div class="flex items-center gap-2">
              <input type="date" value="${formatYMD(note.date)}" 
                  class="note-date min-w-[120px] [color-scheme:light] dark:[color-scheme:dark] text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 shadow-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                  onchange="handleMinuteInput('${note.id}', 'date', this.value)">
              <span id="min-by-${note.id}" class="note-meta text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide hidden md:inline-block">${timeStr} by ${note.updatedBy}</span>
          </div>
          <button onclick="deleteMinuteNote('${note.id}')" class="text-gray-400 hover:text-red-500 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-1.5 rounded shadow-sm hover:bg-red-50 dark:hover:bg-gray-700 transition focus:outline-none">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
      </div>
      <div class="p-3">
          <textarea 
              class="note-content w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs md:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-y shadow-inner min-h-[100px]"
              placeholder="Salient points, decisions made, or important notes..."
              oninput="handleMinuteInput('${note.id}', 'content', this.value)">${note.content}</textarea>
      </div>
      <div class="bg-blue-50/50 dark:bg-blue-900/10 p-2 md:p-3 border-t border-blue-100 dark:border-blue-900/30 flex items-center gap-2">
          <svg class="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <input type="text" value="${note.assignedTo}" 
              class="note-assigned w-full bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800/50 rounded-md px-2 py-1.5 text-xs font-bold text-blue-800 dark:text-blue-300 placeholder-blue-300 dark:placeholder-blue-700 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
              placeholder="Tag follow-ups (e.g. John, Alice)..."
              oninput="handleMinuteInput('${note.id}', 'assignedTo', this.value)">
      </div>
  `;
  
  return div;
}

function updateMinutesSyncUI(state) {
  const el = document.getElementById('minutesSyncStatus');
  if (!el) return;
  
  if (state === 'saving') {
      el.textContent = "Syncing...";
      el.className = "ml-2 text-[9px] font-bold text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 px-1.5 py-0.5 rounded shadow-inner uppercase tracking-wider transition-colors";
  } else if (state === 'saved') {
      el.textContent = "Saved";
      el.className = "ml-2 text-[9px] font-bold text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded shadow-inner uppercase tracking-wider transition-colors";
      setTimeout(() => {
          if (pendingMinutesUpdates.size === 0) {
              el.className = "ml-2 text-[9px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded shadow-inner uppercase tracking-wider transition-colors";
          }
      }, 2000);
  } else if (state === 'error') {
      el.textContent = "Offline / Error";
      el.className = "ml-2 text-[9px] font-bold text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded shadow-inner uppercase tracking-wider transition-colors";
  }
}