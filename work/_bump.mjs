import { spawnSync } from 'node:child_process';
const exe = 'C:\\Users\\Administrator\\AppData\\Local\\OpenAI\\Codex\\bin\\2e5e00daee91c61d\\codex.exe';
const patch = [
  '*** Begin Patch',
  '*** Update File: package.json',
  '@@',
  '-  "version": "1.10.6",',
  '+  "version": "1.10.7",',
  '*** End Patch',
  ''
].join('\n');
const r = spawnSync(exe, ['--codex-run-as-apply-patch', patch], { stdio: 'inherit' });
console.log('status', r.status, 'err', r.error ? String(r.error) : 'none');
