const fs = require('fs');
let code = fs.readFileSync('frontend/js/logistics.js', 'utf8');

code = code.replace(
  /const p = globalLogistics\.participants\.find\(x => x\.nric === current\);\n\s*if \(!p\) continue;\n\s*let pTarget = p\.pocNric;/,
  `const p = globalLogistics.participants.find(x => x.nric === current);\n        if (!p) continue;\n        \n        if (p.isIndividual) continue;\n        \n        let pTarget = p.pocNric;`
);

code = code.replace(
  /if \(pair\.traineeNric === current && !connected\.has\(pair\.volNric\)\) \{/,
  `const vP = globalLogistics.participants.find(x => x.nric === pair.volNric);\n            if (pair.traineeNric === current && !connected.has(pair.volNric) && !(vP && vP.isIndividual)) {`
);

code = code.replace(
  /if \(pair\.volNric === current && !connected\.has\(pair\.traineeNric\)\) \{/,
  `const tP = globalLogistics.participants.find(x => x.nric === pair.traineeNric);\n            if (pair.volNric === current && !connected.has(pair.traineeNric) && !(tP && tP.isIndividual)) {`
);

fs.writeFileSync('frontend/js/logistics.js', code);
console.log('Patched logistics.js for isIndividual');
