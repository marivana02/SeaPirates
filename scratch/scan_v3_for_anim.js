const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\marivana\\Desktop\\SeaPirate\\scratch\\map_raw_v3_from_e2639054-fa13-4ee8-b893-52539f64a727.html', 'utf8');

const keywords = ['ambientSound', 'bird', 'spawn'];
for (const kw of keywords) {
    let index = 0;
    while ((index = content.indexOf(kw, index)) !== -1) {
        console.log(`Found keyword "${kw}" at index ${index}`);
        console.log("Context around:");
        console.log(content.substring(Math.max(0, index - 100), Math.min(content.length, index + 1000)));
        console.log("=========================================\n");
        index += kw.length;
    }
}
