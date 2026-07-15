// Navigates securely handling Base URL and Query parameters
window.navigateTo = function(page, params = {}) {
  let url = new URL(page, window.location.origin + window.location.pathname);
  for (let key in params) {
      url.searchParams.set(key, params[key]);
  }
  window.location.href = url.toString();
};

async function refreshApp() { 
  const icon = document.getElementById('refreshIcon'); 
  if(icon) icon.classList.add('fa-spin'); 
  
  // Provide UX feedback since a deep sync takes a few seconds
  showOverlay('loading', 'Syncing from Google Drive...');

  // 1. Wipe frontend LocalStorage cache so the next load doesn't show stale data immediately
  localStorage.removeItem('myg_sheetList');

  // 2. Determine if a specific sheet is open so we can bust its specific cache too
  let targetSheetUrl = null;
  if (typeof currentCommAttSheetUrl !== 'undefined' && currentCommAttSheetUrl) targetSheetUrl = currentCommAttSheetUrl;
  else if (typeof currentManualPairingSheetUrl !== 'undefined' && currentManualPairingSheetUrl) targetSheetUrl = currentManualPairingSheetUrl;
  else if (typeof currentGroupingSheetUrl !== 'undefined' && currentGroupingSheetUrl) targetSheetUrl = currentGroupingSheetUrl;
  else if (document.getElementById('volSheetSelector') && document.getElementById('volSheetSelector').value && document.getElementById('volSheetSelector').value.startsWith('http')) {
      targetSheetUrl = document.getElementById('volSheetSelector').value;
  } else if (document.getElementById('actualSheetSelector') && document.getElementById('actualSheetSelector').value && document.getElementById('actualSheetSelector').value.startsWith('http')) {
      targetSheetUrl = document.getElementById('actualSheetSelector').value;
  } else if (document.getElementById('commSheetSelector') && document.getElementById('commSheetSelector').value && document.getElementById('commSheetSelector').value.startsWith('http')) {
      targetSheetUrl = document.getElementById('commSheetSelector').value;
  }

  // 3. Command backend to bust and rebuild caches
  try {
      await apiCall('forceBackendRefresh', { sheetUrl: targetSheetUrl });
  } catch(e) {
      console.warn("Backend refresh failed, proceeding with local refresh.");
  }

  // 4. Force Service Worker Update
  if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
          for (let reg of regs) {
              reg.update();
          }
      });
  }

  // 5. Clear Browser Cache Storage & Reload
  if ('caches' in window) {
      caches.keys().then(names => {
          Promise.all(names.map(name => caches.delete(name))).then(() => {
              window.location.reload(true);
          });
      });
  } else {
      setTimeout(() => { window.location.reload(true); }, 300);
  }
}

function toggleTheme() { 
  document.documentElement.classList.toggle('dark'); 
  localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); 
}

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(inputId + 'Icon');
  if(input.type === 'password') {
      input.type = 'text';
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
  } else {
      input.type = 'password';
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
  }
}

// --- OVERLAY LOGIC ---
function showOverlay(type, msg) {
  const overlay = document.getElementById('fullPageOverlay');
  if(!overlay) return;
  overlay.classList.remove('hidden');

  ['overlayLoading', 'overlaySuccess', 'overlayError'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.classList.add('hidden');
  });

  if (type === 'loading') {
      const el = document.getElementById('overlayLoading');
      if(el) el.classList.remove('hidden');
      const txt = document.getElementById('overlayLoadingText');
      if(txt) txt.innerText = msg || "Processing...";
  } else if (type === 'success') {
      const el = document.getElementById('overlaySuccess');
      if(el) el.classList.remove('hidden');
      const txt = document.getElementById('overlaySuccessText');
      if(txt) txt.innerText = msg;
  } else {
      const el = document.getElementById('overlayError');
      if(el) el.classList.remove('hidden');
      const txt = document.getElementById('overlayErrorText');
      if(txt) txt.innerText = msg;
  }
}

function closeOverlay() {
  const el = document.getElementById('fullPageOverlay');
  if(el) el.classList.add('hidden');
}

