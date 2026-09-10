const fs = require('fs');
const path = './frontend/js/attendance.js';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `relatedTraineeHtml = \`<div class="mt-1 font-bold text-purple-600 dark:text-purple-400 text-[10px] leading-tight max-w-full break-words whitespace-normal" style="overflow-wrap: break-word;">[\${tName.toUpperCase()}]</div>\`;`;

const newStr = `relatedTraineeHtml = \`<div class="mt-1 font-bold text-purple-600 dark:text-purple-400 text-xs leading-tight max-w-full break-words whitespace-normal" style="overflow-wrap: break-word;">[\${tName.toUpperCase()}]</div>\`;`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, newStr);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Patched style to exact match successfully.");
} else {
    console.log("Target string not found.");
}
