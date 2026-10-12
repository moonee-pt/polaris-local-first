import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChatMessage, ProviderProfile } from '../../../../types/domain';

const storeMock = vi.hoisted(() => ({ providers: [] as unknown[] }));

vi.mock('../../../../stores/runtimeStore', () => ({
  useRuntimeStore: (selector: (state: { providers: unknown[] }) => unknown) => selector({ providers: storeMock.providers })
}));

import { MessageMeta } from './MessageMeta';

function createAssistantMessage(extra?: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    content: '收到',
    timestamp: 1,
    assistantName: '小助手',
    model: 'Polaris',
    thinkingText: '内部思路',
    ...extra
  };
}

describe('MessageMeta', () => {
  it('hides thinking controls when thinking display is disabled', () => {
    const html = renderToStaticMarkup(
      <MessageMeta
        message={createAssistantMessage()}
        fallbackAssistantName="小助手"
        isThinkingActive={false}
        onOpenThinkingSummary={vi.fn()}
        canOpenThinkingSummary
        showThinking={false}
      />
    );

    expect(html).toContain('小助手');
    expect(html).toContain('Polaris');
    expect(html).not.toContain('thinking-inline-trigger');
    expect(html).not.toContain('思路摘要');
  });

  it('is the only entry point, so a reply without reasoning still gets the trigger', () => {
    const html = renderToStaticMarkup(
      <MessageMeta
        message={createAssistantMessage({ thinkingText: undefined })}
        fallbackAssistantName="小助手"
        isThinkingActive={false}
        onOpenThinkingSummary={vi.fn()}
        canOpenThinkingSummary
      />
    );

    expect(html).toContain('thinking-inline-trigger');
  });

  it('shows both the token total and the converted cost, with a tappable breakdown', () => {
    const provider: ProviderProfile = {
      id: 'provider-priced',
      name: 'Priced',
      protocol: 'openai-completions',
      baseUrl: 'https://api.example.com/v1',
      path: '/chat/completions',
      apiKey: 'sk-test',
      model: 'gpt-5.2',
      capabilities: { images: false, streaming: true, thinking: false },
      pricing: { mode: 'usage', inputPerMillion: 180, outputPerMillion: 180, cachePerMillion: 18, perCall: null }
    };
    storeMock.providers = [provider];

    const html = renderToStaticMarkup(
      <MessageMeta
        message={createAssistantMessage({
          providerId: provider.id,
          tokenCount: 12_480,
          tokenUsage: { inputTokens: 10_000, outputTokens: 5_000, cachedInputTokens: 4_000 }
        })}
        fallbackAssistantName="\u5c0f\u52a9\u624b"
        isThinkingActive={false}
        onOpenThinkingSummary={vi.fn()}
      />
    );

    expect(html).toContain('总用量 12,480 tokens');
    expect(html).toContain('￥2.05');
    expect(html).toContain('message-cost-pill');
    expect(html).toContain('aria-expanded="false"');

    storeMock.providers = [];
  });

  it('hides model details when details are disabled', () => {
    const html = renderToStaticMarkup(
      <MessageMeta
        message={createAssistantMessage()}
        fallbackAssistantName="小助手"
        isThinkingActive={false}
        onOpenThinkingSummary={vi.fn()}
        showDetails={false}
        showThinking={false}
      />
    );

    expect(html).toContain('小助手');
    expect(html).not.toContain('Polaris');
  });
});
