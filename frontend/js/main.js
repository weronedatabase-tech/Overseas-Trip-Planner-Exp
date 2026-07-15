document.addEventListener("DOMContentLoaded", () => {
  if(localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
  } else {
      document.documentElement.classList.remove('dark');
  }

  const envBar = document.getElementById('envBar');
  if (envBar) {
      if (ENV === 'Dev') {
          envBar.innerText = 'Testing';
          envBar.classList.add('bg-red-600', 'border-red-800');
          envBar.classList.remove('hidden');
      } else if (ENV === 'Exp') {
          envBar.innerText = 'Experimentation';
          envBar.classList.add('bg-purple-600', 'border-purple-800');
          envBar.classList.remove('hidden');
      }
  }

  console.log(`Running in ${ENV} mode connected to: ${API_URL}`);

  apiCall('getAppSettings', null).then(res => {
      if (res && res.success !== false) {
          appSettings = res;
      }
  });

  const savedKey = localStorage.getItem('adminKey');
  if (savedKey) {
      apiCall('verifyAdminPassword', savedKey).then(isValid => {
          if (isValid) {
              isAdminAuthenticated = true;
          } else {
              localStorage.removeItem('adminKey');
              isAdminAuthenticated = false;
          }
      });
  }

  silentHydration();
});

function silentHydration() {
  if (isHydrated) return;
  
  apiCall('getRecentOutingSheets', null).then(res => {
      if (res && res.success && res.data && res.data.length > 0) {
          currentSheetList = res.data;
          localStorage.setItem('myg_sheetList', JSON.stringify(res.data)); // Core MPA Pre-cache
          isHydrated = true;
      }
  }).catch(e => console.warn("Hydration failed silently", e));
}

// Global utility to find the most immediate upcoming event
window.getClosestEventUrl = function(data) {
  if(!data || data.length === 0) return null;
  if(data.length === 1) return data[0].sheetUrl;
  
  const today = new Date();
  const tY = today.getFullYear();
  const tM = String(today.getMonth() + 1).padStart(2, '0');
  const tD = String(today.getDate()).padStart(2, '0');
  const todayNum = parseInt(`${tY}${tM}${tD}`);
  
  // The backend data array is now sorted ascending by folderDateNum (earliest to latest)
  let closestFuture = null;
  for(let i = 0; i < data.length; i++) {
      if(data[i].folderDateNum >= todayNum) {
          closestFuture = data[i];
          break;
      }
  }
  
  if(closestFuture) return closestFuture.sheetUrl;
  
  // If no future events exist, return the most recent past event (which is the last item)
  return data[data.length - 1].sheetUrl;
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
          console.log('Service Worker Registered successfully');
      }).catch(err => {
          console.warn('Service Worker registration failed:', err);
      });
  });
}