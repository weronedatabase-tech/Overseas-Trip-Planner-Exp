function loadSettings() { 
const loader = document.getElementById('settingsLoader'); 
const content = document.getElementById('settingsContent'); 
loader.classList.remove('hidden'); 
content.classList.add('hidden'); 

apiCall('getAppSettings', null).then(savedSettings => { 
    if (!savedSettings || savedSettings.success === false) savedSettings = {};
    
    window.appSettings = savedSettings;
    
    apiCall('getTemplateHeaders', null).then(res => { 
        document.getElementById('settingsLoader').classList.add('hidden'); 
        document.getElementById('settingsContent').classList.remove('hidden'); 
        if(res.success) { 
            renderSettingsCheckboxes(res.tHeaders, res.vHeaders, savedSettings); 
        } else { 
            alert("Error loading template headers: " + res.message); 
        } 
    }); 
}); 
}

function renderSettingsCheckboxes(tHeaders, vHeaders, saved) { 
const tContainer = document.getElementById('traineeColsContainer'); 
const vContainer = document.getElementById('volColsContainer'); 
tContainer.innerHTML = ''; 
vContainer.innerHTML = ''; 
tHeaders.forEach(h => { 
    let checked = (saved.traineeCols && saved.traineeCols.includes(h) || (!saved.traineeCols || saved.traineeCols.length === 0)) ? 'checked' : ''; 
    tContainer.innerHTML += `<label class="flex items-center gap-2"><input type="checkbox" class="t-col-check accent-purple-600 dark:accent-purple-500 w-4 h-4 cursor-pointer" value="${h}" ${checked}> <span class="text-gray-700 dark:text-gray-300 font-medium">${h}</span></label>`; 
}); 
vHeaders.forEach(h => { 
    let checked = (saved.volCols && saved.volCols.includes(h) || (!saved.volCols || saved.volCols.length === 0)) ? 'checked' : ''; 
    vContainer.innerHTML += `<label class="flex items-center gap-2"><input type="checkbox" class="v-col-check accent-purple-600 dark:accent-purple-500 w-4 h-4 cursor-pointer" value="${h}" ${checked}> <span class="text-gray-700 dark:text-gray-300 font-medium">${h}</span></label>`; 
}); 
}

function saveSettings() { 
const tCols = Array.from(document.querySelectorAll('.t-col-check:checked')).map(cb => cb.value); 
const vCols = Array.from(document.querySelectorAll('.v-col-check:checked')).map(cb => cb.value); 

const settings = { 
    traineeCols: tCols, 
    volCols: vCols
}; 

window.appSettings = settings;

showFlashMessage('settingsStatus', "Saving...", 'success'); 
apiCall('saveAppSettings', settings).then(res => { 
    showFlashMessage('settingsStatus', res.message, 'success'); 
}); 
}

function changeAdminPassword() {
const currentPwd = document.getElementById('settingsCurrentPwd').value;
const newPwd = document.getElementById('settingsNewPwd').value;
const btn = document.getElementById('changePwdBtn');

if (!currentPwd || !newPwd) {
    showFlashMessage('settingsStatus', "Please fill in both password fields.", 'error');
    return;
}

btn.disabled = true;
btn.innerText = "Updating...";

apiCall('changeAdminPassword', { currentPassword: currentPwd, newPassword: newPwd }).then(res => {
    btn.disabled = false;
    btn.innerText = "Change Password";
    
    if (res.success) {
        document.getElementById('settingsCurrentPwd').value = "";
        document.getElementById('settingsNewPwd').value = "";
        // Update local storage so the session continues uninterrupted
        localStorage.setItem('adminKey', newPwd);
        showFlashMessage('settingsStatus', "Password updated successfully!", 'success');
    } else {
        showFlashMessage('settingsStatus', res.message, 'error');
    }
});
}