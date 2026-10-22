import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useVoiceCallPlayback } from '../../../app/call/useVoiceCallPlayback';
import { primeCallAudio } from '../../../app/call/callAudio';
import { useFleshAmbience } from '../../../app/call/useFleshAmbience';
import type { TimedAmbienceCue } from '../../../engines/voice/ambienceTimeline';
import type { FleshAmbienceCategory, FleshCue } from '../../../engines/voice/fleshAmbience';
import { useI18n } from '../../../i18n';
import type { I18nKey } from '../../../i18n/messages';
import { useChatActions, useChatPresentation, useChatStablePayload, useChatUi } from '../chat/context/ChatContext';
import { buildAssistantCaptionParts, getAssistantAmbiencePlan } from '../chat/message/messageSpeechText';
import { resolveVoiceCallSpeechTarget } from './voiceCallSpeechTarget';
import { Icon } from '../../Icon';
import { runImpactAction, runSelectionAction } from '../../haptics';
import { useAssetObjectUrl } from '../../useAssetObjectUrl';

type VoiceCallStageProps = {
  onClose: () => void;
};

const ERROR_MESSAGE_KEYS: Record<string, I18nKey> = {
  'voice-provider-missing': 'chat.call.voiceMissing',
  'autoplay-blocked': 'chat.call.autoplayBlocked',
  'audio-playback-failed': 'chat.call.playbackFailed',
  'speech-generation-failed': 'chat.call.generationFailed',
  'speech-cache-missing': 'chat.call.cacheMissing'
};

