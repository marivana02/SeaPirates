const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\marivana\\Desktop\\SeaPirate\\scratch\\map_raw_v3_from_e2639054-fa13-4ee8-b893-52539f64a727.html', 'utf8');

console.log("File length:", content.length);
console.log("Does it contain styling?", content.includes('<style>'));
console.log("Does it contain script?", content.includes('<script>'));

// Let's print out lines around the body
const bodyIdx = content.indexOf('<body');
if (bodyIdx !== -1) {
    console.log("\n--- BODY SECTION ---");
    console.log(content.substring(bodyIdx, bodyIdx + 1500));
}

// Let's print out some CSS classes or keys
const classes = ['radar', 'panel', 'gold', 'ara', 'top-nav', 'btn-npc', 'btn-search', 'action', 'map', 'status', 'sea'];
console.log("\n--- KEYWORD OCCURRENCES ---");
classes.forEach(cls => {
    const regex = new RegExp(cls, 'gi');
    const count = (content.match(regex) || []).length;
    console.log(`Keyword '${cls}': ${count} times`);
});
