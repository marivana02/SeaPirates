const fs = require('fs');
const logFile = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain\\183d1ecf-7c14-4db6-a81b-c309d295a523\\.system_generated\\logs\\overview.txt';
const outputFile = 'C:\\Users\\marivana\\Desktop\\SeaPirate\\scratch\\step_2597_full_diff.json';

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

for (const line of lines) {
  if (line.includes('"step_index":2597')) {
    const step = JSON.parse(line);
    const args = step.tool_calls[0].args;
    // Parse ReplacementChunks as a JSON object if it's a string, or write it directly
    let chunks = args.ReplacementChunks;
    if (typeof chunks === 'string') {
      chunks = JSON.parse(chunks);
    }
    fs.writeFileSync(outputFile, JSON.stringify(chunks, null, 2), 'utf8');
    console.log(`Successfully wrote full step 2597 replacement chunks of size ${JSON.stringify(chunks).length} bytes to ${outputFile}`);
    break;
  }
}
