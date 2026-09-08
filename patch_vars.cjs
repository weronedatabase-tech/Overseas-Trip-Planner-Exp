const fs = require('fs');
const glob = require('glob');

const files = glob.sync('frontend/js/*.js');

const varsToVar = [
  'traineeShortNames',
  'medicalRosterData',
  'medSortRules',
  'medCols',
  'medicalSearchQuery',
  'otherRosterData',
  'otherSearchQuery',
  'otherSortRules',
  'otherCols',
  'expiredSearchQuery',
  'dietRosterData',
  'dietSearchQuery',
  'dietSortRules',
  'dietCols',
  'globalFinanceRates',
  'currentPickerTarget',
  'dndState',
  'attempts'
];

files.forEach(file => {
  let code = fs.readFileSync(file, 'utf8');
  let changed = false;
  varsToVar.forEach(v => {
    const regex = new RegExp(`^let\\s+${v}\\s*=`, 'm');
    if (regex.test(code)) {
      code = code.replace(regex, `var ${v} =`);
      changed = true;
    }
  });
  if (changed) {
    fs.writeFileSync(file, code);
    console.log('Patched', file);
  }
});
