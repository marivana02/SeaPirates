const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\marivana\\Desktop\\SeaPirate\\gdd_output.txt', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('boss')) {
        console.log(`Line ${idx+1}: ${line.trim()}`);
    }
});
