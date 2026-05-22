const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\marivana\\Desktop\\SeaPirate\\frontend\\map.html', 'utf8');
console.log("Contains 'bird'?", content.includes('bird'));
console.log("Contains 'dolphin'?", content.includes('dolphin'));
console.log("Contains 'ambient'?", content.includes('ambient'));
console.log("Contains 'animation'?", content.includes('animation'));
console.log("Contains 'keyframes'?", content.includes('keyframes'));
console.log("Contains 'svg'?", content.includes('svg'));
console.log("Contains 'waves'?", content.includes('waves'));
