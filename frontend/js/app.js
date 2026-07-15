let currentUser = null; 
let appSettings = { registrationOpen: false, allowEdits: false, committee:[], projectGroups:[], projectColors:{}, activeProjects:[], junctures:[], sortingRules:[], tripTitle:'', tripYear:'' };

let globalLogistics = null; 
let currentPairingTarget = null; 
let pendingColorGroupTarget = null;
let newProjectSelectedColor = null;

window.onload = async () => {
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

const devModeBar = document.getElementById('devModeBar');
if (ENV === 'Dev') {
   devModeBar.textContent = 'Testing';
   devModeBar.className = 'w-full bg-red-600 text-white text-center py-0.5 text-[10px] font-bold tracking-widest uppercase shrink-0 z-50';
} else if (ENV === 'Exp') {
   devModeBar.textContent = 'Experimentation';
   devModeBar.className = 'w-full bg-purple-600 text-white text-center py-0.5 text-[10px] font-bold tracking-widest uppercase shrink-0 z-50';
} else {
   devModeBar.classList.add('hidden-force');
}

if(localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark');

const savedSession = localStorage.getItem('userSession');
if(savedSession) currentUser = JSON.parse(savedSession);

injectGlobalModals(); 
await fetchConfig();
if(currentUser) renderDashboard(); else goHome();
};

async function callBackend(action, payload = {}) {
try {
const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, ...payload }), headers: { 'Content-Type': 'text/plain;charset=utf-8' }});
if(!res.ok) throw new Error("Network error."); 
const data = await res.json();
if(data.status === 'error') throw new Error(data.message); 
return data;
} catch (err) {
if(err.message.includes('Failed to fetch')) { showToast("Auth required.", true); setTimeout(() => window.open(API_URL, '_blank'), 2000); }
else { throw err; }
}
}

async function fetchConfig() {
try {
const config = await callBackend('getSettings'); appSettings = config;
const regBox = document.getElementById('landingRegBox');
if(appSettings.registrationOpen) regBox.classList.remove('hidden-force'); else regBox.classList.add('hidden-force');

const tripStr = (appSettings.tripTitle && appSettings.tripYear) ? `${appSettings.tripTitle} ${appSettings.tripYear}` : '';
const titleEls = ['deskTripName', 'mobTripName', 'unauthTripName'];
titleEls.forEach(id => {
   const el = document.getElementById(id);
   if(el) {
       if(tripStr) { el.textContent = tripStr; el.classList.remove('hidden-force'); } 
       else { el.classList.add('hidden-force'); }
   }
});

renderHeaderLegend();
if(currentUser && currentUser.role === 'admin') applyAdminVisuals(); 
} catch (e) { showToast("Error syncing settings.", true); } finally { document.getElementById('viewLoading').classList.add('hidden-force'); }
}

async function updateApp(btn) {
setBtnLoading(btn, true); 
showToast("Updating app data and clearing caches...");

try {
    // 1. Clear Service Worker Caches
    if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    // 2. Unregister Service Workers
    if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (let r of regs) {
            await r.unregister();
        }
    }
} catch(e) {
    console.error("Cache clearing error:", e);
}

// 3. Force a hard reload by appending a cache-busting timestamp
setTimeout(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('v', new Date().getTime());
    window.location.replace(url.toString());
}, 1000);
}

// Global Sorting Logic (Applies to all lists across the App)
function applyGlobalSorting(participants) {
const rules = appSettings.sortingRules || ['project', 'family', 'role', 'name'];
const familyCounts = {};
participants.forEach(p => { familyCounts[p.poc] = (familyCounts[p.poc] || 0) + 1; });

return participants.sort((a, b) => {
  for (let rule of rules) {
      if (rule === 'none') continue;
      if (rule === 'project') {
          const aG = a.group || 'ZZZ';
          const bG = b.group || 'ZZZ';
          const cmp = aG.localeCompare(bG);
          if (cmp !== 0) return cmp;
      }
      if (rule === 'family') {
          const aFam = familyCounts[a.poc] > 1 ? 1 : 0;
          const bFam = familyCounts[b.poc] > 1 ? 1 : 0;
          if (aFam !== bFam) return bFam - aFam; 
      }
      if (rule === 'role') {
          const rW = { 'CAREGIVER': 1, 'TRAINEE': 2, 'VOLUNTEER': 3 };
          const aR = rW[a.role] || 9;
          const bR = rW[b.role] || 9;
          if (aR !== bR) return aR - bR;
      }
      if (rule === 'name') {
          const cmp = (a.displayName || a.name || '').localeCompare(b.displayName || b.name || '');
          if (cmp !== 0) return cmp;
      }
  }
  return 0;
});
}

// Global function to resolve Short Name conflicts dynamically
function processDisplayNames(participants) {
  if(!participants) return;
  const nameCounts = {};
  
  // First pass: Count occurrences of short names
  participants.forEach(p => {
      p.shortName = p.shortName ? p.shortName.trim() : '';
      p.name = p.name ? p.name.trim() : '';
      const sName = p.shortName || p.name; 
      nameCounts[sName] = (nameCounts[sName] || 0) + 1;
  });

  // Second pass: Apply primary disambiguation if duplicated
  participants.forEach(p => {
      const sName = p.shortName || p.name;
      if (nameCounts[sName] > 1) {
          const roleChar = p.role ? p.role.charAt(0).toUpperCase() : 'U';
          const projAcr = p.group ? (typeof getProjectAbbreviation === 'function' ? getProjectAbbreviation(p.group) : p.group.substring(0,3)) : 'N/A';
          p.displayName = `${sName} (${roleChar}) (${projAcr})`;
      } else {
          p.displayName = sName;
      }
  });

  // Third pass: Check if the primary disambiguation STILL causes a clash
  const displayCounts = {};
  participants.forEach(p => { displayCounts[p.displayName] = (displayCounts[p.displayName] || 0) + 1; });

  participants.forEach(p => {
      if (displayCounts[p.displayName] > 1) {
          const sName = p.shortName || p.name;
          const roleChar = p.role ? p.role.charAt(0).toUpperCase() : 'U';
          const projAcr = p.group ? (typeof getProjectAbbreviation === 'function' ? getProjectAbbreviation(p.group) : p.group.substring(0,3)) : 'N/A';
          
          const words = p.name.split(' ');
          let extraChar = '';
          if (words.length > 1) {
              // Try to find a word that is not the exact short name
              const diffWord = words.find(w => w.toLowerCase() !== sName.toLowerCase());
              if(diffWord) extraChar = diffWord.charAt(0).toUpperCase() + '.';
              else extraChar = words[1].charAt(0).toUpperCase() + '.';
          } else {
              extraChar = p.name.charAt(0).toUpperCase() + '.';
          }
          p.displayName = `${sName} ${extraChar} (${roleChar}) (${projAcr})`;
      }
  });

  // Final safety pass: If somehow even the full name initial matches, append NRIC last 4
  const finalCounts = {};
  participants.forEach(p => { finalCounts[p.displayName] = (finalCounts[p.displayName] || 0) + 1; });
  participants.forEach(p => {
      if (finalCounts[p.displayName] > 1 && p.nric) {
          p.displayName = `${p.displayName} [${p.nric.slice(-4)}]`;
      }
  });
}