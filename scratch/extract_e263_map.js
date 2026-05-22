const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain\\e2639054-fa13-4ee8-b893-52539f64a727\\.system_generated\\logs\\overview.txt';
if (fs.existsSync(logPath)) {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        if (line.includes('map.html') && (line.includes('replace_file_content') || line.includes('write_to_file') || line.includes('multi_replace_file_content'))) {
            try {
                const step = JSON.parse(line);
                if (step.tool_calls) {
                    step.tool_calls.forEach(call => {
                        if (call.args && (call.args.TargetFile && call.args.TargetFile.includes('map.html'))) {
                            console.log(`Step: ${step.step_index}`);
                            console.log(`  Tool: ${call.name} | Description: ${call.args.Description || ''}`);
                            if (call.args.ReplacementContent) {
                                console.log(`  ReplacementContent Length: ${call.args.ReplacementContent.length}`);
                                console.log(`  ReplacementContent:\n${call.args.ReplacementContent.substring(0, 300)}...`);
                            }
                            if (call.args.CodeContent) {
                                console.log(`  CodeContent Length: ${call.args.CodeContent.length}`);
                                console.log(`  CodeContent:\n${call.args.CodeContent.substring(0, 300)}...`);
                            }
                        }
                    });
                }
            } catch(e) {}
        }
    });
} else {
    console.log("Log not found!");
}
