import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizePersonaDefaultSummary } from '../../../config/persona/personaBaseCatalog';
import type { Persona } from '../../../types/domain';
import { runSelectionAction, selectionHaptic } from '../../haptics';
import { CollaboratorSigil } from '../../collaborator/CollaboratorSigil';
import { CreateActionSheet } from '../../create/CreateActionSheet';
import { Icon } from '../../Icon';
import { WorldMark } from '../../shell/WorldMark';
import { CollaboratorCreatePicker } from '../../worlds/chat/collaborator/CollaboratorCreatePicker';
import { useI18n } from '../../../i18n';

const LONG_PRESS_MS = 520;

type CollaboratorScopeStripProps = {
  open: boolean;
  personas: Persona[];
  conversationCounts: {
    byCollaboratorId: Record<string, number>;
    total: number;
  };
  collaboratorScopeId: string | null;
  onSelectCollaboratorScope: (collaboratorId: string | null) => void;
  onOpenGroupWorld: () => void;
  onToggleCollaboratorPinned: (collaboratorId: string) => void;
  onClose: () => void;
  onCreateFromBuilder: () => void;
  onCreateCustomCollaborator: () => void;
  onOpenSettings: () => void;
  onDeleteCollaborator: (collaboratorId: string) => void;
  onOpenCollaboratorInfo: (collaboratorId: string) => void;
};

