import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../../types/domain';
import { resolveVoiceCallSpeechTarget } from './voiceCallSpeechTarget';

function assistantMessage(id: string, content: string, timestamp: number, extra?: Partial<ChatMessage>): ChatMessage {
  return { id, role: 'assistant', content, timestamp, ...extra };
}

function baseArgs(messages: ChatMessage[], overrides: Partial<Parameters<typeof resolveVoiceCallSpeechTarget>[0]> = {}) {
  return {
    messages,
    startedAt: 1_000,
    muted: false,
    busy: false,
    sending: false,
    hasSpoken: () => false,
    isStreamingMessage: () => false,
    ...overrides
  };
}

describe('resolveVoiceCallSpeechTarget', () => {
  it('picks up a reply written during the call', () => {
    const target = resolveVoiceCallSpeechTarget(baseArgs([
      { id: 'u1', role: 'user', content: '在吗', timestamp: 1_100 },
      assistantMessage('a1', '我在。', 1_200)
    ]));

    expect(target).toEqual({ messageId: 'a1', content: '我在。', streaming: false });
  });

  it('ignores replies that existed before the call started', () => {
    const target = resolveVoiceCallSpeechTarget(baseArgs([
      assistantMessage('a0', '早些时候说的。', 900)
    ]));

    expect(target).toBeNull();
  });

  it('stays quiet while muted, busy, or still sending', () => {
    const messages = [assistantMessage('a1', '我在。', 1_200)];

    expect(resolveVoiceCallSpeechTarget(baseArgs(messages, { muted: true }))).toBeNull();
    expect(resolveVoiceCallSpeechTarget(baseArgs(messages, { busy: true }))).toBeNull();
    expect(resolveVoiceCallSpeechTarget(baseArgs(messages, { sending: true }))).toBeNull();
  });

  it('does not repeat a reply it already spoke', () => {
    const target = resolveVoiceCallSpeechTarget(baseArgs(
      [assistantMessage('a1', '我在。', 1_200)],
      { hasSpoken: (messageId) => messageId === 'a1' }
    ));

    expect(target).toBeNull();
  });

  it('waits until the newest message is an assistant reply', () => {
    const target = resolveVoiceCallSpeechTarget(baseArgs([
      assistantMessage('a1', '我在。', 1_200),
      { id: 'u2', role: 'user', content: '那你说', timestamp: 1_300 }
    ]));

    expect(target).toBeNull();
  });

  it('skips tool runtime messages instead of stopping at them', () => {
    const target = resolveVoiceCallSpeechTarget(baseArgs([
      { id: 't1', role: 'system', content: '', timestamp: 1_300, toolInvocation: { id: 'x' } as never }
    ]));

    expect(target).toBeNull();
  });

  it('starts a streaming reply as soon as one line closes', () => {
    const target = resolveVoiceCallSpeechTarget(baseArgs(
      [assistantMessage('a1', '【第一句。】\n【第二句还', 1_200)],
      { isStreamingMessage: (messageId) => messageId === 'a1' }
    ));

    expect(target).toEqual({ messageId: 'a1', content: '【第一句。】\n【第二句还', streaming: true });
  });

  it('waits for the first closed line before starting a streaming reply', () => {
    const target = resolveVoiceCallSpeechTarget(baseArgs(
      [assistantMessage('a1', '【第一句还没写完', 1_200)],
      { isStreamingMessage: (messageId) => messageId === 'a1' }
    ));

    expect(target).toBeNull();
  });

  it('skips a settled reply that has no words to say', () => {
    const target = resolveVoiceCallSpeechTarget(baseArgs([
      assistantMessage('a1', '（只是旁白。）', 1_200)
    ]));

    expect(target).toBeNull();
  });
});
