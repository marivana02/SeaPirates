const fs = require('fs');
const logFile = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain\\e2639054-fa13-4ee8-b893-52539f64a727\\.system_generated\\logs\\overview.txt';

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

const targets = [235, 294];
for (const t of targets) {
  const line = lines[t - 1];
  try {
    const step = JSON.parse(line);
    console.log(`--- Line ${t} (Step ${step.step_index}) ---`);
    console.log(JSON.stringify({
      step_index: step.step_index,
      created_at: step.created_at,
      tool_calls: step.tool_calls ? step.tool_calls.map(tc => ({
        name: tc.name,
        targetFile: tc.args.TargetFile,
        description: tc.args.Description || tc.args.Instruction || ''
      })) : null,
      content: step.content
    }, null, 2));
  } catch (e) {
    console.log(`--- Line ${t} (Raw) ---`);
    console.log(line.substring(0, 1000));
  }
}
