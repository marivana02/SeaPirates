const fs = require('fs');
const path = require('path');

const scratchDir = 'C:\\Users\\marivana\\Desktop\\SeaPirate\\scratch';
const files = fs.readdirSync(scratchDir);

for (const file of files) {
    if (file.startsWith('map_') && file.endsWith('.html')) {
        const filePath = path.join(scratchDir, file);
        let content = fs.readFileSync(filePath, 'utf8').trim();
        
        // Let's see if this content is a JSON-encoded string (starts and ends with double quotes)
        if (content.startsWith('"') && content.endsWith('"')) {
            try {
                // Parse it as JSON to resolve all escape sequences like \n, \t, \", etc.
                const unescaped = JSON.parse(content);
                const cleanName = 'clean_' + file;
                fs.writeFileSync(path.join(scratchDir, cleanName), unescaped, 'utf8');
                console.log(`Cleaned and wrote: ${cleanName}`);
            } catch (err) {
                console.log(`Failed to parse ${file} as JSON string: ${err.message}`);
            }
        } else {
            console.log(`File ${file} does not appear to be an escaped JSON string.`);
        }
    }
}
