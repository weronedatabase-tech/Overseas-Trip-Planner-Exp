const fs = require('fs');
let c = fs.readFileSync('frontend/js/extraction.js', 'utf8');

const regex = /\/\/ Fuzzy search identical to roster[\s\S]*?\}\)\.slice\(0, 10\);/g;

const newSearch = `// Fuzzy search identical to roster
    let matches = extractGlobalRoster.filter(p => {
        if (extractExcludedNrics.has(p.nric)) return false;
        
        return Object.values(p).some(val => 
            val && val.toString().toLowerCase().includes(query)
        );
    });
    
    // Group family members together
    matches.sort((a, b) => {
        if (a.pocNric < b.pocNric) return -1;
        if (a.pocNric > b.pocNric) return 1;
        
        let roleA = a.role === 'TRAINEE' ? 1 : (a.role === 'CAREGIVER' ? 2 : 3);
        let roleB = b.role === 'TRAINEE' ? 1 : (b.role === 'CAREGIVER' ? 2 : 3);
        return roleA - roleB;
    });
    
    matches = matches.slice(0, 15);`;

c = c.replace(regex, newSearch);
fs.writeFileSync('frontend/js/extraction.js', c);
console.log("Extraction sorting added.");