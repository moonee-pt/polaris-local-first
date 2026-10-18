import { describe, expect, it } from 'vitest';
import { buildStreamingVoicePlan } from './messageSpeechText';

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
