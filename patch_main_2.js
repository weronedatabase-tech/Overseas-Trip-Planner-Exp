import fs from 'fs';
let code = fs.readFileSync('frontend/js/main.js', 'utf8');

const target1 = `    cont.innerHTML = \`<p class="text-xs font-bold text-red-500 text-center py-4">\${e.message || 'Failed to load details.'}</p>\`;
  }
}`;

const rep1 = `    cont.innerHTML = \`<p class="text-xs font-bold text-red-500 text-center py-4">\${e.message || 'Failed to load details.'}</p>\`;
  }
  
  if (typeof setupTokenInput === 'function') {
      setTimeout(() => {
          if(document.getElementById('gpmRelated')) {
              setupTokenInput('gpmRelated', function(query) {
                  let allP = [];
                  if (typeof adminRosterData !== 'undefined' && adminRosterData.length > 0) {
                      allP = adminRosterData;
                  } else if (typeof loadedFamily !== 'undefined' && loadedFamily.length > 0) {
                      allP = loadedFamily;
                  }
                  const trainees = allP.filter(p => p.role === 'TRAINEE');
                  const results = trainees.filter(t => (t.fullName || '').toLowerCase().includes(query) || (t.shortName || '').toLowerCase().includes(query));
                  return results.map(t => ({ label: \`\${t.fullName} \${t.shortName ? '(' + t.shortName + ')' : ''}\`, value: t.fullName }));
              });
          }
      }, 50);
  }
}`;

code = code.replace(target1, rep1);

fs.writeFileSync('frontend/js/main.js', code);
