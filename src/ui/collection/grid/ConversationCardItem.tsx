import { memo, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { ConversationCardSummary } from '../../../app/collection/conversationCardSummary';
import { useI18n } from '../../../i18n';
import { Icon } from '../../Icon';
import { runImpactAction, runSelectionAction, selectionHaptic } from '../../haptics';
import { useConversationCardContext } from './ConversationCardContext';
import { useSwipeDelete } from './useSwipeDelete';
import { useTapIntentGuard } from '../useTapIntentGuard';
import { collectionRelativeDateLabel, collectionArchiveDateTimeLabel } from '../collectionUtils';

const LONG_PRESS_MS = 520;

type ConversationCardItemProps = {
  conversation: ConversationCardSummary;
  cardsExpanded: boolean;
};

export const ConversationCardItem = memo(function ConversationCardItem({
  conversation,
  cardsExpanded
}: ConversationCardItemProps) {
  const { t, language, formatNumber } = useI18n();
  const {
    collaboratorNameById,
    activeConversationId,
    editingConversationId,
    conversationTitleDraft,
    onConversationTitleDraftChange,
    onCommitConversationRename,
    onCancelConversationRename,
    onConversationDelete,
    onOpenConversation,
    onOpenConversationMenu,
    onOpenConversationMessage
  } = useConversationCardContext();
  const collaboratorName = conversation.collaboratorId
    ? collaboratorNameById[conversation.collaboratorId] ?? '?'
    : t('collection.dialogue.unassignedHistory');
  const isEditing = editingConversationId === conversation.id;
  const isActive = conversation.id === activeConversationId;
  const conversationTitle = conversation.displayTitle;
  const swipeDelete = useSwipeDelete(isEditing);
  const tapIntent = useTapIntentGuard();
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const clearLongPress = () => {
    if (longPressTimerRef.current === null) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };
  const handleLongPressStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    tapIntent.handlePointerDown(event);
    clearLongPress();
    longPressFiredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      longPressFiredRef.current = true;
      void selectionHaptic();
      onOpenConversationMenu(conversation.id);
    }, LONG_PRESS_MS);
  };
  const handleLongPressEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    clearLongPress();
    tapIntent.handlePointerEnd(event);
  };
  useEffect(() => clearLongPress, []);
  const handleDelete = (element?: HTMLElement | null) => {
    runImpactAction(() => {
      swipeDelete.close();
      onConversationDelete(conversation.id, conversation.title);
    }, element ? { element } : undefined);
  };
  const handleOpenConversation = (element?: HTMLElement | null) => {
    if (swipeDelete.open) {
      swipeDelete.close();
      return;
    }
    swipeDelete.close();
    runSelectionAction(() => onOpenConversation(conversation.id), element ? { element } : undefined);
  };
  const handleOpenMessageMatch = (messageId: string, element?: HTMLElement | null) => {
    if (swipeDelete.open) {
      swipeDelete.close();
      return;
    }
    swipeDelete.close();
    runSelectionAction(() => {
      if (onOpenConversationMessage) {
        onOpenConversationMessage(conversation.id, messageId);
        return;
      }
      onOpenConversation(conversation.id);
    }, element ? { element } : undefined);
  };

  const searchMatches = cardsExpanded ? conversation.searchMatches : null;
  const visibleSearchMatches = searchMatches?.matches ?? [];
  const hiddenSearchMatchCount = Math.max(0, (searchMatches?.total ?? 0) - visibleSearchMatches.length);
  const searchRoleLabel = (role: (typeof visibleSearchMatches)[number]['role']) => {
    if (role === 'user') return t('collection.dialogue.searchRole.user');
    if (role === 'assistant') return collaboratorName;
    return t('collection.dialogue.searchRole.system');
  };

  const detailExpanded = isEditing || cardsExpanded;

  return (
    <article
      className={`card conversation-card ${isActive ? 'active' : ''} ${conversation.pinnedAt ? 'pinned' : ''} ${isEditing ? 'editing' : ''} ${detailExpanded ? 'expanded' : 'collapsed'} ${cardsExpanded ? 'search-expanded' : 'search-collapsed'} ${cardsExpanded ? 'detail-static' : 'detail-animated'} ${swipeDelete.open ? 'swipe-open' : ''} ${swipeDelete.dragging ? 'swiping' : ''}`}
      style={swipeDelete.style}
      {...swipeDelete.swipeProps}
    >
      <button
        type="button"
        className="conversation-card-swipe-delete"
        data-swipe-delete-action="true"
        onClick={(event) => handleDelete(event.currentTarget)}
        aria-label={t('collection.dialogue.deleteAria', { title: conversationTitle })}
      >
        {t('collection.dialogue.delete')}
      </button>
      <div className="conversation-card-swipe-surface">
        <div className="conversation-card-thread-mark" aria-hidden="true" />
        <div className="conversation-card-head">
          <div className="card-meta-row">
            <div className="conversation-card-meta-copy">
              <small className="conversation-card-persona">{collaboratorName}</small>
            </div>
            <small className="conversation-card-updated">{conversation.pinnedAt ? t('common.pinned') : collectionRelativeDateLabel(conversation.updatedAt, language)}</small>
          </div>
        </div>

        {isEditing ? (
          <div className="conversation-card-edit" data-swipe-delete-ignore="true">
            <input
              value={conversationTitleDraft}
              onChange={(event) => onConversationTitleDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  runImpactAction(() => onCommitConversationRename(conversation.id), { settle: 'none' });
                } else if (event.key === 'Escape') {
                  runSelectionAction(onCancelConversationRename, { settle: 'none' });
                }
              }}
              autoFocus
            />
            <div className="conversation-card-edit-actions">
              <button type="button" className="btn-secondary compact-btn" onClick={(event) => {
                runImpactAction(() => onCommitConversationRename(conversation.id), { element: event.currentTarget });
              }}>
                {t('collection.dialogue.save')}
              </button>
              <button type="button" className="btn-secondary compact-btn" onClick={(event) => {
                runSelectionAction(onCancelConversationRename, { element: event.currentTarget });
              }}>
                {t('collection.dialogue.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div
            className="conversation-card-main"
            role="button"
            tabIndex={0}
            onPointerDown={handleLongPressStart}
            onPointerMove={tapIntent.handlePointerMove}
            onPointerUp={handleLongPressEnd}
            onPointerCancel={handleLongPressEnd}
            onPointerLeave={clearLongPress}
            onContextMenu={(event) => {
              event.preventDefault();
              onOpenConversationMenu(conversation.id);
            }}
            onClick={(event) => {
              if (longPressFiredRef.current) {
                longPressFiredRef.current = false;
                return;
              }
              if (!tapIntent.shouldAllowTap()) return;
              handleOpenConversation(event.currentTarget);
            }}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              handleOpenConversation(event.currentTarget);
            }}
          >
            <div className="conversation-card-copy">
              <div className="conversation-card-title-row">
                <small className={`conversation-card-archive-date ${conversation.pinnedAt ? 'pinned' : ''}`}>
                  {conversation.pinnedAt ? <Icon name="polarisStar" size={10} /> : null}
                  <span>{collectionArchiveDateTimeLabel(conversation.updatedAt)}</span>
                </small>
                <div className="conversation-card-title-line">
                  <h3>
                    <span className="conversation-card-title-mine">{conversationTitle}</span>
                    {conversation.progressTitle && conversation.progressTitle !== conversationTitle ? (
                      <span className="conversation-card-title-progress">{conversation.progressTitle}</span>
                    ) : null}
                  </h3>
                </div>
              </div>
              <div className={`conversation-card-detail ${detailExpanded ? 'expanded' : 'collapsed'}`}>
                <p className="conversation-excerpt">{conversation.latestExcerpt}</p>
                {visibleSearchMatches.length > 0 ? (
                  <div className="conversation-message-search-matches" data-swipe-delete-ignore="true">
                    <div className="conversation-message-search-meta">
                      {t('collection.dialogue.searchMatchCount', {
                        count: formatNumber(searchMatches?.total ?? visibleSearchMatches.length)
                      })}
                    </div>
                    {visibleSearchMatches.map((match) => (
                      <button
                        key={match.messageId}
                        type="button"
                        className="conversation-message-search-match"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenMessageMatch(match.messageId, event.currentTarget);
                        }}
                        aria-label={t('collection.dialogue.searchOpenMessageAria', { title: conversationTitle })}
                      >
                        <span className="conversation-message-search-role">{searchRoleLabel(match.role)}</span>
                        <span className="conversation-message-search-excerpt">{match.excerpt}</span>
                      </button>
                    ))}
                    {hiddenSearchMatchCount > 0 ? (
                      <span className="conversation-message-search-more">
                        {t('collection.dialogue.searchHiddenCount', { count: formatNumber(hiddenSearchMatchCount) })}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="conversation-stats">
              <span>{t('collection.dialogue.messageCount', { count: formatNumber(conversation.messageCount) })}</span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
});
