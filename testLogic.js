const results = [
  { nric: 'S6666666S', role: 'CAREGIVER', fullName: 'TIGER', relatedTrainee: 'GSJAHD | ADFASFASD' },
  { nric: 'S1111111S', role: 'TRAINEE', fullName: 'GSJAHD' },
  { nric: 'S2222222S', role: 'TRAINEE', fullName: 'ADFASFASD' }
];

results.forEach(r => {
    r.pocNric = r.nric; // default
});
results.forEach(r => {
      if (r.role === 'CAREGIVER' && r.relatedTrainee) {
          const desiredNames = r.relatedTrainee.split(/[\|,]/).map(n => n.replace(/\s+/g, '').toLowerCase()).filter(n => n);
          results.forEach(j => {
              if (j.role === 'TRAINEE') {
                  const jName = (j.fullName || '').replace(/\s+/g, '').toLowerCase();
                  const jShort = (j.shortName || '').replace(/\s+/g, '').toLowerCase();
                  const isDesired = desiredNames.some(d => d.includes(jName) || jName.includes(d) || (jShort && d.includes(jShort)));
                  if (isDesired) {
                      j.pocNric = r.nric;
                      r.pocNric = r.nric;
                  }
              }
          });
      }
});

results.forEach(r => {
      if (r.role === 'CAREGIVER') {
          const dependents = results.filter(x => x.role === 'TRAINEE' && x.pocNric === r.pocNric);
          r.relatedTrainee = dependents.map(d => `${d.fullName}${d.shortName ? ' (' + d.shortName + ')' : ''}`).join(' | ');
      }
});

console.log("Results after healing:", results);

function getProfile(nric) {
  const data = results;
  const currentUserRecord = data.find(r => r.nric === nric);
  const targetPoc = currentUserRecord.pocNric || currentUserRecord.nric;
  let family = [];
  data.forEach(row => { 
      const rowPoc = row.pocNric || row.nric;
      if (rowPoc === targetPoc) {
          family.push(row);
      }
  });
  return family;
}

console.log("Family array:", getProfile('S6666666S'));
