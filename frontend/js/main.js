document.addEventListener("DOMContentLoaded", () => {
if ('serviceWorker' in navigator) {
 navigator.serviceWorker.getRegistrations().then(regs => {
   for (let r of regs) r.unregister();
 });
}

const savedSession = localStorage.getItem('userSession');
if (savedSession) currentUser = JSON.parse(savedSession);

if(localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
 document.documentElement.classList.add('dark');
} else {
 document.documentElement.classList.remove('dark');
}

const devModeBar = document.getElementById('devModeBar');
if (devModeBar) {
 if (ENV === 'Dev') {
   devModeBar.textContent = 'Testing';
   devModeBar.className = 'w-full bg-red-600 text-white text-center py-0.5 text-xs font-bold tracking-widest uppercase shrink-0 z-50';
   devModeBar.classList.remove('hidden-force');
 } else if (ENV === 'Exp') {
   devModeBar.textContent = 'Experimentation';
   devModeBar.className = 'w-full bg-purple-600 text-white text-center py-0.5 text-xs font-bold tracking-widest uppercase shrink-0 z-50';
   devModeBar.classList.remove('hidden-force');
 } else {
   devModeBar.classList.add('hidden-force');
 }
}

// Check Authentication boundaries
const path = window.location.pathname;
const isPublic = path.endsWith('index.html') || path.endsWith('register.html') || path === '/' || path === '';
if (!currentUser && !isPublic) {
 window.location.href = 'index.html';
 return;
}

if (currentUser) {
 const deskUserName = document.getElementById('deskUserName');
 const deskUserRole = document.getElementById('deskUserRole');
 const roleStr = currentUser.nric === 'ADMIN' ? 'Main Admin' : (currentUser.role === 'admin' ? 'Committee' : 'Participant');
 if(deskUserName) deskUserName.textContent = currentUser.name || 'User';
 if(deskUserRole) deskUserRole.textContent = roleStr;

 if (currentUser.role !== 'admin') {
     document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden-force'));
 }
 if (currentUser.nric === 'ADMIN') {
     const navProfile = document.getElementById('nav-profile');
     if(navProfile) navProfile.classList.add('hidden-force');
 }
}

// Pillar 1 Sync Safety: Track mutational interactions
document.addEventListener('input', () => { lastLocalChange = Date.now(); });
document.addEventListener('change', () => { lastLocalChange = Date.now(); });
document.addEventListener('click', (e) => {
  if(e.target.tagName === 'BUTTON' || e.target.closest('button')) lastLocalChange = Date.now();
});

// Setup Long Press for Participant Quick View
setupGlobalLongPress();

silentHydration();
});

// ==========================================
// GLOBAL LONG-PRESS PARTICIPANT VIEW
// ==========================================
let lpTimer;
let lpActive = false;
let lpStartX = 0;
let lpStartY = 0;

function setupGlobalLongPress() {
document.addEventListener('touchstart', handleLpStart, {passive: true});
document.addEventListener('mousedown', handleLpStart);
document.addEventListener('touchend', handleLpEnd);
document.addEventListener('mouseup', handleLpEnd);
document.addEventListener('touchmove', handleLpMove, {passive: true});
document.addEventListener('mousemove', handleLpMove);
}

function handleLpStart(e) {
if(e.button !== undefined && e.button !== 0) return; // Ignore right-clicks
const target = e.target.closest('[data-nric]');
if (!target) return;

const nric = target.dataset.nric;
if (!nric) return;

const clientX = e.touches ? e.touches[0].clientX : e.clientX;
const clientY = e.touches ? e.touches[0].clientY : e.clientY;
lpStartX = clientX;
lpStartY = clientY;

lpActive = true;
lpTimer = setTimeout(() => {
   if(lpActive) {
       lpActive = false;
       if(navigator.vibrate) {
           try { navigator.vibrate(50); } catch(err){}
       }
       showParticipantSummaryModal(nric);
   }
}, 600);
}

function handleLpMove(e) {
if (!lpActive) return;
const clientX = e.touches ? e.touches[0].clientX : e.clientX;
const clientY = e.touches ? e.touches[0].clientY : e.clientY;

// Only cancel long press if finger/mouse moves more than 10 pixels (allows for slight jitters on mobile screens)
if (Math.abs(clientX - lpStartX) > 10 || Math.abs(clientY - lpStartY) > 10) {
   handleLpEnd();
}
}

