import { FLESH_CUE_PATTERN, parseFleshCueTag, selectAmbienceCues, type FleshCue } from './fleshAmbience';
import { splitVoiceCallCaptions, type VoiceCallCaptionSourcePart } from './voiceCallCaption';

/**
 * Places the body-sound cues on the voice timeline.
 *
 * The clip is synthesized as one file, so the only way to know where a cue lands is
 * to weigh the text the same way the caption does: characters read at a steady rate,
 * narration holding the screen while the voice stays quiet. Ratios are used because the
 * real clip length is only known once the audio has been decoded.
 */

export type TimedAmbienceCue = FleshCue & { atRatio: number };

export type AmbiencePlan = {
  cues: TimedAmbienceCue[];
  /** Seconds the clip is expected to run, for the moment before the audio is measured. */
  estimatedSec: number;
};

const CHARS_PER_SEC = 5;

export function buildAmbiencePlan(parts: VoiceCallCaptionSourcePart[]): AmbiencePlan {
  const segments = splitVoiceCallCaptions(parts);
  const totalWeight = segments.reduce((sum, segment) => sum + segment.weight, 0);
  const estimatedSec = Math.max(1, totalWeight / CHARS_PER_SEC);
  if (totalWeight <= 0) return { cues: [], estimatedSec };

  const placed: Array<{ cue: FleshCue; at: number }> = [];
  let elapsed = 0;
  for (const segment of segments) {
    const span = Math.max(1, segment.text.length);
    for (const match of segment.text.matchAll(new RegExp(FLESH_CUE_PATTERN, 'gi'))) {
      const cue = parseFleshCueTag(match[1], match[2] ?? '');
      if (!cue) continue;
      // Narration is silence, so a cue in it means the track turns on as the voice stops.
      const position = segment.kind === 'stage' ? 0 : Math.min(match.index, span) / span;
      placed.push({ cue, at: elapsed + position * segment.weight });
    }
    elapsed += segment.weight;
  }

  const kept = new Set(selectAmbienceCues(placed.map((item) => item.cue)));
  const cues = placed
    .filter((item) => kept.has(item.cue))
    .map((item) => ({ ...item.cue, atRatio: item.at / totalWeight }));

  return { cues, estimatedSec };
}
