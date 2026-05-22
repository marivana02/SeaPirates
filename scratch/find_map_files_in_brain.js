const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain';

function searchForMapHtmlFiles(dir) {
    let results = [];
    
    function recurse(currentDir) {
        if (!fs.existsSync(currentDir)) return;
        const list = fs.readdirSync(currentDir);
        for (const item of list) {
            const itemPath = path.join(currentDir, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
                recurse(itemPath);
            } else if (item.toLowerCase() === 'map.html' || item.toLowerCase().includes('map.html')) {
                results.push({
                    path: itemPath,
                    size: stat.size
                });
            }
        }
    }
    
    recurse(dir);
    return results;
}

const found = searchForMapHtmlFiles(brainDir);
console.log(`Found ${found.length} files:`);
found.forEach(f => {
    console.log(`- Path: ${f.path} (${f.size} bytes)`);
});
