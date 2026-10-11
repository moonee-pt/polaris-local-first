import { useI18n } from '../../../i18n';
import { Icon } from '../../Icon';
import { runSelectionAction } from '../../haptics';

export function ChatReadingEntry({ onOpen }: { onOpen: () => void }) {
  const { t } = useI18n();
  return (
    <div className="chat-reading-entry-row">
      <button
        type="button"
        className="chat-reading-entry"
        aria-label={t('chat.reading.open')}
        onClick={(event) => runSelectionAction(onOpen, { element: event.currentTarget })}
      >
        <Icon name="openBook" size={14} />
        <span>{t('chat.reading.open')}</span>
      </button>
    </div>
  );
}