const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain';

function findMapHtmlInLogs() {
    if (!fs.existsSync(brainDir)) {
        console.log('Brain directory does not exist.');
        return;
    }

    const subdirs = fs.readdirSync(brainDir);
    let candidates = [];

    for (const subdir of subdirs) {
        const logPath = path.join(brainDir, subdir, '.system_generated', 'logs', 'overview.txt');
        if (fs.existsSync(logPath)) {
            const content = fs.readFileSync(logPath, 'utf8');
            const lines = content.split('\n');
            
            lines.forEach((line, index) => {
                if (line.includes('map.html') && line.includes('write_to_file')) {
                    try {
                        const step = JSON.parse(line);
                        if (step.tool_calls) {
                            step.tool_calls.forEach(call => {
                                if (call.name === 'write_to_file' && call.args && call.args.TargetFile && call.args.TargetFile.endsWith('map.html')) {
                                    candidates.push({
                                        session: subdir,
                                        stepIndex: step.step_index,
                                        length: call.args.CodeContent ? call.args.CodeContent.length : 0,
                                        desc: call.args.Description || ''
                                    });
                                }
                            });
                        }
                    } catch (e) {}
                }
            });
        }
    }

    // Sort by length or stepIndex to see recent/largest files
    console.log(`Found ${candidates.length} candidate write_to_file logs:`);
    candidates.forEach(c => {
        console.log(`Session: ${c.session} | Step: ${c.stepIndex} | Length: ${c.length} | Desc: ${c.desc}`);
    });
}

findMapHtmlInLogs();
