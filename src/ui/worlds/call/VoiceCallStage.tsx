import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useVoiceCallPlayback } from '../../../app/call/useVoiceCallPlayback';
import { splitVoiceCallCaptions } from '../../../engines/voice/voiceCallCaption';
import { useI18n } from '../../../i18n';
import type { I18nKey } from '../../../i18n/messages';
import { useChatActions, useChatPresentation, useChatStablePayload, useChatUi } from '../chat/context/ChatContext';
import { buildAssistantSpeechText } from '../chat/message/messageSpeechText';
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

  const playback = useVoiceCallPlayback({
    onSpeechCacheReady: (messageId, voiceCache) => {
      const target = stablePayload.messages.find((message) => message.id === messageId);
      if (target) actions.cacheAssistantSpeech(target, voiceCache);
    },
    onError: (code) => setErrorCode(code)
  });

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

  const speakAssistantMessage = (messageId: string, text: string) => {
    if (!text) return;
    const cachedVoice = stablePayload.messages.find((message) => message.id === messageId)?.voiceCache;
    if (cachedVoice) {
      const segments = splitVoiceCallCaptions(text);
      if (segments.length === 0) return;
      playback.playCachedClip(messageId, cachedVoice, segments);
      return;
    }
    playback.speak({ messageId, text });
  };

  useEffect(() => {
    const target = resolveVoiceCallSpeechTarget({
      messages: stablePayload.messages,
      startedAt: startedAtRef.current,
      muted,
      busy: playback.status !== 'idle',
      generating: ui.sending || Boolean(ui.streaming),
      hasSpoken: (messageId) => spokenMessageIdsRef.current.has(messageId)
    });
    if (!target) return;

    spokenMessageIdsRef.current.add(target.messageId);
    setErrorCode(null);
    speakAssistantMessage(target.messageId, target.speechText);
  }, [stablePayload.messages, muted, playback.status, ui.sending, ui.streaming]);

  function handleHangUp() {
    const conversationId = stablePayload.conversation?.id ?? null;
    const startedAt = startedAtRef.current;
    const endedAt = Date.now();
    playback.stop();

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
          turnCount: callMessages.filter((message) => message.role === 'user').length
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
    const speechText = buildAssistantSpeechText(message.content);
    if (!speechText) return;
    setErrorCode(null);
    speakAssistantMessage(message.id, speechText);
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

  const visibleText = muted ? '' : playback.visibleText;
  const hintText = muted
    ? t('chat.call.mutedHint')
    : errorCode
      ? t(ERROR_MESSAGE_KEYS[errorCode] ?? 'chat.call.generationFailed')
      : visibleText
        ? ''
        : t('chat.call.captionHint');

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
          {visibleText ? <p className="voice-call-caption-text">{visibleText}</p> : null}
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
                  if (!current) playback.stop();
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
