/**
 * Turns one spoken reply into a caption timeline.
 *
 * Speech is generated as a whole clip, so the caption follows the audio clock
 * instead of a real token stream. Sentences and clauses carry extra weight so the
 * text pauses where the voice breathes.
 */
export type VoiceCallCaptionSegment = {
  text: string;
  weight: number;
};

const SENTENCE_DELIMITERS = '。！？!?…；;\n';
const CLAUSE_DELIMITERS = '，,、：:';
const SENTENCE_PAUSE_WEIGHT = 5;
const CLAUSE_PAUSE_WEIGHT = 2;

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

export function splitVoiceCallCaptions(text: string): VoiceCallCaptionSegment[] {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const segments: VoiceCallCaptionSegment[] = [];

  for (const sentence of splitByDelimiters(normalized, SENTENCE_DELIMITERS, SENTENCE_PAUSE_WEIGHT)) {
    const clauses = splitByDelimiters(sentence.text, CLAUSE_DELIMITERS, CLAUSE_PAUSE_WEIGHT);

    clauses.forEach((clause, clauseIndex) => {
      const isLastClause = clauseIndex === clauses.length - 1;
      const weight = countChars(clause.text) + clause.pause + (isLastClause ? sentence.pause : 0);
      if (weight <= 0) return;
      segments.push({ text: clause.text, weight });
    });
  }

  return segments;
}

export function buildVoiceCallCaptionText(segments: VoiceCallCaptionSegment[]) {
  return segments.map((segment) => segment.text).join('');
}

export function resolveVoiceCallVisibleText(segments: VoiceCallCaptionSegment[], progress: number): string {
  if (segments.length === 0) return '';
  if (!Number.isFinite(progress)) return '';
  if (progress <= 0) return '';

  const fullText = buildVoiceCallCaptionText(segments);
  if (progress >= 1) return fullText;

  const totalWeight = segments.reduce((sum, segment) => sum + segment.weight, 0);
  if (totalWeight <= 0) return fullText;

  let remainingWeight = totalWeight * progress;
  let visible = '';

  for (const segment of segments) {
    if (remainingWeight >= segment.weight) {
      visible += segment.text;
      remainingWeight -= segment.weight;
      continue;
    }

    const chars = Array.from(segment.text);
    if (remainingWeight >= chars.length) {
      visible += segment.text;
      return visible;
    }

    const consumedChars = Math.floor(remainingWeight);
    const visibleCount = Math.max(1, Math.min(chars.length, consumedChars));
    return visible + chars.slice(0, visibleCount).join('');
  }

  return visible;
}
