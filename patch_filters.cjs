const fs = require('fs');
let code = fs.readFileSync('frontend/js/attendance.js', 'utf8');

// Replace renderAttendanceLists filter
code = code.replace(
    /const participants = globalLogistics\.participants\.filter\(p => assignment === 'ALL' \|\| p\.group === assignment\);/,
    `const participants = globalLogistics.participants.filter(p => {
    if (assignment === 'ALL') return true;
    if (assignment.startsWith('PROJ::')) return p.group === assignment.split('::')[1];
    if (assignment.startsWith('GRP::')) return p.logisticsGroup === assignment.split('::')[1];
    if (assignment.startsWith('BUS::')) return p.bus === assignment.split('::')[1];
    return p.group === assignment;
});`
);

// Replace handleAttendanceSearch filter
code = code.replace(
    /const participants = globalLogistics\.participants\.filter\(p => \{\s*if\(assignment !== 'ALL' && p\.group !== assignment\) return false;\s*const dName = p\.displayName \|\| p\.name \|\| '';\s*return dName\.toLowerCase\(\)\.includes\(query\);\s*\}\);/,
    `const participants = globalLogistics.participants.filter(p => {
    if (assignment !== 'ALL') {
        if (assignment.startsWith('PROJ::') && p.group !== assignment.split('::')[1]) return false;
        if (assignment.startsWith('GRP::') && p.logisticsGroup !== assignment.split('::')[1]) return false;
        if (assignment.startsWith('BUS::') && p.bus !== assignment.split('::')[1]) return false;
        if (!assignment.includes('::') && p.group !== assignment) return false;
    }
    const dName = p.displayName || p.name || '';
    return dName.toLowerCase().includes(query);
});`
);

fs.writeFileSync('frontend/js/attendance.js', code);
