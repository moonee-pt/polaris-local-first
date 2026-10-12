import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CodeCardActionMode } from '../../../../app/chat/chatDerivedState';
import { readMessageSpeechCacheBlob, saveMessageSpeechCache } from '../../../../app/chat/messageSpeechCache';
import { playChatSpeechBlob, primeChatSpeechAudio, stopChatSpeechAudio } from '../../../../app/chat/chatSpeechAudio';
import { requestGeneratedSpeech } from '../../../../engines/voiceGenerationClient';
import { useFleshAmbience } from '../../../../app/call/useFleshAmbience';
import { writeTextToClipboard } from '../../../../infrastructure/clipboard';
import { useVoiceSettingsForSpeaker } from '../../../../app/voice/useVoiceSettingsForSpeaker';
import type { ChatMemoryEvidence, ChatMessageVoiceCache, ConversationTaskStatus } from '../../../../types/domain';
import { Icon } from '../../../Icon';
import { runSelectionAction, runSuccessAction } from '../../../haptics';
import { useI18n } from '../../../../i18n';
import { MessageMemoryEvidence } from './MessageMemoryEvidence';
import { getAssistantAmbiencePlan } from './messageSpeechText';
import { registerAmbienceStop, stopOtherAmbiences } from '../../../../app/audio/ambienceRegistry';

/** Replies whose voice already started on its own; a re-render must never replay one. */
const autoSpokenMessageIds = new Set<string>();
/** Read-aloud only starts by itself for replies that land while the app is open. */
const AUTO_SPEAK_READY_AT = Date.now();

export type MessageTaskReceiptAction = {
  status: ConversationTaskStatus;
  expanded: boolean;
  onToggle: () => void;
};

type MessageActionsProps = {
  canCopyAssistant: boolean;
  canEditAssistant: boolean;
  canForkAssistant: boolean;
  canRetryAssistant: boolean;
  retryAssistantLabel?: string;
  memoryEvidence?: ChatMemoryEvidence | null;
  taskReceiptAction?: MessageTaskReceiptAction | null;
  codeCardActionLabel: string;
  codeCardActionMode: CodeCardActionMode;
  codeCardProgressLabel: string | null;
  messageContent: string;
  speechContent: string;
  speechCache?: ChatMessageVoiceCache | null;
  /** Set on the newest settled reply so its voice can start without a tap. */
  speakerCollaboratorId?: string | null;
  autoSpeakKey?: string | null;
  autoSpeakAt?: number | null;
  /** Only the turn's final reply reads aloud; intermediate steps stay quiet. */
  allowAssistantSpeech?: boolean;
  role: 'assistant' | 'user';
  onSetCommandStatus: (text: string, isError?: boolean) => void;
  onCodeCardAction: () => void;
  onEditAssistant: (content: string) => void;
  onSpeechCacheReady: (voiceCache: ChatMessageVoiceCache) => void;
  onForkAssistant: () => void;
  onRetryLatestAssistant: () => void;
};

