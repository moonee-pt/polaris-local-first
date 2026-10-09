import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createFleshAmbienceLoop,
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
const DUCK_LEVEL = 0.55;

function resolveClipUrl(category: FleshAmbienceCategory, clip: string) {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}sfx/flesh/${category}/${clip}.ogg`;
}

type ScheduledVoice = { source: AudioBufferSourceNode; gain: GainNode };

export type FleshAmbienceController = {
  active: boolean;
  ready: boolean;
  start: (category: FleshLoopCategory, preset: FleshAmbiencePreset) => void;
  stop: () => void;
  setPreset: (preset: FleshAmbiencePreset) => void;
  setDucked: (ducked: boolean) => void;
  playOneShot: (category: FleshAmbienceCategory) => void;
};

/**
 * Streams the short SFX pack into a continuous body track under the call.
 * Nothing is pre-rendered: hits are planned on a rolling window and scheduled
 * straight onto the audio clock.
 */
export function useFleshAmbience(): FleshAmbienceController {
  const contextRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const duckRef = useRef<GainNode | null>(null);
  const bufferRef = useRef<Map<string, AudioBuffer>>(new Map());
  const pendingRef = useRef<Set<string>>(new Set());
  const loopRef = useRef<FleshAmbienceLoop | null>(null);
  const loopStartRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const voicesRef = useRef<Set<ScheduledVoice>>(new Set());
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

  const prefetchLoops = useCallback((context: AudioContext) => {
    void (async () => {
      for (const category of FLESH_LOOP_CATEGORIES) {
        for (const clip of FLESH_CLIP_NAMES[category]) {
          if (bufferRef.current.has(`${category}/${clip}`)) continue;
          await decodeClip(context, category, clip);
        }
        setReady(true);
      }
    })();
  }, [decodeClip]);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const scheduleHit = useCallback((context: AudioContext, category: FleshAmbienceCategory, clip: string, atSec: number, gain: number) => {
    const buffer = bufferRef.current.get(`${category}/${clip}`);
    if (!buffer || !duckRef.current) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gainNode = context.createGain();
    gainNode.gain.value = gain;
    source.connect(gainNode);
    gainNode.connect(duckRef.current);
    const voice: ScheduledVoice = { source, gain: gainNode };
    voicesRef.current.add(voice);
    source.onended = () => {
      voicesRef.current.delete(voice);
      source.disconnect();
      gainNode.disconnect();
    };
    source.start(Math.max(context.currentTime, atSec));
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    loopRef.current = null;
    setActive(false);
    const context = contextRef.current;
    const master = masterRef.current;
    if (context && master) {
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + FADE_OUT_SEC);
      const cutoff = now + FADE_OUT_SEC;
      for (const voice of voicesRef.current) {
        try {
          voice.source.stop(cutoff);
        } catch {
          // Already stopped.
        }
      }
    }
  }, [clearTimer]);

  const start = useCallback((category: FleshLoopCategory, preset: FleshAmbiencePreset) => {
    const context = ensureGraph();
    if (!context || !masterRef.current) return;
    void context.resume().catch(() => {});
    prefetchLoops(context);
    loopRef.current = createFleshAmbienceLoop({
      seed: Math.floor(Math.random() * 0x7fffffff),
      category,
      preset
    });
    loopStartRef.current = context.currentTime + 0.15;
    const master = masterRef.current;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(1, now + FADE_IN_SEC);
    clearTimer();
    const tick = () => {
      const loop = loopRef.current;
      const audio = contextRef.current;
      if (!loop || !audio) return;
      const startAt = loopStartRef.current;
      const hits = loop.take(audio.currentTime + LOOKAHEAD_SEC - startAt);
      for (const hit of hits) scheduleHit(audio, hit.category, hit.clip, startAt + hit.atSec, hit.gain);
    };
    tick();
    timerRef.current = window.setInterval(tick, TICK_MS);
    setActive(true);
  }, [clearTimer, ensureGraph, prefetchLoops, scheduleHit]);

  const setPreset = useCallback((preset: FleshAmbiencePreset) => {
    loopRef.current?.setPreset(preset);
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
    if (!context) return;
    void context.resume().catch(() => {});
    const clip = FLESH_CLIP_NAMES[category][0];
    if (!clip) return;
    const hit = () => scheduleHit(context, category, clip, context.currentTime + 0.05, 0.7);
    if (bufferRef.current.has(`${category}/${clip}`)) {
      hit();
      return;
    }
    void decodeClip(context, category, clip).then(() => hit());
  }, [decodeClip, ensureGraph, scheduleHit]);

  useEffect(() => () => {
    clearTimer();
    for (const voice of voicesRef.current) {
      try {
        voice.source.stop();
      } catch {
        // Already stopped.
      }
    }
    voicesRef.current.clear();
    void contextRef.current?.close().catch(() => {});
    contextRef.current = null;
    masterRef.current = null;
    duckRef.current = null;
  }, [clearTimer]);

  return { active, ready, start, stop, setPreset, setDucked, playOneShot };
}
