const fs = require('fs');
let c = fs.readFileSync('frontend/js/extraction.js', 'utf8');

const regex = /\/\/ Fuzzy search same as roster[\s\S]*?\}\)\.slice\(0, 5\);/g;

const newSearch = `// Fuzzy search identical to roster
    const matches = extractGlobalRoster.filter(p => {
        if (extractExcludedNrics.has(p.nric)) return false;
        
        return Object.values(p).some(val => 
            val && val.toString().toLowerCase().includes(query)
        );
    }).slice(0, 10);`; // Let's increase limit to 10 so whole families can show up easily

c = c.replace(regex, newSearch);
fs.writeFileSync('frontend/js/extraction.js', c);
console.log("Extraction search REALLY fixed.");
