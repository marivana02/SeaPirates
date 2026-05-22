const fs = require('fs');
const path = require('path');

const scratchDir = 'C:\\Users\\marivana\\Desktop\\SeaPirate\\scratch';
const files = fs.readdirSync(scratchDir);

for (const file of files) {
    if (file.toLowerCase().includes('perfect') || file.toLowerCase().includes('raw_v3') || file.toLowerCase().includes('unfiltered')) {
        const filePath = path.join(scratchDir, file);
        if (fs.statSync(filePath).isFile()) {
            const content = fs.readFileSync(filePath, 'utf8');
            console.log(`File: ${file} (Size: ${content.length} chars)`);
            console.log(`  Contains 'spawn'? ${content.includes('spawn')}`);
            console.log(`  Contains 'bird'? ${content.includes('bird')}`);
            console.log(`  Contains 'ambient'? ${content.includes('ambient')}`);
        }
    }
}