function showFlashMessage(elementId, message, type) { 
  const el = document.getElementById(elementId); 
  if(!el) return;
  el.innerText = message; 
  el.classList.remove('hidden', 'bg-green-100', 'dark:bg-green-900/30', 'text-green-600', 'dark:text-green-400', 'border-green-200', 'dark:border-green-800', 'bg-red-100', 'dark:bg-red-900/30', 'text-red-600', 'dark:text-red-400', 'border-red-200', 'dark:border-red-800'); 
  if (type === 'success') { 
      el.classList.add('bg-green-100', 'dark:bg-green-900/30', 'text-green-600', 'dark:text-green-400', 'border', 'border-green-200', 'dark:border-green-800'); 
  } else { 
      el.classList.add('bg-red-100', 'dark:bg-red-900/30', 'text-red-600', 'dark:text-red-400', 'border', 'border-red-200', 'dark:border-red-800'); 
  } 
  el.classList.remove('hidden'); 
  setTimeout(() => { el.classList.add('hidden'); }, 5000); 
}

function formatDateDisplay(input) { 
  const val = input.value; 
  if(!val) { input.type='text'; return; } 
  const date = new Date(val); 
  if(isNaN(date.getTime())) { input.type='text'; return; } 
  const day = date.getDate().toString().padStart(2, '0'); 
  const month = date.toLocaleString('default', { month: 'short' }); 
  const year = date.getFullYear(); 
  input.type = 'text'; 
  input.value = `${day} ${month} ${year}`; 
}

// --- HELPER LOGIC FOR SEARCH CLEAR BUTTONS ---
window.toggleClearBtn = function(inputId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById('clearBtn-' + inputId);
  if (input && btn) {
      if (input.value.length > 0) {
          btn.classList.remove('hidden');
      } else {
          btn.classList.add('hidden');
      }
  }
}

window.clearSearchInput = function(inputId, filterCallbackName) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById('clearBtn-' + inputId);
  if (input) {
      input.value = '';
      if (btn) btn.classList.add('hidden');
      input.focus();

      if (filterCallbackName && typeof window[filterCallbackName] === 'function') {
          window[filterCallbackName]();
      }
  }
}

function updateUnpairedNotification(count) {
  // Update Comm Dashboard List
  if(currentSheetList) {
      currentSheetList.forEach((item, index) => {
          if (
              (typeof currentCommAttSheetUrl !== 'undefined' && item.sheetUrl === currentCommAttSheetUrl) || 
              (typeof currentManualPairingSheetUrl !== 'undefined' && item.sheetUrl === currentManualPairingSheetUrl) || 
              (typeof currentGroupingSheetUrl !== 'undefined' && item.sheetUrl === currentGroupingSheetUrl)
          ) {
              const pendingDiv = document.getElementById(`pending-badge-${index}`);
              if (pendingDiv) {
                  if (count > 0) {
                      pendingDiv.innerHTML = `<button onclick="navigateTo('pairing.html', { url: '${item.sheetUrl}', filtered: 'true' })" class="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800 animate-pulse shadow-sm flex items-center justify-center w-fit pointer-events-auto cursor-pointer">${count} Unpaired</button>`;
                      pendingDiv.classList.remove('hidden');
                      pendingDiv.classList.add('flex');
                  } else {
                      pendingDiv.classList.add('hidden');
                      pendingDiv.classList.remove('flex');
                  }
              }
          }
      });
  }

  // Update Live Tracker
  const liveBadgeBtn = document.getElementById('liveUnpairedBtn');
  const liveBadgeCount = document.getElementById('liveUnpairedCount');
  if (liveBadgeBtn && liveBadgeCount) {
      if (count > 0) {
          liveBadgeCount.innerText = `${count} Unpaired`;
          liveBadgeBtn.classList.remove('hidden');
          liveBadgeBtn.classList.add('flex');
      } else {
          liveBadgeBtn.classList.add('hidden');
          liveBadgeBtn.classList.remove('flex');
      }
  }

  // Update Manual Pairing View
  const manualBadge = document.getElementById('manualPairingUnpairedCount');
  if (manualBadge) {
      if (count > 0) {
          manualBadge.innerText = `${count} Unpaired`;
          manualBadge.classList.remove('hidden');
          manualBadge.classList.add('flex');
      } else {
          manualBadge.classList.add('hidden');
          manualBadge.classList.remove('flex');
      }
  }
}

// --- UNIVERSAL LONG PRESS LOGIC ---

