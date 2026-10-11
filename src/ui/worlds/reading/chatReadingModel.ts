import type { ChatMessage, ChatMessageVoiceCache } from '../../../types/domain';
import {
  splitVoiceCallCaptions,
  type VoiceCallCaptionKind,
  type VoiceCallCaptionSegment
} from '../../../engines/voice/voiceCallCaption';
import { buildAssistantCaptionParts, getAssistantAmbiencePlan } from '../chat/message/messageSpeechText';
import type { TimedAmbienceCue } from '../../../engines/voice/ambienceTimeline';

/** One row of the reading page: a spoken sentence, or the stage direction beside it. */
export type ReadingLine = {
  kind: VoiceCallCaptionKind;
  text: string;
  /** Caption segments this row covers, in audio order. */
  segmentIndices: number[];
};

/**
 * One message rendered as part of the reading page. Assistant replies keep the same
 * speech/stage split the call caption uses, so the highlight follows the voice.
 */
export type ReadingBlock = {
  messageId: string;
  role: 'user' | 'assistant';
  segments: VoiceCallCaptionSegment[];
  lines: ReadingLine[];
  /** Caption segment index -> the row it is drawn on. */
  lineOfSegment: number[];
  voiceCache: ChatMessageVoiceCache | null;
  voicable: boolean;
  /** Body-sound cues this reply asks for, timed against the clip it plays under. */
  ambience: TimedAmbienceCue[];
  ambienceSec: number;
};

const LINE_END_CHARS = '。！？!?…；;';

/**
 * Groups caption segments into the rows the page shows. A row ends where the chat puts a
 * line: a sentence finishes, the writer starts a new line, or the voice stops being
 * speech and turns into a stage direction. Commas never split a row.
 */
export function buildReadingLines(segments: VoiceCallCaptionSegment[]) {
  const lines: ReadingLine[] = [];
  const lineOfSegment: number[] = [];
  let previousKind: VoiceCallCaptionKind | null = null;
  let previousEndedLine = false;

  segments.forEach((segment, index) => {
    const hadBreak = segment.text.includes('\n');
    const text = segment.text.replace(/\n+/g, '').trim();
    if (!text) {
      previousEndedLine = true;
      lineOfSegment[index] = lines.length - 1;
      return;
    }

    const startsLine = lines.length === 0
      || previousKind !== segment.kind
      || previousEndedLine
      || hadBreak;
    const line = startsLine
      ? { kind: segment.kind, text: '', segmentIndices: [] }
      : lines[lines.length - 1];

    if (startsLine) lines.push(line);
    line.text += text;
    line.segmentIndices.push(index);
    lineOfSegment[index] = lines.length - 1;

    previousKind = segment.kind;
    previousEndedLine = LINE_END_CHARS.includes(text.slice(-1));
  });

  return { lines, lineOfSegment };
}

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
    const { lines, lineOfSegment } = buildReadingLines(segments);
    const voiceCache = message.voiceCache ?? null;
    const ambiencePlan = message.role === 'assistant' ? getAssistantAmbiencePlan(raw) : null;
    blocks.push({
      messageId: message.id,
      role: message.role,
      segments,
      lines,
      lineOfSegment,
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
  if (progress >= 1) return { segmentIndex: segments.length - 1, readChars: 0 };

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

  return { segmentIndex: segments.length - 1, readChars: 0 };
}