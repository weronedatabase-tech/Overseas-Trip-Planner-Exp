const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

const regex = /<div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="myGroupMembersGrid">` \+\s*loadedGroupMembers\.map\(member => \{\s*return `<div class="my-group-card p-3([\s\S]*?)`<\/div><\/div>`; \}\)\.join\(""\) \+/g;

console.log(code.match(regex));
