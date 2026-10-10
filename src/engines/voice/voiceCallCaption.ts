/**
 * Turns one spoken reply into a caption timeline.
 *
 * Speech is generated as a whole clip, so the caption follows the audio clock
 * instead of a real token stream. Sentences and clauses carry extra weight so the
 * text pauses where the voice breathes.
 */
export type VoiceCallCaptionKind = 'speech' | 'stage';

export type VoiceCallCaptionSourcePart = {
  kind: VoiceCallCaptionKind;
  text: string;
};

export type VoiceCallCaptionSegment = {
  text: string;
  weight: number;
  kind: VoiceCallCaptionKind;
};

const SENTENCE_DELIMITERS = '。！？!?…；;\n';
const CLAUSE_DELIMITERS = '，,、：:';
const SENTENCE_PAUSE_WEIGHT = 5;
const CLAUSE_PAUSE_WEIGHT = 2;
/** Stage directions are silent on the track, so they hold the screen a little longer. */
const STAGE_HOLD_WEIGHT = 8;

type RawChunk = {
  text: string;
  pause: number;
};

function countChars(value: string) {
  return Array.from(value).length;
}

function splitByDelimiters(text: string, delimiters: string, pauseWeight: number): RawChunk[] {
  const chunks: RawChunk[] = [];
  let buffer = '';

  for (const char of text) {
    buffer += char;
    if (!delimiters.includes(char)) continue;
    chunks.push({ text: buffer, pause: pauseWeight });
    buffer = '';
  }

  if (buffer) {
    chunks.push({ text: buffer, pause: 0 });
  }

  return chunks;
}

export function splitVoiceCallCaptions(source: string | VoiceCallCaptionSourcePart[]): VoiceCallCaptionSegment[] {
  const parts: VoiceCallCaptionSourcePart[] = typeof source === 'string'
    ? [{ kind: 'speech', text: source }]
    : source;

  const segments: VoiceCallCaptionSegment[] = [];

  for (const part of parts) {
    const normalized = part.text.replace(/\r\n?/g, '\n').trim();
    if (!normalized) continue;

    if (part.kind === 'stage') {
      segments.push({ text: normalized, weight: countChars(normalized) + STAGE_HOLD_WEIGHT, kind: 'stage' });
      continue;
    }

    for (const sentence of splitByDelimiters(normalized, SENTENCE_DELIMITERS, SENTENCE_PAUSE_WEIGHT)) {
      const clauses = splitByDelimiters(sentence.text, CLAUSE_DELIMITERS, CLAUSE_PAUSE_WEIGHT);

      clauses.forEach((clause, clauseIndex) => {
        const isLastClause = clauseIndex === clauses.length - 1;
        const weight = countChars(clause.text) + clause.pause + (isLastClause ? sentence.pause : 0);
        if (weight <= 0) return;
        segments.push({ text: clause.text, weight, kind: 'speech' });
      });
    }
  }

  return segments;
}

export function buildVoiceCallCaptionText(segments: VoiceCallCaptionSegment[]) {
  return segments.map((segment) => segment.text).join('');
}

export function resolveVoiceCallVisibleParts(
  segments: VoiceCallCaptionSegment[],
  progress: number
): VoiceCallCaptionSourcePart[] {
  if (segments.length === 0) return [];
  if (!Number.isFinite(progress)) return [];
  if (progress <= 0) return [];

  const totalWeight = segments.reduce((sum, segment) => sum + segment.weight, 0);
  let remainingWeight = totalWeight * Math.min(1, progress);
  const visible: VoiceCallCaptionSourcePart[] = [];

  const push = (kind: VoiceCallCaptionKind, text: string) => {
    if (!text) return;
    const previous = visible[visible.length - 1];
    if (previous && previous.kind === kind) previous.text += text;
    else visible.push({ kind, text });
  };

  for (const segment of segments) {
    const chars = Array.from(segment.text);
    if (remainingWeight >= segment.weight) {
      push(segment.kind, segment.text);
      remainingWeight -= segment.weight;
      continue;
    }

    const visibleCount = Math.max(1, Math.min(chars.length, Math.floor(remainingWeight)));
    push(segment.kind, chars.slice(0, visibleCount).join(''));
    return visible;
  }

  return visible;
}
