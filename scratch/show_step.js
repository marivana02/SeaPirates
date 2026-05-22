const fs = require('fs');
const path = require('path');

const targetPath = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain\\183d1ecf-7c14-4db6-a81b-c309d295a523\\.system_generated\\logs\\overview.txt';
if (fs.existsSync(targetPath)) {
  const lines = fs.readFileSync(targetPath, 'utf8').split('\n');
  for (const line of lines) {
    if (line.includes('"step_index":2561') || line.includes('"step_index":2597')) {
      const obj = JSON.parse(line);
      console.log(`STEP: ${obj.step_index}`);
      console.log(JSON.stringify(obj, null, 2));
    }
  }
} else {
  console.log("File not found!");
}
