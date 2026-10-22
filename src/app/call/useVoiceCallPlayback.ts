import { useCallback, useEffect, useRef, useState } from 'react';
import { readMessageSpeechCacheBlob, saveMessageSpeechCache } from '../chat/messageSpeechCache';
import { requestGeneratedSpeech } from '../../engines/voiceGenerationClient';
import {
  resolveVoiceCallVisibleParts,
  type VoiceCallCaptionSegment,
  type VoiceCallCaptionSourcePart
} from '../../engines/voice/voiceCallCaption';
import {
  buildWholeClipPlan,
  estimateSpeechSeconds,
  type VoiceCallSpeechPlan,
  type VoiceCallSpeechUnit
} from '../../engines/voice/voiceCallSpeechUnits';
import { buildAssistantSpeechPlan, buildStreamingVoicePlan } from '../../ui/worlds/chat/message/messageSpeechText';
import { useVoiceSettingsForSpeaker } from '../voice/useVoiceSettingsForSpeaker';
import { getCallAudio, markCallAudioBlocked, markCallAudioUnlocked, setCallAudioInUse } from './callAudio';
import type { ChatMessageVoiceCache } from '../../types/domain';
import type { FleshCue } from '../../engines/voice/fleshAmbience';

export type VoiceCallPlaybackStatus = 'idle' | 'generating' | 'speaking';

type UseVoiceCallPlaybackArgs = {
  onSpeechCacheReady?: (messageId: string, voiceCache: ChatMessageVoiceCache) => void;
  /** For the cached whole-reply take: fires once that clip starts, with its length in seconds. */
  onPlaybackStarted?: (durationSec: number) => void;
  /** Fires when a synthesised line starts: the body sounds marked in that line begin now. */
  onLineStarted?: (cues: FleshCue[]) => void;
  /** Fires when the settled reply's last line ends: markers written after it start now. */
  onLineEnded?: (cues: FleshCue[]) => void;
  onError?: (message: string) => void;
};

type UseVoiceCallPlaybackResult = {
  status: VoiceCallPlaybackStatus;
  activeMessageId: string | null;
  visibleParts: VoiceCallCaptionSourcePart[];
  canSpeak: boolean;
  /**
   * Start the per-sentence pipeline for a reply. With streaming=true only the closed
   * lines are synthesised and feedStream keeps growing the same run; with
   * streaming=false the reply is final. Returns true when a run actually began.
   */
  speak: (messageId: string, content: string, streaming?: boolean) => boolean;
  feedStream: (messageId: string, content: string) => void;
  finalize: (messageId: string, content: string) => void;
  playCachedClip: (messageId: string, cache: ChatMessageVoiceCache, caption: VoiceCallCaptionSourcePart[]) => void;
  stop: () => void;
};

type UnitState = {
  unit: VoiceCallSpeechUnit;
  blob: Promise<Blob> | null;
};

type CallSession = {
  runId: number;
  controller: AbortController;
  messageId: string;
  /** True for a cached whole-reply take: it carries no per-line cues. */
  fromCache: boolean;
  units: UnitState[];
  settled: boolean;
  trailingCues: FleshCue[];
  resolveWake: (() => void) | null;
};

type ClipOutcome = 'ended' | 'failed' | 'stopped' | 'blocked';
type WaitOutcome = 'waited' | 'stopped';

function sameParts(left: VoiceCallCaptionSourcePart[], right: VoiceCallCaptionSourcePart[]) {
  if (left.length !== right.length) return false;
  return left.every((part, index) => part.kind === right[index].kind && part.text === right[index].text);
}

function measuredSeconds(audio: HTMLAudioElement) {
  return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
}

function weightBefore(session: CallSession, index: number) {
  let weight = 0;
  for (let cursor = 0; cursor < index; cursor += 1) weight += session.units[cursor].unit.weight;
  return weight;
}

/**
 * Plays one generated reply inside the call stage, a spoken line at a time, and reveals
 * its caption along the audio clock. Each line is synthesised on its own and — while the
 * reply is still streaming — every line whose 【…】 closed goes to synthesis right away,
 * so the first lines speak while the model is still writing. Body sounds ride the line
 * that marks them, the same schedule the chat voice-script mode uses.
 */
