import { describe, expect, it } from 'vitest';
import {
  buildVoiceCallCaptionText,
  resolveVoiceCallVisibleText,
  splitVoiceCallCaptions
} from './voiceCallCaption';

describe('splitVoiceCallCaptions', () => {
  it('returns nothing for empty or whitespace text', () => {
    expect(splitVoiceCallCaptions('')).toEqual([]);
    expect(splitVoiceCallCaptions('   \n  ')).toEqual([]);
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
});

describe('resolveVoiceCallVisibleText', () => {
  const text = '你好啊，很久没见了。今天想聊点什么？';
  const segments = splitVoiceCallCaptions(text);

  it('reveals nothing at the start and everything at the end', () => {
    expect(resolveVoiceCallVisibleText(segments, 0)).toBe('');
    expect(resolveVoiceCallVisibleText(segments, 1)).toBe(text);
    expect(resolveVoiceCallVisibleText(segments, 4)).toBe(text);
  });

  it('never reveals text out of order', () => {
    let previous = '';
    for (let step = 0; step <= 10; step += 1) {
      const current = resolveVoiceCallVisibleText(segments, step / 10);
      expect(text.startsWith(current)).toBe(true);
      expect(current.length).toBeGreaterThanOrEqual(previous.length);
      previous = current;
    }
  });

  it('falls back to empty text when progress is not a number', () => {
    expect(resolveVoiceCallVisibleText(segments, Number.NaN)).toBe('');
    expect(resolveVoiceCallVisibleText([], 0.5)).toBe('');
  });
});
