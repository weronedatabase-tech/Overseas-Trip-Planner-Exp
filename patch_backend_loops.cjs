const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

const targetLoop = `  // In-memory self-healing of pocNric based on 'relatedTrainee' column (index 4)
  let changed = true;
  while (changed) {
      changed = false;
      results.forEach(r => {
          if (r.role === 'CAREGIVER' && r.relatedTrainee) {
              const desiredNames = r.relatedTrainee.split('|').map(n => n.replace(/\\s+/g, '').toLowerCase()).filter(n => n);
              results.forEach(j => {
                  if (j !== r) {
                      const jName = (j.fullName || '').replace(/\\s+/g, '').toLowerCase();
                      const jShort = (j.shortName || '').replace(/\\s+/g, '').toLowerCase();
                      const isDesired = desiredNames.some(d => d.includes(jName) || jName.includes(d) || (jShort && d.includes(jShort)));
                      if (isDesired) {
                          const rPoc = r.pocNric || r.nric;
                          const jPoc = j.pocNric || j.nric;
                          if (rPoc !== jPoc) {
                              const targetPoc = rPoc;
                              results.forEach(x => {
                                  if ((x.pocNric || x.nric) === jPoc) {
                                      x.pocNric = targetPoc;
                                  }
                              });
                              changed = true;
                          }
                      }
                  }
              });
          }
      });
  }`;

const replacementLoop = `  // Optimized In-memory self-healing of pocNric based on 'relatedTrainee' column (index 4)
  results.forEach(r => {
      r._normFullName = (r.fullName || '').replace(/\\s+/g, '').toLowerCase();
      r._normShortName = (r.shortName || '').replace(/\\s+/g, '').toLowerCase();
      if (r.role === 'CAREGIVER' && r.relatedTrainee) {
          r._normDesired = r.relatedTrainee.split('|').map(n => n.replace(/\\s+/g, '').toLowerCase()).filter(n => n);
      }
  });

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 5) {
      changed = false;
      iterations++;
      results.forEach(r => {
          if (r.role === 'CAREGIVER' && r._normDesired && r._normDesired.length > 0) {
              const desiredNames = r._normDesired;
              results.forEach(j => {
                  if (j !== r) {
                      const isDesired = desiredNames.some(d => d.includes(j._normFullName) || j._normFullName.includes(d) || (j._normShortName && d.includes(j._normShortName)));
                      if (isDesired) {
                          const rPoc = r.pocNric || r.nric;
                          const jPoc = j.pocNric || j.nric;
                          if (rPoc !== jPoc) {
                              results.forEach(x => {
                                  if ((x.pocNric || x.nric) === jPoc) {
                                      x.pocNric = rPoc;
                                  }
                              });
                              changed = true;
                          }
                      }
                  }
              });
          }
      });
  }
  
  results.forEach(r => {
      delete r._normFullName;
      delete r._normShortName;
      delete r._normDesired;
  });`;

if (code.includes(targetLoop)) {
    code = code.replace(targetLoop, replacementLoop);
    console.log("Successfully replaced targetLoop");
} else {
    console.log("targetLoop not found in Code.js");
}

fs.writeFileSync('backend/Code.js', code);
