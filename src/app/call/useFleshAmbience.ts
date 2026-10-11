import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createFleshAmbienceLoop,
  fleshClipFile,
  FLESH_CLIP_NAMES,
  type FleshAmbienceCategory,
  type FleshAmbienceLoop,
  type FleshLoopCategory,
  type FleshAmbiencePreset
} from '../../engines/voice/fleshAmbience';
import type { TimedAmbienceCue } from '../../engines/voice/ambienceTimeline';

const LOOKAHEAD_SEC = 0.8;
const TICK_MS = 150;
const FADE_IN_SEC = 0.5;
const FADE_OUT_SEC = 0.9;
const DUCK_LEVEL = 0.8;

function resolveClipUrl(category: FleshAmbienceCategory, clip: string) {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}sfx/flesh/${fleshClipFile(category, clip)}`;
}

type ScheduledVoice = { source: AudioBufferSourceNode; gain: GainNode };

type PresetStep = { at: number; preset: FleshAmbiencePreset };

type Bed = {
  category: FleshLoopCategory;
  loop: FleshAmbienceLoop;
  startSec: number;
  gain: GainNode;
  voices: Set<ScheduledVoice>;
  steps: PresetStep[];
};

type PendingBed = { at: number; category: FleshLoopCategory; preset: FleshAmbiencePreset; steps: PresetStep[] };
type PendingShot = { at: number; category: FleshAmbienceCategory };

export type FleshAmbienceController = {
  active: boolean;
  schedule: (cues: TimedAmbienceCue[], totalSec: number) => void;
  stop: () => void;
  setDucked: (ducked: boolean) => void;
};

/**
 * Streams the short SFX pack into one or more continuous beds under the call.
 * Nothing is pre-rendered: hits are planned on a rolling window and scheduled
 * straight onto the audio clock. Each category keeps its own bed, so a water
 * track and a breath track run at the same time, and one reply can open a track
 * or change its density partway through the voice it sits under.
 */
export function useFleshAmbience(): FleshAmbienceController {
  const contextRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const duckRef = useRef<GainNode | null>(null);
  const bufferRef = useRef<Map<string, AudioBuffer>>(new Map());
  const pendingRef = useRef<Set<string>>(new Set());
  const bedsRef = useRef<Map<FleshLoopCategory, Bed>>(new Map());
  const startsRef = useRef<PendingBed[]>([]);
  const shotsRef = useRef<PendingShot[]>([]);
  const timerRef = useRef<number | null>(null);
  const oneShotVoicesRef = useRef<Set<ScheduledVoice>>(new Set());
  const [active, setActive] = useState(false);

  const ensureGraph = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (contextRef.current) return contextRef.current;
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const context = new Ctor();
    const duck = context.createGain();
    duck.gain.value = 1;
    const master = context.createGain();
    master.gain.value = 0;
    duck.connect(master);
    master.connect(context.destination);
    contextRef.current = context;
    duckRef.current = duck;
    masterRef.current = master;
    return context;
  }, []);

  const decodeClip = useCallback(async (context: AudioContext, category: FleshAmbienceCategory, clip: string) => {
    const key = `${category}/${clip}`;
    if (bufferRef.current.has(key) || pendingRef.current.has(key)) return;
    pendingRef.current.add(key);
    try {
      const response = await fetch(resolveClipUrl(category, clip));
      if (!response.ok) return;
      const data = await response.arrayBuffer();
      const buffer = await context.decodeAudioData(data);
      bufferRef.current.set(key, buffer);
    } catch {
      // A missing clip just means that hit is skipped; the bed keeps playing.
    } finally {
      pendingRef.current.delete(key);
    }
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const scheduleHit = useCallback((
    context: AudioContext,
    category: FleshAmbienceCategory,
    clip: string,
    atSec: number,
    gain: number,
    output: AudioNode,
    voices: Set<ScheduledVoice>
  ) => {
    const buffer = bufferRef.current.get(`${category}/${clip}`);
    if (!buffer) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gainNode = context.createGain();
    gainNode.gain.value = gain;
    source.connect(gainNode);
    gainNode.connect(output);
    const voice: ScheduledVoice = { source, gain: gainNode };
    voices.add(voice);
    source.onended = () => {
      voices.delete(voice);
      source.disconnect();
      gainNode.disconnect();
    };
    source.start(Math.max(context.currentTime, atSec));
  }, []);

  const retireBed = useCallback((bed: Bed) => {
    bedsRef.current.delete(bed.category);
    const context = contextRef.current;
    if (!context) return;
    const cutoff = context.currentTime + FADE_OUT_SEC;
    bed.gain.gain.cancelScheduledValues(context.currentTime);
    bed.gain.gain.setValueAtTime(bed.gain.gain.value, context.currentTime);
    bed.gain.gain.linearRampToValueAtTime(0, cutoff);
    for (const voice of bed.voices) {
      try {
        voice.source.stop(cutoff);
      } catch {
        // Already stopped.
      }
    }
    window.setTimeout(() => {
      bed.gain.disconnect();
    }, (FADE_OUT_SEC + 0.2) * 1000);
  }, []);

  const openBed = useCallback((context: AudioContext, pending: PendingBed) => {
    const duck = duckRef.current;
    const master = masterRef.current;
    if (!duck || !master) return;
    const gain = context.createGain();
    gain.gain.value = 1;
    gain.connect(duck);
    bedsRef.current.set(pending.category, {
      category: pending.category,
      loop: createFleshAmbienceLoop({
        seed: Math.floor(Math.random() * 0x7fffffff),
        category: pending.category,
        preset: pending.preset
      }),
      startSec: context.currentTime + 0.15,
      gain,
      voices: new Set(),
      steps: pending.steps
    });
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(1, now + FADE_IN_SEC);
  }, []);

  const fireOneShot = useCallback((context: AudioContext, category: FleshAmbienceCategory) => {
    const duck = duckRef.current;
    if (!duck) return;
    const names = FLESH_CLIP_NAMES[category];
    const clip = names[Math.floor(Math.random() * names.length)];
    if (!clip) return;
    scheduleHit(context, category, clip, context.currentTime + 0.05, 1, duck, oneShotVoicesRef.current);
  }, [scheduleHit]);

  const tick = useCallback(() => {
    const context = contextRef.current;
    if (!context) return;
    const now = context.currentTime;

    if (startsRef.current.some((item) => item.at <= now)) {
      const due = startsRef.current.filter((item) => item.at <= now);
      startsRef.current = startsRef.current.filter((item) => item.at > now);
      for (const pending of due) openBed(context, pending);
    }

    for (const bed of bedsRef.current.values()) {
      if (bed.steps.some((step) => step.at <= now)) {
        const due = bed.steps.filter((step) => step.at <= now);
        bed.steps = bed.steps.filter((step) => step.at > now);
        bed.loop.setPreset(due[due.length - 1].preset);
      }
      const hits = bed.loop.take(now + LOOKAHEAD_SEC - bed.startSec);
      for (const hit of hits) {
        scheduleHit(context, hit.category, hit.clip, bed.startSec + hit.atSec, hit.gain, bed.gain, bed.voices);
      }
    }

    if (shotsRef.current.some((shot) => shot.at <= now)) {
      const due = shotsRef.current.filter((shot) => shot.at <= now);
      shotsRef.current = shotsRef.current.filter((shot) => shot.at > now);
      for (const shot of due) fireOneShot(context, shot.category);
    }

    if (!bedsRef.current.size && !startsRef.current.length && !shotsRef.current.length) clearTimer();
  }, [clearTimer, fireOneShot, openBed, scheduleHit]);

  const stop = useCallback(() => {
    startsRef.current = [];
    shotsRef.current = [];
    for (const bed of [...bedsRef.current.values()]) retireBed(bed);
    clearTimer();
    setActive(false);
    const context = contextRef.current;
    const master = masterRef.current;
    if (context && master) {
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + FADE_OUT_SEC);
    }
  }, [clearTimer, retireBed]);

  /**
   * Runs one reply's cue plan against the length of the clip being played, so a track
   * opens where the model wrote it instead of the moment the voice starts.
   */
  const schedule = useCallback((cues: TimedAmbienceCue[], totalSec: number) => {
    const context = ensureGraph();
    if (!context || !masterRef.current || !duckRef.current) return;
    void context.resume().catch(() => {});

    stop();

    const horizon = Math.max(1, totalSec);
    const now = context.currentTime;
    const plan = new Map<FleshLoopCategory, PendingBed>();
    const shots: PendingShot[] = [];

    for (const cue of cues) {
      const at = now + Math.min(Math.max(cue.atRatio, 0), 1) * horizon;
      void Promise.all(FLESH_CLIP_NAMES[cue.category].map((clip) => decodeClip(context, cue.category, clip)));
      if (cue.kind === 'oneShot') {
        shots.push({ at, category: cue.category });
        continue;
      }
      const scheduled = plan.get(cue.category);
      if (scheduled) scheduled.steps.push({ at, preset: cue.preset });
      else plan.set(cue.category, { at, category: cue.category, preset: cue.preset, steps: [] });
    }

    startsRef.current = [...plan.values()];
    shotsRef.current = shots;
    if (!startsRef.current.length && !shotsRef.current.length) return;

    setActive(true);
    clearTimer();
    tick();
    timerRef.current = window.setInterval(tick, TICK_MS);
  }, [clearTimer, decodeClip, ensureGraph, stop, tick]);

  const setDucked = useCallback((ducked: boolean) => {
    const context = contextRef.current;
    const duck = duckRef.current;
    if (!context || !duck) return;
    const now = context.currentTime;
    const target = ducked ? DUCK_LEVEL : 1;
    duck.gain.cancelScheduledValues(now);
    duck.gain.setValueAtTime(duck.gain.value, now);
    duck.gain.linearRampToValueAtTime(target, now + 0.25);
  }, []);

  useEffect(() => () => {
    clearTimer();
    startsRef.current = [];
    shotsRef.current = [];
    for (const voice of oneShotVoicesRef.current) {
      try {
        voice.source.stop();
      } catch {
        // Already stopped.
      }
    }
    oneShotVoicesRef.current.clear();
    void contextRef.current?.close().catch(() => {});
    contextRef.current = null;
    masterRef.current = null;
    duckRef.current = null;
    bedsRef.current.clear();
  }, [clearTimer]);

  return { active, schedule, stop, setDucked };
}
