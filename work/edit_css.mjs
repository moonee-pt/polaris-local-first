import { readFileSync, writeFileSync } from 'node:fs';
const file = 'src/styles/group-world.css';
const CR = '\r\n';
let text = readFileSync(file, 'utf8');
if (!text.endsWith(CR)) text += CR;
const block = [
  '/* Voice: read-aloud button under each message, and the auto-read switch in the header */',
  '.group-voice-toggle.is-on {',
  '  color: var(--accent);',
  '  background: color-mix(in srgb, var(--accent-soft) 34%, transparent);',
  '}',
  '',
  '.group-voice-toggle:disabled {',
  '  opacity: 0.4;',
  '  cursor: default;',
  '  transform: none;',
  '}',
  '',
  '.group-msg-voice-row {',
  '  display: flex;',
  '  margin: 2px 0 0 2px;',
  '}',
  '',
  '.group-msg-voice-btn {',
  '  display: inline-flex;',
  '  align-items: center;',
  '  justify-content: center;',
  '  width: 26px;',
  '  height: 26px;',
  '  border: 0;',
  '  border-radius: 999px;',
  '  background: transparent;',
  '  color: var(--text-muted);',
  '  cursor: pointer;',
  '  transition: background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);',
  '}',
  '',
  '.group-msg-voice-btn:hover,',
  '.group-msg-voice-btn:focus-visible {',
  '  background: color-mix(in srgb, var(--accent-soft) 30%, transparent);',
  '  color: var(--text);',
  '  outline: none;',
  '}',
  '',
  '.group-msg-voice-btn.is-speaking {',
  '  color: var(--accent);',
  '  background: color-mix(in srgb, var(--accent-soft) 36%, transparent);',
  '}',
  '',
  '.group-msg-voice-btn.is-loading {',
  '  color: var(--text-soft);',
  '  cursor: default;',
  '}'
].join(CR);
text += block + CR;
writeFileSync(file, text);
console.log('OK css');
