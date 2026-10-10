import { describe, expect, it } from 'vitest';
import { buildAssistantCaptionParts, buildAssistantSpeechText } from './messageSpeechText';

describe('buildAssistantSpeechText', () => {
  it('keeps assistant prose while removing tool draft windows', () => {
    const speechText = buildAssistantSpeechText([
      '我把界面入口拆开了。',
      '',
      '```polaris-tools',
      '{"actions":[{"kind":"patchRawCss","css":".system-inline-note{color:red}"}]}',
      '```',
      '',
      '现在语音会走单独面板。'
    ].join('\n'));

    expect(speechText).toBe('我把界面入口拆开了。\n现在语音会走单独面板。');
    expect(speechText).not.toContain('polaris-tools');
    expect(speechText).not.toContain('patchRawCss');
    expect(speechText).not.toContain('system-inline-note');
  });

  it('removes code blocks and leaves only readable body text', () => {
    const speechText = buildAssistantSpeechText([
      '这里真正要听的是这句。',
      '',
      '```tsx',
      '<SystemWindow title="debug">不要朗读这个</SystemWindow>',
      '```',
      '',
      '这句也应该留下。'
    ].join('\n'));

    expect(speechText).toBe('这里真正要听的是这句。\n这句也应该留下。');
    expect(speechText).not.toContain('SystemWindow');
    expect(speechText).not.toContain('不要朗读这个');
  });

  it('normalizes markdown chrome before speech playback', () => {
    const speechText = buildAssistantSpeechText([
      '### 结论',
      '- **只读正文**',
      '- 看这个 [设置项](https://example.test/settings)',
      '> 不读引用壳'
    ].join('\n'));

    expect(speechText).toBe('结论\n只读正文\n看这个 设置项\n不读引用壳');
  });

  it('returns empty text for tool-only replies', () => {
    expect(buildAssistantSpeechText([
      '```polaris-tools',
      '{"actions":[{"kind":"startTask","title":"整理"}]}',
      '```'
    ].join('\n'))).toBe('');
  });
});

describe('buildAssistantCaptionParts', () => {
  it('drops delivery cues from the caption but keeps them for the voice', () => {
    const content = '【唔……[whispering] 是谁教你的。】';

    expect(buildAssistantSpeechText(content)).toContain('[whispering]');
    expect(buildAssistantCaptionParts(content)).toEqual([{ kind: 'speech', text: '唔……是谁教你的。' }]);
  });

  it('shows the stage direction the voice skips instead of a run of ellipses', () => {
    const content = [
      '【先说这一句。】',
      '（他停了很久，才把视线挪开）',
      '【再说一遍试试。】'
    ].join('\n');

    expect(buildAssistantSpeechText(content)).toContain('……');
    expect(buildAssistantCaptionParts(content)).toEqual([
      { kind: 'speech', text: '先说这一句。' },
      { kind: 'stage', text: '（他停了很久，才把视线挪开）' },
      { kind: 'speech', text: '再说一遍试试。' }
    ]);
  });

  it('wraps bare stage text so it reads as narration', () => {
    expect(buildAssistantCaptionParts('【进来吧。】\n门外雨声很大')).toEqual([
      { kind: 'speech', text: '进来吧。' },
      { kind: 'stage', text: '（门外雨声很大）' }
    ]);
  });

  it('splits narration away from dialogue when the reply never used brackets', () => {
    expect(buildAssistantCaptionParts('他笑了笑。（把外套递过去）穿上吧。')).toEqual([
      { kind: 'speech', text: '他笑了笑。' },
      { kind: 'stage', text: '（把外套递过去）' },
      { kind: 'speech', text: '穿上吧。' }
    ]);
  });
});
