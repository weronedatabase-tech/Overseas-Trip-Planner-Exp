document.addEventListener("DOMContentLoaded", () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn(err));
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
      devModeBar.className = 'w-full bg-red-600 text-white text-center py-0.5 text-[10px] font-bold tracking-widest uppercase shrink-0 z-50';
      devModeBar.classList.remove('hidden-force');
    } else if (ENV === 'Exp') {
      devModeBar.textContent = 'Experimentation';
      devModeBar.className = 'w-full bg-purple-600 text-white text-center py-0.5 text-[10px] font-bold tracking-widest uppercase shrink-0 z-50';
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

  silentHydration();
});

async function silentHydration() {
  if (isHydrated) return;
  try {
    const config = await apiCall('getSettings');
    appSettings = config;
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
    
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
    isHydrated = true;

    // Custom initializations based on active page
    if(window.initPage) window.initPage();
  } catch (e) {
    console.warn("Hydration failed silently", e);
    const cachedSettings = localStorage.getItem('appSettings');
    if (cachedSettings) appSettings = JSON.parse(cachedSettings);
  } finally {
    const viewLoading = document.getElementById('viewLoading');
    if(viewLoading) viewLoading.classList.add('hidden-force');
  }
}