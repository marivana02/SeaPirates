const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain\\183d1ecf-7c14-4db6-a81b-c309d295a523\\.system_generated\\logs\\overview.txt';
if (fs.existsSync(logPath)) {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        if (line.includes('map.html') && (line.includes('replace_file_content') || line.includes('write_to_file'))) {
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
                        }
                    });
                }
            } catch(e) {}
        }
    });
}
