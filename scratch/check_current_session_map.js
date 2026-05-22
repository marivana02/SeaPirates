const fs = require('fs');
const path = require('path');

const logFile = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain\\183d1ecf-7c14-4db6-a81b-c309d295a523\\.system_generated\\logs\\overview.txt';
if (fs.existsSync(logFile)) {
    console.log("Analyzing logFile...");
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        if (line.includes('map.html') && (line.includes('replace') || line.includes('write'))) {
            console.log(`Line ${index + 1}: ${line.substring(0, 500)}...`);
        }
    });
} else {
    console.log("logFile not found!");
}