function handleLpEnd() {
lpActive = false;
clearTimeout(lpTimer);
}


async function showParticipantSummaryModal(nric) {
  let modal = document.getElementById('globalParticipantModal');
  if(!modal) {
    modal = document.createElement('div');
    modal.id = 'globalParticipantModal';
    modal.className = 'fixed inset-0 bg-black/60 z-[110] flex justify-center items-center p-4 backdrop-blur-sm hidden-force overflow-y-auto';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl shadow-2xl border border-gray-200 dark:border-gray-700 animate-slide-up flex flex-col overflow-hidden my-auto">
        <div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-900/50">
          <h3 class="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Participant Summary
          </h3>
          <button type="button" onclick="closeParticipantSummaryModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold px-1 focus:outline-none">&times;</button>
        </div>
        <div id="gpm-content" class="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div class="flex justify-center py-6"><div class="loader !w-8 !h-8 border-primary"></div></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if(e.target === modal) closeParticipantSummaryModal(); });
  }

  modal.classList.remove('hidden-force');
  const cont = document.getElementById('gpm-content');
  cont.innerHTML = `<div class="flex justify-center py-6"><div class="loader !w-8 !h-8 border-primary"></div></div>`;

    try {
    let m = null;
    let familyArr = [];
    if (typeof adminRosterData !== 'undefined' && adminRosterData.length > 0) {
        m = adminRosterData.find(f => f.nric.toUpperCase() === nric.toUpperCase());
    } else if (typeof loadedFamily !== 'undefined' && loadedFamily.length > 0) {
        m = loadedFamily.find(f => f.nric.toUpperCase() === nric.toUpperCase());
    }
    
    if (!m) {
        const res = await apiCall('getProfile', { nric: nric });
        if(res.status === 'error') throw new Error(res.message);
        if(res.family) {
            m = res.family.find(f => f.nric.toUpperCase() === nric.toUpperCase());
            if (m) {
                familyArr = res.family.filter(f => f !== m);
            }
        }
    }
    
    if(!m) throw new Error("Participant not found");

    if (m && familyArr.length === 0) {
        let sourceArr = [];
        if (typeof adminRosterData !== 'undefined' && adminRosterData.length > 0) sourceArr = adminRosterData;
        else if (typeof loadedFamily !== 'undefined' && loadedFamily.length > 0) sourceArr = loadedFamily;
        
        familyArr = window.getFamilyMembers ? window.getFamilyMembers(m.nric, sourceArr).filter(f => f !== m) : [];
    }

    let groupOpts = `<option value="">Select...</option>`;
    if(appSettings.projectGroups) {
       appSettings.projectGroups.forEach(g => { groupOpts += `<option value="${g}" ${m.group === g ? 'selected' : ''}>${g}</option>`; });
     }
    if(m.group && (!appSettings.projectGroups || !appSettings.projectGroups.includes(m.group))) {
       groupOpts += `<option value="${m.group}" selected>${m.group} (Archived)</option>`;
     }
    const dynColor = getProjectColor(m.group);

    let familyHtml = '';
    if (familyArr.length > 0) {
        familyHtml = `
        <div class="md:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-3 mt-1">
            <p class="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider mb-2">Family Members</p>
            <div class="flex flex-col gap-2">
                ${familyArr.map(f => {
                     const fRoleColor = f.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (f.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
                     return `<div class="flex flex-col md:flex-row md:items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-2 rounded border border-gray-200 dark:border-gray-700">
                         <div class="flex items-center gap-2 mb-1 md:mb-0">
                            <span class="text-[10px] font-black ${fRoleColor} bg-white dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 uppercase tracking-wider shrink-0">${f.role.substring(0,3)}</span>
                            <span class="font-bold text-xs text-gray-800 dark:text-gray-200">${f.fullName}</span>
                         </div>
                         <div class="text-sm font-mono text-gray-600 dark:text-gray-400 font-semibold bg-white dark:bg-gray-900 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                            ${renderPhoneLink(f.contact)}
                         </div>
                     </div>`;
                }).join('')}
            </div>
        </div>`;
    }


    const mRoleColor = m.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (m.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
    
    let logRoom = 'None';
    let logGroup = m.logisticsGroup || 'None';
    let logBus = m.bus || 'None';
    let logPairing = 'None';

    try {
        const logistics = (typeof globalLogistics !== 'undefined' && globalLogistics) ? globalLogistics : await apiCall('fetchLogistics').catch(e => null);
        if (logistics && logistics.participants) {
            const lp = logistics.participants.find(p => p.nric.toUpperCase() === m.nric.toUpperCase());
            if (lp) {
                logGroup = lp.logisticsGroup || 'None';
                logBus = lp.bus || 'None';
                if (logistics.rooms) {
                    const r = logistics.rooms.find(r => r.occupants && r.occupants.includes(lp.nric));
                    if (r) logRoom = r.name;
                }
                if (logistics.pairings) {
                    if (lp.role === 'TRAINEE') {
                        const pair = logistics.pairings.find(p => p.traineeNric === lp.nric && p.status === 'ACTIVE');
                        if (pair) {
                            const vp = logistics.participants.find(x => x.nric === pair.volNric);
                            if (vp) logPairing = vp.shortName || vp.fullName || pair.volNric;
                        }
                    } else {
                        const pairs = logistics.pairings.filter(p => p.volNric === lp.nric && p.status === 'ACTIVE');
                        if (pairs.length > 0) {
                            logPairing = pairs.map(pair => {
                                const tp = logistics.participants.find(x => x.nric === pair.traineeNric);
                                return tp ? (tp.shortName || tp.fullName) : pair.traineeNric;
                            }).join(', ');
                        }
                    }
                }
            }
        }
    } catch(e) {}

    window._currentModalParticipant = m;

    cont.innerHTML = `
      <div id="gpm-view">
        <div class="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-2 mb-3">
          <div class="flex items-center flex-wrap gap-1.5">
            <span class="font-extrabold text-[13px] md:text-sm px-2 py-0.5 rounded shadow-sm border ${dynColor} leading-tight">${m.fullName}</span> 
            <span class="text-xs font-black ${mRoleColor} bg-gray-50 dark:bg-gray-800 px-1 py-[1px] leading-tight rounded-sm border border-gray-200 dark:border-gray-700 uppercase tracking-wide">${m.role}</span>
          </div>
          <div class="flex gap-2">
            <button onclick="document.getElementById('gpm-view').classList.add('hidden-force'); document.getElementById('gpm-edit').classList.remove('hidden-force'); if(typeof setupNationalityDropdown === 'function') setupNationalityDropdown('gpmNat');" class="text-primary dark:text-green-400 text-xs font-bold hover:bg-green-50 dark:hover:bg-gray-800 px-2 py-1 rounded transition focus:outline-none border border-transparent hover:border-green-200 dark:hover:border-gray-700 shadow-sm">Edit</button>
            <button onclick="deleteParticipant('${m.nric}')" class="text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-gray-800 px-2 py-1 rounded transition focus:outline-none border border-transparent hover:border-red-200 dark:hover:border-gray-700 shadow-sm">Delete</button>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 text-sm text-gray-800 dark:text-gray-200">
          <div><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Short Name</p><p class="font-semibold">${m.shortName || '-'}</p></div>
          <div><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">NRIC / FIN</p><p class="font-semibold uppercase">${m.nric}</p></div>
          <div><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Date of Birth</p><p class="font-semibold">${formatDDMmmYYYY(m.dob)}</p></div>
          <div><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Gender & Nat.</p><p class="font-semibold">${m.gender} | ${m.nationality}</p></div>
          <div><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Contact & Email</p><div class="font-semibold flex flex-col gap-0.5"><span>${renderPhoneLink(m.contact)}</span><span class="text-gray-600 dark:text-gray-400 font-medium truncate w-full" title="${m.email || 'N/A'}">${m.email || 'N/A'}</span></div></div>
          <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-1">Project</p><span class="font-bold text-xs px-1.5 py-0.5 rounded border inline-block shadow-sm ${dynColor}">${m.group || 'None'}</span></div>
          <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Pairing</p><p class="font-semibold truncate w-full" title="${logPairing}">${logPairing}</p></div>
          <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Room</p><p class="font-semibold truncate w-full" title="${logRoom}">${logRoom}</p></div>
          <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Group</p><p class="font-semibold truncate w-full" title="${logGroup}">${logGroup}</p></div>
          <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Bus</p><p class="font-semibold truncate w-full" title="${logBus}">${logBus}</p></div>
          <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Home Address</p><p class="font-semibold">${m.address}</p></div>
          <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Passport No.</p><p class="font-semibold uppercase">${m.passportNo}</p></div>
          <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Passport Expiry</p><p class="font-semibold">${m.passportExpiry ? formatDDMmmYYYY(m.passportExpiry) : '-'}</p></div>
          <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Emerg. Contact</p><div class="font-semibold flex items-center gap-1">${m.emergencyName} (${m.emergencyRelation}) - <span class="font-mono">${renderPhoneLink(m.emergencyContact)}</span></div></div>
          <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Dietary Needs</p><p class="font-semibold text-red-600 dark:text-red-400">${m.diet || 'None'}</p></div>
          <div class="md:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Sleeping Arrangement</p><p class="font-semibold text-green-600 dark:text-green-400">${m.sleeping || 'No special request'}</p></div>
          <div class="md:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Other Points to Note</p><p class="font-semibold">${m.otherPoints || 'None'}</p></div>
          ${m.role === 'TRAINEE' ? `<div class="md:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider mb-0.5">Medical Conditions and Medications to take note of</p><p class="font-semibold">${m.medical || 'None'}</p></div>` : ''}

          ${familyHtml}
        </div>
      </div>
      
      <form id="gpm-edit" onsubmit="event.preventDefault(); submitAdminProfileEdit(this.querySelector('button[type=submit]'));" class="hidden-force space-y-3">
        <h4 class="font-black text-sm mb-1 border-b border-gray-100 dark:border-gray-800 pb-1.5 text-gray-900 dark:text-white tracking-tight">Edit Details (Admin)</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Full Name</label><input type="text" id="gpmName" value="${m.fullName}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"></div>
          <div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Short Name</label><input type="text" id="gpmShortName" value="${m.shortName || ''}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"></div>
          <div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Email</label><input type="text" id="gpmEmail" value="${m.email}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"></div>
          <div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Contact</label><input type="text" id="gpmContact" value="${m.contact}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"></div>
          <div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Role</label><select id="gpmRole" onchange="document.getElementById('gpmRelated').closest('.relative').className = this.value === 'CAREGIVER' ? 'block relative' : 'hidden-force relative'; document.getElementById('gpmRelation').parentElement.className = this.value === 'CAREGIVER' ? 'block' : 'hidden-force'; document.getElementById('gpmMedical').parentElement.className = this.value === 'TRAINEE' ? 'md:col-span-2' : 'hidden-force';" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"><option ${m.role==='TRAINEE'?'selected':''}>TRAINEE</option><option ${m.role==='CAREGIVER'?'selected':''}>CAREGIVER</option><option ${m.role==='VOLUNTEER'?'selected':''}>VOLUNTEER</option></select></div>
          <div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Gender</label><select id="gpmGender" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"><option ${m.gender==='Male'?'selected':''}>Male</option><option ${m.gender==='Female'?'selected':''}>Female</option></select></div>
          <div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Project</label><select id="gpmGroup" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white">${groupOpts}</select></div>
          <div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Date of Birth</label><input type="text" id="gpmDob" value="${formatDDMmmYYYY(m.dob)}" readonly onclick="openDatePicker('gpmDob', 'dob')" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-center font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm" placeholder="DD Mmm YYYY"></div>
          <div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Nationality</label><input type="text" id="gpmNat" value="${m.nationality}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"></div>
          <div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Passport No</label><input type="text" id="gpmPass" value="${m.passportNo}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white uppercase"></div>
          <div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Passport Expiry</label><input type="text" id="gpmExp" value="${m.passportExpiry ? formatDDMmmYYYY(m.passportExpiry) : ''}" readonly onclick="openDatePicker('gpmExp', 'exp')" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-center font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm" placeholder="DD Mmm YYYY"></div>
          <div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Dietary</label><input type="text" id="gpmDiet" value="${m.diet}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"></div>
          <div class="md:col-span-2"><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Home Address</label><textarea id="gpmAddress" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" rows="2">${m.address}</textarea></div>
          <div class="md:col-span-2"><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Other Points</label><textarea id="gpmOther" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" rows="2">${m.otherPoints || ''}</textarea></div>
<div class="${m.role === 'TRAINEE' ? 'md:col-span-2' : 'hidden-force'}"><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Medical Conditions</label><textarea id="gpmMedical" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" rows="2">${m.medical || ''}</textarea></div>
          <div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Emerg. Name</label><input type="text" id="gpmEmName" value="${m.emergencyName}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"></div>
          <div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Emerg. Contact</label><input type="text" id="gpmEmContact" value="${m.emergencyContact}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"></div>
          <div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Emerg. Relation</label><input type="text" id="gpmEmRel" value="${m.emergencyRelation}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"></div>
          <div><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Sleeping</label><input type="text" id="gpmSleep" value="${m.sleeping}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"></div>
          <div class="${m.role==='CAREGIVER'?'block':'hidden-force'} relative"><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Related Trainees' Name(s)</label><input type="text" id="gpmRelated" placeholder="Search trainee..." value="${m.relatedTrainee || ''}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
          <div class="${m.role==='CAREGIVER'?'block':'hidden-force'}"><label class="text-xs font-bold mb-0.5 text-gray-500 block uppercase">Relationship to Trainee(s)</label><input type="text" id="gpmRelation" value="${m.relationship || ''}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"></div>
        </div>
        <div class="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button type="button" onclick="document.getElementById('gpm-edit').classList.add('hidden-force'); document.getElementById('gpm-view').classList.remove('hidden-force');" class="px-4 py-2 text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition">Cancel</button>
          <button type="submit" class="px-4 py-2 text-xs font-bold text-white bg-primary rounded-lg hover:bg-green-600 transition shadow-sm flex items-center">
             <span class="btn-text">Save Changes</span>
             <div class="btn-spinner spinner-white hidden-force ml-2 !w-3 !h-3"></div>
          </button>
        </div>
      </form>
    `;
  } catch(e) {
    cont.innerHTML = `<p class="text-xs font-bold text-red-500 text-center py-4">${e.message || 'Failed to load details.'}</p>`;
  }
  
  if (typeof setupTokenInput === 'function') {
      setTimeout(() => {
          if(document.getElementById('gpmRelated')) {
              setupTokenInput('gpmRelated', function(query) {
                  let allP = [];
                  if (typeof adminRosterData !== 'undefined' && adminRosterData.length > 0) {
                      allP = adminRosterData;
                  } else if (typeof loadedFamily !== 'undefined' && loadedFamily.length > 0) {
                      allP = loadedFamily;
                  }
                  const trainees = allP.filter(p => p.role === 'TRAINEE');
                  const results = trainees.filter(t => (t.fullName || '').toLowerCase().includes(query) || (t.shortName || '').toLowerCase().includes(query));
                  return results.map(t => {
                      const formatted = `${t.fullName}${t.shortName ? ' (' + t.shortName + ')' : ''}`;
                      return { label: formatted, value: formatted };
                  });
              });
          }
      }, 50);
  }
}

async function submitAdminProfileEdit(btn) {
  if (!window._currentModalParticipant) return;
  setBtnLoading(btn, true);
  try {
    const p = window._currentModalParticipant;
    const roleVal = document.getElementById('gpmRole').value;
    const relatedVal = document.getElementById('gpmRelated') ? document.getElementById('gpmRelated').value.trim() : '';
    
    if (roleVal === 'CAREGIVER' && relatedVal) {
        let allP = [];
        if (typeof adminRosterData !== 'undefined' && adminRosterData.length > 0) allP = adminRosterData;
        else if (typeof loadedFamily !== 'undefined' && loadedFamily.length > 0) allP = loadedFamily;
        
        const names = relatedVal.split('|').map(x => x.trim()).filter(x => x !== '');
        let allValid = true;
        names.forEach(n => {
            const cleanN = n.replace(/\([^)]*\)/g, '').trim().toLowerCase();
            const match = allP.find(x => x.role === 'TRAINEE' && (x.fullName || '').toLowerCase() === cleanN);
            if(!match) allValid = false;
        });

        if(!allValid) {
            showToast("Related Trainees' Name(s) field must match exactly with an existing Trainees' Full Names.", true);
            setBtnLoading(btn, false);
            return;
        }
    }
    const upd = {
      nric: p.nric,
      fullName: document.getElementById('gpmName').value,
      shortName: document.getElementById('gpmShortName').value,
      email: document.getElementById('gpmEmail').value,
      contact: document.getElementById('gpmContact').value,
      role: document.getElementById('gpmRole').value,
      gender: document.getElementById('gpmGender').value,
      group: document.getElementById('gpmGroup').value,
      dob: document.getElementById('gpmDob').value,
      nationality: document.getElementById('gpmNat').value,
      passportNo: document.getElementById('gpmPass').value.toUpperCase(),
      passportExpiry: document.getElementById('gpmExp').value,
      diet: document.getElementById('gpmDiet').value,
      address: document.getElementById('gpmAddress').value,
      medical: document.getElementById('gpmMedical').value,
      emergencyName: document.getElementById('gpmEmName').value,
      emergencyContact: document.getElementById('gpmEmContact').value,
      emergencyRelation: document.getElementById('gpmEmRel').value,
      sleeping: document.getElementById('gpmSleep').value,
      otherPoints: document.getElementById('gpmOther').value,
      relatedTrainee: document.getElementById('gpmRelated') ? document.getElementById('gpmRelated').value : '',
      relationship: document.getElementById('gpmRelation') ? document.getElementById('gpmRelation').value : ''
    };
    
    const res = await apiCall('adminUpdateParticipant', { member: upd });
    if(res.status === 'success') {
      showToast('Participant updated successfully.');
      closeParticipantSummaryModal();
      if(typeof loadParticipantsData === 'function') loadParticipantsData();
    } else {
      throw new Error(res.message || 'Update failed');
    }
  } catch(e) {
    showToast(e.message, true);
  } finally {
    setBtnLoading(btn, false);
  }
}

