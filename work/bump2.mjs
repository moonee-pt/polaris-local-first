import { readFileSync, writeFileSync } from 'node:fs';
const f = 'package.json';
let s = readFileSync(f, 'utf8');
const m = s.match(/"version":\s*"([^"]+)"/);
if (!m) throw new Error('no version');
console.log('before', m[1]);
if (m[1] === '1.6.1') { console.log('already'); process.exit(0); }
if (m[1] !== '1.6.0') throw new Error('unexpected ' + m[1]);
s = s.replace('"version": "1.6.0"', '"version": "1.6.1"');
writeFileSync(f, s);
console.log('after', JSON.parse(s).version);
