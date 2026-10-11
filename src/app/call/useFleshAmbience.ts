import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createFleshAmbienceLoop,
  fleshClipFile,
  FLESH_CLIP_NAMES,
  FLESH_LOOP_CATEGORIES,
  type FleshAmbienceCategory,
  type FleshAmbienceLoop,
  type FleshLoopCategory,
  type FleshAmbiencePreset
} from '../../engines/voice/fleshAmbience';

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

type Bed = {
  category: FleshLoopCategory;
  loop: FleshAmbienceLoop;
  startSec: number;
  gain: GainNode;
  voices: Set<ScheduledVoice>;
};

export type FleshAmbienceController = {
  active: boolean;
  ready: boolean;
  start: (category: FleshLoopCategory, preset: FleshAmbiencePreset) => void;
  stop: (category?: FleshLoopCategory) => void;
  setPreset: (category: FleshLoopCategory, preset: FleshAmbiencePreset) => void;
  setDucked: (ducked: boolean) => void;
  playOneShot: (category: FleshAmbienceCategory) => void;
};

/**
 * Streams the short SFX pack into one or more continuous beds under the call.
 * Nothing is pre-rendered: hits are planned on a rolling window and scheduled
 * straight onto the audio clock. Each category keeps its own bed, so a water
 * track and a breath track run at the same time.
 */
export function useFleshAmbience(): FleshAmbienceController {
  const contextRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const duckRef = useRef<GainNode | null>(null);
  const bufferRef = useRef<Map<string, AudioBuffer>>(new Map());
  const pendingRef = useRef<Set<string>>(new Set());
  const bedsRef = useRef<Map<FleshLoopCategory, Bed>>(new Map());
  const timerRef = useRef<number | null>(null);
  const oneShotVoicesRef = useRef<Set<ScheduledVoice>>(new Set());
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);

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

  const prefetchLoops = useCallback((context: AudioContext, preferred: FleshLoopCategory) => {
    const ordered: FleshLoopCategory[] = [preferred, ...FLESH_LOOP_CATEGORIES.filter((item) => item !== preferred)];
    void (async () => {
      for (const category of ordered) {
        for (const clip of FLESH_CLIP_NAMES[category]) {
          if (bufferRef.current.has(`${category}/${clip}`)) continue;
          await decodeClip(context, category, clip);
        }
        if (category === preferred) setReady(true);
      }
    })();
  }, [decodeClip]);

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

  const stop = useCallback((category?: FleshLoopCategory) => {
    if (category) {
      const bed = bedsRef.current.get(category);
      if (bed) retireBed(bed);
    } else {
      for (const bed of [...bedsRef.current.values()]) retireBed(bed);
    }
    if (bedsRef.current.size > 0) return;

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

  const start = useCallback((category: FleshLoopCategory, preset: FleshAmbiencePreset) => {
    const context = ensureGraph();
    if (!context || !masterRef.current || !duckRef.current) return;
    void context.resume().catch(() => {});

    const existing = bedsRef.current.get(category);
    if (existing) {
      existing.loop.setPreset(preset);
      return;
    }

    prefetchLoops(context, category);
    const gain = context.createGain();
    gain.gain.value = 1;
    gain.connect(duckRef.current);
    bedsRef.current.set(category, {
      category,
      loop: createFleshAmbienceLoop({
        seed: Math.floor(Math.random() * 0x7fffffff),
        category,
        preset
      }),
      startSec: context.currentTime + 0.15,
      gain,
      voices: new Set()
    });

    const master = masterRef.current;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(1, now + FADE_IN_SEC);

    clearTimer();
    const tick = () => {
      const audio = contextRef.current;
      if (!audio) return;
      for (const bed of bedsRef.current.values()) {
        const hits = bed.loop.take(audio.currentTime + LOOKAHEAD_SEC - bed.startSec);
        for (const hit of hits) {
          scheduleHit(audio, hit.category, hit.clip, bed.startSec + hit.atSec, hit.gain, bed.gain, bed.voices);
        }
      }
    };
    tick();
    timerRef.current = window.setInterval(tick, TICK_MS);
    setActive(true);
  }, [clearTimer, ensureGraph, prefetchLoops, scheduleHit]);

  const setPreset = useCallback((category: FleshLoopCategory, preset: FleshAmbiencePreset) => {
    bedsRef.current.get(category)?.loop.setPreset(preset);
  }, []);

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

  const playOneShot = useCallback((category: FleshAmbienceCategory) => {
    const context = ensureGraph();
    if (!context || !duckRef.current) return;
    void context.resume().catch(() => {});
    const names = FLESH_CLIP_NAMES[category];
    const clip = names[Math.floor(Math.random() * names.length)];
    if (!clip) return;
    const hit = () => scheduleHit(
      context,
      category,
      clip,
      context.currentTime + 0.05,
      1,
      duckRef.current as AudioNode,
      oneShotVoicesRef.current
    );
    if (bufferRef.current.has(`${category}/${clip}`)) {
      hit();
      return;
    }
    void decodeClip(context, category, clip).then(() => hit());
  }, [decodeClip, ensureGraph, scheduleHit]);

  useEffect(() => () => {
    clearTimer();
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

  return { active, ready, start, stop, setPreset, setDucked, playOneShot };
}
