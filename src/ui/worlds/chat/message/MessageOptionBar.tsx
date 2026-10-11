import { useEffect, useState } from 'react';
import { useI18n } from '../../../../i18n';
import { Icon } from '../../../Icon';

type MessageOptionBarProps = {
  options: string[];
  interactive: boolean;
  onSelect: ((text: string) => void) | null;
};

const OPTION_LETTERS = 'ABCDEFGH';

function resolveLetter(index: number) {
  return OPTION_LETTERS[index] ?? String(index + 1);
}

export function MessageOptionBar({ options, interactive, onSelect }: MessageOptionBarProps) {
  const { t } = useI18n();
  const [customText, setCustomText] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const canChoose = interactive && typeof onSelect === 'function' && chosen === null;
  const trimmedCustom = customText.trim();

  useEffect(() => {
    if (!canChoose) setCustomText('');
  }, [canChoose]);

  const choose = (text: string) => {
    if (!canChoose || !onSelect) return;
    const value = text.trim();
    if (!value) return;
    setChosen(value);
    onSelect(value);
  };

  const submitCustom = () => {
    if (!trimmedCustom) return;
    choose(trimmedCustom);
  };

  return (
    <div
      className={`message-option-bar ${canChoose ? 'is-interactive' : 'is-static'}`}
      role="group"
      aria-label={t('chat.optionBar.aria')}
    >
      <div className="message-option-bar-list">
        {options.map((option, index) => {
          const rowClass = `message-option-bar-row ${chosen === option ? 'is-chosen' : ''}`.trim();
          const letter = (
            <span className="message-option-bar-letter" aria-hidden="true">{resolveLetter(index)}</span>
          );
          const text = <span className="message-option-bar-text">{option}</span>;
          if (!canChoose) {
            return (
              <div key={`${index}-${option}`} className={rowClass}>
                {letter}
                {text}
              </div>
            );
          }
          return (
            <button
              key={`${index}-${option}`}
              type="button"
              className={rowClass}
              onClick={() => choose(option)}
            >
              {letter}
              {text}
            </button>
          );
        })}
        {canChoose ? (
          <div className="message-option-bar-custom">
            <span className="message-option-bar-letter" aria-hidden="true">{resolveLetter(options.length)}</span>
            <input
              type="text"
              value={customText}
              placeholder={t('chat.optionBar.customPlaceholder')}
              aria-label={t('chat.optionBar.customAria')}
              onChange={(event) => setCustomText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                submitCustom();
              }}
            />
            <button
              type="button"
              className="message-option-bar-send"
              data-ready={trimmedCustom ? 'true' : 'false'}
              aria-label={t('chat.optionBar.sendCustom')}
              disabled={!trimmedCustom}
              onClick={submitCustom}
            >
              <Icon name="send" size={16} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}