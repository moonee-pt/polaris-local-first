import { useCallback, useEffect, useRef, useState } from 'react';
import { readMessageSpeechCacheBlob, saveMessageSpeechCache } from '../chat/messageSpeechCache';
import { requestGeneratedSpeech, type VoiceGenerationResult } from '../../engines/voiceGenerationClient';
import {
  resolveVoiceCallVisibleParts,
  type VoiceCallCaptionSegment,
  type VoiceCallCaptionSourcePart
} from '../../engines/voice/voiceCallCaption';
import {
  buildWholeClipPlan,
  estimatePlanSeconds,
  estimateSpeechSeconds,
  type VoiceCallSpeechPlan,
  type VoiceCallSpeechUnit
} from '../../engines/voice/voiceCallSpeechUnits';
import { useVoiceSettingsForSpeaker } from '../voice/useVoiceSettingsForSpeaker';
import { getCallAudio, markCallAudioBlocked, markCallAudioUnlocked, setCallAudioInUse } from './callAudio';
import type { ChatMessageVoiceCache } from '../../types/domain';

export type VoiceCallPlaybackStatus = 'idle' | 'generating' | 'speaking';

type SpeakArgs = {
  messageId: string;
  plan: VoiceCallSpeechPlan;
};

type UseVoiceCallPlaybackArgs = {
  onSpeechCacheReady?: (messageId: string, voiceCache: ChatMessageVoiceCache) => void;
  /** Fires once the first clip is really running, with the seconds the whole reply will take. */
  onPlaybackStarted?: (durationSec: number) => void;
  onError?: (message: string) => void;
};

type UseVoiceCallPlaybackResult = {
  status: VoiceCallPlaybackStatus;
  activeMessageId: string | null;
  visibleParts: VoiceCallCaptionSourcePart[];
  canSpeak: boolean;
  speak: (args: SpeakArgs) => void;
  playCachedClip: (messageId: string, cache: ChatMessageVoiceCache, caption: VoiceCallCaptionSourcePart[]) => void;
  stop: () => void;
};

type Synthesize = (unit: VoiceCallSpeechUnit) => Promise<SynthOutcome>;
type SynthOutcome = { ok: true; result: VoiceGenerationResult } | { ok: false };
type ClipOutcome = 'ended' | 'failed' | 'stopped' | 'blocked';
type WaitOutcome = 'waited' | 'stopped';

function sameParts(left: VoiceCallCaptionSourcePart[], right: VoiceCallCaptionSourcePart[]) {
  if (left.length !== right.length) return false;
  return left.every((part, index) => part.kind === right[index].kind && part.text === right[index].text);
}

function measuredSeconds(audio: HTMLAudioElement) {
  return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
}

function weightBefore(plan: VoiceCallSpeechPlan, index: number) {
  let weight = 0;
  for (let cursor = 0; cursor < index; cursor += 1) weight += plan.units[cursor].weight;
  return weight;
}

const NEVER_SYNTHESIZE: Synthesize = async () => ({ ok: false });

/**
 * Plays one generated reply inside the call stage, a spoken line at a time, and reveals
 * its caption along the audio clock. Each line is synthesised on its own so the first
 * one can start while the rest are still being generated.
 */
