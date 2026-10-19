import { describe, expect, it } from 'vitest';
import { buildAssistantSpeechPlan, buildStreamingVoicePlan } from './messageSpeechText';

describe('buildStreamingVoicePlan', () => {
  it('returns null until the first line closes', () => {
    expect(buildStreamingVoicePlan('（她凑近）【这句话还没有')).toBeNull();
  });

  it('plans only closed lines while the tail is still streaming', () => {
    const plan = buildStreamingVoicePlan('【第一句。】\n（停顿旁白还没写完）\n【第二句的开头');
    expect(plan).not.toBeNull();
    expect(plan!.units.map((unit) => unit.tts)).toEqual(['第一句。']);
  });

  it('grows the plan as more lines close', () => {
    const plan = buildStreamingVoicePlan('【第一句。】\n【第二句。】\n【第三句还');
    expect(plan!.units.map((unit) => unit.tts)).toEqual(['第一句。', '第二句。']);
  });
});

describe('per-line body sound cues', () => {
  it('attaches each line\'s own markers to that line only', () => {
    const plan = buildAssistantSpeechPlan([
      '【[wetplap] 慢一点。】',
      '【[stroke] 这样好吗。】',
      '【休息一下吧。】'
    ].join('\n'));

    expect(plan.units.map((unit) => unit.cues.map((cue) => cue.category))).toEqual([
      ['wetplap'],
      ['stroke'],
      []
    ]);
  });

  it('fires a long line\'s marker once, when the line starts', () => {
    const long = `[wet] ${'这半句已经够长了，一口气说完有点勉强。中间还有一段话，也长得可以这样说。再说一句用来把长度顶过一口气的范围。最后收尾。'}`;
    const plan = buildAssistantSpeechPlan(`【${long}】`);

    expect(plan.units.length).toBeGreaterThan(1);
    expect(plan.units[0].cues.map((cue) => cue.category)).toEqual(['wet']);
    expect(plan.units.slice(1).every((unit) => unit.cues.length === 0)).toBe(true);
  });

  it('attaches markers written in the narration to the line that follows them', () => {
    const plan = buildAssistantSpeechPlan('（[wetplap] 她凑过来）【慢一点。】\n【[stroke] 这样。】');

    expect(plan.units.map((unit) => unit.cues.map((cue) => cue.category))).toEqual([
      ['wetplap'],
      ['stroke']
    ]);
  });

  it('keeps markers after the last line as trailing cues', () => {
    const plan = buildAssistantSpeechPlan('【好。】\n（[wet] 收尾的水声）');

    expect(plan.units[0].cues).toEqual([]);
    expect(plan.trailingCues).toEqual([{ kind: 'loop', category: 'wet', preset: 'mid' }]);
  });

  it('keeps markers while streaming', () => {
    const plan = buildStreamingVoicePlan('【[sp] 啪。】\n【后半句还没');
    expect(plan!.units[0].cues).toEqual([{ kind: 'oneShot', category: 'sp' }]);
  });
});
