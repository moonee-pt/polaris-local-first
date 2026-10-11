import type { ChatMessage } from '../../../types/domain';
import { buildAssistantCaptionParts, buildAssistantSpeechPlan } from '../chat/message/messageSpeechText';
import type { VoiceCallCaptionSourcePart } from '../../../engines/voice/voiceCallCaption';
import { buildCaptionPartsFromPlan, type VoiceCallSpeechPlan } from '../../../engines/voice/voiceCallSpeechUnits';

export type VoiceCallSpeechTarget = {
  messageId: string;
  plan: VoiceCallSpeechPlan;
  caption: VoiceCallCaptionSourcePart[];
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

    const plan = buildAssistantSpeechPlan(message.content);
    if (plan.units.length === 0) return null;
    const caption = buildAssistantCaptionParts(message.content);
    return {
      messageId: message.id,
      plan,
      caption: caption.length > 0 ? caption : buildCaptionPartsFromPlan(plan)
    };
  }

  return null;
}
