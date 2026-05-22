const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain';
const outputFilePath = path.join(brainDir, '89a393a5-ac85-4113-8106-c31534b4e368', 'scratch', 'extracted_map_header.txt');

let out = '';
const dirs = fs.readdirSync(brainDir);
for (const dir of dirs) {
  const logDir = path.join(brainDir, dir, '.system_generated', 'logs');
  if (fs.existsSync(logDir)) {
    const overviewPath = path.join(logDir, 'overview.txt');
    if (fs.existsSync(overviewPath)) {
      const content = fs.readFileSync(overviewPath, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('map.html') && (line.includes('map-header') || line.includes('nav-btn') || line.includes('changeMap'))) {
          out += `=== CONVERSATION ${dir} Line ${i} ===\n`;
          out += line.substring(0, 1500) + '\n\n';
        }
      }
    }
  }
}

fs.writeFileSync(outputFilePath, out, 'utf8');
console.log(`Saved matches to ${outputFilePath}`);
