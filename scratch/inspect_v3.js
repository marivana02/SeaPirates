const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\marivana\\Desktop\\SeaPirate\\scratch\\map_raw_v3_from_e2639054-fa13-4ee8-b893-52539f64a727.html', 'utf8');

console.log("File length:", content.length);
console.log("First 800 characters:");
console.log(content.substring(0, 800));

console.log("\nLast 800 characters:");
console.log(content.substring(content.length - 800));
