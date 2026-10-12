import { describe, expect, it } from 'vitest';
import { buildProgressTitleInstruction } from '../config/prompts/progressTitlePrompt';
import {
  parseAssistantProgressTitle,
  shouldApplyProgressTitleChange
} from './conversationProgressTitleParser';

describe('parseAssistantProgressTitle', () => {
  it('takes the title out of the reply and keeps the spoken text intact', () => {
    const parsed = parseAssistantProgressTitle(
      '今天的风好大。\n<polaris-progress>吵完之后的沉默</polaris-progress>'
    );

    expect(parsed.progressTitle).toBe('吵完之后的沉默');
    expect(parsed.displayContent).toBe('今天的风好大。');
  });

  it('uses the last tag when the model repeats it', () => {
    const parsed = parseAssistantProgressTitle(
      '<polaris-progress>旧进度</polaris-progress>中间的话<polaris-progress>新进度</polaris-progress>'
    );

    expect(parsed.progressTitle).toBe('新进度');
    expect(parsed.displayContent).toBe('中间的话');
  });

  it('hides a tag that is still streaming without a closing bracket', () => {
    const parsed = parseAssistantProgressTitle('好，那就这样。\n<polaris-progress>第三版封面');

    expect(parsed.progressTitle).toBeNull();
    expect(parsed.displayContent).toBe('好，那就这样。');
  });

  it('returns no title for a plain reply', () => {
    const parsed = parseAssistantProgressTitle('普通的一句话。');

    expect(parsed.progressTitle).toBeNull();
    expect(parsed.displayContent).toBe('普通的一句话。');
  });

  it('collapses whitespace and caps an over-long title', () => {
    const parsed = parseAssistantProgressTitle(
      `<polaris-progress>  很长  ${'很长'.repeat(12)}  </polaris-progress>`
    );

    expect(parsed.progressTitle).toHaveLength(24);
  });
});

describe('shouldApplyProgressTitleChange', () => {
  it('takes the first title the model offers', () => {
    expect(shouldApplyProgressTitleChange({ userRoundCount: 1, lastAppliedRound: null })).toBe(true);
  });

  it('applies a new title the model writes on the next round', () => {
    expect(shouldApplyProgressTitleChange({ userRoundCount: 6, lastAppliedRound: 5 })).toBe(true);
    expect(shouldApplyProgressTitleChange({ userRoundCount: 5, lastAppliedRound: 5 })).toBe(false);
  });
});

describe('buildProgressTitleInstruction', () => {
  it('tells the model the current title so it can keep or change it', () => {
    const instruction = buildProgressTitleInstruction('第三版封面定稿');

    expect(instruction).toContain('现在的进度标题是「第三版封面定稿」');
    expect(instruction).toContain('一字不差地重复它');
    expect(instruction).toContain('用户让你改标题');
  });

  it('says this is the first title when there is none yet', () => {
    expect(buildProgressTitleInstruction(undefined)).toContain('第一次起标题');
  });
});
