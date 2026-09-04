const fs = require('fs');

function fixFile(file) {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  // Match `identifier.innerHTML = ` where `identifier` is NOT preceded by `if (identifier) `
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Very simple check for lines that have `.innerHTML =` but don't have an `if`
    if (line.includes('.innerHTML =') && !line.includes('if (') && !line.includes('if(')) {
      const match = line.match(/([a-zA-Z0-9_\-]+)\.innerHTML\s*=/);
      if (match) {
        const id = match[1];
        if (id === 'div' || id === 'modal' || id === 'chipContainer' || id === 'chip' || id === 'dropdown' || id === 'chevron' || id === 'clearBtn' || id === 'listCont' || id === 'toast') {
           // These are locally created or verified elements
           continue;
        }
        lines[i] = line.replace(`${id}.innerHTML =`, `if (${id}) ${id}.innerHTML =`);
      }
    }
  }
  fs.writeFileSync(file, lines.join('\n'));
}

fixFile('frontend/js/logistics.js');
fixFile('frontend/js/attendance.js');
fixFile('frontend/js/expired.js');
fixFile('frontend/js/other.js');
fixFile('frontend/js/finance.js');
fixFile('frontend/js/main.js'); fixFile('frontend/js/ui.js'); fixFile('frontend/js/settings.js');
