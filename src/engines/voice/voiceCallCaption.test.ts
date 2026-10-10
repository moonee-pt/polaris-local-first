import { describe, expect, it } from 'vitest';
import {
  buildVoiceCallCaptionText,
  resolveVoiceCallVisibleParts,
  splitVoiceCallCaptions
} from './voiceCallCaption';

describe('splitVoiceCallCaptions', () => {
  it('returns nothing for empty or whitespace text', () => {
    expect(splitVoiceCallCaptions('')).toEqual([]);
    expect(splitVoiceCallCaptions([{ kind: 'speech', text: '   \n  ' }])).toEqual([]);
  });

  it('keeps the original text intact after splitting', () => {
    const text = '嗯哼，坏透了。And you love it.\n膝盖落地那一声，我要在电话里听见。';
    expect(buildVoiceCallCaptionText(splitVoiceCallCaptions(text))).toBe(text.trim());
  });

  it('gives sentences more weight than clauses', () => {
    const segments = splitVoiceCallCaptions('先说话，再停顿。收尾。');
    const lastOfFirstSentence = segments.find((segment) => segment.text === '再停顿。');
    const lastOfSecondSentence = segments.find((segment) => segment.text === '收尾。');
    const clause = segments.find((segment) => segment.text === '先说话，');

    expect(clause?.weight).toBe(6);
    expect(lastOfFirstSentence?.weight).toBe(9);
    expect(lastOfSecondSentence?.weight).toBe(8);
  });

  it('marks stage directions so the caption can render them differently', () => {
    const segments = splitVoiceCallCaptions([
      { kind: 'speech', text: '你听。' },
      { kind: 'stage', text: '（他没接话）' }
    ]);

    expect(segments.map((segment) => segment.kind)).toEqual(['speech', 'stage']);
    expect(segments[1]?.text).toBe('（他没接话）');
  });
});

describe('resolveVoiceCallVisibleParts', () => {
  const text = '你好啊，很久没见了。今天想聊点什么？';
  const segments = splitVoiceCallCaptions(text);

  it('reveals nothing at the start and everything at the end', () => {
    expect(resolveVoiceCallVisibleParts(segments, 0)).toEqual([]);
    expect(buildVoiceCallCaptionText(segments)).toBe(text);
    expect(resolveVoiceCallVisibleParts(segments, 1).map((part) => part.text).join('')).toBe(text);
    expect(resolveVoiceCallVisibleParts(segments, 4).map((part) => part.text).join('')).toBe(text);
  });

  it('never reveals text out of order', () => {
    let previous = '';
    for (let step = 0; step <= 10; step += 1) {
      const current = resolveVoiceCallVisibleParts(segments, step / 10).map((part) => part.text).join('');
      expect(text.startsWith(current)).toBe(true);
      expect(current.length).toBeGreaterThanOrEqual(previous.length);
      previous = current;
    }
  });

  it('keeps speech and stage parts separate', () => {
    const mixed = splitVoiceCallCaptions([
      { kind: 'speech', text: '第一句。第二句。' },
      { kind: 'stage', text: '（他顿了一下）' },
      { kind: 'speech', text: '第三句。' }
    ]);

    const full = resolveVoiceCallVisibleParts(mixed, 1);
    expect(full.map((part) => part.kind)).toEqual(['speech', 'stage', 'speech']);
    expect(full.map((part) => part.text)).toEqual(['第一句。第二句。', '（他顿了一下）', '第三句。']);
  });

  it('falls back to nothing when progress is not a number', () => {
    expect(resolveVoiceCallVisibleParts(segments, Number.NaN)).toEqual([]);
    expect(resolveVoiceCallVisibleParts([], 0.5)).toEqual([]);
  });
});
