const fs = require('fs');
let c = fs.readFileSync('frontend/js/extraction.js', 'utf8');

const oldFetch = `        try {
            const res = await apiCall('fetchAdminRoster', {});
            if (res.status === 'success') {
                extractGlobalRoster = res.roster || [];
            }
        } catch (e) {
            console.error("Error fetching roster for extraction", e);
        }`;

const newFetch = `        try {
            const [rostRes, logRes] = await Promise.all([
                apiCall('fetchAdminRoster', {}),
                (typeof globalLogistics !== 'undefined' && globalLogistics) ? Promise.resolve(globalLogistics) : apiCall('fetchLogistics').catch(e => null)
            ]);
            
            if (rostRes && rostRes.status === 'success') {
                let tempRoster = rostRes.roster || [];
                if (typeof applyCaregiverLabels === 'function') applyCaregiverLabels(tempRoster);
                
                const logisticsData = logRes || { rooms: [], pairings: [] };
                
                const pairingsMap = {};
                if (logisticsData.pairings) {
                    logisticsData.pairings.filter(p => p.status === 'ACTIVE').forEach(pair => {
                        if(!pairingsMap[pair.traineeNric]) pairingsMap[pair.traineeNric] = [];
                        if(!pairingsMap[pair.volNric]) pairingsMap[pair.volNric] = [];
                        
                        const v = tempRoster.find(x => x.nric === pair.volNric);
                        const t = tempRoster.find(x => x.nric === pair.traineeNric);
                        
                        if(v) pairingsMap[pair.traineeNric].push(((v.shortName || v.fullName) || '').toUpperCase());
                        if(t) pairingsMap[pair.volNric].push(((t.shortName || t.fullName) || '').toUpperCase());
                    });
                }
                
                const roomsMap = {};
                if (logisticsData.rooms) {
                    logisticsData.rooms.filter(r => !r.isDeleted).forEach(r => {
                        r.occupants.forEach(n => roomsMap[n] = r.name.toUpperCase());
                    });
                }
                
                tempRoster.forEach(p => {
                    p.room = roomsMap[p.nric] || 'UNASSIGNED';
                    let myPairings = pairingsMap[p.nric] ? [...pairingsMap[p.nric]] : [];
                    if (p.role === 'CAREGIVER' && p.relatedTrainee) {
                        const rNames = p.relatedTrainee.split('|').map(n => n.trim().toLowerCase());
                        const relatedList = tempRoster.filter(x => rNames.includes((x.fullName||'').toLowerCase()) && x.role === 'TRAINEE');
                        relatedList.forEach(related => {
                            if (related && pairingsMap[related.nric]) {
                                myPairings.push(...pairingsMap[related.nric]);
                            }
                        });
                    }
                    p.pairings = myPairings.length > 0 ? Array.from(new Set(myPairings)).join(', ') : 'NONE';
                });
                
                extractGlobalRoster = tempRoster;
            }
        } catch (e) {
            console.error("Error fetching roster for extraction", e);
        }`;

c = c.replace(oldFetch, newFetch);
fs.writeFileSync('frontend/js/extraction.js', c);
console.log("Updated extraction data fetch.");
