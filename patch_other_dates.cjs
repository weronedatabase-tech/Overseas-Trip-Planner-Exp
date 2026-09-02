const fs = require('fs');

let f = fs.readFileSync('frontend/js/finance.js', 'utf8');
f = f.replace(
  "const dateStr = new Date(r.ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });",
  "const dateStr = typeof formatDDMmmYYYY === 'function' ? formatDDMmmYYYY(r.ts) : new Date(r.ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });"
);
fs.writeFileSync('frontend/js/finance.js', f);

let p = fs.readFileSync('frontend/js/profile.js', 'utf8');
p = p.replace(
  "const dateStr = new Date(feeReceipt.ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });",
  "const timeStr = new Date(feeReceipt.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); const dateStr = (typeof formatDDMmmYYYY === 'function' ? formatDDMmmYYYY(feeReceipt.ts) : '') + ' ' + timeStr;"
);
p = p.replace(
  "${tripEnd.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}",
  "${typeof formatDDMmmYYYY === 'function' ? formatDDMmmYYYY(tripEnd) : tripEnd.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}"
);
fs.writeFileSync('frontend/js/profile.js', p);