function uiBindLongPress(element, callback) {
  let pressTimer = null;
  let startX = 0, startY = 0;
  let hasFired = false;

  const clearTimer = () => {
      if (pressTimer !== null) {
          clearTimeout(pressTimer);
          pressTimer = null;
      }
  };

  const handleStart = (e) => {
      if (e.button !== undefined && e.button !== 0) return; // Ignore right-click/middle-click

      hasFired = false;
      if (e.touches && e.touches.length > 0) {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
      } else {
          startX = e.clientX;
          startY = e.clientY;
      }

      pressTimer = setTimeout(() => {
          hasFired = true;
          callback();
          element.classList.remove('active:scale-95');
          setTimeout(() => element.classList.add('active:scale-95'), 100);
      }, 500); 
  };

  const handleMove = (e) => {
      if (!pressTimer) return;
      let currentX, currentY;

      if (e.touches && e.touches.length > 0) {
          currentX = e.touches[0].clientX;
          currentY = e.touches[0].clientY;
      } else {
          currentX = e.clientX;
          currentY = e.clientY;
      }

      if (Math.abs(currentX - startX) > 10 || Math.abs(currentY - startY) > 10) {
          clearTimer();
      }
  };

  const handleEnd = (e) => {
      clearTimer();
      if (hasFired) {
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();

          const preventClick = (clickEvent) => {
              clickEvent.preventDefault();
              clickEvent.stopPropagation();
              element.removeEventListener('click', preventClick, true);
          };
          element.addEventListener('click', preventClick, true);
          setTimeout(() => element.removeEventListener('click', preventClick, true), 300);
      }
  };

  element.addEventListener('touchstart', handleStart, {passive: true});
  element.addEventListener('touchmove', handleMove, {passive: true});
  element.addEventListener('touchend', handleEnd);
  element.addEventListener('touchcancel', handleEnd);

  element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      callback();
  });
}

// --- GLOBAL GROUP SELECTOR MODAL ---
window.renderGlobalGroupGrid = function() {
  const grid = document.getElementById('globalGroupGrid');
  if (!grid) return;
  grid.innerHTML = '';
  if (window.extractedActiveGroups) {
      window.extractedActiveGroups.forEach(g => {
          grid.innerHTML += `
          <div class="relative group/btn">
              <button onclick="selectGlobalGroup('${g}')" class="w-full bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-zinc-700 py-2 md:py-3 rounded-lg text-sm font-bold hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-900/30 dark:hover:text-orange-400 transition-colors shadow-sm focus:outline-none">Grp ${g}</button>
              <button onclick="removeGlobalGroupOption('${g}', event)" class="absolute -top-1.5 -right-1.5 bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-gray-400 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm border border-gray-300 dark:border-zinc-600 transition-colors z-10"><i class="fa-solid fa-xmark"></i></button>
          </div>`;
      });
  }
};

window.openGlobalGroupSelect = function(inputId) {
  if (!isAdminAuthenticated) return requestAccess(null, () => window.openGlobalGroupSelect(inputId));
  
  let modal = document.getElementById('globalGroupSelectModal');
  if (!modal) {
      modal = document.createElement('div');
      modal.id = 'globalGroupSelectModal';
      modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm hidden z-[120] flex items-center justify-center p-4 transition-opacity duration-300 opacity-0';
      modal.innerHTML = `
          <div class="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl border border-gray-200 dark:border-zinc-800 flex flex-col max-h-[90vh] shadow-2xl scale-95 transition-transform duration-300" id="globalGroupSelectPanel">
              <div class="p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center shrink-0">
                  <h3 class="text-gray-900 dark:text-white font-bold text-sm md:text-base">Assign Group</h3>
                  <button onclick="closeGlobalGroupSelect()" class="text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"><i class="fa-solid fa-xmark text-lg"></i></button>
              </div>
              <div class="p-4 flex-grow overflow-y-auto custom-scrollbar max-h-[60vh] pb-12">
                  <div id="globalGroupGrid" class="grid grid-cols-3 gap-2"></div>
                  <div class="mt-4 border-t border-gray-200 dark:border-zinc-800 pt-4 flex gap-2">
                      <button onclick="selectGlobalGroup('')" class="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 py-2 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition">Unassign</button>
                      <button onclick="selectGlobalNewGroup()" class="flex-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition">+ New Group</button>
                  </div>
              </div>
          </div>
      `;
      document.body.appendChild(modal);
  }

  window.globalGroupTargetInput = inputId;
  window.renderGlobalGroupGrid();

  modal.classList.remove('hidden');
  setTimeout(() => {
      modal.classList.remove('opacity-0');
      document.getElementById('globalGroupSelectPanel').classList.replace('scale-95', 'scale-100');
  }, 10);
};

window.closeGlobalGroupSelect = function() {
  const modal = document.getElementById('globalGroupSelectModal');
  if (modal) {
      modal.classList.add('opacity-0');
      document.getElementById('globalGroupSelectPanel').classList.replace('scale-100', 'scale-95');
      setTimeout(() => modal.classList.add('hidden'), 300);
  }
};

