import { readFileSync, writeFileSync } from 'node:fs';
const f = 'package.json';
let s = readFileSync(f, 'utf8');
const m = s.match(/"version":\s*"([^"]+)"/);
console.log('before', m[1]);
if (m[1] === '1.6.2') { console.log('already'); process.exit(0); }
if (m[1] !== '1.6.1') throw new Error('unexpected ' + m[1]);
writeFileSync(f, s.replace('"version": "1.6.1"', '"version": "1.6.2"'));
console.log('after', JSON.parse(readFileSync(f, 'utf8')).version);
