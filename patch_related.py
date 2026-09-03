import sys
content = open('backend/Code.js').read()
start = content.find("results.forEach(r => {\\n      if (r.role === 'CAREGIVER') {")
end = content.find("r.relatedTrainee = dependents.map(d => `${d.fullName}${d.shortName ? ' (' + d.shortName + ')' : ''}`).join(' | ');")
end = content.find("}", end) + 1

# Actually let's just do a string replace
old_block = """  results.forEach(r => {
      if (r.role === 'CAREGIVER') {
          const dependents = results.filter(x => x !== r && x.pocNric === r.pocNric);
          if (dependents.length > 0) {
              r.relatedTrainee = dependents.map(d => `${d.fullName}${d.shortName ? ' (' + d.shortName + ')' : ''}`).join(' | ');
          }
      }
  });"""

new_block = """  results.forEach(r => {
      if (r.role === 'CAREGIVER') {
          const dependents = results.filter(x => x !== r && x.pocNric === r.pocNric && x.role === 'TRAINEE');
          if (dependents.length > 0) {
              r.relatedTrainee = dependents.map(d => `${d.fullName}${d.shortName ? ' (' + d.shortName + ')' : ''}`).join(' | ');
          }
      }
  });"""

if old_block in content:
    open('backend/Code.js', 'w').write(content.replace(old_block, new_block))
    print("Patched!")
else:
    print("Not found!")

