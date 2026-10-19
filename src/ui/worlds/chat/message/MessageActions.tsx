import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CodeCardActionMode } from '../../../../app/chat/chatDerivedState';
import { readMessageSpeechCacheBlob, saveMessageSpeechCache } from '../../../../app/chat/messageSpeechCache';
import { playChatSpeechBlob, primeChatSpeechAudio, stopChatSpeechAudio } from '../../../../app/chat/chatSpeechAudio';
import { requestGeneratedSpeech } from '../../../../engines/voiceGenerationClient';
import { useFleshAmbience } from '../../../../app/call/useFleshAmbience';
import { writeTextToClipboard } from '../../../../infrastructure/clipboard';
import { useVoiceSettingsForSpeaker } from '../../../../app/voice/useVoiceSettingsForSpeaker';
import { useVoiceScriptPlayback } from '../../../../app/chat/voiceScriptPlayback';
import type { ChatMemoryEvidence, ChatMessageVoiceCache, ConversationTaskStatus } from '../../../../types/domain';
import type { FleshAmbienceCategory, FleshCue } from '../../../../engines/voice/fleshAmbience';
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
  messageId?: string;
  /** Set on the newest settled reply so its voice can start without a tap. */
  speakerCollaboratorId?: string | null;
  autoSpeakKey?: string | null;
  autoSpeakAt?: number | null;
  /** Only the turn's final reply reads aloud; intermediate steps stay quiet. */
  allowAssistantSpeech?: boolean;
  /** 音声模式：每句独立 TTS + 句间停顿 + 自动朗读 */
  isVoiceScriptMode?: boolean;
  /** Reply is still streaming: 音声模式 feeds closed lines to the pipeline as they land. */
  isStreamingLike?: boolean;
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
  messageId = '',
  speakerCollaboratorId = null,
  autoSpeakKey = null,
  autoSpeakAt = null,
  allowAssistantSpeech = true,
  isVoiceScriptMode = false,
  isStreamingLike = false,
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
  const voiceScriptMessageIdRef = useRef<string | null>(null);
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

  // Categories the previous spoken line marked: beds not re-marked by the next
  // line close when that line starts; the last line's beds carry to the next reply.
  const voiceScriptMarkedRef = useRef<FleshAmbienceCategory[]>([]);

  const handleVoiceScriptLine = (durationSec: number, cues: FleshCue[], retire?: FleshAmbienceCategory[]) => {
    const previous = retire ?? voiceScriptMarkedRef.current;
    voiceScriptMarkedRef.current = cues.map((cue) => cue.category);
    const timed = cues.map((cue) => ({ ...cue, atRatio: 0 }));
    scheduleAmbience(timed, Math.max(1, durationSec), previous);
  };

  const {
    speaking: voiceScriptSpeaking,
    loading: voiceScriptLoading,
    speak: speakVoiceScript,
    feedStream: feedVoiceScriptStream,
    finalize: finalizeVoiceScriptSpeech,
    stop: stopVoiceScript
  } = useVoiceScriptPlayback({
    speakerCollaboratorId,
    onSpeechCacheReady: (voiceCache) => onSpeechCacheReady(voiceCache),
    onStarted: (durationSec, cues) => handleVoiceScriptLine(durationSec, cues),
    onEnded: (cues) => handleVoiceScriptLine(0, cues, [])
  });

  const effectiveSpeaking = speaking || voiceScriptSpeaking;
  const effectiveLoading = speechLoading || voiceScriptLoading;

  useEffect(() => {
    setAmbienceDucked(effectiveSpeaking);
  }, [effectiveSpeaking, setAmbienceDucked]);

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
    if (isVoiceScriptMode) {
      // 音声模式：首句一闭合就送合成，之后的内容边流边喂。
      if (!beginVoiceScriptSpeech(true, isStreamingLike)) return;
      autoSpokenMessageIds.add(autoSpeakKey);
      return;
    }
    // 普通模式：没有环境音提示就不自动朗读
    if (!getAssistantAmbiencePlan(messageContent).cues.length) return;
    autoSpokenMessageIds.add(autoSpeakKey);
    autoSpeakRef.current?.();
  }, [autoSpeakKey, autoSpeakAt, role, speakableContent, canUseConfiguredSpeech, hasSpeechCache, messageContent, isVoiceScriptMode, isStreamingLike]);

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
    stopVoiceScript();
    voiceScriptMessageIdRef.current = null;
    voiceScriptMarkedRef.current = [];
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

  const beginVoiceScriptSpeech = (auto = false, streaming = false, useCache = true): boolean => {
    const text = speakableContent;
    if (!text) return false;
    autoPlaybackRef.current = auto;
    primeChatSpeechAudio();
    stopSpeechPlayback();
    const started = speakVoiceScript(messageId, text, useCache ? (speechCache ?? null) : null, streaming);
    voiceScriptMessageIdRef.current = started ? messageId : null;
    return started;
  };

  const beginSpeech = (auto = false) => {
    // 音声模式：走分句 TTS 管线（逐句生成 + 句间停顿）
    if (isVoiceScriptMode && (canUseConfiguredSpeech || hasSpeechCache)) {
      beginVoiceScriptSpeech(auto);
      return;
    }
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

  // 音声模式流式期间：新闭合的句子随时喂进合成队列；流结束时收尾。
  useEffect(() => {
    if (!isVoiceScriptMode || role !== 'assistant') return;
    if (voiceScriptMessageIdRef.current !== messageId) return;
    if (!speakableContent) return;
    if (isStreamingLike) {
      feedVoiceScriptStream(messageId, speechContent);
      return;
    }
    finalizeVoiceScriptSpeech(messageId, speechContent);
    voiceScriptMessageIdRef.current = null;
  }, [isVoiceScriptMode, isStreamingLike, role, messageId, speechContent, speakableContent, feedVoiceScriptStream, finalizeVoiceScriptSpeech]);

  const toggleSpeech = () => {
    if (!canSpeakAssistant || effectiveLoading) return;
    if (effectiveSpeaking) {
      stopSpeechPlayback();
      return;
    }
    beginSpeech();
  };

  /** Re-synthesise the same reply: the cached clip is skipped, the TTS runs again
   *  and the body-sound beds are laid out from a fresh roll. */
  const regenerateSpeech = () => {
    if (!canUseConfiguredSpeech || !speakableContent) return;
    if (isVoiceScriptMode) {
      beginVoiceScriptSpeech(false, false, false);
      return;
    }
    autoPlaybackRef.current = false;
    primeChatSpeechAudio();
    stopSpeechPlayback();
    void playConfiguredSpeech(speakableContent);
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
            {canSpeakAssistant && canUseConfiguredSpeech && !isStreamingLike ? (
              <button
                type="button"
                className="assistant-message-action-btn"
                onClick={(event) => {
                  runSelectionAction(() => {
                    regenerateSpeech();
                    closeAssistantSheet();
                  }, { element: event.currentTarget });
                }}
              >
                <Icon name="sparkle" size={18} />
                <span>{t('chat.messageActions.regenerateSpeech')}</span>
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
          className={`micro-action-btn ${effectiveSpeaking ? 'active' : ''} ${effectiveLoading ? 'generating' : ''}`}
          onClick={(event) => {
            runSelectionAction(toggleSpeech, { element: event.currentTarget });
          }}
          aria-label={effectiveLoading ? t('chat.messageActions.generatingSpeech') : effectiveSpeaking ? t('chat.messageActions.stopReading') : t('chat.messageActions.readAssistant')}
          title={effectiveLoading ? t('chat.messageActions.generatingSpeech') : effectiveSpeaking ? t('chat.messageActions.stopReading') : t('chat.messageActions.read')}
          aria-pressed={effectiveSpeaking || effectiveLoading}
        >
          <Icon name={effectiveLoading ? 'refresh' : effectiveSpeaking ? 'pause' : 'voice'} size={14} />
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
