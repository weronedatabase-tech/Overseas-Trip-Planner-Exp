const fs = require('fs');
['medical', 'expired', 'other', 'diet'].forEach(name => {
  const file = `frontend/js/${name}.js`;
  let content = fs.readFileSync(file, 'utf8');
  
  // Find "let XXRosterData = [];" and replace it with "let adminRosterData = window.adminRosterData || [];" if it exists, actually we don't need to.
  // We can just inject at the start of loadData
  
  const targetFnStart = `async function load${name.charAt(0).toUpperCase() + name.slice(1)}Data() {`;
  
  const replacement = `${targetFnStart}
if (window.adminRosterData && window.adminRosterData.length > 0) {
    ${name}RosterData = window.adminRosterData;
    if (typeof applyCaregiverLabels === "function") applyCaregiverLabels(${name}RosterData);
    traineeShortNames = {};
    ${name}RosterData.forEach(p => {
        if(p.role === 'TRAINEE' && p.fullName) {
            traineeShortNames[String(p.fullName || '').trim().toUpperCase()] = String(p.shortName || p.fullName || '').trim().toUpperCase();
        }
    });
    render${name.charAt(0).toUpperCase() + name.slice(1)}Table();
    return;
}`;
  content = content.replace(targetFnStart, replacement);
  
  // Also we must change `medicalRosterData = res.roster || [];` to `medicalRosterData = res.roster || []; window.adminRosterData = medicalRosterData;`
  content = content.replace(`${name}RosterData = res.roster || [];`, `${name}RosterData = res.roster || []; window.adminRosterData = ${name}RosterData;`);
  
  fs.writeFileSync(file, content);
});