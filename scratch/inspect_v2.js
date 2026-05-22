const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\marivana\\Desktop\\SeaPirate\\scratch\\map_raw_v2_from_b265d012-e210-4427-8a67-15cea8e4503d.html', 'utf8');

console.log("File length:", content.length);
console.log("First 800 characters:");
console.log(content.substring(0, 800));

console.log("\nLast 800 characters:");
console.log(content.substring(content.length - 800));
