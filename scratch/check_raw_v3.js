const fs = require('fs');

const path = 'C:\\Users\\marivana\\Desktop\\SeaPirate\\scratch\\map_raw_v3_from_e2639054-fa13-4ee8-b893-52539f64a727.html';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);
console.log("First 30 lines:");
for (let i = 0; i < 30; i++) {
    console.log(`${i+1}: ${lines[i]}`);
}

console.log("\nSearching for any high line index (e.g. 500-530):");
for (let i = 500; i < 530; i++) {
    if (lines[i]) console.log(`${i+1}: ${lines[i]}`);
}
