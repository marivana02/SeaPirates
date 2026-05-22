const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain';
const subdirs = fs.readdirSync(brainDir);

console.log("Searching through brain logs for boss.html...");

for (const subdir of subdirs) {
    const logPath = path.join(brainDir, subdir, '.system_generated', 'logs', 'overview.txt');
    if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf8');
        if (content.includes('boss.html')) {
            console.log(`Found "boss.html" in session: ${subdir}`);
            const lines = content.split('\n');
            lines.forEach((line, index) => {
                if (line.includes('boss.html') && (line.includes('write_to_file') || line.includes('replace_file_content'))) {
                    console.log(`  Line ${index + 1}: ${line.substring(0, 300)}...`);
                }
            });
        }
    }
}
