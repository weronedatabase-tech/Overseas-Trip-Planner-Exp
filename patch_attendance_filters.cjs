const fs = require('fs');
let code = fs.readFileSync('frontend/js/attendance.js', 'utf8');

const regex = /const asgnSel = document\.getElementById\('attAssignmentSelect'\);[\s\S]*?if\(\!globalLogistics\) \{[\s\S]*?\} catch\(e\) \{\}\n\}/;

const replacement = `// Pre-fetch global logistics if null
if(!globalLogistics) {
    try {
        const res = await apiCall('fetchLogistics'); 
        globalLogistics = res;
        if (typeof processDisplayNames === "function") processDisplayNames(globalLogistics.participants);
        if (typeof applyGlobalSorting === "function") globalLogistics.participants = applyGlobalSorting(globalLogistics.participants);
    } catch(e) {}
}

const asgnSel = document.getElementById('attAssignmentSelect');
asgnSel.innerHTML = \`<option value="ALL">All Participants</option>\`;

// Populate Projects
if(appSettings.activeProjects && appSettings.activeProjects.length > 0) {
    const projGroup = document.createElement('optgroup');
    projGroup.label = 'Projects';
    appSettings.activeProjects.forEach(g => {
        projGroup.innerHTML += \`<option value="PROJ::\${g}">\${g}</option>\`;
    });
    asgnSel.appendChild(projGroup);
}

// Populate Logistics Groups and Buses
if (globalLogistics && globalLogistics.participants) {
    const groups = new Set();
    const buses = new Set();
    globalLogistics.participants.forEach(p => {
        if (p.logisticsGroup && p.logisticsGroup.trim()) groups.add(p.logisticsGroup.trim());
        if (p.bus && p.bus.trim()) buses.add(p.bus.trim());
    });
    
    if (groups.size > 0) {
        const grpGroup = document.createElement('optgroup');
        grpGroup.label = 'Groups';
        Array.from(groups).sort().forEach(g => {
            grpGroup.innerHTML += \`<option value="GRP::\${g}">\${g}</option>\`;
        });
        asgnSel.appendChild(grpGroup);
    }
    
    if (buses.size > 0) {
        const busGroup = document.createElement('optgroup');
        busGroup.label = 'Buses';
        Array.from(buses).sort().forEach(b => {
            busGroup.innerHTML += \`<option value="BUS::\${b}">\${b}</option>\`;
        });
        asgnSel.appendChild(busGroup);
    }
}

if(savedAttAssignment) {
    // Need to handle legacy savedAttAssignment (without prefix)
    let finalValue = savedAttAssignment;
    if (savedAttAssignment !== 'ALL' && !savedAttAssignment.includes('::')) {
        finalValue = 'PROJ::' + savedAttAssignment;
    }
    
    // Check if the option exists
    if (asgnSel.querySelector(\`option[value="\${finalValue}"]\`)) {
        asgnSel.value = finalValue;
    }
}`;

code = code.replace(regex, replacement);
fs.writeFileSync('frontend/js/attendance.js', code);
