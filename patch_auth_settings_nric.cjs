const fs = require('fs');

let settings = fs.readFileSync('frontend/js/settings.js', 'utf8');
settings = settings.replace(
    'showToast("Invalid NRIC/FIN format.", true)',
    'showToast("Invalid NRIC/FIN.", true)'
);

// We need to implement the auto-disappear for Settings? "across the app... when a valid NRIC is filled in..."
// Actually for settings, it's a Toast notification on button click. Auto-disappear doesn't quite apply to toasts in the same way, but let's check if there is inline validation. No, settings is `if(!isValidNRIC) showToast`. 
// Let's add oninput for newCommNric? If we just show a toast, they can just type and click again. The auto-disappear applies to persistent inline errors (like registration or maybe a new one we create).

fs.writeFileSync('frontend/js/settings.js', settings);

let auth = fs.readFileSync('frontend/js/auth.js', 'utf8');
auth = auth.replace(
    'err.textContent = "Invalid NRIC/FIN format.";',
    'err.textContent = "Invalid NRIC/FIN.";'
);

// Add oninput to clear error in auth.js
// auth.js has id="landingRecNric"
// We can add an event listener if it doesn't have one, or just add inline `oninput`
// Let's modify index.html or where landingRecNric is defined.
