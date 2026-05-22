const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain';
const subdirs = fs.readdirSync(brainDir);

console.log("Searching through brain logs...");

for (const subdir of subdirs) {
    const logPath = path.join(brainDir, subdir, '.system_generated', 'logs', 'overview.txt');
    if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf8');
        if (content.includes('/api/maps') || content.includes('/api/player') || content.includes('changeMap') || content.includes('change_map')) {
            console.log(`Found relevant terms in session: ${subdir}`);
            const lines = content.split('\n');
            lines.forEach((line, index) => {
                if ((line.includes('/api/maps') || line.includes('changeMap')) && (line.includes('replace_file_content') || line.includes('write_to_file'))) {
                    // Let's print out the arguments or line content
                    console.log(`  Line ${index + 1}: ${line.substring(0, 400)}...`);
                }
            });
        }
    }
}
