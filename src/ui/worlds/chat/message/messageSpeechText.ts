import { TOOL_DRAFT_BLOCK_PATTERN } from '../../../../app/chat/chatMarkdownPatterns';
import { stripCodeBlocksFromMessage } from '../../../../engines/codeCardEngine';
import { readFleshCues, stripFleshCues, type FleshCue } from '../../../../engines/voice/fleshAmbience';
import { normalizePauseTagsForEngine, stripCrowdLaughterTags, stripPerformanceTags } from '../../../../engines/voice/performanceTags';
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
  segments.forEach((segment, index) => {
    if (segment.kind === 'speech') {
      const line = segment.text.trim();
      if (line) parts.push(line);
      return;
    }
    if (parts.length === 0 || !segment.text.trim()) return;
    const hasLaterSpeech = segments.slice(index + 1).some((item) => item.kind === 'speech' && item.text.trim());
    if (!hasLaterSpeech) return;
    parts.push(pauseForGap(segment.text));
  });
  return parts.join('');
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

/** What this reply sends to the voice engine, plus the background track it asks for. */
export function getAssistantVoiceContent(content: string): AssistantVoiceContent | null {
  const cues = readFleshCues(content);
  const ttsText = buildAssistantSpeechText(content);
  return cues.length || ttsText ? { ttsText, cues } : null;
}

/**
 * The caption is read, not spoken: delivery cues stay in the text sent to the voice
 * engine, and the stage directions the voice skips are shown as muted narration.
 */
export function buildAssistantCaptionParts(content: string): AssistantCaptionPart[] {
  const cleaned = cleanReplyForVoice(content);
  const pairs = cleaned.includes('【') ? CALL_SPEECH_PAIRS : QUOTE_PAIRS;
  const segments = splitSpeechSegments(cleaned, pairs);
  const hasSpokenLines = segments.some((segment) => segment.kind === 'speech' && segment.text.trim());
  const source: SpeechSegment[] = hasSpokenLines
    ? segments
    : splitStageDirections(cleaned);

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

