import fs from 'fs';
let uiCode = fs.readFileSync('frontend/js/ui.js', 'utf8');

const regex = /async function updateApp\(btn\).+?\}, 1000\);\}/g;
const newUpdateApp = `async function updateApp(btn) { setBtnLoading(btn, true); showToast("Clearing global database cache & updating app..."); try {   await apiCall('clearCache');   if ('caches' in window) {     const cacheNames = await caches.keys();     await Promise.all(cacheNames.map(name => caches.delete(name)));   }   if ('serviceWorker' in navigator) {     const regs = await navigator.serviceWorker.getRegistrations();     for (let r of regs) await r.unregister();   } } catch(e) { console.error(e); } setTimeout(() => {   const url = new URL(window.location.href);   url.searchParams.set('v', new Date().getTime());   window.location.replace(url.toString()); }, 500);}`;

uiCode = uiCode.replace(regex, newUpdateApp);
fs.writeFileSync('frontend/js/ui.js', uiCode);
