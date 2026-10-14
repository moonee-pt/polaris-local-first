import { readFileSync, writeFileSync } from 'node:fs';
const f = 'package.json';
let s = readFileSync(f, 'utf8');
const m = s.match(/"version":\s*"([^"]+)"/);
if (!m) throw new Error('no version');
console.log('before', m[1]);
if (m[1] === '1.6.0') { console.log('already 1.6.0'); process.exit(0); }
if (m[1] !== '1.5.12') throw new Error('unexpected version ' + m[1]);
s = s.replace('"version": "1.5.12"', '"version": "1.6.0"');
writeFileSync(f, s);
console.log('after', JSON.parse(s).version);
