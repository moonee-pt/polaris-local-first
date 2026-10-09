import { describe, expect, it } from 'vitest';
import {
  createFleshAmbienceLoop,
  readFleshCues,
  stripFleshCues,
  type FleshAmbienceHit,
  type FleshAmbiencePreset,
  type FleshLoopCategory
} from './fleshAmbience';

function collect(seed: number, category: FleshLoopCategory, preset: FleshAmbiencePreset, seconds: number): FleshAmbienceHit[] {
  return createFleshAmbienceLoop({ seed, category, preset }).take(seconds);
}

describe('flesh ambience cues', () => {
  it('maps each sound folder to its own cue', () => {
    expect(readFleshCues('嗯…[wetplap]…\n[dryplap:hard]\n[wet]\n[stroke:soft]\n[cum]\n[pullout]')).toEqual([
      { kind: 'loop', category: 'wetplap', preset: 'mid' },
      { kind: 'loop', category: 'dryplap', preset: 'hard' },
      { kind: 'loop', category: 'wet', preset: 'mid' },
      { kind: 'loop', category: 'stroke', preset: 'soft' },
      { kind: 'oneShot', category: 'cum' },
      { kind: 'oneShot', category: 'pullout' }
    ]);
  });

  it('ignores unknown brackets', () => {
    expect(readFleshCues('[panting][ungu][whatever](flesh)')).toEqual([]);
  });

  it('strips cues out of spoken and displayed text', () => {
    expect(stripFleshCues('别躲  [wetplap:soft]  过来')).toBe('别躲 过来');
    expect(stripFleshCues('[cum]')).toBe('');
  });
});

describe('flesh ambience loop', () => {
  it('is deterministic for the same seed', () => {
    expect(collect(7, 'wetplap', 'mid', 20)).toEqual(collect(7, 'wetplap', 'mid', 20));
  });

  it('differs across seeds', () => {
    expect(collect(1, 'wetplap', 'mid', 20)).not.toEqual(collect(2, 'wetplap', 'mid', 20));
  });

  it('raises density with the preset', () => {
    const soft = collect(3, 'wetplap', 'soft', 30).length;
    const mid = collect(3, 'wetplap', 'mid', 30).length;
    const hard = collect(3, 'wetplap', 'hard', 30).length;
    expect(mid).toBeGreaterThan(soft);
    expect(hard).toBeGreaterThan(mid);
  });

  it('keeps hits ordered and inside the requested window', () => {
    const hits = collect(11, 'dryplap', 'mid', 12);
    expect(hits.length).toBeGreaterThan(8);
    expect(hits.every((hit) => hit.atSec >= 0 && hit.atSec < 12)).toBe(true);
    for (let index = 1; index < hits.length; index += 1) {
      expect(hits[index].atSec).toBeGreaterThanOrEqual(hits[index - 1].atSec);
    }
  });

  it('never plays the same clip twice in a row', () => {
    const hits = collect(5, 'wetplap', 'hard', 60);
    expect(hits.length).toBeGreaterThan(20);
    for (let index = 1; index < hits.length; index += 1) {
      expect(hits[index].clip).not.toBe(hits[index - 1].clip);
    }
  });

  it('partitions the timeline the same way whether taken in slices or at once', () => {
    const whole = createFleshAmbienceLoop({ seed: 9, category: 'stroke', preset: 'mid' }).take(24);
    const sliced: FleshAmbienceHit[] = [];
    const loop = createFleshAmbienceLoop({ seed: 9, category: 'stroke', preset: 'mid' });
    for (let step = 1; step <= 24; step += 1) sliced.push(...loop.take(step));
    expect(sliced).toEqual(whole);
  });

  it('applies gain jitter around the preset level', () => {
    const plaps = collect(13, 'wetplap', 'soft', 40);
    expect(plaps.every((hit) => hit.gain > 0.3 && hit.gain < 0.7)).toBe(true);
    const bed = collect(13, 'wet', 'soft', 40);
    expect(bed.every((hit) => hit.gain > 0.15 && hit.gain < 0.5)).toBe(true);
  });

  it('switches density when the preset is changed mid-scene', () => {
    const loop = createFleshAmbienceLoop({ seed: 21, category: 'wetplap', preset: 'soft' });
    const soft = loop.take(20);
    loop.setPreset('hard');
    const hard = loop.take(40);
    expect(soft.length / 20).toBeLessThan(hard.length / 20);
  });
});