export function useVoiceCallPlayback({
  onSpeechCacheReady,
  onPlaybackStarted,
  onLineStarted,
  onLineEnded,
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
  const sessionRef = useRef<CallSession | null>(null);
  const resumeRef = useRef<{ session: CallSession; index: number; blob: Blob } | null>(null);
  const retryRef = useRef<(() => void) | null>(null);
  const onSpeechCacheReadyRef = useRef(onSpeechCacheReady);
  const onPlaybackStartedRef = useRef(onPlaybackStarted);
  const onLineStartedRef = useRef(onLineStarted);
  const onLineEndedRef = useRef(onLineEnded);
  const onErrorRef = useRef(onError);
  onSpeechCacheReadyRef.current = onSpeechCacheReady;
  onPlaybackStartedRef.current = onPlaybackStarted;
  onLineStartedRef.current = onLineStarted;
  onLineEndedRef.current = onLineEnded;
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
    sessionRef.current = null;
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
    sessionRef.current = null;
    releaseAudio();
  }, [releaseAudio]);

  const reveal = useCallback((weight: number) => {
    const total = totalWeightRef.current;
    const next = resolveVoiceCallVisibleParts(segmentsRef.current, total > 0 ? Math.min(1, weight / total) : 0);
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

  const wake = (session: CallSession) => {
    const resolve = session.resolveWake;
    session.resolveWake = null;
    resolve?.();
  };

  const startSynthesis = (session: CallSession, unit: VoiceCallSpeechUnit): Promise<Blob> => {
    const runId = session.runId;
    return (async () => {
      const outcome = await requestGeneratedSpeech({
        settings: voiceGeneration,
        text: unit.tts,
        signal: session.controller.signal
      });
      // A reply that never grew past one line: keep the take for next time.
      if (session.settled && session.units.length === 1) {
        void saveMessageSpeechCache({ text: unit.tts, settings: voiceGeneration, result: outcome })
          .then((voiceCache) => {
            if (runIdRef.current === runId && !session.controller.signal.aborted) {
              onSpeechCacheReadyRef.current?.(session.messageId, voiceCache);
            }
          })
          .catch(() => {
            // Caching is best-effort.
          });
      }
      return outcome.blob;
    })();
  };

  /** Grow the running session with the units of a freshly built plan; only new units get synthesised. */
  const appendUnits = (session: CallSession, plan: VoiceCallSpeechPlan | null, settled: boolean) => {
    if (plan) {
      while (session.units.length < plan.units.length) {
        const index = session.units.length;
        const unit = plan.units[index];
        const synthesise = !session.fromCache && canSpeak;
        session.units.push({ unit, blob: synthesise ? startSynthesis(session, unit) : null });
        segmentsRef.current.push(...unit.segments);
        totalWeightRef.current += unit.weight;
      }
      if (settled) session.trailingCues = plan.trailingCues;
    }
    if (settled) session.settled = true;
    wake(session);
  };

  const runSession = (session: CallSession, startIndex: number, firstBlob: Blob | null) => {
    const runId = session.runId;
    const isStale = () => runIdRef.current !== runId;

    void (async () => {
      let index = startIndex;
      let announced = false;
      let playedAny = false;
      let skippedAny = false;

      while (true) {
        if (isStale() || session.controller.signal.aborted) return;
        if (index >= session.units.length) {
          if (session.settled) break;
          await new Promise<void>((resolve) => {
            session.resolveWake = resolve;
          });
          continue;
        }

        const state = session.units[index];
        const unit = state.unit;
        const baseWeight = weightBefore(session, index);
        let blob = index === startIndex ? firstBlob : null;
        if (!blob && state.blob) {
          try {
            blob = await state.blob;
          } catch {
            if (isStale() || session.controller.signal.aborted) return;
            skippedAny = true;
            index += 1;
            continue;
          }
        }
        if (!blob) {
          skippedAny = true;
          index += 1;
          continue;
        }
        index += 1;

        setStatus('speaking');
        if (unit.pauseBeforeMs > 0) {
          const waited = await holdSilence(unit.pauseBeforeMs, (progress) => baseWeight + progress * unit.stageWeight);
          if (waited === 'stopped' || isStale()) return;
        }

        const clip = await playClip(blob, unit, baseWeight, (seconds) => {
          if (session.fromCache) {
            if (!announced) {
              announced = true;
              onPlaybackStartedRef.current?.(seconds);
            }
            return;
          }
          if (unit.startsLine) onLineStartedRef.current?.(unit.cues);
        });

        if (isStale() || session.controller.signal.aborted) return;
        if (clip === 'failed') {
          releaseAudio();
          setActiveMessageId(null);
          setStatus('idle');
          onErrorRef.current?.('audio-playback-failed');
          return;
        }
        if (clip === 'blocked') {
          releaseAudio();
          setActiveMessageId(null);
          setStatus('idle');
          onErrorRef.current?.('autoplay-blocked');
          resumeRef.current = { session, index: index - 1, blob };
          const retry = () => {
            const pending = resumeRef.current;
            clearRetryListener();
            if (!pending) return;
            resumeRef.current = null;
            setActiveMessageId(pending.session.messageId);
            setStatus('generating');
            runSession(pending.session, pending.index, pending.blob);
          };
          retryRef.current = retry;
          window.addEventListener('pointerdown', retry, true);
          return;
        }
        playedAny = true;
      }

      if (isStale()) return;
      if (skippedAny) reveal(totalWeightRef.current);
      sessionRef.current = null;
      releaseAudio();
      setActiveMessageId(null);
      setStatus('idle');
      if (!session.fromCache && session.trailingCues.length) onLineEndedRef.current?.(session.trailingCues);
      if (!playedAny && skippedAny) onErrorRef.current?.('speech-generation-failed');
    })();
  };

  const prepareCaption = () => {
    segmentsRef.current = [];
    totalWeightRef.current = 0;
    visiblePartsRef.current = [];
    setVisibleParts([]);
  };

  const speak = useCallback((messageId: string, content: string, streaming = false): boolean => {
    stop();
    if (!canSpeak) {
      onErrorRef.current?.('voice-provider-missing');
      return false;
    }
    const plan = streaming ? buildStreamingVoicePlan(content) : buildAssistantSpeechPlan(content);
    if (!plan || plan.units.length === 0) return false;

    const session: CallSession = {
      runId: runIdRef.current,
      controller: new AbortController(),
      messageId,
      fromCache: false,
      units: [],
      settled: !streaming,
      trailingCues: streaming ? [] : plan.trailingCues,
      resolveWake: null
    };
    abortRef.current = session.controller;
    sessionRef.current = session;
    prepareCaption();
    setActiveMessageId(messageId);
    setStatus('generating');
    appendUnits(session, plan, !streaming);
    runSession(session, 0, null);
    return true;
  }, [canSpeak, appendUnits, runSession, stop]);

  const feedStream = useCallback((messageId: string, content: string) => {
    const session = sessionRef.current;
    if (!session || session.messageId !== messageId || session.settled) return;
    appendUnits(session, buildStreamingVoicePlan(content), false);
  }, [appendUnits]);

  const finalize = useCallback((messageId: string, content: string) => {
    const session = sessionRef.current;
    if (!session || session.messageId !== messageId || session.settled) return;
    appendUnits(session, buildAssistantSpeechPlan(content), true);
  }, [appendUnits]);

  const playCachedClip = useCallback((messageId: string, cache: ChatMessageVoiceCache, caption: VoiceCallCaptionSourcePart[]) => {
    stop();
    const plan = buildWholeClipPlan(caption);
    if (plan.units.length === 0) return;

    const session: CallSession = {
      runId: runIdRef.current,
      controller: new AbortController(),
      messageId,
      fromCache: true,
      units: [],
      settled: true,
      trailingCues: [],
      resolveWake: null
    };
    abortRef.current = session.controller;
    sessionRef.current = session;
    prepareCaption();
    setActiveMessageId(messageId);
    setStatus('generating');
    appendUnits(session, plan, true);
    void (async () => {
      try {
        const blob = await readMessageSpeechCacheBlob(cache);
        if (runIdRef.current !== session.runId) return;
        runSession(session, 0, blob);
      } catch {
        if (runIdRef.current !== session.runId) return;
        sessionRef.current = null;
        setActiveMessageId(null);
        setStatus('idle');
        onErrorRef.current?.('speech-cache-missing');
      }
    })();
  }, [appendUnits, runSession, stop]);

  return {
    status,
    activeMessageId,
    visibleParts,
    canSpeak,
    speak,
    feedStream,
    finalize,
    playCachedClip,
    stop
  };
}
