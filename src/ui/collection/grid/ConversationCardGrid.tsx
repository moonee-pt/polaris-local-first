import { useCallback, useMemo, useState } from 'react';
import { buildConversationCardSummary } from '../../../app/collection/conversationCardSummary';
import type { ConversationMessageSearchIndex } from '../../../app/collection/conversationMessageSearch';
import { useI18n } from '../../../i18n';
import type { Conversation, Persona } from '../../../types/domain';
import { runSelectionAction } from '../../haptics';
import { Icon } from '../../Icon';
import { CreateActionSheet } from '../../create/CreateActionSheet';
import { ConversationCardProvider } from './ConversationCardContext';
import { ConversationCardItem } from './ConversationCardItem';
import { useVirtualCardWindow } from './useVirtualCardWindow';

type ConversationCardGridProps = {
  cardsExpanded: boolean;
  conversations: Conversation[];
  conversationMessageSearchIndex?: ConversationMessageSearchIndex;
  personas: Persona[];
  activeConversationId: string | null;
  editingConversationId: string | null;
  conversationTitleDraft: string;
  onConversationTitleDraftChange: (value: string) => void;
  onStartConversationRename: (conversationId: string, currentTitle: string) => void;
  onCommitConversationRename: (conversationId: string) => void;
  onCancelConversationRename: () => void;
  onConversationPinToggle: (conversationId: string) => void;
  onConversationDelete: (conversationId: string, title: string) => void;
  onOpenConversation: (conversationId: string) => void;
  onOpenConversationMessage?: (conversationId: string, messageId: string) => void;
};

export function ConversationCardGrid({
  cardsExpanded,
  conversations,
  conversationMessageSearchIndex,
  personas,
  activeConversationId,
  editingConversationId,
  conversationTitleDraft,
  onConversationTitleDraftChange,
  onStartConversationRename,
  onCommitConversationRename,
  onCancelConversationRename,
  onConversationPinToggle,
  onConversationDelete,
  onOpenConversation,
  onOpenConversationMessage
}: ConversationCardGridProps) {
  const { t, language } = useI18n();
  const [menuConversationId, setMenuConversationId] = useState<string | null>(null);
  const openConversationMenu = useCallback((conversationId: string) => {
    setMenuConversationId(conversationId);
  }, []);
  const listDensity = conversations.length > 8 ? 'cards-heavy' : 'cards-normal';
  const hasMessageSearchMatches = Object.keys(conversationMessageSearchIndex ?? {}).length > 0;
  const virtualWindow = useVirtualCardWindow({
    itemCount: conversations.length,
    estimateRowHeight: cardsExpanded ? (hasMessageSearchMatches ? 226 : 154) : 68,
    overscanRows: cardsExpanded ? 5 : 10
  });
  const visibleConversations = useMemo(
    () => conversations.slice(virtualWindow.startIndex, virtualWindow.endIndex),
    [conversations, virtualWindow.endIndex, virtualWindow.startIndex]
  );
  const visibleConversationSummaries = useMemo(
    () =>
      visibleConversations.map((conversation) => ({
        ...buildConversationCardSummary(conversation, { language }),
        searchMatches: conversationMessageSearchIndex?.[conversation.id] ?? null
      })),
    [
      conversationMessageSearchIndex,
      language,
      visibleConversations
    ]
  );
  const collaboratorNameById = useMemo(
    () => Object.fromEntries(personas.map((persona) => [persona.id, persona.name])) as Record<string, string>,
    [personas]
  );
  const contextValue = useMemo(
    () => ({
      collaboratorNameById,
      activeConversationId,
      editingConversationId,
      conversationTitleDraft,
      onConversationTitleDraftChange,
      onCommitConversationRename,
      onCancelConversationRename,
      onConversationDelete,
      onOpenConversation,
      onOpenConversationMenu: openConversationMenu,
      onOpenConversationMessage
    }),
    [
      activeConversationId,
      collaboratorNameById,
      conversationTitleDraft,
      editingConversationId,
      onCancelConversationRename,
      onCommitConversationRename,
      onConversationDelete,
      onOpenConversationMessage,
      onOpenConversation,
      openConversationMenu,
      onConversationTitleDraftChange
    ]
  );
  const menuConversation = menuConversationId
    ? visibleConversationSummaries.find((summary) => summary.id === menuConversationId) ?? null
    : null;

  return (
    <ConversationCardProvider value={contextValue}>
      <div
        ref={virtualWindow.containerRef}
        className={`conversation-card-list ${cardsExpanded ? 'search-open' : 'search-closed'} ${listDensity}`}
      >
        {virtualWindow.topSpacerHeight > 0 ? (
          <div
            className="collection-virtual-spacer"
            style={{ height: virtualWindow.topSpacerHeight }}
            aria-hidden="true"
          />
        ) : null}

        {visibleConversationSummaries.map((conversation) => (
          <ConversationCardItem
            key={conversation.id}
            conversation={conversation}
            cardsExpanded={cardsExpanded}
          />
        ))}

        {virtualWindow.bottomSpacerHeight > 0 ? (
          <div
            className="collection-virtual-spacer"
            style={{ height: virtualWindow.bottomSpacerHeight }}
            aria-hidden="true"
          />
        ) : null}

        {conversations.length === 0 && (
          <div className="empty-state-floating collection-shelf-empty-state dialogue-empty-state">
            <p className="empty-state-title">{t('collection.dialogue.emptyTitle')}</p>
          </div>
        )}
      </div>

      <CreateActionSheet
        open={menuConversation !== null}
        ariaLabel={menuConversation?.displayTitle ?? ''}
        className="conversation-card-menu-sheet"
        onClose={() => setMenuConversationId(null)}
      >
        {menuConversation ? (
          <div className="conversation-card-menu">
            <p className="conversation-card-menu-title">{menuConversation.displayTitle}</p>
            <button
              type="button"
              className="conversation-card-menu-item"
              onClick={(event) => {
                const conversationId = menuConversation.id;
                runSelectionAction(() => {
                  setMenuConversationId(null);
                  onStartConversationRename(conversationId, menuConversation.title);
                }, { element: event.currentTarget });
              }}
            >
              <Icon name="edit" size={15} />
              <span>{t('collection.dialogue.rename')}</span>
            </button>
            <button
              type="button"
              className="conversation-card-menu-item"
              onClick={(event) => {
                const conversationId = menuConversation.id;
                runSelectionAction(() => {
                  setMenuConversationId(null);
                  onConversationPinToggle(conversationId);
                }, { element: event.currentTarget });
              }}
            >
              <Icon name="pin" size={15} />
              <span>{menuConversation.pinnedAt ? t('collection.dialogue.unpin') : t('collection.dialogue.pin')}</span>
            </button>
            <button
              type="button"
              className="conversation-card-menu-item conversation-card-menu-item--danger"
              onClick={(event) => {
                const conversationId = menuConversation.id;
                runSelectionAction(() => {
                  setMenuConversationId(null);
                  onConversationDelete(conversationId, menuConversation.title);
                }, { element: event.currentTarget });
              }}
            >
              <Icon name="trash" size={15} />
              <span>{t('collection.dialogue.delete')}</span>
            </button>
          </div>
        ) : null}
      </CreateActionSheet>
    </ConversationCardProvider>
  );
}
