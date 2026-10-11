import { describe, expect, it } from 'vitest';
import { buildAssistantCaptionParts, buildAssistantSpeechText, getAssistantAmbiencePlan } from './messageSpeechText';

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

    expect(buildAssistantSpeechText(content)).toContain('[long-break]');
    expect(buildAssistantSpeechText(content)).not.toContain('……');
    expect(buildAssistantCaptionParts(content)).toEqual([
      { kind: 'speech', text: '先说这一句。' },
      { kind: 'stage', text: '（他停了很久，才把视线挪开）' },
      { kind: 'speech', text: '再说一遍试试。' }
    ]);
  });

  it('sends the engine spelling of the pause cues the reply writes', () => {
    expect(buildAssistantSpeechText('【等我一下。】[pause] 【我回来了。】')).toBe('等我一下。[break]我回来了。');
    expect(buildAssistantSpeechText('【等我一下。】[long pause] 【我回来了。】')).toBe('等我一下。[long-break]我回来了。');
  });

  it('keeps two spoken lines written back to back as two lines', () => {
    expect(buildAssistantSpeechText('【今天好累。】【早点睡吧。】')).toBe('今天好累。\n早点睡吧。');
    expect(buildAssistantCaptionParts('【今天好累。】【早点睡吧。】')).toEqual([
      { kind: 'speech', text: '今天好累。\n早点睡吧。' }
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

describe('getAssistantAmbiencePlan', () => {
  it('switches the track where the reply rewrites the cue', () => {
    const plan = getAssistantAmbiencePlan([
      '【慢一点。】',
      '（她慢慢摇 [wetplap:soft]）',
      '【别停。】',
      '（更快了 [wetplap:hard]）',
      '【就这样。】'
    ].join('\n'));

    expect(plan.cues).toMatchObject([
      { kind: 'loop', preset: 'soft' },
      { kind: 'loop', preset: 'hard' }
    ]);
    expect(plan.cues[0].atRatio).toBeLessThan(0.5);
    expect(plan.cues[1].atRatio).toBeGreaterThan(0.5);
  });

  it('keeps cues that are written inside the spoken line', () => {
    const plan = getAssistantAmbiencePlan('【嗯 [wet] 别躲。】');
    expect(plan.cues).toHaveLength(1);
    expect(plan.cues[0]).toMatchObject({ kind: 'loop', category: 'wet' });
  });

  it('starts a cue written after the last line where the voice stops', () => {
    const plan = getAssistantAmbiencePlan('【先到这里。】\n（水声一直响到 [wet]）');
    expect(plan.cues).toHaveLength(1);
    expect(plan.cues[0].atRatio).toBeGreaterThan(0.2);
  });

  it('runs the timeline on spoken lines only', () => {
    const plan = getAssistantAmbiencePlan('前言（不念的旁白 [wetplap]）【进来。】');
    expect(plan.cues).toHaveLength(1);
    // A single cue in the leading narration lands at the middle of that segment.
    expect(plan.cues[0].atRatio).toBeLessThan(0.5);
  });
});
