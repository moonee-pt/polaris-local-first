import { useEffect, useMemo, useState } from 'react';
import type { ChatMessage, ToolInvocation } from '../../../../types/domain';
import type { I18nTranslator } from '../../../../i18n';
import { useI18n } from '../../../../i18n';
import { Icon } from '../../../Icon';
import { toolIconName } from '../chatToolIcons';
import { buildThinkingSessionSummary, createThinkingSummaryCopy } from '../thinkingSummary';
import { buildAssistantSpeechText } from '../message/messageSpeechText';
import { readFleshCues, type FleshAmbiencePreset, type FleshCue } from '../../../../engines/voice/fleshAmbience';
import type { I18nKey } from '../../../../i18n/messages';

type ThinkingSheetProps = {
  message: ChatMessage | null;
  messages: ChatMessage[];
  assistantName: string;
  onClose: () => void;
};

const FLESH_CATEGORY_KEYS: Record<string, string> = {
  dryplap: 'dryplap',
  wetplap: 'wetplap',
  wet: 'wet',
  stroke: 'stroke',
  cum: 'cum',
  pullout: 'pullout'
};

function describeFleshCue(cue: FleshCue, t: I18nTranslator['t']) {
  const categoryKey = FLESH_CATEGORY_KEYS[cue.category];
  const label = t((`chat.performanceTag.${categoryKey}`) as I18nKey);
  if (cue.kind === 'oneShot') {
    return `${label} · ${t('chat.thinking.voice.oneShot')}`;
  }
  const presetLabel = t((`chat.thinking.voice.preset.${cue.preset as FleshAmbiencePreset}`) as I18nKey);
  return `${label} · ${presetLabel} · ${t('chat.thinking.voice.loop')}`;
}

function localizeToolStatus(status: ToolInvocation['status'], t: I18nTranslator['t']) {
  switch (status) {
    case 'running':
      return t('chat.thinking.toolStatus.running');
    case 'preview':
      return t('chat.thinking.toolStatus.preview');
    case 'applied':
      return t('chat.thinking.toolStatus.applied');
    case 'rolled_back':
      return t('chat.thinking.toolStatus.rolled_back');
    case 'superseded':
      return t('chat.thinking.toolStatus.superseded');
    case 'executed':
      return t('chat.thinking.toolStatus.executed');
    case 'saved':
      return t('chat.thinking.toolStatus.saved');
    case 'failed':
      return t('chat.thinking.toolStatus.failed');
    default:
      return status;
  }
}

export function ThinkingSheet({
  message,
  messages,
  assistantName,
  onClose
}: ThinkingSheetProps) {
  const { t } = useI18n();
  const [rawExpanded, setRawExpanded] = useState(false);
  const copy = useMemo(() => createThinkingSummaryCopy(t), [t]);
  const session = useMemo(
    () => (message ? buildThinkingSessionSummary(messages, message.id, copy) : null),
    [copy, message, messages]
  );

  const voice = useMemo(() => {
    if (!message || message.role !== 'assistant') return null;
    const cues = readFleshCues(message.content);
    const ttsText = buildAssistantSpeechText(message.content);
    if (!cues.length && !ttsText) return null;
    return { ttsText, cues };
  }, [message]);

  useEffect(() => {
    setRawExpanded(false);
  }, [message?.id]);

  if (!message || !session) return null;

  return (
    <div className="thinking-summary-overlay" role="dialog" aria-modal="true" aria-label={t('chat.thinking.sheetAria')}>
      <button type="button" className="thinking-summary-backdrop" aria-label={t('chat.thinking.closeAria')} onClick={onClose} />
      <div className="thinking-summary-sheet">
        <div className="sheet-handle" />
        <div className="thinking-summary-topbar">
          <button type="button" className="thinking-summary-close" onClick={onClose} aria-label={t('chat.thinking.closeAria')}>
            <Icon name="x" size={18} />
          </button>
          <div className="thinking-summary-title">
            <strong>Summary</strong>
            <span>{[message.assistantName || assistantName, session.statsLabel].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="thinking-summary-spacer" aria-hidden="true" />
        </div>
        <div className="thinking-summary-list">
          {session.steps.map((step) => (
            <article key={step.id} className={`thinking-summary-step ${step.kind}`}>
              <div className="thinking-summary-item-rail" aria-hidden="true">
                <span className={`thinking-summary-item-dot ${step.kind} ${step.kind === 'tool' ? step.tool.status : ''}`}>
                  {step.kind === 'thinking' ? <Icon name="polarisStar" size={11} color="polarisDeepSpace" /> : <Icon name={toolIconName(step.tool)} size={12} />}
                </span>
              </div>
              <div className={`thinking-summary-step-shell ${step.kind} ${step.kind === 'tool' ? step.tool.status : ''}`}>
                {step.kind === 'thinking' ? (
                  <div className="thinking-summary-phase-list">
                    {step.items.map((item) => (
                      <div key={item.id} className={`thinking-summary-phase-item ${item.kind}`}>
                        <span className={`thinking-summary-phase-dot ${item.kind}`} aria-hidden="true" />
                        <div className="thinking-summary-phase-copy">
                          <p>{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="thinking-summary-tool-head">
                      <span className="thinking-summary-step-kicker">{t('chat.thinking.toolKicker')}</span>
                      <span className={`thinking-summary-tool-status ${step.tool.status}`}>{localizeToolStatus(step.tool.status, t)}</span>
                    </div>
                    <strong className="thinking-summary-step-preview">{step.tool.title}</strong>
                    <p className="thinking-summary-tool-detail">{step.tool.summary}</p>
                    {step.tool.themeSurfaceLabels?.length ? (
                      <div className="thinking-summary-tool-chip-row">
                        {step.tool.themeSurfaceLabels.map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                      </div>
                    ) : null}
                    {step.tool.memoryItems?.length ? (
                      <div className="thinking-summary-tool-chip-row">
                        {step.tool.memoryItems.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </article>
          ))}
        </div>

        {voice ? (
          <section className="thinking-summary-voice">
            <span className="thinking-summary-voice-kicker">{t('chat.thinking.voice.title')}</span>
            <div className="thinking-summary-voice-row">
              <span className="thinking-summary-voice-label">{t('chat.thinking.voice.tts')}</span>
              <pre className="thinking-summary-voice-tts">{voice.ttsText || '—'}</pre>
            </div>
            <div className="thinking-summary-voice-row">
              <span className="thinking-summary-voice-label">{t('chat.thinking.voice.track')}</span>
              {voice.cues.length ? (
                <div className="thinking-summary-voice-track">
                  {voice.cues.map((cue, index) => (
                    <span key={`voice-cue-${index}`} className="thinking-summary-voice-track-item">
                      {describeFleshCue(cue, t)}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="thinking-summary-voice-track-empty">{t('chat.thinking.voice.trackEmpty')}</span>
              )}
            </div>
          </section>
        ) : null}

        <div className="thinking-summary-raw">
          <button
            type="button"
            className="thinking-summary-raw-toggle"
            onClick={() => setRawExpanded((value) => !value)}
            aria-expanded={rawExpanded}
          >
            <span>{t('chat.thinking.raw')}</span>
            <Icon name={rawExpanded ? 'chevronUp' : 'chevronDown'} size={14} />
          </button>
          {rawExpanded ? (
            <div className="thinking-summary-raw-sections">
              {session.rawSections.map((section) => (
                <section key={section.id} className="thinking-summary-raw-section">
                  <span className="thinking-summary-raw-kicker">{section.label}</span>
                  <pre className="thinking-summary-raw-body">{section.content}</pre>
                </section>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
