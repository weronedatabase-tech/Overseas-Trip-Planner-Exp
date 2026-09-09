const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

const targetCache = `function putLargeCache(cacheKey, jsonStr) {
const cache = CacheService.getScriptCache();
try {`;

const replacementCache = `function putLargeCache(cacheKey, jsonStr) {
removeLargeCache(cacheKey);
const cache = CacheService.getScriptCache();
try {`;

if (code.includes(targetCache)) {
    code = code.replace(targetCache, replacementCache);
    console.log("Successfully replaced putLargeCache");
} else {
    console.log("putLargeCache not found");
}

fs.writeFileSync('backend/Code.js', code);
