const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain';
const outputDir = 'C:\\Users\\marivana\\Desktop\\SeaPirate\\scratch';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

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
  console.log(`Found ${logs.length} overview logs.`);
  
  let versionCount = 0;
  
  for (const logPath of logs) {
    const convId = path.basename(path.dirname(path.dirname(path.dirname(logPath))));
    const content = fs.readFileSync(logPath, 'utf8');
    
    let pos = 0;
    while (true) {
      const startIdx = content.indexOf('<!DOCTYPE html>', pos);
      if (startIdx === -1) break;
      
      const endIdx = content.indexOf('</html>', startIdx);
      if (endIdx === -1) {
        pos = startIdx + 15;
        continue;
      }
      
      const rawBlock = content.substring(startIdx, endIdx + 7);
      pos = endIdx + 7;
      
      let cleaned = rawBlock
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .replace(/\\'/g, "'");
      
      // We only filter by checking if it contains some Seapirates map related keywords
      if (cleaned.includes('map') || cleaned.includes('sea.png') || cleaned.includes('Harita')) {
        versionCount++;
        const filename = `map_raw_v${versionCount}_from_${convId}.html`;
        fs.writeFileSync(path.join(outputDir, filename), cleaned, 'utf8');
        console.log(`Extracted map HTML from ${convId} -> ${filename}`);
      }
    }
  }
  console.log(`Extraction complete. Total versions written: ${versionCount}`);
} catch (err) {
  console.error('Error:', err);
}
