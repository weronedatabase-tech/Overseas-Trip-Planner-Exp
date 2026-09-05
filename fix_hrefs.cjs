const fs = require('fs');
let c = fs.readFileSync('frontend/js/files.js', 'utf8');
c = c.replace(/href="#" onclick="document.getElementById\('driveExtractMenu'\).classList.add\('hidden-force'\); showExtractionPopup\('insurance'\)"/g, 'href="javascript:void(0)" onclick="document.getElementById(\'driveExtractMenu\').classList.add(\'hidden-force\'); showExtractionPopup(\'insurance\')"');
c = c.replace(/href="#" onclick="document.getElementById\('driveExtractMenu'\).classList.add\('hidden-force'\); showExtractionPopup\('bus'\)"/g, 'href="javascript:void(0)" onclick="document.getElementById(\'driveExtractMenu\').classList.add(\'hidden-force\'); showExtractionPopup(\'bus\')"');
fs.writeFileSync('frontend/js/files.js', c);