export function CollaboratorScopeStrip({
  open,
  personas,
  conversationCounts,
  collaboratorScopeId,
  onSelectCollaboratorScope,
  onOpenGroupWorld,
  onToggleCollaboratorPinned,
  onClose,
  onCreateFromBuilder,
  onCreateCustomCollaborator,
  onOpenSettings,
  onDeleteCollaborator,
  onOpenCollaboratorInfo
}: CollaboratorScopeStripProps) {
  const { t, formatNumber } = useI18n();
  const [createPickerOpen, setCreatePickerOpen] = useState(false);
  const [menuPersonaId, setMenuPersonaId] = useState<string | null>(null);
  const [aggregateSpinKey, setAggregateSpinKey] = useState(0);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
    }
  }, []);

  if (!open) return null;

  const portalRoot = typeof document !== 'undefined'
    ? document.querySelector<HTMLElement>('.app-shell')
    : null;

  const formatSegmentCount = (count: number) => t('collection.scope.segmentCount', { count: formatNumber(count) });
  const menuPersona = menuPersonaId ? personas.find((persona) => persona.id === menuPersonaId) ?? null : null;
  const triggerAggregateSpin = () => {
    setAggregateSpinKey((current) => current + 1);
  };

  const handleSelect = (collaboratorId: string | null) => {
    if (collaboratorId === collaboratorScopeId) return;
    setCreatePickerOpen(false);
    onSelectCollaboratorScope(collaboratorId);
    onClose();
  };

  const drawer = (
    <section className="collaborator-scope-drawer collaborator-scope-drawer--open" aria-label={t('collection.scope.drawerAria')}>
      <button
        type="button"
        className="collaborator-scope-drawer-scrim"
        aria-label={t('collection.scope.closeDrawerAria')}
        onClick={(event) => {
          runSelectionAction(() => {
            setCreatePickerOpen(false);
            onClose();
          }, { element: event.currentTarget });
        }}
      />

      <aside className="collaborator-scope-drawer-panel" role="dialog" aria-modal="false" aria-label={t('collection.scope.dialogAria')}>
        <div className="collaborator-scope-drawer-head">
          <div className="collaborator-scope-drawer-head-copy">
            <span>{t('collection.scope.title')}</span>
          </div>
          <div className="collaborator-scope-drawer-actions">
            <button
              type="button"
              className="collaborator-scope-drawer-settings"
              title={t('collection.scope.settings')}
              aria-label={t('collection.scope.settings')}
              onClick={(event) => {
                runSelectionAction(() => {
                  setCreatePickerOpen(false);
                  onClose();
                  onOpenSettings();
                }, { element: event.currentTarget });
              }}
            >
              <Icon name="settings" size={18} />
            </button>
          </div>
        </div>

        <div className="collaborator-scope-drawer-list">
          <section className="collaborator-scope-group" aria-labelledby="collaborator-scope-group-spaces">
            <h3 className="collaborator-scope-group-label" id="collaborator-scope-group-spaces">
              {t('collection.scope.groupSpaces')}
            </h3>
            <div className="collaborator-scope-group-body" role="tablist" aria-label={t('collection.scope.groupSpaces')}>
              <button
                type="button"
                className="collaborator-scope-card collaborator-scope-card--special collaborator-scope-card--group"
                onClick={(event) => {
                  runSelectionAction(() => {
                    setCreatePickerOpen(false);
                    onOpenGroupWorld();
                    onClose();
                  }, { element: event.currentTarget });
                }}
                role="tab"
                aria-selected={false}
              >
                <span className="collaborator-scope-card-title">
                  <span className="collaborator-scope-group-mark" aria-hidden="true">
                    <Icon name="navGroup" size={15} />
                  </span>
                  <strong>{t('collection.scope.groupChat')}</strong>
                </span>
                <span className="collaborator-scope-card-meta">
                  <span>{t('collection.scope.groupDetail')}</span>
                </span>
              </button>
              <button
                type="button"
                className={`collaborator-scope-card collaborator-scope-card--special collaborator-scope-card--aggregate ${collaboratorScopeId === null ? 'active' : ''}`}
                onClick={(event) => {
                  runSelectionAction(() => {
                    triggerAggregateSpin();
                    handleSelect(null);
                  }, { element: event.currentTarget });
                }}
                role="tab"
                aria-selected={collaboratorScopeId === null}
              >
                <span className="collaborator-scope-card-title">
                  <span className="collaborator-scope-aggregate-mark">
                    <WorldMark
                      key={aggregateSpinKey}
                      world="chat"
                      spinning={aggregateSpinKey > 0}
                      className="collaborator-scope-aggregate-world-mark"
                    />
                  </span>
                  <strong>{t('collection.scope.allCollaborators')}</strong>
                </span>
                <span className="collaborator-scope-card-meta">
                  <span>{t('collection.scope.allRooms')}</span>
                </span>
                <span className="collaborator-scope-card-aside">
                  {collaboratorScopeId === null ? (
                    <span className="collaborator-scope-card-current" aria-hidden="true">
                      <Icon name="check" size={12} />
                    </span>
                  ) : null}
                  <span className="collaborator-scope-card-count">{formatSegmentCount(conversationCounts.total)}</span>
                </span>
              </button>
            </div>
          </section>

          <section className="collaborator-scope-group" aria-labelledby="collaborator-scope-group-collaborators">
            <div className="collaborator-scope-group-head">
              <h3 className="collaborator-scope-group-label" id="collaborator-scope-group-collaborators">
                {t('collection.scope.groupCollaborators')}
              </h3>
              <button
                type="button"
                className="collaborator-scope-group-add"
                aria-expanded={createPickerOpen}
                aria-label={t('collection.scope.createCollaborator')}
                onClick={(event) => {
                  runSelectionAction(() => {
                    setCreatePickerOpen((prev) => !prev);
                  }, { element: event.currentTarget });
                }}
              >
                <Icon name="plus" size={13} />
                <span>{t('collection.scope.createCollaborator')}</span>
              </button>
            </div>
            {personas.length === 0 ? (
              <div className="collaborator-scope-group-body">
                <p className="collaborator-scope-group-empty">{t('collection.scope.noCollaborators')}</p>
              </div>
            ) : (
              <div className="collaborator-scope-group-body" role="tablist" aria-label={t('collection.scope.groupCollaborators')}>
                {personas.map((persona) => {
                  const conversationCount = conversationCounts.byCollaboratorId[persona.id] ?? 0;
                  const current = collaboratorScopeId === persona.id;
                  const menuOpen = menuPersonaId === persona.id;

                  return (
                    <div
                      key={persona.id}
                      className={`collaborator-scope-card-shell ${menuOpen ? 'collaborator-scope-card-shell--menu' : ''}`}
                      onContextMenu={(event) => event.preventDefault()}
                      onPointerDown={(event) => {
                        if (event.pointerType === 'mouse' && event.button !== 0) return;
                        clearLongPress();
                        longPressTriggeredRef.current = false;
                        longPressTimerRef.current = window.setTimeout(() => {
                          longPressTriggeredRef.current = true;
                          setCreatePickerOpen(false);
                          setMenuPersonaId(persona.id);
                          void selectionHaptic();
                        }, LONG_PRESS_MS);
                      }}
                      onPointerUp={clearLongPress}
                      onPointerCancel={clearLongPress}
                      onPointerLeave={clearLongPress}
                    >
                      <button
                        type="button"
                        className={`collaborator-scope-card ${current ? 'active' : ''} ${persona.pinnedAt ? 'pinned' : ''}`}
                        onClick={(event) => {
                          if (longPressTriggeredRef.current) {
                            event.preventDefault();
                            longPressTriggeredRef.current = false;
                            return;
                          }
                          runSelectionAction(() => handleSelect(persona.id), { element: event.currentTarget });
                        }}
                        role="tab"
                        aria-selected={current}
                      >
                        <span className="collaborator-scope-card-title">
                          <span className="collaborator-scope-card-badge">
                            <CollaboratorSigil seed={persona.id} size={13} />
                          </span>
                          {persona.pinnedAt ? (
                            <span className="collaborator-scope-card-pin-mark" aria-hidden="true">
                              <Icon name="polarisStar" size={11} />
                            </span>
                          ) : null}
                          <strong>{persona.name}</strong>
                        </span>
                        <span className="collaborator-scope-card-meta">
                          <span>{normalizePersonaDefaultSummary(persona.description) || t('collection.scope.noSummary')}</span>
                        </span>
                        <span className="collaborator-scope-card-aside">
                          {current ? (
                            <span className="collaborator-scope-card-current" aria-hidden="true">
                              <Icon name="check" size={12} />
                            </span>
                          ) : null}
                          <span className="collaborator-scope-card-count">{formatSegmentCount(conversationCount)}</span>
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <CreateActionSheet
            open={createPickerOpen}
            ariaLabel={t('collection.scope.createCollaborator')}
            className="collaborator-create-action-sheet"
            onClose={() => setCreatePickerOpen(false)}
          >
            <CollaboratorCreatePicker
              showCloseButton={false}
              onCloseCreatePicker={() => setCreatePickerOpen(false)}
              onCreateFromBuilder={() => {
                setCreatePickerOpen(false);
                onClose();
                onCreateFromBuilder();
              }}
              onCreateCustomCollaborator={() => {
                setCreatePickerOpen(false);
                onClose();
                onCreateCustomCollaborator();
              }}
            />
          </CreateActionSheet>
        </div>
      </aside>

      <CreateActionSheet
        open={menuPersona !== null}
        ariaLabel={menuPersona ? menuPersona.name : ''}
        className="collaborator-scope-menu-sheet"
        onClose={() => setMenuPersonaId(null)}
      >
        {menuPersona ? (
          <div className="collaborator-scope-menu">
            <p className="collaborator-scope-menu-title">{menuPersona.name}</p>
            <button
              type="button"
              className="collaborator-scope-menu-item"
              onClick={(event) => {
                runSelectionAction(() => {
                  onToggleCollaboratorPinned(menuPersona.id);
                  setMenuPersonaId(null);
                }, { element: event.currentTarget });
              }}
            >
              <Icon name="pin" size={15} />
              <span>{menuPersona.pinnedAt ? t('collection.scope.unpin') : t('collection.scope.pin')}</span>
            </button>
            <button
              type="button"
              className="collaborator-scope-menu-item"
              onClick={(event) => {
                runSelectionAction(() => {
                  setMenuPersonaId(null);
                  onClose();
                  onOpenCollaboratorInfo(menuPersona.id);
                }, { element: event.currentTarget });
              }}
            >
              <Icon name="edit" size={15} />
              <span>{t('collection.scope.edit')}</span>
            </button>
            <button
              type="button"
              className="collaborator-scope-menu-item collaborator-scope-menu-item--danger"
              onClick={(event) => {
                runSelectionAction(() => {
                  setMenuPersonaId(null);
                  onClose();
                  onDeleteCollaborator(menuPersona.id);
                }, { element: event.currentTarget });
              }}
            >
              <Icon name="trash" size={15} />
              <span>{t('collection.scope.delete')}</span>
            </button>
          </div>
        ) : null}
      </CreateActionSheet>
    </section>
  );

  return portalRoot ? createPortal(drawer, portalRoot) : drawer;
}
