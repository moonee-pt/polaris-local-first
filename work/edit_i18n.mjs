import { readFileSync, writeFileSync } from 'node:fs';
const CR = '\r\n';
function insert(file, lines) {
  let text = readFileSync(file, 'utf8');
  const anchor = '} as const;';
  const idx = text.lastIndexOf(anchor);
  if (idx < 0) throw new Error('anchor missing in ' + file);
  const head = text.slice(0, idx);
  const tail = text.slice(idx);
  const insertText = lines.join(CR) + CR;
  const headFixed = head.endsWith(CR) ? head : head + CR;
  writeFileSync(file, headFixed + insertText + tail);
  console.log('OK', file);
}
insert('src/i18n/locales/zh-CN/group.ts', [
  "  'group.voice.autoOn': '开启自动朗读',",
  "  'group.voice.autoOff': '关闭自动朗读',",
  "  'group.voice.play': '朗读',",
  "  'group.voice.stop': '停止',",
  "  'group.voice.generating': '生成中',",
  "  'group.voice.playFailed': '播放失败',",
  "  'group.voice.configureFirst': '先去设置里配好语音',",
  "  'group.voice.generateFailed': '语音生成失败',"
]);
insert('src/i18n/locales/en-US/group.ts', [
  "  'group.voice.autoOn': 'Turn on auto-read',",
  "  'group.voice.autoOff': 'Turn off auto-read',",
  "  'group.voice.play': 'Read aloud',",
  "  'group.voice.stop': 'Stop',",
  "  'group.voice.generating': 'Generating',",
  "  'group.voice.playFailed': 'Playback failed',",
  "  'group.voice.configureFirst': 'Set up a voice provider first',",
  "  'group.voice.generateFailed': 'Voice generation failed',"
]);
