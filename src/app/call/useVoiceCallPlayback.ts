import { useCallback, useEffect, useRef, useState } from 'react';
import { readMessageSpeechCacheBlob, saveMessageSpeechCache } from '../chat/messageSpeechCache';
import { requestGeneratedSpeech } from '../../engines/voiceGenerationClient';
import {
  resolveVoiceCallVisibleParts,
  splitVoiceCallCaptions,
  type VoiceCallCaptionSegment,
  type VoiceCallCaptionSourcePart
} from '../../engines/voice/voiceCallCaption';
import { useRuntimeStore } from '../../stores/runtimeStore';
import { getCallAudio, markCallAudioBlocked, markCallAudioUnlocked, setCallAudioInUse } from './callAudio';
import type { ChatMessageVoiceCache } from '../../types/domain';

export type VoiceCallPlaybackStatus = 'idle' | 'generating' | 'speaking';

type SpeakArgs = {
  messageId: string;
  text: string;
  caption: VoiceCallCaptionSourcePart[];
};

type UseVoiceCallPlaybackArgs = {
  onSpeechCacheReady?: (messageId: string, voiceCache: ChatMessageVoiceCache) => void;
  /** Fires once the clip is really running, with the seconds it will take. */
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

type PlayBlob = (blob: Blob, caption: VoiceCallCaptionSourcePart[], messageId: string) => void;

function sameParts(left: VoiceCallCaptionSourcePart[], right: VoiceCallCaptionSourcePart[]) {
  if (left.length !== right.length) return false;
  return left.every((part, index) => part.kind === right[index].kind && part.text === right[index].text);
}

function measuredSeconds(audio: HTMLAudioElement) {
  return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
}

/**
 * Plays one generated reply inside the call stage and reveals its caption along
 * the audio clock. The clip is generated as a whole file, so the caption is driven
 * by playback progress rather than a live token stream.
 */
export function useVoiceCallPlayback({
  onSpeechCacheReady,
  onPlaybackStarted,
  onError
}: UseVoiceCallPlaybackArgs = {}): UseVoiceCallPlaybackResult {
  const voiceGeneration = useRuntimeStore((state) => state.voiceGeneration);
  const [status, setStatus] = useState<VoiceCallPlaybackStatus>('idle');
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [visibleParts, setVisibleParts] = useState<VoiceCallCaptionSourcePart[]>([]);

  const audioUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const frameRef = useRef<number | null>(null);
  const segmentsRef = useRef<VoiceCallCaptionSegment[]>([]);
  const visiblePartsRef = useRef<VoiceCallCaptionSourcePart[]>([]);
  const runIdRef = useRef(0);
  const pendingRef = useRef<{ messageId: string; blob: Blob; caption: VoiceCallCaptionSourcePart[] } | null>(null);
  const retryRef = useRef<(() => void) | null>(null);
  const playBlobRef = useRef<PlayBlob | null>(null);
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
    pendingRef.current = null;
    releaseAudio();
    segmentsRef.current = [];
    visiblePartsRef.current = [];
    setVisibleParts([]);
    setActiveMessageId(null);
    setStatus('idle');
  }, [releaseAudio]);

  useEffect(() => () => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    pendingRef.current = null;
    releaseAudio();
  }, [releaseAudio]);

  const startFrameLoop = useCallback((estimatedSeconds: number) => {
    cancelFrameLoop();
    const startedAt = Date.now();
    const tick = () => {
      const audio = getCallAudio();
      const duration = audio.duration;
      const hasRealDuration = Number.isFinite(duration) && duration > 0;
      const progress = hasRealDuration
        ? audio.currentTime / duration
        : estimatedSeconds > 0
          ? (Date.now() - startedAt) / 1000 / estimatedSeconds
          : 0;
      const next = resolveVoiceCallVisibleParts(segmentsRef.current, progress);
      if (!sameParts(visiblePartsRef.current, next)) {
        visiblePartsRef.current = next;
        setVisibleParts(next);
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [cancelFrameLoop]);

  const playBlob = useCallback((blob: Blob, caption: VoiceCallCaptionSourcePart[], messageId: string) => {
    const segments = splitVoiceCallCaptions(caption);
    if (segments.length === 0) return;

    clearRetryListener();
    const totalChars = segments.reduce((sum, segment) => sum + segment.text.length, 0);
    const estimatedSeconds = Math.max(1, totalChars / 5);

    const url = URL.createObjectURL(blob);
    const audio = getCallAudio();
    let announced = false;
    const announce = () => {
      if (announced) return;
      announced = true;
      onPlaybackStartedRef.current?.(measuredSeconds(audio) ?? estimatedSeconds);
    };
    setCallAudioInUse(true);
    audio.onended = null;
    audio.onerror = null;
    audio.onloadedmetadata = announce;
    audio.src = url;
    audioUrlRef.current = url;
    segmentsRef.current = segments;
    visiblePartsRef.current = [];
    setVisibleParts([]);
    pendingRef.current = { messageId, blob, caption };

    audio.onended = () => {
      if (audioUrlRef.current !== url) return;
      const full = resolveVoiceCallVisibleParts(segments, 1);
      visiblePartsRef.current = full;
      setVisibleParts(full);
      pendingRef.current = null;
      releaseAudio();
      setActiveMessageId(null);
      setStatus('idle');
    };
    audio.onerror = () => {
      if (audioUrlRef.current !== url) return;
      pendingRef.current = null;
      releaseAudio();
      setActiveMessageId(null);
      setStatus('idle');
      onErrorRef.current?.('audio-playback-failed');
    };

    setStatus('speaking');
    startFrameLoop(estimatedSeconds);
    void audio.play().then(() => {
      markCallAudioUnlocked();
      announce();
    }).catch(() => {
      if (audioUrlRef.current !== url) return;
      markCallAudioBlocked();
      const pending = pendingRef.current;
      releaseAudio();
      setActiveMessageId(null);
      setStatus('idle');
      onErrorRef.current?.('autoplay-blocked');
      if (!pending) return;
      // The browser only needs one more real tap: replay the same clip straight from it.
      pendingRef.current = pending;
      const retry = () => {
        const item = pendingRef.current;
        clearRetryListener();
        if (!item) return;
        pendingRef.current = null;
        setActiveMessageId(item.messageId);
        playBlobRef.current?.(item.blob, item.caption, item.messageId);
      };
      retryRef.current = retry;
      window.addEventListener('pointerdown', retry, true);
    });
  }, [clearRetryListener, releaseAudio, startFrameLoop]);

  playBlobRef.current = playBlob;

  const speak = useCallback(({ messageId, text, caption }: SpeakArgs) => {
    const speechText = text.trim();
    if (!speechText) return;

    stop();
    const runId = runIdRef.current;

    if (!canSpeak) {
      onErrorRef.current?.('voice-provider-missing');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setActiveMessageId(messageId);
    setStatus('generating');

    void (async () => {
      try {
        const result = await requestGeneratedSpeech({
          settings: voiceGeneration,
          text: speechText,
          signal: controller.signal
        });
        if (runIdRef.current !== runId || controller.signal.aborted) return;

        try {
          const voiceCache = await saveMessageSpeechCache({
            text: speechText,
            settings: voiceGeneration,
            result
          });
          if (runIdRef.current === runId && !controller.signal.aborted) {
            onSpeechCacheReadyRef.current?.(messageId, voiceCache);
          }
        } catch {
          // Caching is best-effort; playback should still continue.
        }

        if (runIdRef.current !== runId || controller.signal.aborted) return;
        playBlob(result.blob, caption, messageId);
      } catch {
        if (runIdRef.current !== runId || controller.signal.aborted) return;
        setActiveMessageId(null);
        setStatus('idle');
        onErrorRef.current?.('speech-generation-failed');
      }
    })();
  }, [canSpeak, playBlob, stop, voiceGeneration]);

  const playCachedClip = useCallback((messageId: string, cache: ChatMessageVoiceCache, caption: VoiceCallCaptionSourcePart[]) => {
    stop();
    const runId = runIdRef.current;
    setActiveMessageId(messageId);
    setStatus('generating');
    void (async () => {
      try {
        const blob = await readMessageSpeechCacheBlob(cache);
        if (runIdRef.current !== runId) return;
        playBlob(blob, caption, messageId);
      } catch {
        if (runIdRef.current !== runId) return;
        setActiveMessageId(null);
        setStatus('idle');
        onErrorRef.current?.('speech-cache-missing');
      }
    })();
  }, [playBlob, stop]);

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
