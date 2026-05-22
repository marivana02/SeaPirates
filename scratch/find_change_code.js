const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\marivana\\Desktop\\SeaPirate\\scratch\\map_raw_v1_from_183d1ecf-7c14-4db6-a81b-c309d295a523.html', 'utf8');

const regex = /\/api\/maps\/change/g;
let match;
while ((match = regex.exec(content)) !== null) {
    console.log(`Found index: ${match.index}`);
    console.log(content.substring(match.index - 300, match.index + 500));
    console.log("\n-------------------------------------------------\n");
}