window.selectGlobalGroup = function(g) {
  const input = document.getElementById(window.globalGroupTargetInput);
  if (input) {
      input.value = g;
  }
  window.closeGlobalGroupSelect();
};

window.selectGlobalNewGroup = function() {
  const g = prompt("Enter new Group Name or Number:");
  if (g && g.trim()) {
      const clean = g.trim();
      if (!window.extractedActiveGroups.includes(clean)) {
          window.extractedActiveGroups.push(clean);
      }
      selectGlobalGroup(clean);
  }
};

window.removeGlobalGroupOption = function(g, event) {
  if (event) event.stopPropagation();
  window.extractedActiveGroups = window.extractedActiveGroups.filter(x => String(x) !== String(g));
  if (typeof activeGroups !== 'undefined') {
      activeGroups = activeGroups.filter(x => String(x) !== String(g));
  }
  window.renderGlobalGroupGrid();
};


// --- PERSON INFO & INTEGRATED QUICK EDIT ---

window.lastPersonObj = null;
window.infoPairingVols = [];
window.infoAllAvailableVols = [];

function showPersonInfo(personObj) {
  if (window.navigator && window.navigator.vibrate) {
      try { window.navigator.vibrate(50); } catch(e){}
  }

  if (!personObj) return;
  window.lastPersonObj = personObj;

  const ex = personObj.extra || {};
  const role = personObj.role || ex.role || 'TRAINEE';
  let htmlContent = "";

  const nameStr = personObj.name || '-';
  const roleBadge = role === 'TRAINEE' 
  ? `<span class="bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 px-1.5 py-0.5 rounded text-[10px] uppercase font-black tracking-wider shadow-sm">Trainee</span>`
  : `<span class="bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800 px-1.5 py-0.5 rounded text-[10px] uppercase font-black tracking-wider shadow-sm">Volunteer</span>`;

  const infoTitle = document.getElementById('personInfoModalTitle');
  if (infoTitle) {
      infoTitle.innerHTML = `<i class="fa-solid fa-circle-info mr-2 text-blue-500 dark:text-blue-400 shrink-0"></i> <span class="truncate flex-1">${nameStr}</span> <div class="shrink-0 ml-2">${roleBadge}</div>`;
  }

  // Resilient context extraction bypassing URL constraints
  let sheetUrl = "";
  let meetingOpts = [];
  let dismissalOpts = [];
  let allGroups = new Set(["1", "2", "3", "4", "5"]);

  const extractData = (dataObj) => {
      if (dataObj?.meetingLocs) meetingOpts = dataObj.meetingLocs;
      if (dataObj?.dismissalLocs) dismissalOpts = dataObj.dismissalLocs;
      if (dataObj?.participants || dataObj?.trainees) {
          const arr = dataObj.participants || dataObj.trainees;
          arr.forEach(p => { if (p.group) allGroups.add(String(p.group).trim()); });
      }
  };

  if (typeof commAttData !== 'undefined' && commAttData) extractData(commAttData);
  if (typeof manualPairingData !== 'undefined' && manualPairingData) extractData(manualPairingData);
  if (typeof groupingData !== 'undefined' && groupingData) extractData(groupingData);

  if (typeof currentCommAttSheetUrl !== 'undefined' && currentCommAttSheetUrl) sheetUrl = currentCommAttSheetUrl;
  if (typeof currentManualPairingSheetUrl !== 'undefined' && currentManualPairingSheetUrl) sheetUrl = currentManualPairingSheetUrl;
  if (typeof currentGroupingSheetUrl !== 'undefined' && currentGroupingSheetUrl) sheetUrl = currentGroupingSheetUrl;

  window.extractedActiveGroups = Array.from(allGroups).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));

  let attVal = (personObj.attending || '').toLowerCase();
  if (!attVal) attVal = 'y';

  let meetVal = (personObj.meetingLoc || (role === 'TRAINEE' ? ex.t_meet : ex.v_meet) || '').trim();
  let disVal = (personObj.dismissalLoc || (role === 'TRAINEE' ? ex.t_dismiss : ex.v_dismiss) || '').trim();

  let groupVal = personObj.group || ex.v_group || '';
  let pairedVal = personObj.volPaired || ex.t_paired_vol || ex.v_paired_trainee || '';

  const generateOpts = (optsArr, currentVal, placeholder) => {
      let html = `<option value="">-- ${placeholder} --</option>`;
      let found = false;
      optsArr.forEach(opt => {
          const isSelected = currentVal.toLowerCase() === opt.toLowerCase();
          if (isSelected) found = true;
          html += `<option value="${opt}" ${isSelected ? 'selected' : ''}>${opt}</option>`;
      });
      if (currentVal && !found) {
          html += `<option value="${currentVal}" selected>${currentVal} (Current)</option>`;
      }
      return html;
  };

  const meetOptionsHtml = generateOpts(meetingOpts, meetVal, "None");
  const disOptionsHtml = generateOpts(dismissalOpts, disVal, "None");

  const adminLockHtml = isAdminAuthenticated ? '' : `
  <div class="absolute inset-0 bg-white/60 dark:bg-black/60 z-20 flex items-center justify-center cursor-pointer rounded-lg backdrop-blur-[1px] transition-all hover:bg-white/40 dark:hover:bg-black/40" onclick="requestAccess(null, () => showPersonInfo(window.lastPersonObj))">
  <span class="bg-gray-900 dark:bg-gray-100 text-white dark:text-black text-[10px] px-2 py-1 rounded font-bold shadow-md"><i class="fa-solid fa-lock mr-1"></i>Admin Edit</span>
  </div>`;

  let detailsHtml = `<div class="space-y-3 mt-1 text-sm text-gray-700 dark:text-gray-300">`;

  detailsHtml += `
  <div class="bg-gray-50/50 dark:bg-zinc-800/30 p-3 rounded-xl border border-gray-200 dark:border-zinc-700/60 space-y-3 shadow-inner">
  <div class="flex items-center gap-2 mb-1 border-b border-gray-200 dark:border-zinc-700/60 pb-2">
      <i class="fa-solid fa-pen-to-square text-gray-500"></i>
      <h4 class="font-bold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Quick Edit</h4>
  </div>

  <input type="hidden" id="infoEditSheetUrl" value="${sheetUrl || ''}">
  <input type="hidden" id="infoEditRole" value="${role}">
  <input type="hidden" id="infoEditName" value="${nameStr.replace(/"/g, '&quot;')}">

  <div class="grid grid-cols-1 gap-3">
      <div class="flex items-center gap-3">
           <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 shrink-0"><i class="fa-solid fa-clipboard-user"></i></div>
           <div class="flex-1">
               <label class="block text-[10px] font-bold text-blue-700 dark:text-blue-400 mb-0.5 uppercase tracking-wider">Attending</label>
               <select id="infoEditAttending" class="w-full bg-white dark:bg-black border border-blue-200 dark:border-blue-800/50 text-gray-900 dark:text-white rounded-lg p-1.5 text-xs focus:border-blue-500 shadow-sm outline-none transition-colors">
                   <option value="Y" ${attVal === 'y' ? "selected" : ""}>Yes (Y)</option>
                   <option value="N" ${attVal === 'n' ? "selected" : ""}>No (N)</option>
                   <option value="" ${attVal !== 'y' && attVal !== 'n' ? "selected" : ""}>Unknown</option>
               </select>
           </div>
      </div>

      <div class="flex items-center gap-3">
           <div class="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-500 shrink-0"><i class="fa-solid fa-location-dot"></i></div>
           <div class="flex-1">
               <label class="block text-[10px] font-bold text-green-700 dark:text-green-400 mb-0.5 uppercase tracking-wider">Meeting</label>
               <select id="infoEditMeeting" class="w-full bg-white dark:bg-black border border-green-200 dark:border-green-800/50 text-gray-900 dark:text-white rounded-lg p-1.5 text-xs focus:border-green-500 shadow-sm outline-none transition-colors">
                   ${meetOptionsHtml}
               </select>
           </div>
      </div>

      <div class="flex items-center gap-3">
           <div class="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-500 shrink-0"><i class="fa-solid fa-flag-checkered"></i></div>
           <div class="flex-1">
               <label class="block text-[10px] font-bold text-purple-700 dark:text-purple-400 mb-0.5 uppercase tracking-wider">Dismissal</label>
               <select id="infoEditDismissal" class="w-full bg-white dark:bg-black border border-purple-200 dark:border-purple-800/50 text-gray-900 dark:text-white rounded-lg p-1.5 text-xs focus:border-purple-500 shadow-sm outline-none transition-colors">
                   ${disOptionsHtml}
               </select>
           </div>
      </div>
      
      <div class="flex items-center gap-3 relative cursor-pointer group" onclick="openGlobalGroupSelect('infoEditGroup')">
          ${adminLockHtml}
          <div class="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-500 shrink-0 group-hover:scale-110 transition-transform"><i class="fa-solid fa-users"></i></div>
          <div class="flex-1 pointer-events-none">
              <label class="block text-[10px] font-bold text-orange-700 dark:text-orange-400 mb-0.5 uppercase tracking-wider">Group</label>
              <input type="text" id="infoEditGroup" value="${groupVal.replace(/"/g, '&quot;')}" class="w-full bg-gray-50 dark:bg-black border border-orange-200 dark:border-orange-800/50 text-gray-900 dark:text-white rounded-lg p-1.5 text-xs shadow-sm outline-none transition-colors cursor-pointer" readonly placeholder="Unassigned">
          </div>
      </div>`;
      
  if (role === 'TRAINEE') {
      detailsHtml += `
      <div class="flex items-start gap-3 relative mt-1">
          ${adminLockHtml}
          <div class="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-500 shrink-0"><i class="fa-solid fa-handshake-angle"></i></div>
          <div class="flex-1 relative">
              <label class="block text-[10px] font-bold text-teal-700 dark:text-teal-400 mb-0.5 uppercase tracking-wider">Paired Vol(s)</label>
              <input type="hidden" id="infoEditPairingHidden" value="${pairedVal.replace(/"/g, '&quot;')}">
              <div id="infoEditPairingTags" class="flex flex-wrap gap-1 mb-1"></div>
              <input type="text" id="infoEditPairingInput" class="w-full bg-white dark:bg-black border border-teal-200 dark:border-teal-800/50 text-gray-900 dark:text-white rounded-lg p-1.5 text-xs focus:border-teal-500 shadow-sm outline-none transition-colors" placeholder="Search active vol..." oninput="window.filterInfoPairing()" onfocus="window.filterInfoPairing()" autocomplete="off" ${isAdminAuthenticated ? '' : 'readonly'}>
              <ul id="infoEditPairingList" class="absolute z-50 w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg mt-1 shadow-xl hidden max-h-40 overflow-y-auto pb-4 custom-scrollbar"></ul>
          </div>
      </div>`;
  }

  detailsHtml += `
  </div>
  </div>
  `;

  if (role === 'TRAINEE') {
      const meetFetch = ex.t_meet_fetching || '-';
      const disFetch = ex.t_dismiss_fetching || '-';
      const dietary = ex.t_dietary || '-';
      const cgContact = ex.m_cg_contact || '-';

      if (meetFetch !== '-' && meetFetch !== '') {
          detailsHtml += `
          <div class="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800">
              <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 shrink-0 mt-0.5"><i class="fa-solid fa-car-side"></i></div>
              <div class="flex-1 min-w-0">
                  <div class="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">Meeting Fetch</div>
                  <div class="font-medium text-gray-900 dark:text-white break-words whitespace-pre-wrap">${meetFetch}</div>
              </div>
          </div>`;
      }

      if (disFetch !== '-' && disFetch !== '') {
          detailsHtml += `
          <div class="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800">
              <div class="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-500 shrink-0 mt-0.5"><i class="fa-solid fa-car-side"></i></div>
              <div class="flex-1 min-w-0">
                  <div class="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">Dismissal Fetch</div>
                  <div class="font-medium text-gray-900 dark:text-white break-words whitespace-pre-wrap">${disFetch}</div>
              </div>
          </div>`;
      }

      detailsHtml += `
      <div class="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800">
          <div class="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 shrink-0 mt-0.5"><i class="fa-solid fa-utensils"></i></div>
          <div class="flex-1 min-w-0">
              <div class="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">Dietary Restrictions</div>
              <div class="font-medium text-gray-900 dark:text-white break-words whitespace-pre-wrap">${dietary}</div>
          </div>
      </div>

      <div class="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800">
          <div class="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-500 shrink-0 mt-0.5"><i class="fa-solid fa-phone"></i></div>
          <div class="flex-1 min-w-0">
              <div class="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">CG Contact</div>
              <div class="font-medium text-gray-900 dark:text-white break-words whitespace-pre-wrap">${cgContact}</div>
          </div>
      </div>
      `;
  } 

  detailsHtml += `</div>`; 

  let remarks = ex.remark || '-';
  let remarksHtml = "";
  if (remarks && remarks !== '-' && remarks.trim() !== '') {
      remarksHtml = `
      <div class="mt-2 mb-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 border-l-4 border-l-yellow-400 dark:border-l-yellow-500 p-3 rounded-r-lg shadow-sm">
      <div class="flex items-center gap-2 mb-1">
          <i class="fa-solid fa-triangle-exclamation text-yellow-600 dark:text-yellow-500 text-sm"></i>
          <span class="font-black text-yellow-800 dark:text-yellow-400 text-[10px] uppercase tracking-wider">Remarks</span>
      </div>
      <p class="text-yellow-900 dark:text-yellow-100 text-sm whitespace-pre-wrap font-medium leading-relaxed">${remarks}</p>
      </div>
      `;
  }

  let pairingConsiderationsHtml = "";
  if (role === 'TRAINEE' && ex.t_one_on_one) {
      const oneOnOneRaw = String(ex.t_one_on_one).trim().toLowerCase();
      if (oneOnOneRaw !== '' && !['no', 'n', 'false', '0'].includes(oneOnOneRaw)) {
          pairingConsiderationsHtml = `
          <div class="mt-2 mb-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 border-l-4 border-l-blue-400 dark:border-l-blue-500 p-3 rounded-r-lg shadow-sm">
              <div class="flex items-center gap-2 mb-1">
                  <i class="fa-solid fa-star text-blue-600 dark:text-blue-500 text-sm"></i>
                  <span class="font-black text-blue-800 dark:text-blue-400 text-[10px] uppercase tracking-wider">Pairing Considerations</span>
              </div>
              <p class="text-blue-900 dark:text-blue-100 text-sm whitespace-pre-wrap font-medium leading-relaxed">${String(ex.t_one_on_one).trim()}</p>
          </div>
          `;
      }
  }

  htmlContent = `
  ${remarksHtml}
  ${pairingConsiderationsHtml}
  ${detailsHtml}
  `;

  const infoContent = document.getElementById('personInfoContent');
  if(infoContent) {
      infoContent.className = "w-full";
      infoContent.innerHTML = htmlContent;
  }

  const footer = document.getElementById('personInfoFooter');
  if(footer) {
      footer.innerHTML = `
      <button onclick="closePersonInfoModal()" class="flex-1 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-900 dark:text-white font-bold py-3 rounded-xl border border-gray-300 dark:border-zinc-700 shadow-sm transition-colors text-base">Close</button>
      <button onclick="submitIntegratedQuickEdit()" id="infoSaveBtn" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl border border-blue-600 shadow-sm transition-colors text-base flex items-center justify-center gap-2">
      <i class="fa-solid fa-save"></i> Save Changes
      </button>
      `;
  }

  if (role === 'TRAINEE') {
      window.initInfoPairing(pairedVal, sheetUrl);
  }

  const infoModal = document.getElementById('personInfoModal');
  if(infoModal) infoModal.classList.remove('hidden');
}

