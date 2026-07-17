function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.className = `fixed top-12 left-1/2 transform -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-2xl z-[100] transition-opacity duration-300 text-sm font-bold border ${isError ? 'bg-red-600 text-white border-red-700' : 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-700 dark:border-gray-200'}`;
  t.classList.remove('opacity-0');
  setTimeout(() => t.classList.add('opacity-0'), 4000);
}

function setBtnLoading(btn, isLoading) {
  if (!btn) return;
  const spinner = btn.querySelector('.btn-spinner');
  const icon = btn.querySelector('.btn-icon');
  const text = btn.querySelector('.btn-text');

  if (isLoading) {
    btn.disabled = true; btn.classList.add('opacity-80', 'cursor-not-allowed');
    if (spinner) spinner.classList.remove('hidden-force');
    if (icon) icon.classList.add('opacity-0');
    if (text) text.classList.add('opacity-0');
  } else {
    btn.disabled = false; btn.classList.remove('opacity-80', 'cursor-not-allowed');
    if (spinner) spinner.classList.add('hidden-force');
    if (icon) icon.classList.remove('opacity-0');
    if (text) text.classList.remove('opacity-0');
  }
}

function toggleTheme() {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}

const projectColorPalette =[
  'bg-slate-100 border-slate-400 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-100',
  'bg-gray-100 border-gray-400 text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-slate-100',
  'bg-zinc-100 border-zinc-400 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-600 dark:text-zinc-100',
  'bg-neutral-100 border-neutral-400 text-neutral-900 dark:bg-neutral-900 dark:border-neutral-600 dark:text-neutral-100',
  'bg-stone-100 border-stone-400 text-stone-900 dark:bg-stone-900 dark:border-stone-600 dark:text-stone-100',
  'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-900 dark:border-amber-600 dark:text-amber-100',
  'bg-yellow-100 border-yellow-400 text-yellow-900 dark:bg-yellow-900 dark:border-yellow-600 dark:text-yellow-100',
  'bg-lime-100 border-lime-400 text-lime-900 dark:bg-lime-900 dark:border-lime-600 dark:text-lime-100',
  'bg-green-100 border-green-400 text-green-900 dark:bg-green-900 dark:border-green-600 dark:text-green-100',
  'bg-emerald-100 border-emerald-400 text-emerald-900 dark:bg-emerald-900 dark:border-emerald-600 dark:text-emerald-100',
  'bg-teal-100 border-teal-400 text-teal-900 dark:bg-teal-900 dark:border-teal-600 dark:text-teal-100',
  'bg-cyan-100 border-cyan-400 text-cyan-900 dark:bg-cyan-900 dark:border-cyan-600 dark:text-cyan-100',
  'bg-sky-100 border-sky-400 text-sky-900 dark:bg-sky-900 dark:border-sky-600 dark:text-sky-100',
  'bg-blue-100 border-blue-400 text-blue-900 dark:bg-blue-900 dark:border-blue-600 dark:text-blue-100',
  'bg-indigo-100 border-indigo-400 text-indigo-900 dark:bg-indigo-900 dark:border-indigo-600 dark:text-indigo-100',
  'bg-violet-100 border-violet-400 text-violet-900 dark:bg-violet-900 dark:border-violet-600 dark:text-violet-100',
  'bg-purple-100 border-purple-400 text-purple-900 dark:bg-purple-900 dark:border-purple-600 dark:text-purple-100',
  'bg-fuchsia-100 border-fuchsia-400 text-fuchsia-900 dark:bg-fuchsia-900 dark:border-fuchsia-600 dark:text-fuchsia-100'
];

function getProjectColor(groupName) {
  if (!groupName || groupName === 'None') return 'bg-gray-100 border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100';
  if (appSettings && appSettings.projectColors && appSettings.projectColors[groupName]) return appSettings.projectColors[groupName];
  return 'bg-gray-100 border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100';
}

function getProjectAbbreviation(name) {
  const match = name.match(/\((.*?)\)/); if (match && match[1]) return match[1].substring(0,3).toUpperCase();
  const words = name.split(' ').filter(w => w.length > 0);
  if (words.length > 1) return words.slice(0,3).map(w => w[0]).join('').toUpperCase();
  return name.substring(0,3).toUpperCase();
}

function renderHeaderLegend() {
  const deskCont = document.getElementById('headerLegend');
  const mobCont = document.getElementById('mobHeaderLegend');
  if (!appSettings || !appSettings.activeProjects || appSettings.activeProjects.length === 0) {
    if(deskCont) deskCont.innerHTML = '';
    if(mobCont) mobCont.innerHTML = '';
    return;
  }
  let html = '';
  appSettings.activeProjects.forEach(proj => {
    if(!proj) return;
    const colorCls = getProjectColor(proj); const shortName = getProjectAbbreviation(proj);
    html += `<span class="px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold border shadow-sm cursor-help ${colorCls}" title="${proj}">${shortName}</span>`;
  });
  if(deskCont) deskCont.innerHTML = html;
  if(mobCont) mobCont.innerHTML = html;
}

function applyGlobalSorting(participants) {
  if(!appSettings) return participants;
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

function processDisplayNames(participants) {
  if(!participants) return;
  const nameCounts = {};
  participants.forEach(p => {
      p.shortName = p.shortName ? p.shortName.trim() : '';
      p.name = p.name ? p.name.trim() : '';
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
              const diffWord = words.find(w => w.toLowerCase() !== sName.toLowerCase());
              if(diffWord) extraChar = diffWord.charAt(0).toUpperCase() + '.';
              else extraChar = words[1].charAt(0).toUpperCase() + '.';
          } else {
              extraChar = p.name.charAt(0).toUpperCase() + '.';
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

async function updateApp(btn) {
  setBtnLoading(btn, true);
  showToast("Updating app data and clearing caches...");
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (let r of regs) await r.unregister();
    }
  } catch(e) { console.error(e); }
  setTimeout(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('v', new Date().getTime());
    window.location.replace(url.toString());
  }, 1000);
}

function handleEnter(e, func) { if(e.key === 'Enter') func(); }

window.formatMoneyInput = function(input, isBlur) {
  let cursorStart = input.selectionStart;
  let oldLen = input.value.length;
  
  let val = input.value.replace(/[^0-9.]/g, '');
  if(val === '') {
      input.value = '';
      return;
  }
  
  let parts = val.split('.');
  if(parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
  
  if (isBlur) {
      let number = parseFloat(val);
      if(!isNaN(number)) {
          input.value = number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
          input.value = '0.00';
      }
  } else {
      parts = val.split('.');
      let whole = parts[0] ? parseFloat(parts[0]).toLocaleString('en-US') : '0';
      
      if(parts.length > 1) {
          input.value = whole + '.' + parts[1].substring(0, 2);
      } else {
          input.value = whole;
      }
      
      let newLen = input.value.length;
      let diff = newLen - oldLen;
      let newCursor = cursorStart + diff;
      try { input.setSelectionRange(newCursor, newCursor); } catch(e){}
  }
};