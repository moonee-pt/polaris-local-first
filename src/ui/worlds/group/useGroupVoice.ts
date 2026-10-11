import { useEffect, useRef, useState } from 'react';
import {
  messageSpeechCacheMatchesText,
  readMessageSpeechCacheBlob,
  saveMessageSpeechCache
} from '../../../app/chat/messageSpeechCache';
import { playChatSpeechBlob, primeChatSpeechAudio, stopChatSpeechAudio } from '../../../app/chat/chatSpeechAudio';
import { useFleshAmbience } from '../../../app/call/useFleshAmbience';
import { requestGeneratedSpeech } from '../../../engines/voiceGenerationClient';
import { useRuntimeStore } from '../../../stores/runtimeStore';
import { useI18n } from '../../../i18n';
import type { ChatMessageVoiceCache } from '../../../types/domain';
import { getAssistantAmbiencePlan, getAssistantVoiceContent } from '../chat/message/messageSpeechText';

export type GroupVoiceMessage = {
  id: string;
  content: string;
  voiceCache?: ChatMessageVoiceCache | null;
};

export type GroupVoiceController = {
  enabled: boolean;
  supported: boolean;
  speakingId: string | null;
  isLoading: (messageId: string) => boolean;
  toggleEnabled: () => void;
  playMessage: (message: GroupVoiceMessage) => void;
  enqueueAuto: (message: GroupVoiceMessage) => void;
  stopAll: () => void;
};

type UseGroupVoiceArgs = {
  onSpeechCacheReady?: (messageId: string, voiceCache: ChatMessageVoiceCache) => void;
  onError?: (message: string) => void;
};

type Prepared = Blob | 'native' | 'empty' | 'failed';

const MAX_QUEUE = 40;

/**
 * Reads group replies aloud, one after another. When the caller turns it on, every new
 * member message is synthesised ahead of its turn, so a clip is already waiting by the
 * time the voice that is speaking now finishes.
 */
