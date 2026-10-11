import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChatMessage } from '../../../../types/domain';
import { ThinkingSheet } from './ThinkingSheet';

function sheetMarkup(message: ChatMessage) {
  return renderToStaticMarkup(
    <ThinkingSheet message={message} messages={[message]} assistantName="她" onClose={() => {}} />
  );
}

function assistantMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return { id: 'm1', role: 'assistant', content: '', timestamp: 0, ...overrides };
}

describe('thinking sheet voice section', () => {
  it('opens straight onto the engine text when the reply carries no model reasoning', () => {
    const markup = sheetMarkup(assistantMessage({
      content: '"别动……[breathy] 我还没结束。"\n\n（他把她按进枕头里[wet:hard]）'
    }));
    expect(markup).toContain('thinking-summary-voice-tts');
    expect(markup).toContain('别动……[breathy] 我还没结束。');
    expect(markup).toContain('水声 · 重 · 循环');
    expect(markup).not.toContain('他把她按进枕头里');
    expect(markup).not.toContain('thinking-summary-step');
  });

  it('shows no labels and no empty track row', () => {
    const markup = sheetMarkup(assistantMessage({ content: '"我在这儿。"' }));
    expect(markup).toContain('我在这儿。');
    expect(markup).not.toContain('thinking-summary-voice-track');
    expect(markup).not.toContain('送给语音的原文');
    expect(markup).not.toContain('背景音轨');
    expect(markup).not.toContain('thinking-summary-raw-toggle');
  });

  it('keeps the reasoning steps when the model did think', () => {
    const markup = sheetMarkup(assistantMessage({ content: '"好。"', thinkingText: '她在想要不要答应' }));
    expect(markup).toContain('thinking-summary-step');
    expect(markup).toContain('thinking-summary-voice-tts');
    expect(markup.indexOf('thinking-summary-voice')).toBeLessThan(markup.indexOf('thinking-summary-list'));
  });

  it('renders nothing when there is neither reasoning nor voice content', () => {
    expect(sheetMarkup(assistantMessage({ content: '   ' }))).toBe('');
  });
});