export function useVoiceCallPlayback({
  onSpeechCacheReady,
  onPlaybackStarted,
  onError
}: UseVoiceCallPlaybackArgs = {}): UseVoiceCallPlaybackResult {
  const voiceGeneration = useVoiceSettingsForSpeaker(null);
  const [status, setStatus] = useState<VoiceCallPlaybackStatus>('idle');
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [visibleParts, setVisibleParts] = useState<VoiceCallCaptionSourcePart[]>([]);

  const audioUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const frameRef = useRef<number | null>(null);
  const segmentsRef = useRef<VoiceCallCaptionSegment[]>([]);
  const visiblePartsRef = useRef<VoiceCallCaptionSourcePart[]>([]);
  const totalWeightRef = useRef(0);
  const runIdRef = useRef(0);
  const cancelWaitRef = useRef<(() => void) | null>(null);
  const resumeRef = useRef<{ messageId: string; plan: VoiceCallSpeechPlan; index: number; blob: Blob } | null>(null);
  const retryRef = useRef<(() => void) | null>(null);
  const onSpeechCacheReadyRef = useRef(onSpeechCacheReady);
  const onPlaybackStartedRef = useRef(onPlaybackStarted);
  const onErrorRef = useRef(onError);

  onSpeechCacheReadyRef.current = onSpeechCacheReady;
  onPlaybackStartedRef.current = onPlaybackStarted;
  onErrorRef.current = onError;

  const canSpeak = Boolean(voiceGeneration.enabled && voiceGeneration.baseUrl?.trim() && voiceGeneration.apiKey?.trim());

  const cancelFrameLoop = useCallback(() => {
    if (frameRef.current === null) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const clearRetryListener = useCallback(() => {
    if (!retryRef.current) return;
    window.removeEventListener('pointerdown', retryRef.current, true);
    retryRef.current = null;
  }, []);

  const releaseAudio = useCallback(() => {
    cancelFrameLoop();
    clearRetryListener();
    setCallAudioInUse(false);
    const audio = getCallAudio();
    audio.onended = null;
    audio.onerror = null;
    audio.onloadedmetadata = null;
    audio.pause();
    audio.removeAttribute('src');
    const url = audioUrlRef.current;
    if (url) {
      URL.revokeObjectURL(url);
      audioUrlRef.current = null;
    }
  }, [cancelFrameLoop, clearRetryListener]);

  const stop = useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    cancelWaitRef.current?.();
    cancelWaitRef.current = null;
    resumeRef.current = null;
    releaseAudio();
    segmentsRef.current = [];
    visiblePartsRef.current = [];
    totalWeightRef.current = 0;
    setVisibleParts([]);
    setActiveMessageId(null);
    setStatus('idle');
  }, [releaseAudio]);

  useEffect(() => () => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    cancelWaitRef.current?.();
    resumeRef.current = null;
    releaseAudio();
  }, [releaseAudio]);

  const reveal = useCallback((weight: number) => {
    const total = totalWeightRef.current;
    const next = resolveVoiceCallVisibleParts(segmentsRef.current, total > 0 ? weight / total : 0);
    if (sameParts(visiblePartsRef.current, next)) return;
    visiblePartsRef.current = next;
    setVisibleParts(next);
  }, []);

  const startFrameLoop = useCallback((getWeight: () => number) => {
    cancelFrameLoop();
    const tick = () => {
      reveal(getWeight());
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [cancelFrameLoop, reveal]);

  const holdSilence = useCallback((ms: number, getWeight: (progress: number) => number) => new Promise<WaitOutcome>((resolve) => {
    let settled = false;
    let timer = 0;

    const finish = (outcome: WaitOutcome) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cancelFrameLoop();
      cancelWaitRef.current = null;
      resolve(outcome);
    };

    cancelWaitRef.current = () => finish('stopped');
    const startedAt = Date.now();
    startFrameLoop(() => getWeight(Math.min(1, (Date.now() - startedAt) / ms)));
    timer = window.setTimeout(() => {
      reveal(getWeight(1));
      finish('waited');
    }, ms);
  }), [cancelFrameLoop, reveal, startFrameLoop]);

  const playClip = useCallback((blob: Blob, unit: VoiceCallSpeechUnit, baseWeight: number, onStarted?: (seconds: number) => void) => {
    return new Promise<ClipOutcome>((resolve) => {
      let settled = false;
      let startedAt = 0;
      const url = URL.createObjectURL(blob);
      const audio = getCallAudio();
      const speechWeight = Math.max(0, unit.weight - unit.stageWeight);
      const estimate = estimateSpeechSeconds(unit.tts);

      const finish = (outcome: ClipOutcome) => {
        if (settled) return;
        settled = true;
        cancelFrameLoop();
        cancelWaitRef.current = null;
        audio.onended = null;
        audio.onerror = null;
        audio.onloadedmetadata = null;
        if (audioUrlRef.current === url) {
          audioUrlRef.current = null;
          audio.pause();
          audio.removeAttribute('src');
          URL.revokeObjectURL(url);
        }
        resolve(outcome);
      };

      cancelWaitRef.current = () => finish('stopped');
      setCallAudioInUse(true);
      audio.onloadedmetadata = () => {
        onStarted?.(measuredSeconds(audio) ?? estimate);
      };
      audio.onended = () => {
        reveal(baseWeight + unit.weight);
        finish('ended');
      };
      audio.onerror = () => finish('failed');
      audio.src = url;
      audioUrlRef.current = url;

      void audio.play().then(() => {
        markCallAudioUnlocked();
        if (settled) return;
        startedAt = Date.now();
        startFrameLoop(() => {
          const duration = audio.duration;
          const progress = Number.isFinite(duration) && duration > 0
            ? audio.currentTime / duration
            : (Date.now() - startedAt) / 1000 / estimate;
          return baseWeight + unit.stageWeight + Math.min(1, progress) * speechWeight;
        });
      }).catch(() => {
        if (settled) return;
        markCallAudioBlocked();
        finish('blocked');
      });
    });
  }, [cancelFrameLoop, reveal, startFrameLoop]);

  const runPlan = useCallback(async (
    runId: number,
    messageId: string,
    plan: VoiceCallSpeechPlan,
    startIndex: number,
    firstBlob: Blob | null,
    synthesize: Synthesize
  ) => {
    const isStale = () => runIdRef.current !== runId;
    const remainingSeconds = (seconds: number) => estimatePlanSeconds(plan, seconds);
    let announced = false;
    let playedAny = false;
    let pendingRequest: Promise<SynthOutcome> | null = null;

    const settle = (outcome: 'idle' | 'text-only', errorCode?: string) => {
      if (isStale()) return;
      if (outcome === 'text-only') reveal(totalWeightRef.current);
      releaseAudio();
      setActiveMessageId(null);
      setStatus('idle');
      if (errorCode) onErrorRef.current?.(errorCode);
    };

    for (let index = startIndex; index < plan.units.length; index += 1) {
      const unit = plan.units[index];
      const baseWeight = weightBefore(plan, index);
      let blob = index === startIndex ? firstBlob : null;
      let generated: VoiceGenerationResult | null = null;

      if (!blob) {
        const request = pendingRequest ?? synthesize(unit);
        pendingRequest = null;
        const outcome = await request;
        if (isStale()) return;
        if (!outcome.ok) {
          settle(playedAny ? 'text-only' : 'idle', playedAny ? undefined : 'speech-generation-failed');
          return;
        }
        blob = outcome.result.blob;
        generated = outcome.result;
      }

      if (index + 1 < plan.units.length) {
        pendingRequest = synthesize(plan.units[index + 1]);
      }

      if (generated && plan.units.length === 1) {
        void saveMessageSpeechCache({ text: unit.tts, settings: voiceGeneration, result: generated })
          .then((voiceCache) => {
            if (runIdRef.current === runId && !abortRef.current?.signal.aborted) {
              onSpeechCacheReadyRef.current?.(messageId, voiceCache);
            }
          })
          .catch(() => {
            // Caching is best-effort; playback should still continue.
          });
      }

      setStatus('speaking');
      if (unit.pauseBeforeMs > 0) {
        const waited = await holdSilence(unit.pauseBeforeMs, (progress) => baseWeight + progress * unit.stageWeight);
        if (waited === 'stopped' || isStale()) return;
      }

      const clip = await playClip(blob, unit, baseWeight, announced ? undefined : (seconds) => {
        announced = true;
        onPlaybackStartedRef.current?.(remainingSeconds(seconds));
      });

      if (clip === 'stopped' || isStale()) return;
      if (clip === 'failed') {
        settle('idle', 'audio-playback-failed');
        return;
      }
      if (clip === 'blocked') {
        if (isStale()) return;
        releaseAudio();
        setActiveMessageId(null);
        setStatus('idle');
        onErrorRef.current?.('autoplay-blocked');
        resumeRef.current = { messageId, plan, index, blob };
        const retry = () => {
          const pending = resumeRef.current;
          clearRetryListener();
          if (!pending) return;
          resumeRef.current = null;
          setActiveMessageId(pending.messageId);
          setStatus('generating');
          void runPlan(runId, pending.messageId, pending.plan, pending.index, pending.blob, synthesize);
        };
        retryRef.current = retry;
        window.addEventListener('pointerdown', retry, true);
        return;
      }
      playedAny = true;
    }

    if (isStale()) return;
    releaseAudio();
    setActiveMessageId(null);
    setStatus('idle');
  }, [clearRetryListener, holdSilence, playClip, releaseAudio, reveal, voiceGeneration]);

  const prepareCaption = useCallback((plan: VoiceCallSpeechPlan) => {
    const segments: VoiceCallCaptionSegment[] = [];
    for (const unit of plan.units) segments.push(...unit.segments);
    segmentsRef.current = segments;
    totalWeightRef.current = plan.totalWeight;
    visiblePartsRef.current = [];
    setVisibleParts([]);
  }, []);

  const speak = useCallback(({ messageId, plan }: SpeakArgs) => {
    stop();
    if (plan.units.length === 0 || plan.totalWeight <= 0) return;

    if (!canSpeak) {
      onErrorRef.current?.('voice-provider-missing');
      return;
    }

    const runId = runIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    prepareCaption(plan);
    setActiveMessageId(messageId);
    setStatus('generating');

    const synthesize: Synthesize = async (unit) => {
      try {
        const result = await requestGeneratedSpeech({
          settings: voiceGeneration,
          text: unit.tts,
          signal: controller.signal
        });
        return { ok: true, result };
      } catch {
        return { ok: false };
      }
    };

    void runPlan(runId, messageId, plan, 0, null, synthesize);
  }, [canSpeak, prepareCaption, runPlan, stop, voiceGeneration]);

  const playCachedClip = useCallback((messageId: string, cache: ChatMessageVoiceCache, caption: VoiceCallCaptionSourcePart[]) => {
    stop();
    const plan = buildWholeClipPlan(caption);
    if (plan.units.length === 0) return;

    const runId = runIdRef.current;
    prepareCaption(plan);
    setActiveMessageId(messageId);
    setStatus('generating');
    void (async () => {
      try {
        const blob = await readMessageSpeechCacheBlob(cache);
        if (runIdRef.current !== runId) return;
        await runPlan(runId, messageId, plan, 0, blob, NEVER_SYNTHESIZE);
      } catch {
        if (runIdRef.current !== runId) return;
        setActiveMessageId(null);
        setStatus('idle');
        onErrorRef.current?.('speech-cache-missing');
      }
    })();
  }, [prepareCaption, runPlan, stop]);

  return {
    status,
    activeMessageId,
    visibleParts,
    canSpeak,
    speak,
    stop,
    playCachedClip
  };
}
