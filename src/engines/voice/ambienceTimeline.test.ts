import { describe, expect, it } from 'vitest';
import { buildAmbiencePlan, scheduleAmbience } from './ambienceTimeline';

const speech = (text: string) => ({ kind: 'speech' as const, text });
const stage = (text: string) => ({ kind: 'stage' as const, text });

describe('buildAmbiencePlan', () => {
  it('places each cue where it sits in the text', () => {
    const plan = buildAmbiencePlan([
      speech('第一句。'),
      stage('（她慢慢摇 [wetplap:soft]）'),
      speech('第二句。'),
      stage('（更快了 [wetplap:hard]）'),
      speech('第三句。')
    ]);

    expect(plan.cues.map((cue) => cue.kind)).toEqual(['loop', 'loop']);
    expect(plan.cues[0]).toMatchObject({ kind: 'loop', category: 'wetplap', preset: 'soft' });
    expect(plan.cues[1]).toMatchObject({ kind: 'loop', category: 'wetplap', preset: 'hard' });
    expect(plan.cues[1].atRatio).toBeGreaterThan(plan.cues[0].atRatio);
    expect(plan.cues[0].atRatio).toBeLessThan(0.5);
    expect(plan.cues[1].atRatio).toBeGreaterThan(0.5);
  });

  it('opens a later track at its own cue instead of at the start', () => {
    const plan = buildAmbiencePlan([
      speech('先说很长的一段话，这一段里没有身体音，只是把时间占住。'),
      stage('（水声起来 [wet]）')
    ]);

    expect(plan.cues).toHaveLength(1);
    expect(plan.cues[0].atRatio).toBeGreaterThan(0.5);
  });

  it('keeps the legacy flesh alias as a wet plap track', () => {
    const plan = buildAmbiencePlan([speech('嗯。[flesh]')]);
    expect(plan.cues).toHaveLength(1);
    expect(plan.cues[0]).toMatchObject({ kind: 'loop', category: 'wetplap', preset: 'mid' });
    expect(plan.cues[0].atRatio).toBeGreaterThan(0);
  });

  it('spreads multiple cues in one narration stretch by their order', () => {
    const plan = buildAmbiencePlan([
      speech('先说。'),
      stage('（抽离 [pullout] 到顶 [cum]）')
    ]);
    expect(plan.cues).toHaveLength(2);
    expect(plan.cues[0].category).toBe('pullout');
    expect(plan.cues[1].category).toBe('cum');
    expect(plan.cues[1].atRatio).toBeGreaterThan(plan.cues[0].atRatio);
  });

  it('reports nothing for a reply without cues', () => {
    const plan = buildAmbiencePlan([speech('今天天气不错')]);
    expect(plan.cues).toEqual([]);
    expect(plan.estimatedSec).toBe(1.2);
  });

  it('estimates five characters a second', () => {
    expect(buildAmbiencePlan([speech('一二三四五六七八九十'.repeat(3))]).estimatedSec).toBe(6);
  });
});

describe('scheduleAmbience', () => {
  it('spaces two one-shots at the same ratio at least 0.6s apart', () => {
    const cues = [
      { kind: 'oneShot' as const, category: 'pullout' as const, atRatio: 0.7 },
      { kind: 'oneShot' as const, category: 'cum' as const, atRatio: 0.7 }
    ];
    const schedule = scheduleAmbience(cues, 12);
    expect(schedule.shots).toHaveLength(2);
    const gap = schedule.shots[1].atSec - schedule.shots[0].atSec;
    expect(gap).toBeGreaterThanOrEqual(0.599);
  });

  it('groups same-category cues into one bed with steps', () => {
    const cues = [
      { kind: 'loop' as const, category: 'wetplap' as const, preset: 'soft' as const, atRatio: 0.1 },
      { kind: 'loop' as const, category: 'wetplap' as const, preset: 'hard' as const, atRatio: 0.5 }
    ];
    const schedule = scheduleAmbience(cues, 12);
    expect(schedule.beds).toHaveLength(1);
    expect(schedule.beds[0].steps).toHaveLength(1);
    expect(schedule.beds[0].steps[0].preset).toBe('hard');
  });

  it('keeps different categories as parallel beds', () => {
    const cues = [
      { kind: 'loop' as const, category: 'wet' as const, preset: 'mid' as const, atRatio: 0.1 },
      { kind: 'loop' as const, category: 'stroke' as const, preset: 'mid' as const, atRatio: 0.3 }
    ];
    const schedule = scheduleAmbience(cues, 12);
    expect(schedule.beds).toHaveLength(2);
  });
});
