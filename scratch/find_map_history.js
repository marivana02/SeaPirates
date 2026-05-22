const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain';
const subdirs = fs.readdirSync(brainDir);

console.log("Searching through brain logs...");

for (const subdir of subdirs) {
    const logPath = path.join(brainDir, subdir, '.system_generated', 'logs', 'overview.txt');
    if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf8');
        // Let's search for "map.html" or similar key terms in this log file
        if (content.includes('map.html')) {
            console.log(`Found "map.html" in session: ${subdir}`);
            // Let's count how many times it occurs or extract matching lines
            const lines = content.split('\n');
            let matches = 0;
            lines.forEach((line, index) => {
                if (line.includes('map.html') && (line.includes('replace_file_content') || line.includes('write_to_file')) && matches < 15) {
                    console.log(`  Line ${index + 1}: ${line.substring(0, 300)}...`);
                    matches++;
                }
            });
        }
    }
}
