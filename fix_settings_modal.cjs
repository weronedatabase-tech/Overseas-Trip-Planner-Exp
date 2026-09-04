const fs = require('fs');
let content = fs.readFileSync('frontend/js/settings.js', 'utf8');

const target = `async function confirmTripSetup(btn) { 
  document.getElementById('tripSetupModal').classList.add('hidden-force'); 
  await executeToggleRegistration(`;

const replacement = `async function confirmTripSetup(btn) {
  const start = document.getElementById('tripStartInput').value;
  const end = document.getElementById('tripEndInput').value;
  if (!start || !end) {
      showToast('Please select both start and end dates.', true);
      return;
  }
  document.getElementById('tripSetupModal').classList.add('hidden-force'); 
  await executeToggleRegistration(`;

content = content.replace(target, replacement);

fs.writeFileSync('frontend/js/settings.js', content);
