function debugTigerProfile() {
  const nric = 'S6666666S';
  const data = getProfile(nric);
  console.log(JSON.stringify(data, null, 2));
  
  const roster = fetchAdminRoster().roster;
  const target = roster.find(r => r.nric === nric);
  console.log("Target in roster: ", JSON.stringify(target));
  console.log("All members with target pocNric: ", roster.filter(r => r.pocNric === target.pocNric).map(r => r.fullName + " | nric:" + r.nric + " | pocNric:" + r.pocNric));
}