function formatCallDuration(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

export function VoiceCallStage({ onClose }: VoiceCallStageProps) {
  const { t } = useI18n();
  const stablePayload = useChatStablePayload();
  const presentation = useChatPresentation();
  const ui = useChatUi();
  const actions = useChatActions();

  const assistantAvatarUrl = useAssetObjectUrl(stablePayload.persona?.assistantAvatarAssetId ?? undefined, true);
  const startedAtRef = useRef(Date.now());
  const spokenMessageIdsRef = useRef<Set<string>>(new Set());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [draft, setDraft] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const ambiencePlanRef = useRef<TimedAmbienceCue[]>([]);
  // Categories the previous spoken line marked, and the reply whose stream we are
  // feeding: same per-line schedule as the chat voice-script mode.
  const markedRef = useRef<FleshAmbienceCategory[]>([]);
  const sessionMessageIdRef = useRef<string | null>(null);
  const ambience = useFleshAmbience();

  const handleCallLine = (cues: FleshCue[], retire?: FleshAmbienceCategory[]) => {
    const previous = retire ?? markedRef.current;
    markedRef.current = cues.map((cue) => cue.category);
    const timed = cues.map((cue) => ({ ...cue, atRatio: 0 }));
    ambience.schedule(timed, 1, previous);
  };

  const playback = useVoiceCallPlayback({
    onSpeechCacheReady: (messageId, voiceCache) => {
      const target = stablePayload.messages.find((message) => message.id === messageId);
      if (target) actions.cacheAssistantSpeech(target, voiceCache);
    },
    // A cached whole-reply take carries its markers as one spread-out plan.
    onPlaybackStarted: (durationSec) => {
      const cues = ambiencePlanRef.current;
      ambiencePlanRef.current = [];
      if (cues.length) ambience.schedule(cues, durationSec);
    },
    onLineStarted: (cues) => handleCallLine(cues),
    onLineEnded: (cues) => handleCallLine(cues, []),
    onError: (code) => setErrorCode(code)
  });

  useEffect(() => {
    if (playback.status === 'speaking') {
      ambience.setDucked(true);
      return;
    }
    ambience.setDucked(false);
  }, [ambience, playback.status]);

  const queueFleshCues = (content: string) => {
    ambiencePlanRef.current = getAssistantAmbiencePlan(content).cues;
  };

  useEffect(() => {
    primeCallAudio();
    const unlock = () => primeCallAudio();
    window.addEventListener('pointerdown', unlock, true);
    return () => window.removeEventListener('pointerdown', unlock, true);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 1000);
    setElapsedMs(Date.now() - startedAtRef.current);
    return () => window.clearInterval(interval);
  }, []);

  const latestAssistantMessage = useMemo(() => {
    for (let index = stablePayload.messages.length - 1; index >= 0; index -= 1) {
      const message = stablePayload.messages[index];
      if (message.toolInvocation) continue;
      if (message.role !== 'assistant') return null;
      if (!message.content.trim()) return null;
      return message;
    }
    return null;
  }, [stablePayload.messages]);

  const isStreamingMessage = (messageId: string) =>
    Boolean(ui.streaming && ui.streaming.messageId === messageId && (ui.streaming.phase === 'stage' || ui.streaming.phase === 'live'));

  const speakAssistantMessage = (messageId: string, content: string, streaming: boolean) => {
    const source = stablePayload.messages.find((message) => message.id === messageId);
    if (!source || !content.trim()) return;
    if (!streaming && source.voiceCache) {
      queueFleshCues(content);
      const caption = buildAssistantCaptionParts(content);
      if (caption.length > 0) {
        playback.playCachedClip(messageId, source.voiceCache, caption);
        return;
      }
    }
    if (playback.speak(messageId, content, streaming)) {
      sessionMessageIdRef.current = streaming ? messageId : null;
    }
  };

  useEffect(() => {
    const activeId = sessionMessageIdRef.current;
    if (activeId) {
      const message = stablePayload.messages.find((item) => item.id === activeId);
      if (!message) {
        sessionMessageIdRef.current = null;
      } else if (isStreamingMessage(activeId)) {
        playback.feedStream(activeId, message.content);
        return;
      } else {
        playback.finalize(activeId, message.content);
        sessionMessageIdRef.current = null;
        return;
      }
    }

    const target = resolveVoiceCallSpeechTarget({
      messages: stablePayload.messages,
      startedAt: startedAtRef.current,
      muted,
      busy: playback.status !== 'idle',
      sending: ui.sending,
      hasSpoken: (messageId) => spokenMessageIdsRef.current.has(messageId),
      isStreamingMessage
    });
    if (!target) return;

    spokenMessageIdsRef.current.add(target.messageId);
    setErrorCode(null);
    speakAssistantMessage(target.messageId, target.content, target.streaming);
  }, [stablePayload.messages, muted, playback.status, ui.sending, ui.streaming]);

  function handleHangUp() {
    const conversationId = stablePayload.conversation?.id ?? null;
    const startedAt = startedAtRef.current;
    const endedAt = Date.now();
    playback.stop();
    ambience.stop();

    if (conversationId) {
      const callMessages = stablePayload.messages.filter((message) =>
        message.timestamp >= startedAt
        && message.role !== 'system'
        && !message.toolInvocation
        && !message.voiceCall
      );
      if (callMessages.length > 0) {
        actions.markVoiceCall({
          conversationId,
          messageIds: callMessages.map((message) => message.id),
          startedAt,
          endedAt,
          turnCount: callMessages.filter((message) => message.role === 'user').length,
          durationLabel: formatCallDuration(endedAt - startedAt)
        });
      }
    }

    onClose();
  }

  function handleSend() {
    const value = draft.trim();
    if (!value || ui.sending || presentation.interactionLocked) return;
    setDraft('');
    actions.setInputDraft(value);
    void actions.submit();
  }

  function handleRetrySpeak() {
    const message = latestAssistantMessage;
    if (!message) return;
    setErrorCode(null);
    speakAssistantMessage(message.id, message.content, false);
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      handleHangUp();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  const phaseLabel = muted
    ? t('chat.call.muted')
    : playback.status === 'speaking'
      ? t('chat.call.speaking')
      : playback.status === 'generating' || ui.sending || ui.streaming
        ? t('chat.call.thinking')
        : t('chat.call.listening');

  const captionParts = muted ? [] : playback.visibleParts;
  const hintText = muted
    ? t('chat.call.mutedHint')
    : errorCode
      ? t(ERROR_MESSAGE_KEYS[errorCode] ?? 'chat.call.generationFailed')
      : captionParts.length === 0
        ? t('chat.call.captionHint')
        : '';

  return createPortal(
    <div className="voice-call-stage" role="dialog" aria-modal="true" aria-label={t('chat.call.title')}>
      <div className="voice-call-stage-inner">
        <div className="voice-call-head">
          <div className="voice-call-avatar" style={{ borderColor: presentation.personaColor }}>
            {assistantAvatarUrl ? (
              <img src={assistantAvatarUrl} alt="" />
            ) : (
              <span className="voice-call-avatar-fallback">
                {(presentation.assistantName || 'Polaris').slice(0, 1)}
              </span>
            )}
          </div>
          <p className="voice-call-name">{presentation.assistantName}</p>
          <p className="voice-call-status">
            <span className="voice-call-timer">{formatCallDuration(elapsedMs)}</span>
            <span className="voice-call-status-sep">·</span>
            <span className={`voice-call-phase ${playback.status === 'speaking' && !muted ? 'is-speaking' : ''}`}>
              {phaseLabel}
            </span>
          </p>
        </div>

        <div className="voice-call-caption" aria-live="polite">
          {captionParts.length > 0 ? (
            <p className="voice-call-caption-text">
              {captionParts.map((part, index) => (
                <span
                  key={`caption-${index}-${part.kind}`}
                  className={part.kind === 'stage' ? 'voice-call-caption-stage' : undefined}
                >
                  {part.text}
                </span>
              ))}
            </p>
          ) : null}
          {hintText ? <p className={`voice-call-hint ${errorCode ? 'is-error' : ''}`}>{hintText}</p> : null}
          {errorCode && latestAssistantMessage ? (
            <button
              type="button"
              className="voice-call-retry"
              onClick={(event) => {
                runSelectionAction(handleRetrySpeak, { element: event.currentTarget });
              }}
            >
              {t('chat.call.retry')}
            </button>
          ) : null}
        </div>

        <div className="voice-call-input-row">
          <textarea
            className="voice-call-input"
            rows={1}
            value={draft}
            placeholder={t('chat.call.inputPlaceholder')}
            aria-label={t('chat.call.inputPlaceholder')}
            disabled={presentation.interactionLocked}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey) return;
              event.preventDefault();
              handleSend();
            }}
          />
          <button
            type="button"
            className={`voice-call-send ${draft.trim() ? 'has-content' : ''}`}
            disabled={!draft.trim() || ui.sending || presentation.interactionLocked}
            aria-label={t('chat.call.send')}
            title={t('chat.call.send')}
            onClick={(event) => {
              runSelectionAction(handleSend, { element: event.currentTarget });
            }}
          >
            <Icon name="send" size={16} />
          </button>
        </div>

        <div className="voice-call-controls">
          <button
            type="button"
            className={`voice-call-control ${muted ? 'is-active' : ''}`}
            aria-pressed={muted}
            aria-label={muted ? t('chat.call.unmute') : t('chat.call.mute')}
            onClick={(event) => {
              runSelectionAction(() => {
                setMuted((current) => {
                  if (!current) {
                    const activeId = sessionMessageIdRef.current;
                    if (activeId) spokenMessageIdsRef.current.delete(activeId);
                    sessionMessageIdRef.current = null;
                    markedRef.current = [];
                    ambiencePlanRef.current = [];
                    playback.stop();
                    ambience.stop();
                  }
                  return !current;
                });
              }, { element: event.currentTarget });
            }}
          >
            <span className="voice-call-control-icon">
              <Icon name="mic" size={20} />
            </span>
            <span className="voice-call-control-label">{muted ? t('chat.call.unmute') : t('chat.call.mute')}</span>
          </button>
          <button
            type="button"
            className="voice-call-control is-hangup"
            aria-label={t('chat.call.hangUp')}
            onClick={(event) => {
              runImpactAction(handleHangUp, { element: event.currentTarget });
            }}
          >
            <span className="voice-call-control-icon is-hangup">
              <Icon name="phone" size={20} />
            </span>
            <span className="voice-call-control-label">{t('chat.call.hangUp')}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
