const fs = require('fs');
const path = require('path');

const baseDir = 'C:\\Users\\marivana\\.gemini\\antigravity';

function findMapFiles(dir, results = []) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        findMapFiles(filePath, results);
      } else if (file.toLowerCase().includes('map') && file.toLowerCase().endsWith('.html')) {
        results.push({ path: filePath, size: stat.size, mtime: stat.mtime });
      }
    }
  } catch (e) {}
  return results;
}

const list = findMapFiles(baseDir);
list.sort((a, b) => b.mtime - a.mtime);
console.log(`Found ${list.length} HTML files containing 'map' in app data:`);
for (const item of list) {
  console.log(`- Path: ${item.path}\n  Size: ${item.size} bytes\n  Modified: ${item.mtime.toISOString()}`);
}