export function MessageActions({
  canCopyAssistant,
  canEditAssistant,
  canForkAssistant,
  canRetryAssistant,
  retryAssistantLabel,
  memoryEvidence = null,
  taskReceiptAction = null,
  codeCardActionLabel,
  codeCardActionMode,
  codeCardProgressLabel,
  messageContent,
  speechContent,
  speechCache = null,
  speakerCollaboratorId = null,
  autoSpeakKey = null,
  autoSpeakAt = null,
  allowAssistantSpeech = true,
  role,
  onSetCommandStatus,
  onCodeCardAction,
  onEditAssistant,
  onSpeechCacheReady,
  onForkAssistant,
  onRetryLatestAssistant
}: MessageActionsProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [nativeSpeechAvailable, setNativeSpeechAvailable] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechLoading, setSpeechLoading] = useState(false);
  const [assistantSheetOpen, setAssistantSheetOpen] = useState(false);
  const [assistantSheetMode, setAssistantSheetMode] = useState<'menu' | 'edit' | 'memory'>('menu');
  const [assistantDraft, setAssistantDraft] = useState(messageContent);
  const abortRef = useRef<AbortController | null>(null);
  const voiceGeneration = useVoiceSettingsForSpeaker(speakerCollaboratorId);
  const autoSpeakRef = useRef<(() => void) | null>(null);
  /** Auto read-aloud keeps its ambience alive after the clip ends. */
  const autoPlaybackRef = useRef(false);
  const showCodeCardAction = codeCardActionMode !== 'hidden';
  const hasMemoryEvidence = role === 'assistant' && Boolean(memoryEvidence?.items.length);
  const hasSpeechCache = role === 'assistant' && Boolean(speechCache?.assetId);
  const speakableContent = speechContent.trim();
  const canUseConfiguredSpeech = voiceGeneration.enabled && Boolean(voiceGeneration.baseUrl?.trim() && voiceGeneration.apiKey?.trim());
  const canSpeakAssistant = role === 'assistant' && allowAssistantSpeech && Boolean(speakableContent) && (hasSpeechCache || canUseConfiguredSpeech || nativeSpeechAvailable);
  const hasAssistantMore = role === 'assistant' && (canEditAssistant || canForkAssistant || canRetryAssistant || hasMemoryEvidence || canSpeakAssistant);
  const resolvedRetryAssistantLabel = retryAssistantLabel ?? t('chat.messageActions.retry');

  useEffect(() => {
    if (!assistantSheetOpen) {
      setAssistantDraft(messageContent);
      setAssistantSheetMode('menu');
    }
  }, [assistantSheetOpen, messageContent]);

  useEffect(() => {
    if (!assistantSheetOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAssistantSheetOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [assistantSheetOpen]);

  useEffect(() => {
    setNativeSpeechAvailable(typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
  }, []);

  const {
    schedule: scheduleAmbience,
    stop: stopAmbience,
    setDucked: setAmbienceDucked
  } = useFleshAmbience();

  useEffect(() => {
    setAmbienceDucked(speaking);
  }, [speaking, setAmbienceDucked]);

  useEffect(() => registerAmbienceStop(stopAmbience), [stopAmbience]);

  useEffect(() => () => {
    stopSpeechPlayback();
  }, []);

  useEffect(() => {
    if (!autoSpeakKey || autoSpeakAt === null || autoSpeakAt === undefined) return;
    if (autoSpeakAt < AUTO_SPEAK_READY_AT) return;
    if (autoSpokenMessageIds.has(autoSpeakKey)) return;
    if (role !== 'assistant' || !speakableContent) return;
    if (!canUseConfiguredSpeech && !hasSpeechCache) return;
    if (!getAssistantAmbiencePlan(messageContent).cues.length) return;
    autoSpokenMessageIds.add(autoSpeakKey);
    autoSpeakRef.current?.();
  }, [autoSpeakKey, autoSpeakAt, role, speakableContent, canUseConfiguredSpeech, hasSpeechCache, messageContent]);

  if (!canCopyAssistant && !canSpeakAssistant && !hasAssistantMore && !showCodeCardAction && !taskReceiptAction) {
    return null;
  }

  const copyMessage = async () => {
    if (!messageContent.trim()) return;
    await runSuccessAction(() => writeTextToClipboard(messageContent));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  function stopSpeechPlayback() {
    stopAmbience();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    stopChatSpeechAudio();
    abortRef.current?.abort();
    abortRef.current = null;
    setSpeaking(false);
    setSpeechLoading(false);
  }

  /** A clip that ended on its own: auto read-aloud leaves the ambience running,
   *  a manual tap still tears it down. */
  function finishSpeechPlayback() {
    if (autoPlaybackRef.current) {
      setSpeaking(false);
      return;
    }
    stopSpeechPlayback();
  }

  function applyMessageAmbience(measuredSec?: number) {
    const plan = getAssistantAmbiencePlan(messageContent);
    if (!plan.cues.length) return;
    stopOtherAmbiences(stopAmbience);
    scheduleAmbience(plan.cues, measuredSec ?? plan.estimatedSec);
  }

  const playNativeSpeech = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => finishSpeechPlayback();
    utterance.onerror = () => finishSpeechPlayback();
    setSpeaking(true);
    applyMessageAmbience();
    window.speechSynthesis.speak(utterance);
  };

  const playConfiguredSpeech = async (text: string) => {
    if (!voiceGeneration.baseUrl?.trim() || !voiceGeneration.apiKey?.trim()) {
      onSetCommandStatus(t('chat.messageActions.chooseVoiceProvider'), true);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setSpeechLoading(true);
    try {
      const result = await requestGeneratedSpeech({
        settings: voiceGeneration,
        text,
        signal: controller.signal
      });
      if (controller.signal.aborted) return;
      try {
        const voiceCache = await saveMessageSpeechCache({
          text,
          settings: voiceGeneration,
          result
        });
        if (!controller.signal.aborted) {
          onSpeechCacheReady(voiceCache);
        }
      } catch {
        onSetCommandStatus(t('chat.messageActions.speechCacheSaveFailed'), true);
      }
      if (!controller.signal.aborted) {
        await playAudioBlob(result.blob);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : t('chat.messageActions.speechGenerationFailed');
      onSetCommandStatus(message, true);
      stopSpeechPlayback();
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setSpeechLoading(false);
    }
  };

  const playAudioBlob = async (blob: Blob) => {
    setSpeaking(true);
    await playChatSpeechBlob(blob, {
      onStarted: (durationSec) => applyMessageAmbience(durationSec),
      onEnded: () => finishSpeechPlayback(),
      onError: () => {
        onSetCommandStatus(t('chat.messageActions.audioPlaybackFailed'), true);
        stopSpeechPlayback();
      }
    });
  };

  const playCachedSpeech = async (cache: ChatMessageVoiceCache) => {
    setSpeechLoading(true);
    try {
      const blob = await readMessageSpeechCacheBlob(cache);
      await playAudioBlob(blob);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('chat.messageActions.speechCacheMissing');
      onSetCommandStatus(message, true);
      stopSpeechPlayback();
    } finally {
      setSpeechLoading(false);
    }
  };

  const beginSpeech = (auto = false) => {
    const text = speakableContent;
    if (!text) return;
    autoPlaybackRef.current = auto;
    primeChatSpeechAudio();
    stopSpeechPlayback();
    if (speechCache?.assetId) {
      void playCachedSpeech(speechCache);
      return;
    }
    if (voiceGeneration.enabled) {
      void playConfiguredSpeech(text);
      return;
    }
    onSetCommandStatus(t('chat.messageActions.systemVoiceFallback'));
    playNativeSpeech(text);
  };
  autoSpeakRef.current = () => beginSpeech(true);

  const toggleSpeech = () => {
    if (!canSpeakAssistant || speechLoading) return;
    if (speaking) {
      stopSpeechPlayback();
      return;
    }
    beginSpeech();
  };

  const closeAssistantSheet = () => {
    setAssistantSheetOpen(false);
  };

  const saveAssistantDraft = () => {
    if (!assistantDraft.trim()) return;
    onEditAssistant(assistantDraft);
    closeAssistantSheet();
  };
  const assistantSheet = assistantSheetOpen && typeof document !== 'undefined' ? createPortal(
    <>
      <button
        type="button"
        className="assistant-message-sheet-dismiss"
        aria-label={t('chat.messageActions.closeAssistantActions')}
        onClick={closeAssistantSheet}
      />
      <div className="assistant-message-action-sheet" role="dialog" aria-modal="true" aria-label={assistantSheetMode === 'edit' ? t('chat.messageActions.editAssistant') : t('chat.messageActions.assistantActions')}>
        <div className="assistant-message-action-handle" aria-hidden="true" />
        {assistantSheetMode === 'menu' ? (
          <div className="assistant-message-action-menu">
            {hasMemoryEvidence && memoryEvidence ? (
              <button
                type="button"
                className="assistant-message-action-btn"
                onClick={(event) => {
                  runSelectionAction(() => {
                    setAssistantSheetMode('memory');
                  }, { element: event.currentTarget });
                }}
              >
                <Icon name="memoryMap" size={18} />
                <span>{t('chat.messageActions.memorySources')}</span>
              </button>
            ) : null}
            {canEditAssistant ? (
              <button
                type="button"
                className="assistant-message-action-btn"
                onClick={(event) => {
                  runSelectionAction(() => {
                    setAssistantDraft(messageContent);
                    setAssistantSheetMode('edit');
                  }, { element: event.currentTarget });
                }}
              >
                <Icon name="edit" size={18} />
                <span>{t('chat.messageActions.edit')}</span>
              </button>
            ) : null}
            {canForkAssistant ? (
              <button
                type="button"
                className="assistant-message-action-btn"
                onClick={(event) => {
                  runSelectionAction(() => {
                    onForkAssistant();
                    closeAssistantSheet();
                  }, { element: event.currentTarget });
                }}
              >
                <Icon name="branch" size={18} />
                <span>{t('chat.messageActions.forkFromHere')}</span>
              </button>
            ) : null}
            {canRetryAssistant ? (
              <button
                type="button"
                className="assistant-message-action-btn"
                onClick={(event) => {
                  runSelectionAction(() => {
                    onRetryLatestAssistant();
                    closeAssistantSheet();
                  }, { element: event.currentTarget });
                }}
              >
                <Icon name="refresh" size={18} />
                <span>{resolvedRetryAssistantLabel}</span>
              </button>
            ) : null}
          </div>
        ) : assistantSheetMode === 'memory' && memoryEvidence ? (
          <div className="assistant-message-memory">
            <div className="assistant-message-memory-title">
              <button
                type="button"
                className="assistant-message-memory-back"
                onClick={closeAssistantSheet}
                aria-label={t('chat.messageActions.backToActions')}
              >
                <Icon name="chevron" size={16} />
              </button>
              <span>{t('chat.messageActions.memorySources')}</span>
            </div>
            <MessageMemoryEvidence
              evidence={memoryEvidence}
              expanded
              onToggle={() => {}}
              showTrigger={false}
            />
          </div>
        ) : (
          <div className="assistant-message-edit">
            <div className="assistant-message-edit-title">{t('chat.messageActions.editAssistant')}</div>
            <textarea
              className="assistant-message-edit-input"
              value={assistantDraft}
              onChange={(event) => setAssistantDraft(event.target.value)}
              rows={8}
              autoFocus
            />
            <div className="assistant-message-edit-actions">
              <button type="button" className="assistant-message-edit-btn secondary" onClick={closeAssistantSheet}>{t('chat.messageActions.cancel')}</button>
              <button type="button" className="assistant-message-edit-btn primary" onClick={saveAssistantDraft} disabled={!assistantDraft.trim()}>{t('chat.messageActions.confirmEdit')}</button>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  ) : null;

  return (
    <div className={`message-inline-actions ${role}`}>
      {canCopyAssistant && (
        <button type="button" className={`micro-action-btn ${copied ? 'active' : ''}`} onClick={() => { void copyMessage(); }} aria-label={copied ? t('chat.messageActions.copied') : t('chat.messageActions.copyAssistant')} title={copied ? t('chat.messageActions.copied') : t('chat.messageActions.copyAssistant')}>
          <Icon name="copy" size={14} />
        </button>
      )}
      {canSpeakAssistant ? (
        <button
          type="button"
          className={`micro-action-btn ${speaking ? 'active' : ''} ${speechLoading ? 'generating' : ''}`}
          onClick={(event) => {
            runSelectionAction(toggleSpeech, { element: event.currentTarget });
          }}
          aria-label={speechLoading ? t('chat.messageActions.generatingSpeech') : speaking ? t('chat.messageActions.stopReading') : t('chat.messageActions.readAssistant')}
          title={speechLoading ? t('chat.messageActions.generatingSpeech') : speaking ? t('chat.messageActions.stopReading') : t('chat.messageActions.read')}
          aria-pressed={speaking || speechLoading}
        >
          <Icon name={speechLoading ? 'refresh' : speaking ? 'pause' : 'voice'} size={14} />
        </button>
      ) : null}
      {showCodeCardAction && (
        <>
          <button
            type="button"
            className={`micro-action-btn ${codeCardActionMode === 'open' ? 'active' : ''}`}
            onClick={(event) => {
              runSelectionAction(onCodeCardAction, { element: event.currentTarget });
            }}
            aria-label={codeCardActionLabel}
            title={codeCardActionLabel}
          >
            <Icon name="code" size={14} />
          </button>
          {codeCardProgressLabel && <span className="message-inline-progress">{codeCardProgressLabel}</span>}
        </>
      )}
      {canEditAssistant && (
        <button
          type="button"
          className="micro-action-btn"
          onClick={(event) => {
            runSelectionAction(() => {
              setAssistantDraft(messageContent);
              setAssistantSheetMode('edit');
              setAssistantSheetOpen(true);
            }, { element: event.currentTarget });
          }}
          aria-label={t('chat.messageActions.editAssistant')}
          title={t('chat.messageActions.edit')}
        >
          <Icon name="edit" size={14} />
        </button>
      )}
      {canForkAssistant && (
        <button
          type="button"
          className="micro-action-btn"
          onClick={(event) => {
            runSelectionAction(() => onForkAssistant(), { element: event.currentTarget });
          }}
          aria-label={t('chat.messageActions.forkFromHere')}
          title={t('chat.messageActions.forkFromHere')}
        >
          <Icon name="branch" size={14} />
        </button>
      )}
      {canRetryAssistant && (
        <button
          type="button"
          className="micro-action-btn"
          onClick={(event) => {
            runSelectionAction(() => onRetryLatestAssistant(), { element: event.currentTarget });
          }}
          aria-label={resolvedRetryAssistantLabel}
          title={resolvedRetryAssistantLabel}
        >
          <Icon name="refresh" size={14} />
        </button>
      )}
      {hasMemoryEvidence && memoryEvidence && (
        <button
          type="button"
          className="micro-action-btn"
          onClick={(event) => {
            runSelectionAction(() => {
              setAssistantSheetMode('memory');
              setAssistantSheetOpen(true);
            }, { element: event.currentTarget });
          }}
          aria-label={t('chat.messageActions.memorySources')}
          title={t('chat.messageActions.memorySources')}
        >
          <Icon name="memoryMap" size={14} />
        </button>
      )}
      {taskReceiptAction ? (
        <button
          type="button"
          className={`micro-action-btn task-receipt ${taskReceiptAction.status} ${taskReceiptAction.expanded ? 'active' : ''}`}
          onClick={(event) => {
            runSelectionAction(taskReceiptAction.onToggle, { element: event.currentTarget });
          }}
          aria-label={taskReceiptAction.expanded ? t('chat.messageActions.collapseTask') : t('chat.messageActions.viewTask')}
          title={taskReceiptAction.expanded ? t('chat.messageActions.collapseTaskTitle') : t('chat.messageActions.viewTaskTitle')}
          aria-expanded={taskReceiptAction.expanded}
        >
          <Icon name={taskReceiptAction.status === 'completed' ? (taskReceiptAction.expanded ? 'chevronUp' : 'chevronDown') : 'task'} size={14} />
        </button>
      ) : null}
      {assistantSheet}
    </div>
  );
}
