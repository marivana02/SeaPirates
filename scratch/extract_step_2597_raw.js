const fs = require('fs');
const logFile = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain\\183d1ecf-7c14-4db6-a81b-c309d295a523\\.system_generated\\logs\\overview.txt';

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

for (const line of lines) {
  if (line.includes('"step_index":2597')) {
    // Find the target content and print it, ignoring trailing truncation if needed
    // Let's print the raw string around the TargetContent
    const idx = line.indexOf('"ReplacementChunks"');
    if (idx !== -1) {
      console.log(line.substring(idx, idx + 2000));
    }
    break;
  }
}
