const fs = require('fs');
const path = require('path');

const targetPath = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain\\b265d012-e210-4427-8a67-15cea8e4503d\\.system_generated\\logs\\overview.txt';
if (fs.existsSync(targetPath)) {
  const content = fs.readFileSync(targetPath, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('quick-btn') || lines[i].includes('quick-actions')) {
      console.log(`Line ${i}:`);
      console.log(lines[i].substring(0, 1000));
      if (lines[i].length > 1000) {
        console.log(`... and ${lines[i].length - 1000} more chars`);
      }
    }
  }
} else {
  console.log("File not found!");
}
