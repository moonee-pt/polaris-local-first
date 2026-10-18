import { useCallback, useRef, useState } from 'react';
import { AudioQueueManager } from '../../engines/voiceScriptAudioQueue';
import { requestGeneratedSpeech } from '../../engines/voiceGenerationClient';
import { useVoiceSettingsForSpeaker } from '../voice/useVoiceSettingsForSpeaker';
import { buildAssistantSpeechPlan } from '../../ui/worlds/chat/message/messageSpeechText';
import type { VoiceCallSpeechPlan } from '../../engines/voice/voiceCallSpeechUnits';
import type { ChatMessageVoiceCache } from '../../types/domain';
import { readMessageSpeechCacheBlob, saveMessageSpeechCache } from './messageSpeechCache';

/** Default silence between spoken lines in voice-script mode (ms). */
const VOICE_SCRIPT_GAP_MS = 200;

export type UseVoiceScriptPlaybackArgs = {
  speakerCollaboratorId?: string | null;
  onSpeechCacheReady?: (voiceCache: ChatMessageVoiceCache) => void;
  onStarted?: (durationSec: number) => void;
};

export type UseVoiceScriptPlaybackResult = {
  speaking: boolean;
  loading: boolean;
  /** Start the per-sentence TTS pipeline for a reply. */
  speak: (messageId: string, content: string, cache?: ChatMessageVoiceCache | null) => void;
  /** Stop everything — current clip, queued clips, pending synthesis. */
  stop: () => void;
};

/**
 * Per-message playback hook for 音声模式. Splits a reply into spoken lines via
 * `buildAssistantSpeechPlan`, synthesises each line independently, and plays them
 * back one by one with silence gaps — so the first line can start while later
 * lines are still being generated.
 */
export function useVoiceScriptPlayback({
  speakerCollaboratorId = null,
  onSpeechCacheReady,
  onStarted
}: UseVoiceScriptPlaybackArgs = {}): UseVoiceScriptPlaybackResult {
  const voiceGeneration = useVoiceSettingsForSpeaker(speakerCollaboratorId);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);

  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const queueRef = useRef<AudioQueueManager | null>(null);
  const onStartedRef = useRef(onStarted);
  const onSpeechCacheReadyRef = useRef(onSpeechCacheReady);
  onStartedRef.current = onStarted;
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
    setSpeaking(false);
    setLoading(false);
  }, []);

  const speakPlan = useCallback(async (
    messageId: string,
    content: string,
    plan: VoiceCallSpeechPlan,
    cache: ChatMessageVoiceCache | null
  ) => {
    const runId = ++runIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    queueRef.current?.stop();

    const isStale = () => runIdRef.current !== runId;

    setLoading(true);

    // Pipeline: synthesise each unit and play it before moving to the next.
    // While one clip plays, the next is already being generated.
    void (async () => {
      try {
        for (let index = 0; index < plan.units.length; index += 1) {
          if (isStale() || controller.signal.aborted) return;

          const unit = plan.units[index];
          let blob: Blob;

          // For a single-unit plan with a matching cache, skip synthesis entirely.
          if (index === 0 && cache?.assetId && plan.units.length === 1) {
            try {
              blob = await readMessageSpeechCacheBlob(cache);
            } catch {
              if (isStale() || !canSpeak) return;
              const outcome = await requestGeneratedSpeech({
                settings: voiceGeneration,
                text: unit.tts,
                signal: controller.signal
              });
              if (isStale()) return;
              blob = outcome.blob;
            }
          } else {
            const outcome = await requestGeneratedSpeech({
              settings: voiceGeneration,
              text: unit.tts,
              signal: controller.signal
            });
            if (isStale()) return;
            blob = outcome.blob;

            // Single-unit reply: cache the result for next time.
            if (plan.units.length === 1) {
              void saveMessageSpeechCache({
                text: unit.tts,
                settings: voiceGeneration,
                result: outcome
              }).then((voiceCache) => {
                if (runIdRef.current === runId) {
                  onSpeechCacheReadyRef.current?.(voiceCache);
                }
              }).catch(() => {
                // Caching is best-effort.
              });
            }
          }

          // Each unit gets its own queue so the onEnded callback is bound to
          // exactly one clip — no shared-mutable-state issues between iterations.
          const idlePromise = new Promise<'ended' | 'error' | 'blocked'>((resolve) => {
            let settled = false;
            const settle = (result: 'ended' | 'error' | 'blocked') => {
              if (settled) return;
              settled = true;
              resolve(result);
            };

            const queue = new AudioQueueManager(VOICE_SCRIPT_GAP_MS, {
              onStarted: () => {
                if (isStale()) return;
                setSpeaking(true);
                setLoading(false);
                if (index === 0) {
                  onStartedRef.current?.(0);
                }
              },
              onEnded: () => settle('ended'),
              onError: () => settle('error'),
              onBlocked: () => settle('blocked')
            });
            queueRef.current = queue;
            queue.enqueue(blob);
          });

          const result = await idlePromise;
          if (isStale() || controller.signal.aborted) return;
          if (result === 'blocked') { stop(); return; }
          // On error, skip this unit and continue to the next.
        }
      } catch {
        if (!isStale()) stop();
        return;
      }

      if (isStale()) return;
      queueRef.current = null;
      setSpeaking(false);
      setLoading(false);
    })();
  }, [canSpeak, stop, voiceGeneration]);

  const speak = useCallback((
    messageId: string,
    content: string,
    cache?: ChatMessageVoiceCache | null
  ) => {
    stop();

    if (!canSpeak && !cache?.assetId) return;

    const plan = buildAssistantSpeechPlan(content);
    if (plan.units.length === 0) return;

    setSpeaking(true);

    // If the whole reply is already cached as one blob, skip the pipeline.
    if (cache?.assetId && plan.units.length === 1) {
      void speakPlan(messageId, content, plan, cache);
      return;
    }

    if (!canSpeak) return;

    void speakPlan(messageId, content, plan, cache ?? null);
  }, [canSpeak, speakPlan, stop]);

  return {
    speaking,
    loading,
    speak,
    stop
  };
}