async function deleteParticipant(nric) {
  if(!confirm("Are you sure you want to delete this participant? They will be moved to the Archived Participants tab.")) return;
  const btn = document.querySelector('#gpm-view button.text-red-600');
  if (btn) btn.disabled = true;
  
  try {
    const res = await apiCall('deleteParticipant', { nric });
    if(res.status === 'success') {
      showToast('Participant deleted & archived.');
      closeParticipantSummaryModal();
      if(typeof loadParticipantsData === 'function') loadParticipantsData();
    } else {
      throw new Error(res.message || 'Delete failed');
    }
  } catch(e) {
    showToast(e.message, true);
    if (btn) btn.disabled = false;
  }
}

window.closeParticipantSummaryModal = function() {
  const m = document.getElementById('globalParticipantModal');
  if(m) m.classList.add('hidden-force');
  window._currentModalParticipant = null;
}


function applyHydrationDOMUpdates() {
 const tripStr = (appSettings.tripTitle && appSettings.tripYear) ? `${appSettings.tripTitle} ${appSettings.tripYear}` : '';
 const titleEls = ['deskTripName', 'mobTripName', 'unauthTripName'];
 titleEls.forEach(id => {
   const el = document.getElementById(id);
   if(el) {
     if(tripStr) { el.textContent = tripStr; el.classList.remove('hidden-force'); }
     else { el.classList.add('hidden-force'); }
   }
 });
 
 const landingRegBox = document.getElementById('landingRegBox');
 if (landingRegBox) {
     if (appSettings.registrationOpen) landingRegBox.classList.remove('hidden-force');
     else landingRegBox.classList.add('hidden-force');
 }

 renderHeaderLegend();
 renderHeaderHelpline();
 renderLandingHelpline();
}

