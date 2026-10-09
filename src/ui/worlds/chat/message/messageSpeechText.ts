import { TOOL_DRAFT_BLOCK_PATTERN } from '../../../../app/chat/chatMarkdownPatterns';
import { stripCodeBlocksFromMessage } from '../../../../engines/codeCardEngine';
import { stripFleshCues } from '../../../../engines/voice/fleshAmbience';

type SpeechSegment = { kind: 'speech' | 'stage'; text: string };

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

function pauseForGap(gap: string) {
  const length = gap.replace(/\s+/g, '').length;
  if (length >= 30) return '……\n……';
  if (length >= 10) return '…… ……';
  return '……';
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
  const withoutToolDrafts = stripToolDraftBlocks(content);
  const withoutCodeBlocks = stripCodeBlocksFromMessage(withoutToolDrafts);
  const cleaned = normalizeSpeechWhitespace(stripMarkdownForSpeech(withoutCodeBlocks));
  const pairs = cleaned.includes('【') ? CALL_SPEECH_PAIRS : QUOTE_PAIRS;
  const segments = splitSpeechSegments(cleaned, pairs);
  const hasSpokenLines = segments.some((segment) => segment.kind === 'speech' && segment.text.trim());
  const spoken = hasSpokenLines ? joinSpokenSegments(segments) : stripStageDirections(cleaned);
  return stripFleshCues(normalizeSpeechWhitespace(spoken));
}
