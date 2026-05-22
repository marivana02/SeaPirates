const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain';
const outputFilePath = path.join(brainDir, '89a393a5-ac85-4113-8106-c31534b4e368', 'scratch', 'extracted_history.txt');

const searchTerms = ['quick-actions', 'quick-btn', 'btn-prev', 'btn-next', 'nav-btn'];
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
        let match = false;
        for (const term of searchTerms) {
          if (line.includes(term)) {
            match = true;
            break;
          }
        }
        if (match && line.includes('replace_file_content')) {
          out += `=== CONVERSATION ${dir} Line ${i} ===\n`;
          try {
            const parsed = JSON.parse(line);
            out += JSON.stringify(parsed, null, 2) + '\n\n';
          } catch(e) {
            out += line + '\n\n';
          }
        }
      }
    }
  }
}

fs.writeFileSync(outputFilePath, out, 'utf8');
console.log(`Saved extracted sections to ${outputFilePath}`);
