const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain';
const subdirs = fs.readdirSync(brainDir);

for (const subdir of subdirs) {
    const logPath = path.join(brainDir, subdir, '.system_generated', 'logs', 'overview.txt');
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
                                console.log(`Session: ${subdir} | Step: ${step.step_index}`);
                                console.log(`  Tool: ${call.name} | Description: ${call.args.Description || ''}`);
                                const keys = Object.keys(call.args);
                                console.log(`  Keys: ${keys.join(', ')}`);
                                if (call.args.CodeContent) {
                                    console.log(`  CodeContent Length: ${call.args.CodeContent.length}`);
                                    console.log(`  CodeContent Truncated?`, call.args.CodeContent.includes('truncated'));
                                }
                                if (call.args.ReplacementContent) {
                                    console.log(`  ReplacementContent Length: ${call.args.ReplacementContent.length}`);
                                }
                            }
                        });
                    }
                } catch(e) {}
            }
        });
    }
}
