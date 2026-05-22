const fs = require('fs');
const logFile = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain\\183d1ecf-7c14-4db6-a81b-c309d295a523\\.system_generated\\logs\\overview.txt';

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

// Find step 2597
for (const line of lines) {
  if (line.includes('"step_index":2597')) {
    const step = JSON.parse(line);
    console.log(JSON.stringify(step.tool_calls[0].args, null, 2));
    break;
  }
}
