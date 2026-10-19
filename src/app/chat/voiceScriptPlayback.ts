import { useCallback, useRef, useState } from 'react';
import { AudioQueueManager } from '../../engines/voiceScriptAudioQueue';
import { requestGeneratedSpeech } from '../../engines/voiceGenerationClient';
import { useVoiceSettingsForSpeaker } from '../voice/useVoiceSettingsForSpeaker';
import { buildAssistantSpeechPlan, buildStreamingVoicePlan } from '../../ui/worlds/chat/message/messageSpeechText';
import type { VoiceCallSpeechPlan, VoiceCallSpeechUnit } from '../../engines/voice/voiceCallSpeechUnits';
import type { ChatMessageVoiceCache } from '../../types/domain';
import type { FleshCue } from '../../engines/voice/fleshAmbience';
import { readMessageSpeechCacheBlob, saveMessageSpeechCache } from './messageSpeechCache';

/** Default silence between spoken lines in voice-script mode (ms). */
const VOICE_SCRIPT_GAP_MS = 200;

export type UseVoiceScriptPlaybackArgs = {
  speakerCollaboratorId?: string | null;
  onSpeechCacheReady?: (voiceCache: ChatMessageVoiceCache) => void;
  /** Fires when a spoken line starts: body sounds marked in (or just before) that line begin now. */
  onStarted?: (durationSec: number, cues: FleshCue[]) => void;
  /** Fires when the reply's last line ends: markers written after it start now. */
  onEnded?: (cues: FleshCue[]) => void;
};

export type UseVoiceScriptPlaybackResult = {
  speaking: boolean;
  loading: boolean;
  /**
   * Start the per-sentence TTS pipeline for a reply. Returns true when a run
   * actually began. With streaming=true only closed lines are synthesised and
   * later content keeps feeding the same run via feedStream; with streaming=false
   * the reply is final.
   */
  speak: (messageId: string, content: string, cache?: ChatMessageVoiceCache | null, streaming?: boolean) => boolean;
  /** Feed newly arrived content into the running stream for this message. */
  feedStream: (messageId: string, content: string) => void;
  /** Mark the streamed reply as complete: the run finishes after the queued lines. */
  finalize: (messageId: string, content: string) => void;
  /** Stop everything — current clip, queued clips, pending synthesis. */
  stop: () => void;
};

type UnitState = {
  unit: VoiceCallSpeechUnit;
  blob: Promise<Blob> | null;
};

type ScriptSession = {
  runId: number;
  controller: AbortController;
  cache: ChatMessageVoiceCache | null;
  queue: UnitState[];
  settled: boolean;
  trailingCues: FleshCue[];
  resolveWake: (() => void) | null;
};

/**
 * Per-message playback hook for 音声模式. Splits a reply into spoken lines,
 * synthesises each line independently and plays them back one by one. While the
 * reply is still streaming, every line whose 【…】 closed is sent to synthesis
 * right away, so the audio for early lines is ready by the time the text lands.
 */