function closePersonInfoModal() {
  const infoModal = document.getElementById('personInfoModal');
  if(infoModal) infoModal.classList.add('hidden');
  window.lastPersonObj = null;
}

function submitIntegratedQuickEdit() {
  const btn = document.getElementById('infoSaveBtn');
  const sheetUrl = document.getElementById('infoEditSheetUrl').value;
  const role = document.getElementById('infoEditRole').value;
  const name = document.getElementById('infoEditName').value;

  const att = document.getElementById('infoEditAttending').value;
  const meet = document.getElementById('infoEditMeeting').value;
  const dis = document.getElementById('infoEditDismissal').value;

  const groupEl = document.getElementById('infoEditGroup');
  const group = groupEl ? groupEl.value.trim() : null;

  const pairingEl = document.getElementById('infoEditPairingHidden');
  const pairing = pairingEl ? pairingEl.value.trim() : null;

  if (!sheetUrl) return alert("Error: Context URL lost.");

  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...`;

  const payloadData = {
      "Name": name,
      "Attending (Y/N)": att,
      "Meeting Location": meet,
      "Dismissal Location": dis
  };

  if (group !== null) {
      if (role.toLowerCase() === 'trainee') payloadData["Outing Grouping"] = group;
      else payloadData["Group"] = group; 
  }

  if (pairing !== null && role.toLowerCase() === 'trainee') {
      payloadData["Vol Paired"] = pairing;
  }

  const payload = { sheetUrl: sheetUrl, type: role.toLowerCase(), data: payloadData, targetName: name };

  apiCall('submitAttendanceData', payload).then(res => {
      if(res.success) {
          btn.innerHTML = `<i class="fa-solid fa-check"></i> Saved!`;
          btn.classList.replace('bg-blue-600', 'bg-green-600');
          btn.classList.replace('border-blue-600', 'border-green-600');
          btn.classList.replace('hover:bg-blue-700', 'hover:bg-green-700');
          
          setTimeout(() => {
              closePersonInfoModal();
              btn.disabled = false;
              btn.innerHTML = `<i class="fa-solid fa-save"></i> Save Changes`;
              btn.classList.replace('bg-green-600', 'bg-blue-600');
              btn.classList.replace('hover:bg-green-700', 'hover:bg-blue-700');
              btn.classList.replace('border-green-600', 'border-blue-600');
              
              if (typeof manualSyncCommAttendance === 'function') {
                  manualSyncCommAttendance();
              } else if (typeof manualSyncManualPairing === 'function') {
                  manualSyncManualPairing();
              } else if (typeof manualSyncGrouping === 'function') {
                  manualSyncGrouping();
              }
          }, 1500);
      } else {
          btn.disabled = false;
          btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Save Failed`;
          alert("Error: " + res.message);
      }
  });
}

