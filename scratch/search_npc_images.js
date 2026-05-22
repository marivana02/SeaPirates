const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain';
const subdirs = fs.readdirSync(brainDir);

console.log("Searching through brain logs for npcc...");

for (const subdir of subdirs) {
    const logPath = path.join(brainDir, subdir, '.system_generated', 'logs', 'overview.txt');
    if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf8');
        if (content.includes('assets/npcc/')) {
            console.log(`Found assets/npcc/ in session: ${subdir}`);
            const lines = content.split('\n');
            lines.forEach((line, index) => {
                if (line.includes('assets/npcc/') && (line.includes('write_to_file') || line.includes('replace_file_content')) && line.includes('map.html')) {
                    // Let's print out the exact string
                    console.log(`  Line ${index + 1}: ${line.substring(line.indexOf('assets/npcc/') - 200, line.indexOf('assets/npcc/') + 300)}`);
                }
            });
        }
    }
}
