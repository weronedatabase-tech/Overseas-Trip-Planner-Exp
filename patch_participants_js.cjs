const fs = require('fs');
let code = fs.readFileSync('frontend/js/participants.js', 'utf8');

const target = `   adminRosterData.forEach(p => {
       p.room = roomsMap[p.nric] || 'UNASSIGNED';
       let myPairings = pairingsMap[p.nric] ? [...pairingsMap[p.nric]] : [];
       if (p.role === 'CAREGIVER' && p.relatedTrainee) {
           const rNames = p.relatedTrainee.split('|').map(n => n.trim().toLowerCase());
           const relatedList = adminRosterData.filter(x => rNames.includes((x.fullName||'').toLowerCase()) && x.role === 'TRAINEE');
           relatedList.forEach(related => {
               if (related && pairingsMap[related.nric]) {
                   myPairings.push(...pairingsMap[related.nric]);
               }
           });
       }
       p.pairings = myPairings.length > 0 ? Array.from(new Set(myPairings)).join(', ') : 'NONE';
   });`;

const replacement = `   adminRosterData.forEach(p => {
       p.room = roomsMap[p.nric] || 'UNASSIGNED';
       let myPairings = pairingsMap[p.nric] ? [...pairingsMap[p.nric]] : [];
       if (p.role === 'CAREGIVER') {
           const myPoc = p.pocNric || p.nric;
           const myTrainees = adminRosterData.filter(x => x.role === 'TRAINEE' && (x.pocNric || x.nric) === myPoc);
           myTrainees.forEach(t => {
               if (t && pairingsMap[t.nric]) {
                   myPairings.push(...pairingsMap[t.nric]);
               }
           });
       } else if (p.role === 'VOLUNTEER') {
           // For volunteer, myPairings already only contains Trainees based on the pairingsMap[pair.volNric] pushing t.shortName. We ensure caregivers are NOT pushed.
           // Since pairingsMap[pair.volNric] only pushes the trainee involved in the pair, it's correct.
       }
       p.pairings = myPairings.length > 0 ? Array.from(new Set(myPairings)).join(', ') : 'NONE';
   });`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    console.log("Successfully replaced target in participants.js");
} else {
    console.log("Target not found in participants.js");
}

fs.writeFileSync('frontend/js/participants.js', code);