window.initInfoPairing = function(initialStr, sheetUrl) {
  window.infoPairingVols = initialStr ? initialStr.split(/[,|\n]+/).map(s=>s.trim()).filter(s=>s) : [];
  window.updateInfoPairingUI();
  
  // Pulls robust architectural data limiting options to active volunteers
  apiCall('fetchManualPairingData', { sheetUrl: sheetUrl }).then(res => {
      if(res.success && res.data && res.data.volunteers) {
          window.infoAllAvailableVols = res.data.volunteers.map(v => v.name);
      }
  });
};

window.filterInfoPairing = function() {
  const input = document.getElementById('infoEditPairingInput');
  const list = document.getElementById('infoEditPairingList');
  if(!input || !list) return;
  const filter = input.value.toLowerCase().trim();
  list.innerHTML = "";

  if(filter.length === 0 && window.infoAllAvailableVols.length === 0) {
      list.classList.add('hidden');
      return;
  }

  list.classList.remove('hidden');
  const matches = window.infoAllAvailableVols.filter(v => 
      v.toLowerCase().includes(filter) && !window.infoPairingVols.includes(v)
  );

  matches.forEach(match => {
      const li = document.createElement('li');
      li.className = "px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-zinc-700 hover:bg-teal-600 hover:text-white cursor-pointer text-xs transition-colors last:border-0";
      li.innerText = match;
      li.onmousedown = (e) => { e.preventDefault(); window.addInfoPairing(match); };
      list.appendChild(li);
  });

  if (matches.length === 0 && filter.length > 0) {
      const li = document.createElement('li');
      li.className = "px-3 py-2 text-xs text-gray-500 dark:text-gray-400 italic bg-white dark:bg-zinc-800 cursor-pointer hover:bg-teal-50 dark:hover:bg-zinc-700";
      li.innerText = `Press Enter or Click to add "${input.value.trim()}"`;
      li.onmousedown = (e) => { e.preventDefault(); window.addInfoPairing(input.value.trim()); };
      list.appendChild(li);
  }
};

