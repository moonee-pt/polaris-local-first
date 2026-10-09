import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../../i18n';
import type { ChatMessage, ChatMessageVoiceCall } from '../../../types/domain';
import { Icon } from '../../Icon';
import { runSelectionAction } from '../../haptics';

type VoiceCallRecordCardProps = {
  meta: ChatMessageVoiceCall;
  messages: ChatMessage[];
  assistantName: string;
};

function formatCallDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

function formatClockTime(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function VoiceCallRecordCard({ meta, messages, assistantName }: VoiceCallRecordCardProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const durationLabel = formatCallDuration(meta.endedAt - meta.startedAt);

  return (
    <>
      <button
        type="button"
        className={`voice-call-record ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-label={t('chat.callRecord.open')}
        onClick={(event) => {
          runSelectionAction(() => setOpen(true), { element: event.currentTarget });
        }}
      >
        <span className="voice-call-record-icon" aria-hidden="true">
          <Icon name="phone" size={15} />
        </span>
        <span className="voice-call-record-body">
          <span className="voice-call-record-title">{t('chat.callRecord.title')}</span>
          <span className="voice-call-record-meta">
            <span>{formatClockTime(meta.startedAt)}</span>
            <span className="voice-call-record-dot">·</span>
            <span>{t('chat.callRecord.duration', { duration: durationLabel })}</span>
            <span className="voice-call-record-dot">·</span>
            <span>{t('chat.callRecord.turns', { count: String(meta.turnCount) })}</span>
          </span>
        </span>
        <span className="voice-call-record-chevron" aria-hidden="true">
          <Icon name="chevron" size={14} />
        </span>
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
          <div className="voice-call-record-sheet" role="dialog" aria-modal="true" aria-label={t('chat.callRecord.title')}>
            <div className="voice-call-record-sheet-panel">
              <div className="voice-call-record-sheet-head">
                <span className="voice-call-record-sheet-title">{t('chat.callRecord.title')}</span>
                <span className="voice-call-record-sheet-meta">
                  {formatClockTime(meta.startedAt)} · {durationLabel}
                </span>
                <button
                  type="button"
                  className="voice-call-record-sheet-close"
                  aria-label={t('chat.callRecord.close')}
                  onClick={(event) => {
                    runSelectionAction(() => setOpen(false), { element: event.currentTarget });
                  }}
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
              <div className="voice-call-record-sheet-body">
                {messages.length === 0 ? (
                  <p className="voice-call-record-empty">{t('chat.callRecord.empty')}</p>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className={`voice-call-record-line ${message.role}`}>
                      <span className="voice-call-record-line-who">
                        {message.role === 'user' ? t('chat.callRecord.you') : assistantName}
                      </span>
                      <p className="voice-call-record-line-text">{message.content.trim()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )
        : null}
    </>
  );
}
