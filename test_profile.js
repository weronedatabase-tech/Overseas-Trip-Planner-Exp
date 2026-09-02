const fs = require('fs');
let code = fs.readFileSync('frontend/js/profile.js', 'utf8');

// Mock data
global.currentUser = { nric: 'S1234567A', name: 'John Doe' };
global.loadedFamily = [
  { nric: 'S1234567A', fullName: 'John Doe', role: 'TRAINEE', group: 'A' },
  { nric: 'S7654321B', fullName: 'Jane Doe', role: 'CAREGIVER', group: 'A' }
];
global.finConfig = {};
global.finOptions = [];
global.appSettings = { allowEdits: true };
global.getProjectColor = () => 'bg-blue-500';
global.minExpiry = null;
global.formatDDMmmYYYY = (d) => d;

const dom = `
function documentMock() {
  this.getElementById = () => { return { innerHTML: '' }; };
}
global.document = new documentMock();
`;

code = dom + code;
// ...
