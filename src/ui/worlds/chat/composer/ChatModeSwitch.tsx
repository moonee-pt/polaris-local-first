import { useEffect, useRef, useState } from 'react';
import type { ChatOutputMode } from '../../../../types/domain';
import { useChatActions, useChatComposer } from '../context/ChatContext';
import { Icon, type IconName } from '../../../Icon';
import { useI18n } from '../../../../i18n';

const MODE_ORDER: ChatOutputMode[] = ['chat', 'novel', 'voice'];

const MODE_LABEL_KEY = {
  chat: 'chat.mode.option.chat',
  novel: 'chat.mode.option.novel',
  voice: 'chat.mode.option.voice'
} as const;

const MODE_DESC_KEY = {
  chat: 'chat.mode.desc.chat',
  novel: 'chat.mode.desc.novel',
  voice: 'chat.mode.desc.voice'
} as const;

const MODE_ICON: Record<ChatOutputMode, IconName> = {
  chat: 'navDialogue',
  novel: 'openBook',
  voice: 'voice'
};

/**
 * Composer-left switch for the conversation's output mode (chat / novel / voice script).
 * Switching only affects later replies; the store action drops a faint divider note.
 */
export function ChatModeSwitch() {
  const { t } = useI18n();
  const composer = useChatComposer();
  const actions = useChatActions();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const mode = composer.outputMode;

  return (
    <div className="chat-mode-switch" ref={rootRef}>
      <button
        type="button"
        className="chat-mode-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('chat.mode.button')} · ${t(MODE_LABEL_KEY[mode])}`}
        title={t('chat.mode.button')}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name={MODE_ICON[mode]} size={13} />
        <span className="chat-mode-button-label">{t(MODE_LABEL_KEY[mode])}</span>
        <Icon name="chevronDown" size={11} />
      </button>
      {open ? (
        <div className="chat-mode-menu" role="menu" aria-label={t('chat.mode.menuAria')}>
          {MODE_ORDER.map((option) => {
            const active = mode === option;
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`chat-mode-option ${active ? 'active' : ''}`}
                onClick={() => {
                  actions.setOutputMode(option);
                  setOpen(false);
                }}
              >
                <Icon name={MODE_ICON[option]} size={14} />
                <span className="chat-mode-option-copy">
                  <span className="chat-mode-option-label">{t(MODE_LABEL_KEY[option])}</span>
                  <span className="chat-mode-option-desc">{t(MODE_DESC_KEY[option])}</span>
                </span>
                {active ? <Icon name="check" size={13} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