window.addInfoPairing = function(name) {
  if(!name) return;
  if(!window.infoPairingVols.includes(name)) {
      window.infoPairingVols.push(name);
      window.updateInfoPairingUI();
  }
  const input = document.getElementById('infoEditPairingInput');
  input.value = "";
  input.focus();
  window.filterInfoPairing();
};

window.removeInfoPairing = function(name) {
  window.infoPairingVols = window.infoPairingVols.filter(v => v !== name);
  window.updateInfoPairingUI();
  window.filterInfoPairing();
};

window.updateInfoPairingUI = function() {
  const tags = document.getElementById('infoEditPairingTags');
  const hidden = document.getElementById('infoEditPairingHidden');
  if(!tags || !hidden) return;

  tags.innerHTML = window.infoPairingVols.map(v => 
      `<span class="bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/50 dark:text-teal-300 dark:border-teal-700/50 px-2 py-0.5 rounded text-xs flex items-center gap-1">${v} <i class="fa-solid fa-xmark cursor-pointer hover:text-red-500 ml-1" onclick="window.removeInfoPairing('${v.replace(/'/g, "\\'")}')"></i></span>`
  ).join('');

  hidden.value = window.infoPairingVols.join(', ');
};

document.addEventListener('keydown', function(e) {
  if (e.target && e.target.id === 'infoEditPairingInput') {
      if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          if (e.target.value.trim()) {
              window.addInfoPairing(e.target.value.trim());
          }
      }
  }
});

document.addEventListener('click', function(e) {
  const list = document.getElementById('infoEditPairingList');
  const input = document.getElementById('infoEditPairingInput');
  if(list && !list.classList.contains('hidden') && e.target !== input && !list.contains(e.target)) {
      list.classList.add('hidden');
  }
});