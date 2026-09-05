const fs = require('fs');

const orig = `frontend/js/logistics.js:887:document.getElementById('tab-logistics').innerHTML = \`
frontend/js/logistics.js:1111:    document.getElementById('groupUnassignedPool').innerHTML = unHtml || '<p class="text-xs text-gray-500 font-bold p-2 text-center mt-2">All assigned / No matches.</p>';
frontend/js/logistics.js:1135:    document.getElementById('groupListContainer').innerHTML = grpHtml;
frontend/js/logistics.js:1192:    document.getElementById('busUnassignedPool').innerHTML = unHtml || '<p class="text-xs text-gray-500 font-bold p-2 text-center mt-2">All assigned / No matches.</p>';
frontend/js/logistics.js:1216:    document.getElementById('busListContainer').innerHTML = busHtml;
frontend/js/logistics.js:1648:document.getElementById('dnd-source-pool').innerHTML = sourceHtml || '<p class="text-xs text-gray-500 font-bold p-2 text-center mt-2">No items.</p>';
frontend/js/logistics.js:1652:document.getElementById('dnd-target-list').innerHTML = targetHtml || '<p class="text-xs text-gray-500 font-bold p-2 text-center mt-2">No items.</p>';
frontend/js/logistics.js:1698:document.getElementById('roomUnassignedPool').innerHTML = unHtml || '<p class="text-xs text-gray-500 font-bold p-2 text-center mt-2">All assigned / No matches.</p>';
frontend/js/logistics.js:1768:document.getElementById('roomListContainer').innerHTML = roomHtml || '<div class="flex justify-center items-center h-20 text-xs font-bold text-gray-400">No rooms match criteria.</div>';
frontend/js/logistics.js:1808:document.getElementById('sheetTitle').innerHTML = titleHtml;
frontend/js/logistics.js:1838:document.getElementById('sheetListContainer').innerHTML = html || \`<p class="text-xs font-bold text-gray-400 p-2 text-center mt-2">No available options.</p>\`;
frontend/js/logistics.js:1846:document.getElementById('sheetTitle').innerHTML = \`Add to <span class="ml-1 font-black text-primary">\${room.name}</span>\`;
frontend/js/logistics.js:1871:document.getElementById('sheetListContainer').innerHTML = html || \`<p class="text-xs font-bold text-gray-400 p-2 text-center mt-2">Everyone is assigned.</p>\`;
frontend/js/logistics.js:1973:    document.getElementById('sheetTitle').innerHTML = \`Assign <span class="text-primary">\${p.displayName || p.name}</span>\`;
frontend/js/logistics.js:1988:    document.getElementById('sheetTitle').innerHTML = \`Assign <span class="text-primary">\${p.displayName || p.name}</span>\`;
frontend/js/logistics.js:2038:    document.getElementById('sheetListContainer').innerHTML = html;
frontend/js/logistics.js:2125:    document.getElementById('sheetTitle').innerHTML = \`Manage <span class="text-primary">Groups</span>\`;
frontend/js/logistics.js:2135:    document.getElementById('sheetTitle').innerHTML = \`Manage <span class="text-primary">Buses</span>\`;
frontend/js/logistics.js:2158:    document.getElementById('sheetTitle').innerHTML = \`Manage <span class="text-primary">Rooms</span>\`;`.split('\n');

let lines = fs.readFileSync('frontend/js/logistics.js', 'utf8').split('\n');
orig.forEach(l => {
  const match = l.match(/frontend\/js\/logistics\.js:(\d+):(.*)/);
  if(match) {
    const lineNum = parseInt(match[1]) - 1;
    let content = match[2];
    // Now apply safe replace!
    content = content.replace(/document\.getElementById\((['"])([^'"]+)\1\)\.innerHTML\s*=/, "const el_$2 = document.getElementById('$2'); if(el_$2) el_$2.innerHTML =");
    lines[lineNum] = content;
  }
});
fs.writeFileSync('frontend/js/logistics.js', lines.join('\n'));

// Do the same for others
const orig2 = `frontend/js/expired.js:15:document.getElementById('tab-expired').innerHTML = \`
frontend/js/other.js:14:document.getElementById('tab-other').innerHTML = \`
frontend/js/files.js:16:document.getElementById('tab-files').innerHTML = \`
frontend/js/attendance.js:11:document.getElementById('tab-attendance').innerHTML = \``.split('\n');

for(let l of orig2) {
  if(!l.trim()) continue;
  const match = l.match(/(frontend\/js\/[^:]+):(\d+):(.*)/);
  if(match) {
    const file = match[1];
    const lineNum = parseInt(match[2]) - 1;
    let content = match[3];
    content = content.replace(/document\.getElementById\((['"])([^'"]+)\1\)\.innerHTML\s*=/, "const el_$2 = document.getElementById('$2'); if(el_$2) el_$2.innerHTML =");
    let fLines = fs.readFileSync(file, 'utf8').split('\n');
    fLines[lineNum] = content;
    fs.writeFileSync(file, fLines.join('\n'));
  }
}