import { useState } from 'react';
import { CreateActionSheet } from '../../create/CreateActionSheet';
import { useI18n } from '../../../i18n';

export type DocumentActionItem = {
  key: string;
  label: string;
  disabled?: boolean;
  tone?: 'normal' | 'primary' | 'danger';
  onSelect: () => void;
};

type DocumentActionMenuProps = {
  items: DocumentActionItem[];
  label?: string;
};

export function DocumentActionMenu({
  items,
  label
}: DocumentActionMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const actionLabel = label ?? t('collection.workshop.moreActions');

  const handleSelect = (item: DocumentActionItem) => {
    if (item.disabled) return;
    setOpen(false);
    item.onSelect();
  };

  return (
    <div className="document-action-menu">
      <button
        type="button"
        className="document-action-trigger"
        aria-label={actionLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="document-action-trigger-dots" aria-hidden="true">
          <span className="document-action-trigger-dot" />
          <span className="document-action-trigger-dot" />
          <span className="document-action-trigger-dot" />
        </span>
      </button>
      <CreateActionSheet
        open={open}
        ariaLabel={actionLabel}
        className="document-action-sheet"
        onClose={() => setOpen(false)}
      >
        <div className="document-action-sheet-list" role="menu" aria-label={actionLabel}>
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={`document-action-sheet-item document-action-sheet-item--${item.tone ?? 'normal'}`}
              disabled={item.disabled}
              onClick={() => handleSelect(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </CreateActionSheet>
    </div>
  );
}
