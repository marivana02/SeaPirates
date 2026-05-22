const fs = require('fs');
const path = require('path');

const logFile = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain\\b2c549c5-289a-486a-a54a-5bab50598cb7\\.system_generated\\logs\\overview.txt';
if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        try {
            const step = JSON.parse(line);
            if (step.step_index === 179 || step.step_index === 204 || step.step_index === 230 || step.step_index === 2036) {
                console.log(`Step ${step.step_index}:`);
                if (step.tool_calls) {
                    step.tool_calls.forEach(call => {
                        console.log(`  Tool: ${call.name}`);
                        if (call.args) {
                            console.log(`  TargetFile: ${call.args.TargetFile}`);
                            if (call.args.CodeContent) {
                                console.log(`  CodeContent Length: ${call.args.CodeContent.length}`);
                                console.log(`  Preview:\n${call.args.CodeContent.substring(0, 1000)}...`);
                            }
                        }
                    });
                }
            }
        } catch(e) {}
    });
} else {
    console.log("Log file not found!");
}
