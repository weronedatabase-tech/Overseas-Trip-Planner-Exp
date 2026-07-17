async function attemptLogin(btn) {
  const nric = document.getElementById('loginNric').value.trim().toUpperCase();
  const pass = document.getElementById('loginPass').value;
  const err = document.getElementById('loginError');
  
  if(!nric || !pass) { 
      err.textContent = "Please enter NRIC and Password"; 
      return err.classList.remove('hidden-force'); 
  }
  
  err.classList.add('hidden-force'); 
  setBtnLoading(btn, true);
  
  try {
    const res = await apiCall('login', { nric, password: pass });
    currentUser = { nric: nric, role: res.role, name: res.name };
    localStorage.setItem('userSession', JSON.stringify(currentUser));
    window.location.href = 'dashboard.html';
  } catch (error) {
    err.textContent = error.message; 
    err.classList.remove('hidden-force');
  } finally {
    setBtnLoading(btn, false);
  }
}

function logout(btn) {
  if(btn) setBtnLoading(btn, true);
  localStorage.removeItem('userSession');
  currentUser = null;
  window.location.href = 'index.html';
}

function togglePassword(id) {
  const el = document.getElementById(id);
  const eyeOpen = document.getElementById('eyeOpen');
  const eyeClosed = document.getElementById('eyeClosed');
  if(el.type === 'password') {
    el.type = 'text'; 
    eyeOpen.classList.add('hidden-force'); 
    eyeClosed.classList.remove('hidden-force');
  } else {
    el.type = 'password'; 
    eyeOpen.classList.remove('hidden-force'); 
    eyeClosed.classList.add('hidden-force');
  }
}