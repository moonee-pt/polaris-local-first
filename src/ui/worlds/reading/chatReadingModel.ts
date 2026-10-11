import type { ChatMessage, ChatMessageVoiceCache } from '../../../types/domain';
import { splitVoiceCallCaptions, type VoiceCallCaptionSegment } from '../../../engines/voice/voiceCallCaption';
import { buildAssistantCaptionParts, getAssistantAmbiencePlan } from '../chat/message/messageSpeechText';
import type { TimedAmbienceCue } from '../../../engines/voice/ambienceTimeline';

/**
 * One message rendered as part of the reading page. Assistant replies keep the same
 * speech/stage split the call caption uses, so the highlight follows the voice.
 */
export type ReadingBlock = {
  messageId: string;
  role: 'user' | 'assistant';
  segments: VoiceCallCaptionSegment[];
  voiceCache: ChatMessageVoiceCache | null;
  voicable: boolean;
  /** Body-sound cues this reply asks for, timed against the clip it plays under. */
  ambience: TimedAmbienceCue[];
  ambienceSec: number;
};

export function buildReadingBlocks(messages: ChatMessage[]): ReadingBlock[] {
  const blocks: ReadingBlock[] = [];
  for (const message of messages) {
    if (message.toolInvocation) continue;
    if (message.role !== 'user' && message.role !== 'assistant') continue;
    const raw = message.content?.trim();
    if (!raw) continue;
    const segments = message.role === 'assistant'
      ? splitVoiceCallCaptions(buildAssistantCaptionParts(raw))
      : splitVoiceCallCaptions([{ kind: 'speech', text: raw }]);
    if (segments.length === 0) continue;
    const voiceCache = message.voiceCache ?? null;
    const ambiencePlan = message.role === 'assistant' ? getAssistantAmbiencePlan(raw) : null;
    blocks.push({
      messageId: message.id,
      role: message.role,
      segments,
      voiceCache,
      voicable: message.role === 'assistant' && Boolean(voiceCache?.assetId),
      ambience: ambiencePlan?.cues ?? [],
      ambienceSec: ambiencePlan?.estimatedSec ?? 0
    });
  }
  return blocks;
}

export type ReadingCursor = { segmentIndex: number; readChars: number };

/** Maps audio progress onto the sentence that is being read right now. */
export function resolveReadingCursor(segments: VoiceCallCaptionSegment[], progress: number): ReadingCursor {
  if (segments.length === 0) return { segmentIndex: -1, readChars: 0 };
  if (!Number.isFinite(progress) || progress <= 0) return { segmentIndex: -1, readChars: 0 };

  const totalWeight = segments.reduce((sum, segment) => sum + segment.weight, 0);
  let remaining = totalWeight * Math.min(1, progress);

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (remaining >= segment.weight) {
      remaining -= segment.weight;
      continue;
    }
    const charCount = Array.from(segment.text).length;
    return { segmentIndex: index, readChars: Math.min(charCount, Math.max(0, Math.floor(remaining))) };
  }

  return { segmentIndex: -1, readChars: 0 };
}