export function useGroupVoice({ onSpeechCacheReady, onError }: UseGroupVoiceArgs = {}): GroupVoiceController {
  const { t } = useI18n();
  const voiceGeneration = useRuntimeStore((state) => state.voiceGeneration);
  const [nativeSpeechAvailable, setNativeSpeechAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingIds, setLoadingIds] = useState<ReadonlySet<string>>(() => new Set());

  const ambience = useFleshAmbience();

  const metaRef = useRef<Map<string, GroupVoiceMessage>>(new Map());
  const preparedRef = useRef<Map<string, Prepared>>(new Map());
  const queueRef = useRef<string[]>([]);
  const runningRef = useRef<string | null>(null);
  const tokenRef = useRef(0);
  const abortsRef = useRef<Map<string, AbortController>>(new Map());
  const enabledRef = useRef(false);

  const pumpRef = useRef<() => void>(() => {});
  const prepareRef = useRef<(message: GroupVoiceMessage) => void>(() => {});
  const stopAllRef = useRef<() => void>(() => {});
  const cacheReadyRef = useRef(onSpeechCacheReady);
  const errorRef = useRef(onError);
  cacheReadyRef.current = onSpeechCacheReady;
  errorRef.current = onError;

  const canUseConfigured = voiceGeneration.enabled
    && Boolean(voiceGeneration.baseUrl?.trim() && voiceGeneration.apiKey?.trim());
  const supported = canUseConfigured || nativeSpeechAvailable;
  enabledRef.current = enabled;

  useEffect(() => {
    setNativeSpeechAvailable(
      typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
    );
  }, []);

  useEffect(() => () => {
    tokenRef.current += 1;
    abortsRef.current.forEach((controller) => controller.abort());
    stopChatSpeechAudio();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const setLoading = (messageId: string, loading: boolean) => {
    setLoadingIds((current) => {
      if (loading === current.has(messageId)) return current;
      const next = new Set(current);
      if (loading) next.add(messageId);
      else next.delete(messageId);
      return next;
    });
  };

  const speakTextFor = (content: string) => getAssistantVoiceContent(content)?.ttsText?.trim() ?? '';

  const finish = (messageId: string) => {
    if (runningRef.current !== messageId) return;
    runningRef.current = null;
    setSpeakingId(null);
    ambience.setDucked(false);
    ambience.stop();
    pumpRef.current();
  };

  const playNative = (messageId: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      finish(messageId);
      return;
    }
    const message = metaRef.current.get(messageId);
    const text = speakTextFor(message?.content ?? '');
    runningRef.current = messageId;
    setSpeakingId(messageId);
    const plan = getAssistantAmbiencePlan(message?.content ?? '');
    if (plan.cues.length) ambience.schedule(plan.cues, plan.estimatedSec);
    ambience.setDucked(true);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => finish(messageId);
    utterance.onerror = () => finish(messageId);
    window.speechSynthesis.speak(utterance);
  };

  const playBlob = (messageId: string, blob: Blob) => {
    const message = metaRef.current.get(messageId);
    const plan = getAssistantAmbiencePlan(message?.content ?? '');
    runningRef.current = messageId;
    setSpeakingId(messageId);
    void playChatSpeechBlob(blob, {
      onStarted: (durationSec) => {
        if (runningRef.current !== messageId) return;
        if (plan.cues.length) ambience.schedule(plan.cues, durationSec || plan.estimatedSec);
        ambience.setDucked(true);
      },
      onEnded: () => finish(messageId),
      onError: () => {
        errorRef.current?.(t('group.voice.playFailed'));
        finish(messageId);
      }
    });
  };

  const pump = () => {
    if (runningRef.current) return;
    const nextId = queueRef.current[0];
    if (!nextId) return;
    const prepared = preparedRef.current.get(nextId);
    if (prepared === undefined) return;
    queueRef.current.shift();
    if (prepared === 'empty' || prepared === 'failed') {
      pump();
      return;
    }
    if (prepared === 'native') {
      playNative(nextId);
      return;
    }
    playBlob(nextId, prepared);
  };
  pumpRef.current = pump;

  const prepare = async (message: GroupVoiceMessage) => {
    if (preparedRef.current.has(message.id)) {
      pumpRef.current();
      return;
    }
    metaRef.current.set(message.id, message);
    const text = speakTextFor(message.content);
    if (!text) {
      preparedRef.current.set(message.id, 'empty');
      pumpRef.current();
      return;
    }
    const token = tokenRef.current;
    setLoading(message.id, true);
    try {
      const cache = message.voiceCache ?? null;
      if (cache?.assetId && (await messageSpeechCacheMatchesText(cache, text))) {
        const blob = await readMessageSpeechCacheBlob(cache);
        if (token !== tokenRef.current) return;
        preparedRef.current.set(message.id, blob);
      } else if (canUseConfigured) {
        const controller = new AbortController();
        abortsRef.current.set(message.id, controller);
        const result = await requestGeneratedSpeech({ settings: voiceGeneration, text, signal: controller.signal });
        if (token !== tokenRef.current) return;
        preparedRef.current.set(message.id, result.blob);
        try {
          const voiceCache = await saveMessageSpeechCache({ text, settings: voiceGeneration, result });
          if (token === tokenRef.current) cacheReadyRef.current?.(message.id, voiceCache);
        } catch {
          // Saving the clip is best-effort; the voice still plays this turn.
        }
      } else if (nativeSpeechAvailable) {
        preparedRef.current.set(message.id, 'native');
      } else {
        preparedRef.current.set(message.id, 'empty');
        errorRef.current?.(t('group.voice.configureFirst'));
      }
    } catch {
      if (token === tokenRef.current) {
        preparedRef.current.set(message.id, 'failed');
        errorRef.current?.(t('group.voice.generateFailed'));
      }
    } finally {
      abortsRef.current.delete(message.id);
      setLoading(message.id, false);
      if (token === tokenRef.current) pumpRef.current();
    }
  };
  prepareRef.current = prepare;

  const stopAll = () => {
    tokenRef.current += 1;
    queueRef.current = [];
    abortsRef.current.forEach((controller) => controller.abort());
    abortsRef.current.clear();
    preparedRef.current.clear();
    runningRef.current = null;
    setSpeakingId(null);
    setLoadingIds(new Set());
    stopChatSpeechAudio();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    ambience.stop();
    ambience.setDucked(false);
  };
  stopAllRef.current = stopAll;

  const playMessage = (message: GroupVoiceMessage) => {
    if (runningRef.current === message.id) {
      stopAllRef.current();
      return;
    }
    stopAllRef.current();
    primeChatSpeechAudio();
    metaRef.current.set(message.id, message);
    queueRef.current = [message.id];
    void prepareRef.current(message);
    pumpRef.current();
  };

  const enqueueAuto = (message: GroupVoiceMessage) => {
    if (!enabledRef.current) return;
    if (queueRef.current.includes(message.id) || preparedRef.current.has(message.id)) return;
    if (queueRef.current.length >= MAX_QUEUE) return;
    metaRef.current.set(message.id, message);
    queueRef.current.push(message.id);
    void prepareRef.current(message);
    pumpRef.current();
  };

  const toggleEnabled = () => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    if (next) primeChatSpeechAudio();
    else stopAllRef.current();
  };

  return {
    enabled,
    supported,
    speakingId,
    isLoading: (messageId: string) => loadingIds.has(messageId),
    toggleEnabled,
    playMessage,
    enqueueAuto,
    stopAll
  };
}
