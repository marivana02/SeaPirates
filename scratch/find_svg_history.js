const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain';

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getFiles(filePath, fileList);
    } else if (file === 'overview.txt') {
      fileList.push(filePath);
    }
  }
  return fileList;
}

try {
  const logs = getFiles(brainDir);
  console.log(`Searching in ${logs.length} logs...`);
  
  for (const logPath of logs) {
    const convId = path.basename(path.dirname(path.dirname(path.dirname(logPath))));
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim();
      if (!line) continue;
      
      if (line.includes('svg') || line.includes('SVG') || line.includes('minimap') || line.includes('chart-nav')) {
        if (line.includes('map.html')) {
          console.log(`[${convId}] Line ${lineNum + 1}: contains keyword`);
        }
      }
    }
  }
  console.log('Search completed.');
} catch (err) {
  console.error(err);
}
