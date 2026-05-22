const fs = require('fs');
const path = require('path');

const logFile = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain\\b2c549c5-289a-486a-a54a-5bab50598cb7\\.system_generated\\logs\\overview.txt';
const outputDir = 'C:\\Users\\marivana\\Desktop\\SeaPirate\\scratch';

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

let count = 0;
for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const step = JSON.parse(line);
    if (step.tool_calls) {
      for (const call of step.tool_calls) {
        if (call.name === 'write_to_file') {
          const args = call.args || {};
          const target = args.TargetFile || '';
          if (target.includes('map.html')) {
            let code = args.CodeContent || '';
            // Since step is parsed via JSON.parse, code is already a normal JS string
            // with actual newlines and unescaped quotes!
            count++;
            const filename = `map_perfect_v${count}.html`;
            fs.writeFileSync(path.join(outputDir, filename), code, 'utf8');
            console.log(`Successfully wrote ${filename} of length ${code.length}`);
          }
        }
      }
    }
  } catch (err) {
    // skip
  }
}
