import {
  FLESH_CUE_PATTERN,
  parseFleshCueTag,
  selectAmbienceCues,
  type FleshCue,
  type FleshAmbiencePreset,
  type FleshLoopCategory
} from './fleshAmbience';
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
    const matches = [...segment.text.matchAll(new RegExp(FLESH_CUE_PATTERN, 'gi'))];
    matches.forEach((match, index) => {
      const cue = parseFleshCueTag(match[1], match[2] ?? '');
      if (!cue) return;
      // Narration is silence: a cue in it turns the track on where the voice stops, and
      // several of them in one stretch keep the order they were written in.
      const position = segment.kind === 'stage'
        ? (index + 1) / (matches.length + 1)
        : Math.min(match.index, span) / span;
      placed.push({ cue, at: elapsed + position * segment.weight });
    });
    elapsed += segment.weight;
  }

  const kept = new Set(selectAmbienceCues(placed.map((item) => item.cue)));
  const cues = placed
    .filter((item) => kept.has(item.cue))
    .map((item) => ({ ...item.cue, atRatio: item.at / totalWeight }));

  return { cues, estimatedSec };
}

/** Two one-shots written in the same stretch would otherwise land as a single hit. */
const SHOT_GAP_SEC = 0.6;

export type AmbienceStep = { atSec: number; preset: FleshAmbiencePreset };

export type AmbienceBed = {
  category: FleshLoopCategory;
  atSec: number;
  preset: FleshAmbiencePreset;
  /** Density changes for this track later in the same reply. */
  steps: AmbienceStep[];
};

export type AmbienceShot = { category: 'cum' | 'pullout' | 'sp'; atSec: number };

export type AmbienceSchedule = { beds: AmbienceBed[]; shots: AmbienceShot[] };

/**
 * Turns the placed cues into what actually has to run on the audio clock: one track per
 * sound, opened at its second, with later mentions of the same sound becoming density
 * changes. All tracks run in parallel.
 */
export function scheduleAmbience(cues: TimedAmbienceCue[], horizonSec: number): AmbienceSchedule {
  const horizon = Math.max(1, horizonSec);
  const beds: AmbienceBed[] = [];
  const shots: AmbienceShot[] = [];
  let lastShotSec = -SHOT_GAP_SEC;

  for (const cue of cues) {
    const atSec = Math.min(Math.max(cue.atRatio, 0), 1) * horizon;
    if (cue.kind === 'oneShot') {
      const at = Math.max(atSec, lastShotSec + SHOT_GAP_SEC);
      shots.push({ category: cue.category, atSec: at });
      lastShotSec = at;
      continue;
    }
    const bed = beds.find((item) => item.category === cue.category);
    if (bed) {
      bed.steps.push({ atSec, preset: cue.preset });
      continue;
    }
    beds.push({
      category: cue.category,
      atSec,
      preset: cue.preset,
      steps: []
    });
  }

  return { beds, shots };
}
