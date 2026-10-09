import type { ChatMessage } from '../../../types/domain';
import { buildAssistantSpeechText } from '../chat/message/messageSpeechText';

export type VoiceCallSpeechTarget = {
  messageId: string;
  speechText: string;
};

type ResolveVoiceCallSpeechTargetArgs = {
  messages: ChatMessage[];
  startedAt: number;
  muted: boolean;
  busy: boolean;
  generating: boolean;
  hasSpoken: (messageId: string) => boolean;
};

/**
 * Decides whether the call should start saying a newly arrived reply.
 *
 * Only the newest settled assistant message counts, and only when it was written
 * during this call, nothing else is playing, and the reply is not still streaming.
 */
export function resolveVoiceCallSpeechTarget({
  messages,
  startedAt,
  muted,
  busy,
  generating,
  hasSpoken
}: ResolveVoiceCallSpeechTargetArgs): VoiceCallSpeechTarget | null {
  if (muted || busy || generating) return null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.toolInvocation) continue;
    if (message.role !== 'assistant') return null;
    if (!message.content.trim()) return null;
    if (message.timestamp < startedAt) return null;
    if (hasSpoken(message.id)) return null;

    const speechText = buildAssistantSpeechText(message.content);
    if (!speechText) return null;
    return { messageId: message.id, speechText };
  }

  return null;
}
