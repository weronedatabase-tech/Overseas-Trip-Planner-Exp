const fs = require('fs');

let ui = fs.readFileSync('frontend/js/ui.js', 'utf8');

if (!ui.includes('isValidNRIC')) {
  ui = ui + `\n\nwindow.isValidNRIC = function(str) {
    if (!str || str.length !== 9) return false;
    str = str.toUpperCase();
    const prefix = str.charAt(0);
    const digits = str.substring(1, 8);
    const suffix = str.charAt(8);

    if (!['S', 'T', 'F', 'G', 'M'].includes(prefix)) return false;
    if (!/^\\d{7}$/.test(digits)) return false;

    const weights = [2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 7; i++) {
        sum += parseInt(digits.charAt(i), 10) * weights[i];
    }

    if (prefix === 'T' || prefix === 'G') sum += 4;
    if (prefix === 'M') sum += 3;

    const remainder = sum % 11;

    const st = ['J', 'Z', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
    const fgm = ['X', 'W', 'U', 'T', 'R', 'Q', 'P', 'N', 'M', 'L', 'K'];

    let expectedSuffix = '';
    if (prefix === 'S' || prefix === 'T') expectedSuffix = st[remainder];
    else if (prefix === 'F' || prefix === 'G' || prefix === 'M') expectedSuffix = fgm[remainder];

    return suffix === expectedSuffix;
};
`;
  fs.writeFileSync('frontend/js/ui.js', ui);
}
