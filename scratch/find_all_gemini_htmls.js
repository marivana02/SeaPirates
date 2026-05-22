const fs = require('fs');
const path = require('path');

const baseDir = 'C:\\Users\\marivana\\.gemini\\antigravity';

function findHtmlFiles(dir, results = []) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        findHtmlFiles(filePath, results);
      } else if (file.toLowerCase().endsWith('.html') || file.toLowerCase().endsWith('.txt') || file.toLowerCase().endsWith('.js')) {
        results.push({ path: filePath, size: stat.size, mtime: stat.mtime });
      }
    }
  } catch (e) {}
  return results;
}

const list = findHtmlFiles(baseDir);
list.sort((a, b) => b.mtime - a.mtime);
console.log(`Found ${list.length} files in app data:`);
// Print top 50 files
for (let i = 0; i < Math.min(list.length, 50); i++) {
  const item = list[i];
  console.log(`- Path: ${item.path} (${item.size} bytes) [${item.mtime.toISOString()}]`);
}
