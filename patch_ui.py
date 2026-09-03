import sys
content = open('frontend/js/ui.js').read()
start = content.find('window.getFamilyMembers')
end = content.find('window.isFamily')

replacement = """window.getFamilyMembers = function(nric, allParticipants) {
    const target = allParticipants.find(p => p.nric === nric);
    if (!target) return [];

    let family = new Set();
    family.add(target);
    
    let changed = true;
    while (changed) {
        changed = false;
        
        for (let p of allParticipants) {
            if (family.has(p)) continue;
            
            let pName = (p.fullName || p.name || '').replace(/\\s+/g, '').toLowerCase();
            let pShortName = (p.shortName || '').replace(/\\s+/g, '').toLowerCase();
            
            let pRelated = [];
            if (p.role === 'CAREGIVER' && p.relatedTrainee) {
                pRelated = String(p.relatedTrainee).split('|').map(n => n.replace(/\\s+/g, '').toLowerCase()).filter(Boolean);
            }

            for (let f of family) {
                let fName = (f.fullName || f.name || '').replace(/\\s+/g, '').toLowerCase();
                let fShortName = (f.shortName || '').replace(/\\s+/g, '').toLowerCase();
                
                let fRelated = [];
                if (f.role === 'CAREGIVER' && f.relatedTrainee) {
                    fRelated = String(f.relatedTrainee).split('|').map(n => n.replace(/\\s+/g, '').toLowerCase()).filter(Boolean);
                }

                let match = (p.pocNric && f.pocNric && p.pocNric === f.pocNric);
                
                if (!match && pRelated.length > 0) {
                    if (pRelated.some(d => d.includes(fName) || fName.includes(d) || (fShortName && d.includes(fShortName)))) {
                        match = true;
                    }
                }
                
                if (!match && fRelated.length > 0) {
                    if (fRelated.some(d => d.includes(pName) || pName.includes(d) || (pShortName && d.includes(pShortName)))) {
                        match = true;
                    }
                }
                
                if (match) {
                    family.add(p);
                    changed = true;
                    break;
                }
            }
        }
    }
    
    return Array.from(family);
};

"""
open('frontend/js/ui.js', 'w').write(content[:start] + replacement + content[end:])
