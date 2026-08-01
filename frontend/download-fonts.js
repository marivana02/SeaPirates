const https = require('https');
const fs = require('fs');
const path = require('path');

const FONT_DIR = path.join(__dirname, 'assets', 'fonts');

function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location, headers).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CSS_URL = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&display=swap';

(async () => {
  if (!fs.existsSync(FONT_DIR)) fs.mkdirSync(FONT_DIR, { recursive: true });

  const css = (await fetch(CSS_URL, { 'User-Agent': UA })).toString('utf8');

  const blocks = css.split('@font-face').slice(1);
  const out = [];
  const seen = new Map();
  let idx = 0;

  for (const block of blocks) {
    const family = (block.match(/font-family:\s*'([^']+)'/) || [])[1];
    const weight = (block.match(/font-weight:\s*(\d+)/) || [])[1];
    const style = (block.match(/font-style:\s*(\w+)/) || [])[1] || 'normal';
    const unicode = (block.match(/unicode-range:\s*([^;]+);/) || [])[1];
    const url = (block.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
    if (!family || !weight || !url) continue;

    const baseName = `${family.toLowerCase()}-${weight}-${style === 'italic' ? 'i' : 'n'}-${idx}.woff2`;
    let fname = baseName;
    let count = 0;
    while (seen.has(fname)) { fname = baseName.replace('.woff2', `-${++count}.woff2`); }
    seen.set(fname, true);

    const buf = await fetch(url, { 'User-Agent': UA });
    fs.writeFileSync(path.join(FONT_DIR, fname), buf);
    idx++;

    out.push(
      '@font-face {\n' +
      `  font-family: '${family}';\n` +
      `  font-style: ${style};\n` +
      `  font-weight: ${weight};\n` +
      (unicode ? `  unicode-range: ${unicode};\n` : '') +
      `  src: url('assets/fonts/${fname}') format('woff2');\n` +
      '  font-display: swap;\n' +
      '}'
    );
    console.log(`Downloaded ${fname} (${family} ${weight} ${style}) - ${buf.length} bytes`);
  }

  fs.writeFileSync(path.join(__dirname, 'fonts.css'), out.join('\n\n') + '\n');
  console.log('\nfonts.css written with', out.length, '@font-face blocks');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
