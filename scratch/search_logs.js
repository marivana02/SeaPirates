const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain';
const term = 'btn-prev';

const dirs = fs.readdirSync(brainDir);
for (const dir of dirs) {
  const logDir = path.join(brainDir, dir, '.system_generated', 'logs');
  if (fs.existsSync(logDir)) {
    const overviewPath = path.join(logDir, 'overview.txt');
    if (fs.existsSync(overviewPath)) {
      const content = fs.readFileSync(overviewPath, 'utf8');
      if (content.toLowerCase().includes(term.toLowerCase())) {
        console.log(`Found "${term}" in conversation: ${dir}`);
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.toLowerCase().includes(term.toLowerCase()) && line.includes('replace_file_content')) {
            console.log(`  Line: ${line.substring(0, 450)}`);
          }
        }
      }
    }
  }
}
