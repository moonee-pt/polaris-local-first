import type { ChatMessage } from '../../../types/domain';
import { buildAssistantSpeechPlan, buildStreamingVoicePlan } from '../chat/message/messageSpeechText';

export type VoiceCallSpeechTarget = {
  messageId: string;
  content: string;
  /** Reply is still streaming: speak only the lines that closed and keep feeding the rest. */
  streaming: boolean;
};

type ResolveVoiceCallSpeechTargetArgs = {
  messages: ChatMessage[];
  startedAt: number;
  muted: boolean;
  busy: boolean;
  sending: boolean;
  hasSpoken: (messageId: string) => boolean;
  isStreamingMessage: (messageId: string) => boolean;
};

/**
 * Decides whether the call should start saying a newly arrived reply.
 *
 * Only the newest assistant message counts, and only when it was written during this
 * call and nothing else is playing. While it is still streaming the call starts as soon
 * as one line has closed; a settled reply starts as soon as it has any words at all.
 */
export function resolveVoiceCallSpeechTarget({
  messages,
  startedAt,
  muted,
  busy,
  sending,
  hasSpoken,
  isStreamingMessage
}: ResolveVoiceCallSpeechTargetArgs): VoiceCallSpeechTarget | null {
  if (muted || busy || sending) return null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.toolInvocation) continue;
    if (message.role !== 'assistant') return null;
    if (!message.content.trim()) return null;
    if (message.timestamp < startedAt) return null;
    if (hasSpoken(message.id)) return null;

    const streaming = isStreamingMessage(message.id);
    if (streaming) {
      const plan = buildStreamingVoicePlan(message.content);
      if (!plan || plan.units.length === 0) return null;
    } else if (buildAssistantSpeechPlan(message.content).units.length === 0) {
      return null;
    }
    return { messageId: message.id, content: message.content, streaming };
  }

  return null;
}
