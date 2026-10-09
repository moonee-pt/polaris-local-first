import { useCallback, useEffect, useRef, useState } from 'react';
import { readMessageSpeechCacheBlob, saveMessageSpeechCache } from '../chat/messageSpeechCache';
import { requestGeneratedSpeech } from '../../engines/voiceGenerationClient';
import {
  resolveVoiceCallVisibleText,
  splitVoiceCallCaptions,
  type VoiceCallCaptionSegment
} from '../../engines/voice/voiceCallCaption';
import { useRuntimeStore } from '../../stores/runtimeStore';
import type { ChatMessageVoiceCache } from '../../types/domain';

export type VoiceCallPlaybackStatus = 'idle' | 'generating' | 'speaking';

type SpeakArgs = {
  messageId: string;
  text: string;
};

type UseVoiceCallPlaybackArgs = {
  onSpeechCacheReady?: (messageId: string, voiceCache: ChatMessageVoiceCache) => void;
  onError?: (message: string) => void;
};

type UseVoiceCallPlaybackResult = {
  status: VoiceCallPlaybackStatus;
  activeMessageId: string | null;
  visibleText: string;
  canSpeak: boolean;
  speak: (args: SpeakArgs) => void;
  playCachedClip: (messageId: string, cache: ChatMessageVoiceCache, segments: VoiceCallCaptionSegment[]) => void;
  stop: () => void;
};

/**
 * Plays one generated reply inside the call stage and reveals its caption along
 * the audio clock. The clip is generated as a whole file, so the caption is driven
 * by playback progress rather than a live token stream.
 */
export function useVoiceCallPlayback({
  onSpeechCacheReady,
  onError
}: UseVoiceCallPlaybackArgs = {}): UseVoiceCallPlaybackResult {
  const voiceGeneration = useRuntimeStore((state) => state.voiceGeneration);
  const [status, setStatus] = useState<VoiceCallPlaybackStatus>('idle');
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [visibleText, setVisibleText] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const frameRef = useRef<number | null>(null);
  const segmentsRef = useRef<VoiceCallCaptionSegment[]>([]);
  const visibleTextRef = useRef('');
  const runIdRef = useRef(0);
  const onSpeechCacheReadyRef = useRef(onSpeechCacheReady);
  const onErrorRef = useRef(onError);

  onSpeechCacheReadyRef.current = onSpeechCacheReady;
  onErrorRef.current = onError;

  const canSpeak = Boolean(voiceGeneration.enabled && voiceGeneration.baseUrl?.trim() && voiceGeneration.apiKey?.trim());

  const cancelFrameLoop = useCallback(() => {
    if (frameRef.current === null) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const releaseAudio = useCallback(() => {
    cancelFrameLoop();
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.onloadedmetadata = null;
      audio.pause();
      audio.removeAttribute('src');
      audioRef.current = null;
    }
    const url = audioUrlRef.current;
    if (url) {
      URL.revokeObjectURL(url);
      audioUrlRef.current = null;
    }
  }, [cancelFrameLoop]);

  const stop = useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    releaseAudio();
    segmentsRef.current = [];
    visibleTextRef.current = '';
    setVisibleText('');
    setActiveMessageId(null);
    setStatus('idle');
  }, [releaseAudio]);

  useEffect(() => () => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    releaseAudio();
  }, [releaseAudio]);

  const startFrameLoop = useCallback((estimatedSeconds: number) => {
    cancelFrameLoop();
    const startedAt = Date.now();
    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;
      const duration = audio.duration;
      const hasRealDuration = Number.isFinite(duration) && duration > 0;
      const progress = hasRealDuration
        ? audio.currentTime / duration
        : estimatedSeconds > 0
          ? (Date.now() - startedAt) / 1000 / estimatedSeconds
          : 0;
      const next = resolveVoiceCallVisibleText(segmentsRef.current, progress);
      if (next !== visibleTextRef.current) {
        visibleTextRef.current = next;
        setVisibleText(next);
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [cancelFrameLoop]);

  const playBlob = useCallback((blob: Blob, segments: VoiceCallCaptionSegment[]) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.preload = 'auto';
    audioRef.current = audio;
    audioUrlRef.current = url;
    segmentsRef.current = segments;
    visibleTextRef.current = '';
    setVisibleText('');

    const totalChars = segments.reduce((sum, segment) => sum + segment.text.length, 0);
    const estimatedSeconds = Math.max(1, totalChars / 5);

    audio.onended = () => {
      if (audioRef.current !== audio) return;
      const fullText = resolveVoiceCallVisibleText(segments, 1);
      visibleTextRef.current = fullText;
      setVisibleText(fullText);
      releaseAudio();
      setActiveMessageId(null);
      setStatus('idle');
    };
    audio.onerror = () => {
      if (audioRef.current !== audio) return;
      releaseAudio();
      setActiveMessageId(null);
      setStatus('idle');
      onErrorRef.current?.('audio-playback-failed');
    };

    setStatus('speaking');
    startFrameLoop(estimatedSeconds);
    void audio.play().catch(() => {
      if (audioRef.current !== audio) return;
      releaseAudio();
      setActiveMessageId(null);
      setStatus('idle');
      onErrorRef.current?.('autoplay-blocked');
    });
  }, [releaseAudio, startFrameLoop]);

  const speak = useCallback(({ messageId, text }: SpeakArgs) => {
    const speechText = text.trim();
    if (!speechText) return;

    stop();
    const runId = runIdRef.current;

    if (!canSpeak) {
      onErrorRef.current?.('voice-provider-missing');
      return;
    }

    const segments = splitVoiceCallCaptions(speechText);
    if (segments.length === 0) return;

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
        playBlob(result.blob, segments);
      } catch {
        if (runIdRef.current !== runId || controller.signal.aborted) return;
        setActiveMessageId(null);
        setStatus('idle');
        onErrorRef.current?.('speech-generation-failed');
      }
    })();
  }, [canSpeak, playBlob, stop, voiceGeneration]);

  const playCachedClip = useCallback((messageId: string, cache: ChatMessageVoiceCache, segments: VoiceCallCaptionSegment[]) => {
    stop();
    const runId = runIdRef.current;
    setActiveMessageId(messageId);
    setStatus('generating');
    void (async () => {
      try {
        const blob = await readMessageSpeechCacheBlob(cache);
        if (runIdRef.current !== runId) return;
        playBlob(blob, segments);
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
    visibleText,
    canSpeak,
    speak,
    stop,
    playCachedClip
  };
}
