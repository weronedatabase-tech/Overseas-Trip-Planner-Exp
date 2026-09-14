const fs = require('fs');
let content = fs.readFileSync('frontend/js/profile.js', 'utf8');

const oldInnerHTML = "tabProfile.innerHTML = navHtml + topBannersHtml + myGroupHtml + personalDetailsHeader + profilesHtml + receiptsHtml + paymentHtml + '</div>';";
const newInnerHTML = "tabProfile.innerHTML = navHtml + topBannersHtml + personalDetailsHeader + profilesHtml + receiptsHtml + paymentHtml + '</div>' + myGroupHtml;";

content = content.replace(oldInnerHTML, newInnerHTML);
fs.writeFileSync('frontend/js/profile.js', content);
