const fs = require('fs');
const p = 'package.json';
const s = fs.readFileSync(p, 'utf8');
const n = s.replace('"version": "1.10.2"', '"version": "1.10.3"');
if (n === s) { console.log('NO MATCH'); process.exit(1); }
fs.writeFileSync(p, n);
console.log('bumped to 1.10.3');
