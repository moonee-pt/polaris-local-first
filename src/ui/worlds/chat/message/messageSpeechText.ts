import { TOOL_DRAFT_BLOCK_PATTERN } from '../../../../app/chat/chatMarkdownPatterns';
import { stripCodeBlocksFromMessage } from '../../../../engines/codeCardEngine';
import { buildAmbiencePlan, type AmbiencePlan } from '../../../../engines/voice/ambienceTimeline';
import { readFleshCues, selectAmbienceCues, stripFleshCues, type FleshCue } from '../../../../engines/voice/fleshAmbience';
import { normalizePauseTagsForEngine, stripCrowdLaughterTags, stripPerformanceTags } from '../../../../engines/voice/performanceTags';
import {
  VOICE_CALL_LINE_GAP_MS,
  VOICE_CALL_PAUSE_MS,
  createVoiceCallSpeechPlan,
  createVoiceCallSpeechUnit,
  type VoiceCallSpeechPlan,
  type VoiceCallSpeechUnit
} from '../../../../engines/voice/voiceCallSpeechUnits';
import type { VoiceCallCaptionSourcePart } from '../../../../engines/voice/voiceCallCaption';

type SpeechSegment = { kind: 'speech' | 'stage'; text: string };

/** What the call caption shows: the line spoken out loud, or the stage direction around it. */
export type AssistantCaptionPart = VoiceCallCaptionSourcePart;

/** 【】 marks what is said out loud; this is what call mode asks the model to write. */
const CALL_SPEECH_PAIRS: Array<[string, string]> = [['【', '】']];

const QUOTE_PAIRS: Array<[string, string]> = [
  ['「', '」'],
  ['『', '』'],
  ['“', '”'],
  ['"', '"']
];

function stripToolDraftBlocks(content: string) {
  return content
    .replace(TOOL_DRAFT_BLOCK_PATTERN, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripMarkdownForSpeech(content: string) {
  return content
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[ \t]*[-*+]\s+/gm, '')
    .replace(/^[ \t]*\d+[.)]\s+/gm, '')
    .replace(/[*_~]{1,3}/g, '');
}