export function useVoiceScriptPlayback({
  speakerCollaboratorId = null,
  onSpeechCacheReady,
  onStarted,
  onEnded
}: UseVoiceScriptPlaybackArgs = {}): UseVoiceScriptPlaybackResult {
  const voiceGeneration = useVoiceSettingsForSpeaker(speakerCollaboratorId);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);

  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const queueRef = useRef<AudioQueueManager | null>(null);
  const sessionRef = useRef<ScriptSession | null>(null);
  const sessionMessageIdRef = useRef<string | null>(null);
  const onStartedRef = useRef(onStarted);
  const onEndedRef = useRef(onEnded);
  const onSpeechCacheReadyRef = useRef(onSpeechCacheReady);
  onStartedRef.current = onStarted;
  onEndedRef.current = onEnded;
  onSpeechCacheReadyRef.current = onSpeechCacheReady;

  const canSpeak = Boolean(
    voiceGeneration.enabled
    && voiceGeneration.baseUrl?.trim()
    && voiceGeneration.apiKey?.trim()
  );

  const stop = useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    queueRef.current?.stop();
    queueRef.current = null;
    sessionRef.current = null;
    sessionMessageIdRef.current = null;
    setSpeaking(false);
    setLoading(false);
  }, []);

  const wake = (session: ScriptSession) => {
    const resolve = session.resolveWake;
    session.resolveWake = null;
    resolve?.();
  };

  const startSynthesis = (session: ScriptSession, state: UnitState, index: number) => {
    const runId = session.runId;
    const settings = voiceGeneration;
    const isStale = () => runIdRef.current !== runId;

    // The first line of a single-unit reply can come straight from the cache.
    if (index === 0 && session.cache?.assetId && session.queue.length === 1) {
      state.blob = readMessageSpeechCacheBlob(session.cache).catch(async () => {
        if (isStale() || !canSpeak) throw new Error('speech unavailable');
        const outcome = await requestGeneratedSpeech({
          settings,
          text: state.unit.tts,
          signal: session.controller.signal
        });
        return outcome.blob;
      });
      return;
    }

    state.blob = (async () => {
      const outcome = await requestGeneratedSpeech({
        settings,
        text: state.unit.tts,
        signal: session.controller.signal
      });
      // A reply that never grew past one line: keep the take for next time.
      if (session.settled && session.queue.length === 1) {
        void saveMessageSpeechCache({
          text: state.unit.tts,
          settings,
          result: outcome
        }).then((voiceCache) => {
          if (runIdRef.current === runId) {
            onSpeechCacheReadyRef.current?.(voiceCache);
          }
        }).catch(() => {
          // Caching is best-effort.
        });
      }
      return outcome.blob;
    })();
  };

  const feedUnits = (session: ScriptSession, plan: VoiceCallSpeechPlan | null, settled: boolean) => {
    const units = plan?.units ?? [];
    while (session.queue.length < units.length) {
      const index = session.queue.length;
      const state: UnitState = { unit: units[index], blob: null };
      session.queue.push(state);
      if (canSpeak) startSynthesis(session, state, index);
    }
    if (settled && session.queue.length === 1 && !canSpeak) {
      // Cached-only single line: play it once the queue knows nothing more arrives.
      session.queue[0].blob = session.queue[0].blob ?? readMessageSpeechCacheBlob(session.cache!)
        .catch(() => Promise.reject(new Error('speech unavailable')));
    }
    session.settled = session.settled || settled;
    if (settled) session.trailingCues = plan?.trailingCues ?? [];
    wake(session);
  };

  const runSession = (session: ScriptSession) => {
    const runId = session.runId;
    const isStale = () => runIdRef.current !== runId;

    void (async () => {
      let index = 0;
      while (true) {
        if (isStale() || session.controller.signal.aborted) return;
        if (index >= session.queue.length) {
          if (session.settled) break;
          await new Promise<void>((resolve) => {
            session.resolveWake = resolve;
          });
          continue;
        }

        const state = session.queue[index];
        index += 1;
        let blob: Blob | null = null;
        if (state.blob) {
          try {
            blob = await state.blob;
          } catch {
            if (isStale() || session.controller.signal.aborted) return;
            blob = null;
          }
        }
        if (!blob) continue;

        // Each unit gets its own queue so the onEnded callback is bound to
        // exactly one clip — no shared-mutable-state issues between iterations.
        const result = await new Promise<'ended' | 'error' | 'blocked'>((resolve) => {
          let settledFlag = false;
          const settle = (value: 'ended' | 'error' | 'blocked') => {
            if (settledFlag) return;
            settledFlag = true;
            resolve(value);
          };

          const queue = new AudioQueueManager(VOICE_SCRIPT_GAP_MS, {
            onStarted: () => {
              if (isStale()) return;
              setSpeaking(true);
              setLoading(false);
              if (state.unit.startsLine) {
                onStartedRef.current?.(0, state.unit.cues);
              }
            },
            onEnded: () => settle('ended'),
            onError: () => settle('error'),
            onBlocked: () => settle('blocked')
          });
          queueRef.current = queue;
          queue.enqueue(blob as Blob);
        });

        if (isStale() || session.controller.signal.aborted) return;
        if (result === 'blocked') { stop(); return; }
        // On error, skip this unit and continue to the next.
      }

      if (isStale()) return;
      queueRef.current = null;
      sessionRef.current = null;
      sessionMessageIdRef.current = null;
      if (session.trailingCues.length) onEndedRef.current?.(session.trailingCues);
      setSpeaking(false);
      setLoading(false);
    })();
  };

  const speak = useCallback((
    messageId: string,
    content: string,
    cache?: ChatMessageVoiceCache | null,
    streaming = false
  ): boolean => {
    stop();

    if (!canSpeak && !cache?.assetId) return false;

    const plan = streaming ? buildStreamingVoicePlan(content) : buildAssistantSpeechPlan(content);
    if (!plan || plan.units.length === 0) return false;

    const runId = ++runIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    queueRef.current?.stop();

    const session: ScriptSession = {
      runId,
      controller,
      cache: cache ?? null,
      queue: [],
      settled: !streaming,
      trailingCues: [],
      resolveWake: null
    };
    sessionRef.current = session;
    sessionMessageIdRef.current = messageId;

    setSpeaking(true);
    setLoading(true);
    feedUnits(session, plan, !streaming);
    runSession(session);
    return true;
  }, [canSpeak, stop, voiceGeneration]);

  const feedStream = useCallback((messageId: string, content: string) => {
    const session = sessionRef.current;
    if (!session || sessionMessageIdRef.current !== messageId || session.settled) return;
    feedUnits(session, buildStreamingVoicePlan(content), false);
  }, []);

  const finalize = useCallback((messageId: string, content: string) => {
    const session = sessionRef.current;
    if (session && sessionMessageIdRef.current === messageId && !session.settled) {
      feedUnits(session, buildAssistantSpeechPlan(content), true);
      return;
    }
    if (sessionMessageIdRef.current === messageId) return;
    speak(messageId, content, null, false);
  }, [speak]);

  return {
    speaking,
    loading,
    speak,
    feedStream,
    finalize,
    stop
  };
}
