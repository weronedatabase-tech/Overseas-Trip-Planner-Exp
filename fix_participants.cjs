const fs = require('fs');
let content = fs.readFileSync('frontend/js/participants.js', 'utf8');
content = content.replace(
  'adminRosterData = rostRes.roster || []; applyCaregiverLabels(adminRosterData);',
  'adminRosterData = rostRes.roster || []; applyCaregiverLabels(adminRosterData); window.adminRosterData = adminRosterData;'
);
fs.writeFileSync('frontend/js/participants.js', content);