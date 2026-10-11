import { describe, expect, it } from 'vitest';
import { resolveVoiceCallVisibleParts } from './voiceCallCaption';
import {
  buildWholeClipPlan,
  createVoiceCallSpeechPlan,
  createVoiceCallSpeechUnit,
  estimateSpeechSeconds
} from './voiceCallSpeechUnits';

describe('createVoiceCallSpeechUnit', () => {
  it('holds the narration weight apart from the words', () => {
    const unit = createVoiceCallSpeechUnit({
      tts: '过来。',
      caption: '过来。',
      narration: ['（他拍了拍身边的位置）'],
      pauseBeforeMs: 700
    });

    expect(unit?.segments.map((segment) => segment.kind)).toEqual(['stage', 'speech']);
    expect(unit?.stageWeight).toBe(unit?.segments[0].weight);
    expect(unit?.weight).toBeGreaterThan(unit?.stageWeight ?? 0);
  });

  it('breaks the caption between two spoken lines with no narration between them', () => {
    const unit = createVoiceCallSpeechUnit({
      tts: '早点睡吧。',
      caption: '早点睡吧。',
      pauseBeforeMs: 400,
      continuesPreviousLine: true
    });

    expect(unit?.segments[0]).toMatchObject({ kind: 'speech', text: '\n' });
    expect(unit?.stageWeight).toBe(0);
  });
});

describe('createVoiceCallSpeechPlan', () => {
  it('adds the unit weights up so caption progress can be read off them', () => {
    const units = ['第一句。', '第二句。'].map((text, index) =>
      createVoiceCallSpeechUnit({ tts: text, caption: text, pauseBeforeMs: index === 0 ? 0 : 400 })
    ).filter((unit): unit is NonNullable<typeof unit> => Boolean(unit));
    const plan = createVoiceCallSpeechPlan(units);

    expect(plan.totalWeight).toBe(units.reduce((sum, unit) => sum + unit.weight, 0));
  });
});

describe('buildWholeClipPlan', () => {
  it('treats one cached take of the whole reply as a single unit', () => {
    const plan = buildWholeClipPlan([
      { kind: 'speech', text: '先说这一句。' },
      { kind: 'stage', text: '（他停了停）' },
      { kind: 'speech', text: '再说一遍试试。' }
    ]);

    expect(plan.units).toHaveLength(1);
    expect(plan.units[0].pauseBeforeMs).toBe(0);
    // The narration is silent inside this clip, so the audio clock has to carry it.
    expect(plan.units[0].stageWeight).toBe(0);
    expect(plan.totalWeight).toBeGreaterThan(0);
  });

  it('returns nothing for a reply with no words', () => {
    expect(buildWholeClipPlan([]).units).toEqual([]);
  });
});

describe('estimateSpeechSeconds', () => {
  it('ignores delivery cues when guessing how long a line takes', () => {
    expect(estimateSpeechSeconds('[long-break]')).toBeLessThanOrEqual(estimateSpeechSeconds('这是一句要说的话。'));
  });
});

describe('caption progress across a line-by-line plan', () => {
  it('has only the first line on screen when the first clip ends', () => {
    const plan = createVoiceCallSpeechPlan([
      createVoiceCallSpeechUnit({ tts: '今天好累。', caption: '今天好累。', pauseBeforeMs: 0 }),
      createVoiceCallSpeechUnit({
        tts: '早点睡吧。',
        caption: '早点睡吧。',
        pauseBeforeMs: 400,
        continuesPreviousLine: true
      })
    ].filter((unit): unit is NonNullable<typeof unit> => Boolean(unit)));
    const segments = plan.units.flatMap((unit) => unit.segments);
    const firstLineWeight = plan.units[0].weight;

    const afterFirstClip = resolveVoiceCallVisibleParts(segments, firstLineWeight / plan.totalWeight);
    expect(afterFirstClip.map((part) => part.text).join('')).toContain('今天好累。');
    expect(afterFirstClip.map((part) => part.text).join('')).not.toContain('早点睡吧');

    const halfwayThroughSecondLine = resolveVoiceCallVisibleParts(
      segments,
      (firstLineWeight + 1 + (plan.units[1].weight - 1) / 2) / plan.totalWeight
    );
    expect(halfwayThroughSecondLine.map((part) => part.text).join('')).toContain('早点');

    expect(resolveVoiceCallVisibleParts(segments, 1)).toEqual([
      { kind: 'speech', text: '今天好累。\n早点睡吧。' }
    ]);
  });
});
