const fs = require('fs');
let code = fs.readFileSync('backend/Code.js', 'utf8');

// 1. Add removeLargeCache
if (!code.includes('function removeLargeCache')) {
    const addFunc = `
function removeLargeCache(cacheKey) {
  const cache = CacheService.getScriptCache();
  try {
    cache.remove(cacheKey);
    const countStr = cache.get(cacheKey + "_count");
    if (countStr) {
      const count = parseInt(countStr);
      const keys = [cacheKey + "_count"];
      for (let i = 0; i < count; i++) keys.push(cacheKey + "_" + i);
      cache.removeAll(keys);
    }
  } catch(e) {}
}
`;
    code = code.replace('function getLargeCache', addFunc + 'function getLargeCache');
}

// 2. Replace CacheService.getScriptCache().remove(getCacheKey('X')) with removeLargeCache(getCacheKey('X'))
code = code.replace(/CacheService\.getScriptCache\(\)\.remove\((getCacheKey\('[^']+'\))\);/g, 'removeLargeCache($1);');

// 3. Make the matching logic more robust
code = code.replace(/const desiredNames = r\.relatedTrainee\.split\(\/\[\\\|,\]\/\)\.map\(n => n\.trim\(\)\.toLowerCase\(\)\)\.filter\(n => n\);/g, 
  "const desiredNames = r.relatedTrainee.split(/[\\|,]/).map(n => n.replace(/\\s+/g, '').toLowerCase()).filter(n => n);");

code = code.replace(/const jName = \(j\.fullName \|\| ''\)\.toLowerCase\(\);/g, "const jName = (j.fullName || '').replace(/\\s+/g, '').toLowerCase();");
code = code.replace(/const jShort = \(j\.shortName \|\| ''\)\.toLowerCase\(\);/g, "const jShort = (j.shortName || '').replace(/\\s+/g, '').toLowerCase();");

fs.writeFileSync('backend/Code.js', code);
