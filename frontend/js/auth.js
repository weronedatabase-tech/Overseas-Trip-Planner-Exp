function requestAccess(urlPath, actionFn = null) { 
   if (isAdminAuthenticated) { 
       executeAccess(urlPath, actionFn);
   } else { 
       const savedKey = localStorage.getItem('adminKey');
       if (savedKey) {
           showOverlay('loading', 'Verifying session...');
           apiCall('verifyAdminPassword', savedKey).then(isValid => {
               closeOverlay();
               if (isValid) {
                   isAdminAuthenticated = true;
                   executeAccess(urlPath, actionFn);
               } else {
                   localStorage.removeItem('adminKey');
                   promptAuthModal(urlPath, actionFn);
               }
           });
       } else {
           promptAuthModal(urlPath, actionFn);
       }
   } 
}

function executeAccess(urlPath, actionFn) {
   if (actionFn) {
       actionFn();
   } else if (urlPath) {
       window.navigateTo(urlPath);
   }
}

function promptAuthModal(urlPath, actionFn) {
   pendingView = urlPath; 
   pendingAction = actionFn;
   document.getElementById('authModal').classList.remove('hidden'); 
   document.getElementById('adminPassword').value = ""; 
   document.getElementById('authError').classList.add('hidden'); 
   document.getElementById('adminPassword').focus(); 
}

function closeAuthModal(isCancel = true) { 
   document.getElementById('authModal').classList.add('hidden'); 
   
   if (isCancel && !isAdminAuthenticated) {
       const protectedPages = ['admin.html', 'settings.html', 'grouping.html', 'pairing.html'];
       const currentPath = window.location.pathname.toLowerCase();
       const isProtected = protectedPages.some(page => currentPath.includes(page));
       
       if (isProtected) {
           if (typeof window.navigateTo === 'function') {
               window.navigateTo('./');
           } else {
               window.location.href = './';
           }
       }
   }
   
   pendingView = ""; 
   pendingAction = null;
}

function handleAuth(e) { 
   e.preventDefault(); 
   const pwd = document.getElementById('adminPassword').value; 
   const btn = document.getElementById('authBtn'); 
   btn.disabled = true; 
   btn.innerText = "Checking..."; 
   
   apiCall('verifyAdminPassword', pwd).then(isValid => { 
       btn.disabled = false; 
       btn.innerText = "Access"; 
       if (isValid) { 
           isAdminAuthenticated = true; 
           localStorage.setItem('adminKey', pwd); 
           const target = pendingView; 
           const action = pendingAction;
           closeAuthModal(false); 
           executeAccess(target, action);
       } else { 
           document.getElementById('authError').classList.remove('hidden'); 
           document.getElementById('adminPassword').value = ""; 
       } 
   }); 
}