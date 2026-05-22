const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain\\89a393a5-ac85-4113-8106-c31534b4e368\\.system_generated\\logs\\overview.txt';
const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

for (const line of lines) {
    if (line.includes('"step_index":2448') || line.includes('changeMap')) {
        try {
            const step = JSON.parse(line);
            if (step.tool_calls) {
                step.tool_calls.forEach(call => {
                    if (call.args) {
                        console.log(`Step: ${step.step_index}`);
                        console.log(`args keys:`, Object.keys(call.args));
                        if (call.args.ReplacementContent) {
                            console.log(`ReplacementContent:\n${call.args.ReplacementContent}`);
                        }
                        if (call.args.TargetContent) {
                            console.log(`TargetContent:\n${call.args.TargetContent}`);
                        }
                    }
                });
            }
        } catch(e) {}
    }
}
