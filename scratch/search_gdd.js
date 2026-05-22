const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\marivana\\Desktop\\SeaPirate\\gdd_output.txt', 'utf8');

const lines = content.split('\n');
console.log(`GDD has ${lines.length} lines.`);

const keywords = ['boss', 'weekly', 'haftalık', 'liman', 'tersane', 'harita', '1-2', '2-1', 'amiral'];
keywords.forEach(kw => {
    let matches = [];
    lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(kw.toLowerCase())) {
            matches.push({ lineNum: idx + 1, content: line.trim() });
        }
    });
    console.log(`Keyword '${kw}': ${matches.length} matches. Showing first 5:`);
    matches.slice(0, 5).forEach(m => console.log(`  Line ${m.lineNum}: ${m.content}`));
});
