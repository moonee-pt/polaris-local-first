/**
 * Short one-shot SFX are turned into a continuous "body track" by scheduling them
 * on a timeline: a rhythm plus a looser bed. Nothing is pre-rendered, so the same
 * handful of clips never repeats the same way twice.
 *
 * Each cue maps to exactly one folder of the pack, one to one, so the model picks
 * the sound it wants: two plap types, wet, strokes, and the two one-shots.
 */

export type FleshAmbienceCategory = 'dryplap' | 'wetplap' | 'wet' | 'stroke' | 'cum' | 'pullout';

export type FleshLoopCategory = 'dryplap' | 'wetplap' | 'wet' | 'stroke';

export type FleshAmbiencePreset = 'soft' | 'mid' | 'hard';

export type FleshCue =
  | { kind: 'loop'; category: FleshLoopCategory; preset: FleshAmbiencePreset }
  | { kind: 'oneShot'; category: 'cum' | 'pullout' };

export type FleshAmbienceHit = {
  atSec: number;
  category: FleshAmbienceCategory;
  clip: string;
  gain: number;
};

const CUE_SOURCE = '\\[(flesh|dryplap|wetplap|wet|stroke|cum|pullout)(?::(soft|hard))?\\]';

const CATEGORY_PROFILE: Record<FleshLoopCategory, { perSec: number; gain: number }> = {
  dryplap: { perSec: 1.7, gain: 0.6 },
  wetplap: { perSec: 1.7, gain: 0.6 },
  wet: { perSec: 0.9, gain: 0.4 },
  stroke: { perSec: 0.9, gain: 0.4 }
};

const PRESET_SCALE: Record<FleshAmbiencePreset, { rate: number; gain: number }> = {
  soft: { rate: 0.6, gain: 0.8 },
  mid: { rate: 1, gain: 1 },
  hard: { rate: 1.6, gain: 1.2 }
};

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function range(prefix: string, from: number, to: number) {
  const names: string[] = [];
  for (let index = from; index <= to; index += 1) names.push(prefix + pad2(index));
  return names;
}

/** Clip file base names (without extension) per category, as shipped in public/sfx/flesh. */
export const FLESH_CLIP_NAMES: Record<FleshAmbienceCategory, string[]> = {
  dryplap: range('plapdry', 1, 11),
  wetplap: range('plapwet', 1, 16),
  wet: range('wet', 1, 12),
  stroke: range('stroke', 1, 10),
  cum: [...range('cum_in', 1, 3), ...range('cum_out', 1, 6)],
  pullout: range('pullout', 1, 3)
};

export const FLESH_LOOP_CATEGORIES: FleshLoopCategory[] = ['dryplap', 'wetplap', 'wet', 'stroke'];

function presetFromSuffix(suffix: string): FleshAmbiencePreset {
  if (suffix === 'soft') return 'soft';
  if (suffix === 'hard') return 'hard';
  return 'mid';
}

export function readFleshCues(text: string): FleshCue[] {
  if (!text) return [];
  const cues: FleshCue[] = [];
  const pattern = new RegExp(CUE_SOURCE, 'gi');
  let match = pattern.exec(text);
  while (match) {
    // lesh is a legacy alias so older messages still start a track.
    const raw = match[1].toLowerCase() === 'flesh' ? 'wetplap' : match[1].toLowerCase();
    if (raw === 'cum' || raw === 'pullout') {
      cues.push({ kind: 'oneShot', category: raw });
    } else {
      cues.push({
        kind: 'loop',
        category: raw as FleshLoopCategory,
        preset: presetFromSuffix((match[2] ?? '').toLowerCase())
      });
    }
    match = pattern.exec(text);
  }
  return cues;
}

export function stripFleshCues(text: string): string {
  if (!text) return text;
  return text
    .replace(new RegExp(CUE_SOURCE, 'gi'), '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n');
}

function createRng(seed: number) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type FleshAmbienceLoop = {
  take: (upToSec: number) => FleshAmbienceHit[];
  readonly cursorSec: number;
  setPreset: (preset: FleshAmbiencePreset) => void;
};

/**
 * Builds an endless, seeded schedule for one folder. Call 	ake(now + lookahead)
 * to keep pulling the next slice; the cursor only ever moves forward.
 */
export function createFleshAmbienceLoop(options: {
  seed: number;
  category: FleshLoopCategory;
  preset: FleshAmbiencePreset;
  startSec?: number;
}): FleshAmbienceLoop {
  const rng = createRng(options.seed);
  const category = options.category;
  let preset = options.preset;
  let cursor = Math.max(0, options.startSec ?? 0);
  let bag: string[] = [];
  let lastDrawn = '';
  let due = cursor + 0.05;

  const draw = () => {
    if (bag.length === 0) {
      bag = [...FLESH_CLIP_NAMES[category]];
      for (let index = bag.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(rng() * (index + 1));
        [bag[index], bag[swap]] = [bag[swap], bag[index]];
      }
    }
    if (bag.length > 1 && bag[bag.length - 1] === lastDrawn) {
      const swap = Math.floor(rng() * (bag.length - 1));
      [bag[bag.length - 1], bag[swap]] = [bag[swap], bag[bag.length - 1]];
    }
    const clip = bag.pop() as string;
    lastDrawn = clip;
    return clip;
  };

  const jitter = (ratio: number, spread: number) => ratio * (1 - spread + rng() * spread * 2);

  const take = (upToSec: number): FleshAmbienceHit[] => {
    const hits: FleshAmbienceHit[] = [];
    const profile = CATEGORY_PROFILE[category];
    const scale = PRESET_SCALE[preset];
    const limit = Math.max(upToSec, cursor);
    while (due < limit) {
      const atSec = due;
      hits.push({
        atSec,
        category,
        clip: draw(),
        gain: profile.gain * scale.gain * jitter(1, 0.12)
      });
      cursor = Math.max(cursor, atSec);
      due = atSec + jitter(1 / (profile.perSec * scale.rate), 0.18);
    }
    return hits;
  };

  return {
    take,
    get cursorSec() {
      return cursor;
    },
    setPreset(next) {
      preset = next;
    }
  };
}