function normalizeSpeechWhitespace(content: string) {
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Splits a reply into spoken lines (inside quotation marks) and everything else
 * (stage directions: actions, expressions, inner thoughts). Only spoken lines are
 * handed to the speech engine; the rest is dropped.
 */
function splitSpeechSegments(content: string, pairs: Array<[string, string]>): SpeechSegment[] {
  const segments: SpeechSegment[] = [];
  let cursor = 0;
  while (cursor < content.length) {
    let open: { start: number; opener: string; closer: string } | null = null;
    for (const [opener, closer] of pairs) {
      const start = content.indexOf(opener, cursor);
      if (start !== -1 && (open === null || start < open.start)) open = { start, opener, closer };
    }
    if (!open) break;
    const end = content.indexOf(open.closer, open.start + open.opener.length);
    if (end === -1) break;
    if (open.start > cursor) segments.push({ kind: 'stage', text: content.slice(cursor, open.start) });
    segments.push({ kind: 'speech', text: content.slice(open.start + open.opener.length, end) });
    cursor = end + open.closer.length;
  }
  if (cursor < content.length) segments.push({ kind: 'stage', text: content.slice(cursor) });
  return segments;
}

/** Silence between two spoken lines. Ellipsis would be voiced as a breath, so ask for a pause. */
function pauseForGap(gap: string) {
  const length = gap.replace(/\s+/g, '').length;
  if (length >= 30) return '[long-break] [long-break]';
  if (length >= 10) return '[long-break]';
  return '[break]';
}

function joinSpokenSegments(segments: SpeechSegment[]) {
  const parts: string[] = [];
  let lastWasSpeech = false;
  segments.forEach((segment, index) => {
    if (segment.kind === 'speech') {
      const line = segment.text.trim();
      if (!line) return;
      // Two spoken lines written back to back are still two lines: the voice has to stop
      // between them instead of running the words into one sentence.
      if (lastWasSpeech) parts.push('\n');
      parts.push(line);
      lastWasSpeech = true;
      return;
    }
    if (parts.length === 0 || !segment.text.trim()) return;
    const hasLaterSpeech = segments.slice(index + 1).some((item) => item.kind === 'speech' && item.text.trim());
    if (!hasLaterSpeech) return;
    parts.push(pauseForGap(segment.text));
    lastWasSpeech = false;
  });
  return parts.join('');
}

/** How long the voice goes quiet for a piece of narration of this length. */
function pauseMsForGap(gap: string) {
  const length = gap.replace(/\s+/g, '').length;
  if (length >= 30) return VOICE_CALL_PAUSE_MS.extra;
  if (length >= 10) return VOICE_CALL_PAUSE_MS.long;
  return VOICE_CALL_PAUSE_MS.short;
}

const LONG_LINE_CHARS = 48;
const LINE_END_DELIMITERS = '。！？!?…；;';

/**
 * A single spoken line can run long enough that the first sound is still worth
 * waiting on. Cut it at sentence ends once it passes the point where one request
 * stops feeling like one breath.
 */
function splitLongSpokenLine(text: string) {
  const chars = Array.from(text);
  if (chars.length <= LONG_LINE_CHARS) return [text];

  const pieces: string[] = [];
  let buffer = '';
  for (const char of chars) {
    buffer += char;
    if (LINE_END_DELIMITERS.includes(char) && Array.from(buffer).length >= LONG_LINE_CHARS) {
      pieces.push(buffer);
      buffer = '';
    }
  }
  if (buffer) pieces.push(buffer);
  return pieces;
}

function toSpokenText(text: string) {
  return normalizePauseTagsForEngine(stripCrowdLaughterTags(stripFleshCues(text))).trim();
}

function toCaptionText(text: string) {
  return stripPerformanceTags(stripFleshCues(text)).trim();
}

/**
 * The call reads a reply one spoken line at a time: the first line is synthesised on
 * its own so it can start right away, and the narration between lines becomes real
 * silence instead of a tag inside one long clip.
 */
export function buildAssistantSpeechPlan(content: string): VoiceCallSpeechPlan {
  const cleaned = cleanReplyForVoice(content);
  const pairs = cleaned.includes('【') ? CALL_SPEECH_PAIRS : QUOTE_PAIRS;
  const marked = splitSpeechSegments(cleaned, pairs);
  const segments = marked.some((segment) => segment.kind === 'speech' && segment.text.trim())
    ? marked
    : splitStageDirections(cleaned);

  const units: VoiceCallSpeechUnit[] = [];
  let narration: string[] = [];
  let pauseBeforeMs = 0;

  segments.forEach((segment, index) => {
    if (segment.kind === 'speech') {
      const spoken = toSpokenText(segment.text);
      if (!spoken) return;
      splitLongSpokenLine(spoken).forEach((piece) => {
        const unit = createVoiceCallSpeechUnit({
          tts: piece,
          caption: toCaptionText(piece),
          narration,
          pauseBeforeMs: units.length === 0 ? 0 : pauseBeforeMs,
          continuesPreviousLine: units.length > 0 && narration.length === 0
        });
        if (!unit) return;
        units.push(unit);
        narration = [];
        pauseBeforeMs = VOICE_CALL_LINE_GAP_MS;
      });
      return;
    }

    const gap = segment.text.trim();
    if (!gap) return;
    const hasLaterSpeech = segments.slice(index + 1).some((item) => item.kind === 'speech' && item.text.trim());
    if (!hasLaterSpeech) return;
    const narrationText = formatStageDirection(gap);
    if (narrationText) narration.push(narrationText);
    pauseBeforeMs = pauseMsForGap(gap);
  });

  return createVoiceCallSpeechPlan(units);
}

/**
 * Fallback for replies that never marked their spoken lines: read the prose but skip
 * the （）stage directions instead of reading the whole thing out loud.
 */
function stripStageDirections(content: string) {
  if (!content.includes('（') && !content.includes('(')) return content;
  const withoutStage = content.replace(/（[^（）]*）/g, '').replace(/\([^()]*\)/g, '');
  return withoutStage.trim() ? withoutStage : content;
}

export function buildAssistantSpeechText(content: string) {
  const cleaned = cleanReplyForVoice(content);
  const pairs = cleaned.includes('【') ? CALL_SPEECH_PAIRS : QUOTE_PAIRS;
  const segments = splitSpeechSegments(cleaned, pairs);
  const hasSpokenLines = segments.some((segment) => segment.kind === 'speech' && segment.text.trim());
  const spoken = hasSpokenLines ? joinSpokenSegments(segments) : stripStageDirections(cleaned);
  return normalizePauseTagsForEngine(stripCrowdLaughterTags(stripFleshCues(normalizeSpeechWhitespace(spoken))));
}

export type AssistantVoiceContent = {
  ttsText: string;
  cues: FleshCue[];
};

/** What this reply sends to the voice engine, plus the background tracks that will actually run. */
export function getAssistantVoiceContent(content: string): AssistantVoiceContent | null {
  const cues = selectAmbienceCues(readFleshCues(content));
  const ttsText = buildAssistantSpeechText(content);
  return cues.length || ttsText ? { ttsText, cues } : null;
}

function assistantSpeechSegments(content: string): SpeechSegment[] {
  const cleaned = cleanReplyForVoice(content);
  const pairs = cleaned.includes('【') ? CALL_SPEECH_PAIRS : QUOTE_PAIRS;
  const segments = splitSpeechSegments(cleaned, pairs);
  const hasSpokenLines = segments.some((segment) => segment.kind === 'speech' && segment.text.trim());
  return hasSpokenLines ? segments : splitStageDirections(cleaned);
}

/**
 * Where this reply's body sounds land along the voice, plus how long the clip should
 * run. Speech lines and the narration between them are handed over in order: the
 * narration is what the voice goes quiet for, so it is where a track turns on.
 */
export function getAssistantAmbiencePlan(content: string): AmbiencePlan {
  const segments = assistantSpeechSegments(content);
  if (!segments.some((segment) => segment.kind === 'speech' && segment.text.trim())) {
    return buildAmbiencePlan(segments);
  }

  const parts: VoiceCallCaptionSourcePart[] = [];
  let speech = '';
  const flush = () => {
    const spoken = speech.trim();
    speech = '';
    if (spoken) parts.push({ kind: 'speech', text: spoken });
  };

  for (const segment of segments) {
    if (segment.kind === 'speech') {
      speech += segment.text;
      continue;
    }
    const gap = segment.text.trim();
    if (!gap) continue;
    flush();
    parts.push({ kind: 'stage', text: gap });
  }
  flush();

  return buildAmbiencePlan(parts);
}

/**
 * The caption is read, not spoken: delivery cues stay in the text sent to the voice
 * engine, and the stage directions the voice skips are shown as muted narration.
 */
export function buildAssistantCaptionParts(content: string): AssistantCaptionPart[] {
  const source = assistantSpeechSegments(content);

  const parts: AssistantCaptionPart[] = [];
  for (const segment of source) {
    const text = segment.kind === 'speech'
      ? stripPerformanceTags(stripFleshCues(segment.text)).trim()
      : formatStageDirection(segment.text);
    if (!text) continue;
    const previous = parts[parts.length - 1];
    if (previous && previous.kind === segment.kind) {
      previous.text = `${previous.text}\n${text}`;
      continue;
    }
    parts.push({ kind: segment.kind, text });
  }
  return parts;
}

function formatStageDirection(gap: string) {
  const trimmed = stripPerformanceTags(stripFleshCues(gap)).trim();
  if (!trimmed) return '';
  const wrapped = /^（[^（）]*）$/.test(trimmed) || /^\([^()]*\)$/.test(trimmed);
  return wrapped ? trimmed : `（${trimmed}）`;
}

function splitStageDirections(content: string): SpeechSegment[] {
  const segments: SpeechSegment[] = [];
  const pattern = /（[^（）]*）|\([^()]*\)/g;
  let cursor = 0;
  for (const match of content.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ kind: 'speech', text: content.slice(cursor, start) });
    segments.push({ kind: 'stage', text: match[0] });
    cursor = start + match[0].length;
  }
  if (cursor < content.length) segments.push({ kind: 'speech', text: content.slice(cursor) });
  return segments;
}

function cleanReplyForVoice(content: string) {
  const withoutToolDrafts = stripToolDraftBlocks(content);
  const withoutCodeBlocks = stripCodeBlocksFromMessage(withoutToolDrafts);
  return normalizeSpeechWhitespace(stripMarkdownForSpeech(withoutCodeBlocks));
}

