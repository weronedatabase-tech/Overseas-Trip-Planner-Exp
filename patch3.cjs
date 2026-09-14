const fs = require('fs');
let file = fs.readFileSync('frontend/js/participants.js', 'utf8');

const target = `              \`).join('')}
           </div>
       </div>
   </div>`;

const replacement = `              \`).join('')}
           </div>
       </div>
       </div>
   </div>`;

if (file.includes(target)) {
    file = file.replace(target, replacement);
    fs.writeFileSync('frontend/js/participants.js', file);
    console.log("Success exact");
} else {
    const regex = /\}\s*<\/div>\s*<\/div>\s*<\/div>\s*<div class="flex-1 min-h-0 overflow-auto/;
    if (regex.test(file)) {
        file = file.replace(regex, "} </div></div></div></div> <div class=\"flex-1 min-h-0 overflow-auto");
        fs.writeFileSync('frontend/js/participants.js', file);
        console.log("Success regex");
    } else {
        console.log("Failed to match end block");
    }
}
