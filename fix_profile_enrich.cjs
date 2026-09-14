const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const oldSort = `// Sort loadedGroupMembers using special sort logic if available
if (window.sortParticipantsSpecial) {
    window.sortParticipantsSpecial(loadedGroupMembers, globalLogistics && globalLogistics.participants ? globalLogistics.participants : loadedGroupMembers);
}`;

const newSort = `// Enrich loadedGroupMembers with data from globalLogistics to ensure accurate sorting
if (globalLogistics && globalLogistics.participants) {
    loadedGroupMembers.forEach(member => {
        const fullProfile = globalLogistics.participants.find(p => p.nric === member.nric);
        if (fullProfile) {
            if (!member.pocNric && fullProfile.pocNric) member.pocNric = fullProfile.pocNric;
            if (!member.group && fullProfile.group) member.group = fullProfile.group;
        }
    });
}

// Sort loadedGroupMembers using special sort logic if available
if (window.sortParticipantsSpecial) {
    window.sortParticipantsSpecial(loadedGroupMembers, globalLogistics && globalLogistics.participants ? globalLogistics.participants : loadedGroupMembers);
}`;

code = code.replace(oldSort, newSort);

// Do the same for attendance logic
const oldAttSort = `    // Sort logic
    let sortedMembers = [...loadedGroupMembers];
    if (window.sortParticipantsSpecial) {
        window.sortParticipantsSpecial(sortedMembers, globalLogistics && globalLogistics.participants ? globalLogistics.participants : sortedMembers);
    } else {
        sortedMembers.sort((a,b) => String(a.fullName).localeCompare(String(b.fullName)));
    }`;

const newAttSort = `    // Sort logic
    let sortedMembers = [...loadedGroupMembers];
    if (globalLogistics && globalLogistics.participants) {
        sortedMembers.forEach(member => {
            const fullProfile = globalLogistics.participants.find(p => p.nric === member.nric);
            if (fullProfile) {
                if (!member.pocNric && fullProfile.pocNric) member.pocNric = fullProfile.pocNric;
                if (!member.group && fullProfile.group) member.group = fullProfile.group;
            }
        });
    }
    if (window.sortParticipantsSpecial) {
        window.sortParticipantsSpecial(sortedMembers, globalLogistics && globalLogistics.participants ? globalLogistics.participants : sortedMembers);
    } else {
        sortedMembers.sort((a,b) => String(a.fullName).localeCompare(String(b.fullName)));
    }`;

code = code.replace(oldAttSort, newAttSort);

fs.writeFileSync('frontend/js/profile.js', code);