function renderHeaderHelpline() {
    if (!appSettings || !appSettings.helpline || appSettings.helpline.length === 0) return;
    const headerTitleContainers = document.querySelectorAll('header > div:first-child');
    headerTitleContainers.forEach(container => {
        let existing = container.querySelector('.header-helpline-box');
        if (existing) existing.remove();
        
        let html = `<div class="header-helpline-box mt-1 flex flex-wrap gap-2 items-center">`;
        appSettings.helpline.forEach(h => {
            html += `<div class="flex items-center gap-1.5 text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700"><span>${h.name}</span> ${renderPhoneLink(h.phone)}</div>`;
        });
        html += `</div>`;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function renderLandingHelpline() {
    const landingView = document.getElementById('viewLanding');
    if (!landingView) return;
    
    let existing = document.getElementById('landingHelplineBox');
    if (existing) existing.remove();
    
    if (!appSettings || !appSettings.helpline || appSettings.helpline.length === 0) return;
    
    let html = `<div id="landingHelplineBox" class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 text-center animate-slide-up mt-6">
        <h3 class="text-lg font-bold mb-3 text-gray-900 dark:text-white uppercase tracking-tight">Need Help?</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4 font-semibold">Contact the following people for assistance.</p>
        <div class="flex flex-col gap-3">`;
        
    appSettings.helpline.forEach(h => {
        html += `<div class="w-full flex flex-col items-center justify-center gap-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 py-3 rounded-xl shadow-sm"><span class="font-bold text-sm">${h.name}</span>${renderPhoneLink(h.phone)}</div>`;
    });
    
    html += `</div></div>`;
    landingView.insertAdjacentHTML('beforeend', html);
}

async function silentHydration() {
if (isHydrated) return;

// 1. Instant Cache Hydration (0ms Latency)
const cachedSettings = localStorage.getItem('appSettings');
if (cachedSettings) {
 try {
   appSettings = JSON.parse(cachedSettings);
   applyHydrationDOMUpdates();
   isHydrated = true;
   if(window.initPage) window.initPage();
   
   const viewLoading = document.getElementById('viewLoading');
   if(viewLoading) viewLoading.classList.add('hidden-force');
 } catch(e) {}
}

// 2. Background Network Revalidation (With cold-start retries)
let config = null;
let attempts = 0;

while(attempts < 3 && !config) {
   try {
       config = await apiCall('getSettings');
   } catch(e) {
       attempts++;
       console.warn(`Hydration attempt ${attempts} failed:`, e.message);
       if(attempts < 3) await new Promise(res => setTimeout(res, 1500));
   }
}

try {
   if (config) {
       appSettings = config;
       localStorage.setItem('appSettings', JSON.stringify(appSettings));
       applyHydrationDOMUpdates();

       if (!isHydrated) {
           isHydrated = true;
           if(window.initPage) window.initPage();
       } else if (window.location.pathname.endsWith('settings.html') && typeof buildSettingsUI === 'function') {
           buildSettingsUI();
       }
   } else if (!cachedSettings) {
       // Critical failure on first load without cache
       showToast("Server connection delayed. Please refresh the page.", true);
   }
} catch (e) {
   console.warn("Background hydration processing failed", e);
} finally {
   const viewLoading = document.getElementById('viewLoading');
   if(viewLoading) viewLoading.classList.add('hidden-force');
}
}

function processDisplayNames(participants) {
if(!participants) return;
const nameCounts = {};
participants.forEach(p => {
   p.shortName = (p.shortName || '').trim().toUpperCase();
   p.name = (p.name || '').trim().toUpperCase();
   const sName = p.shortName || p.name;
   nameCounts[sName] = (nameCounts[sName] || 0) + 1;
});
participants.forEach(p => {
   const sName = p.shortName || p.name;
   if (nameCounts[sName] > 1) {
       const roleChar = p.role ? p.role.charAt(0).toUpperCase() : 'U';
       const projAcr = p.group ? getProjectAbbreviation(p.group) : 'N/A';
       p.displayName = `${sName} (${roleChar}) (${projAcr})`;
   } else {
       p.displayName = sName;
   }
});
const displayCounts = {};
participants.forEach(p => { displayCounts[p.displayName] = (displayCounts[p.displayName] || 0) + 1; });
participants.forEach(p => {
   if (displayCounts[p.displayName] > 1) {
       const sName = p.shortName || p.name;
       const roleChar = p.role ? p.role.charAt(0).toUpperCase() : 'U';
       const projAcr = p.group ? getProjectAbbreviation(p.group) : 'N/A';
       const words = p.name.split(' ');
       let extraChar = '';
       if (words.length > 1) {
           const diffWord = words.find(w => w !== sName);
           if(diffWord) extraChar = diffWord.charAt(0) + '.';
           else extraChar = words[1].charAt(0) + '.';
       } else {
           extraChar = p.name.charAt(0) + '.';
       }
       p.displayName = `${sName} ${extraChar} (${roleChar}) (${projAcr})`;
   }
});
const finalCounts = {};
participants.forEach(p => { finalCounts[p.displayName] = (finalCounts[p.displayName] || 0) + 1; });
participants.forEach(p => {
   if (finalCounts[p.displayName] > 1 && p.nric) {
       p.displayName = `${p.displayName} [${p.nric.slice(-4)}]`;
   }
});
}
function toBase64(file) {
   return new Promise((resolve, reject) => {
       const reader = new FileReader();
       reader.readAsDataURL(file);
       reader.onload = () => resolve(reader.result);
       reader.onerror = error => reject(error);
   });
}
async function deleteAdminParticipant(nric) {
    if (!confirm("Are you sure you want to delete this participant? Their details will be moved to a separate sheet.")) return;
    try {
        showToast("Deleting...", false, 10000);
        const res = await apiCall('deleteParticipant', { nric });
        if (res.status === 'success') {
            showToast("Participant deleted successfully.");
            closeParticipantSummaryModal();
            if (typeof fetchRoster === 'function') fetchRoster();
            if (typeof loadRoster === 'function') loadRoster();
        } else {
            showToast("Error: " + res.message, true);
        }
    } catch (e) {
        showToast("Failed to delete.", true);
    }
}


window.handleGpmRelatedSearch = function(fullQuery) {
    const dd = document.getElementById('gpmRelatedDropdown');
    if(!dd) return;
    
    const parts = (fullQuery || '').split('|');
    const query = parts[parts.length - 1].trim().toLowerCase();
    
    let allP = [];
    if (typeof adminRosterData !== 'undefined' && adminRosterData.length > 0) {
        allP = adminRosterData;
    } else if (typeof loadedFamily !== 'undefined' && loadedFamily.length > 0) {
        allP = loadedFamily;
    }
    
    const trainees = allP.filter(p => p.role === 'TRAINEE');
    
    if(!query) { 
        // Show all trainees if just trailing comma
        // Actually it's better to hide if they didn't type yet after comma
    }
    
    const results = trainees.filter(t => (t.fullName || '').toLowerCase().includes(query) || (t.shortName || '').toLowerCase().includes(query));
    
    if(results.length === 0) {
        dd.innerHTML = '<div class="p-2 text-xs text-gray-500 text-center">No trainees found.</div>';
    } else {
        dd.innerHTML = results.map(t => {
            const escName = (t.fullName || '').replace(/'/g, "\\'");
            return '<div class="p-2 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700" onclick="selectGpmRelatedTrainee(\'' + escName + '\')"><div class="font-bold text-xs text-gray-800 dark:text-gray-200">' + t.fullName + '</div><div class="text-xs text-gray-500">' + (t.shortName || '-') + '</div></div>';
        }).join('');
    }
    dd.classList.remove('hidden-force');
};

window.selectGpmRelatedTrainee = function(name) {
    const inp = document.getElementById('gpmRelated');
    if(inp) {
        let parts = inp.value.split('|');
        parts.pop();
        parts.push(name);
        inp.value = parts.join(' | ') + ' | ';
    }
    const dd = document.getElementById('gpmRelatedDropdown');
    if(dd) dd.classList.add('hidden-force');
    setTimeout(() => { if(inp) inp.focus(); }, 10);
};

document.addEventListener('click', function(e) {
    const dd = document.getElementById('gpmRelatedDropdown');
    if(dd && !e.target.closest('#gpmRelated') && !e.target.closest('#gpmRelatedDropdown')) {
        dd.classList.add('hidden-force');
    }
});
