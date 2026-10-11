import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatAttachmentStrip } from '../ChatAttachmentStrip';
import { Icon } from '../../../Icon';
import { runSelectionAction } from '../../../haptics';
import { resolveDocumentFilePickerAccept } from '../../../filePickerAccept';
import type { ChatCardReference, CodeCard } from '../../../../types/domain';
import { cleanDisplayText } from '../../../text/displayText';
import { canUseNativePhotoLibraryPicker } from '../../../../native/imagePickerFiles';
import { canUseNativeSystemFilePicker, pickNativeSystemFiles } from '../../../../native/systemPickedFiles';
import { useI18n } from '../../../../i18n';
import { getAssetBlob, getAssetMeta } from '../../../../infrastructure/assetStore';
import { resolveImageCollaboratorId } from '../../../../app/collection/imageCollectionFilterModel';
import { useChatStore } from '../../../../stores/chatStore';
import { useCollectionStore } from '../../../../stores/collectionStore';
import { useSpaceFrontstageBindings } from '../../../../stores/spaceStoreFrontstageBindings';
import type { ImageAssetCard } from '../../../../types/domain';
import { useAssetObjectUrl } from '../../../useAssetObjectUrl';
import { reloadOnceForStaleChunk } from './composerChunkRecovery';

type ComposerAttachmentsProps = {
  pickerOpen: boolean;
  interactionLocked: boolean;
  pendingAttachmentsCount: number;
  hasUnsupportedPendingImages: boolean;
  taskToolsEnabled: boolean;
  taskModeEnabled: boolean;
  onAddAttachments: (files: FileList | File[]) => Promise<void>;
  onRemoveAttachment: (attachmentId: string) => void;
  pendingAttachments: import('../../../../types/domain').ChatAttachment[];
  pendingCardReference: ChatCardReference | null;
  availableCards: CodeCard[];
  onToggleTaskModeEnabled: (enabled: boolean) => void;
  onOpenToolbox: () => void;
  onSetPickerOpen: (open: boolean) => void;
  onSetPendingCardReference: (reference: ChatCardReference | null) => void;
};

type ComposerQuickActionsProps = {
  pickerOpen: boolean;
  interactionLocked: boolean;
  onSetPickerOpen: (open: boolean) => void;
  onStartVoiceCall?: () => void;
  onOpenReading?: () => void;
};

const FILE_ACCEPT =
  '.zip,.pdf,.docx,.xlsx,.csv,.txt,.md,.markdown,.json,.js,.jsx,.ts,.tsx,.css,.html,.xml,.yml,.yaml,.py,.rb,.go,.rs,.java,.kt,.swift,.sh,.sql';

export function ComposerQuickActions({
  pickerOpen,
  interactionLocked,
  onSetPickerOpen,
  onStartVoiceCall,
  onOpenReading
}: ComposerQuickActionsProps) {
  const { t } = useI18n();

  return (
    <div className="composer-quick-actions">
      <button
        type="button"
        className={`composer-slot-btn composer-slot-btn-attachment ${pickerOpen ? 'active' : ''}`}
        title={t('chat.composer.attachmentsToggle')}
        aria-label={t('chat.composer.attachmentsToggle')}
        aria-expanded={pickerOpen}
        aria-controls="composer-attachment-picker"
        disabled={interactionLocked}
        onClick={(event) => {
          runSelectionAction(() => {
            onSetPickerOpen(!pickerOpen);
          }, { element: event.currentTarget });
        }}
      >
        <Icon name="plus" size={15} />
      </button>
      {onStartVoiceCall ? (
        <button
          type="button"
          className="composer-slot-btn composer-slot-btn-call"
          title={t('chat.composer.startCall')}
          aria-label={t('chat.composer.startCall')}
          disabled={interactionLocked}
          onClick={(event) => {
            runSelectionAction(onStartVoiceCall, { element: event.currentTarget });
          }}
        >
          <Icon name="phone" size={15} />
        </button>
      ) : null}
      {onOpenReading ? (
        <button
          type="button"
          className="composer-slot-btn composer-slot-btn-reading"
          title={t('chat.reading.open')}
          aria-label={t('chat.reading.open')}
          disabled={interactionLocked}
          onClick={(event) => {
            runSelectionAction(onOpenReading, { element: event.currentTarget });
          }}
        >
          <Icon name="openBook" size={15} />
        </button>
      ) : null}
    </div>
  );
}

export function ComposerAttachments({
  pickerOpen,
  interactionLocked,
  pendingAttachmentsCount,
  hasUnsupportedPendingImages,
  taskToolsEnabled,
  taskModeEnabled,
  onAddAttachments,
  onRemoveAttachment,
  pendingAttachments,
  pendingCardReference,
  availableCards,
  onToggleTaskModeEnabled,
  onOpenToolbox,
  onSetPickerOpen,
  onSetPendingCardReference
}: ComposerAttachmentsProps) {
  const { t } = useI18n();
  const [cardPickerOpen, setCardPickerOpen] = useState(false);
  const [projectImagePickerOpen, setProjectImagePickerOpen] = useState(false);
  const [imageSourceFailed, setImageSourceFailed] = useState(false);
  const imageLibraryPickerRef = useRef<HTMLInputElement>(null);
  const filePickerRef = useRef<HTMLInputElement>(null);
  const nativeImagePickerPromiseRef = useRef<Promise<typeof import('../../../../native/imagePickerFiles')> | null>(null);
  const fileAccept = resolveDocumentFilePickerAccept(FILE_ACCEPT);
  const projectImageCards = useCollectionStore((state) => state.imageCards);
  const conversations = useChatStore((state) => state.conversations);
  const frontstage = useSpaceFrontstageBindings();
  const projectImageScopeId = frontstage.frontstageCollaboratorId;
  const scopedProjectImages = useMemo(() => {
    const scopedCards = projectImageScopeId
      ? projectImageCards.filter((card) => resolveImageCollaboratorId(card, conversations) === projectImageScopeId)
      : projectImageCards;
    return [...scopedCards].sort((left, right) => right.createdAt - left.createdAt);
  }, [conversations, projectImageCards, projectImageScopeId]);
  const closePicker = () => {
    onSetPickerOpen(false);
    setCardPickerOpen(false);
    setProjectImagePickerOpen(false);
  };
  const visibleCards = availableCards.filter((card) => card.kind !== 'room-rule');
  const loadNativeImagePicker = async () => {
    nativeImagePickerPromiseRef.current ??= import('../../../../native/imagePickerFiles');
    try {
      return await nativeImagePickerPromiseRef.current;
    } catch (error) {
      // a failed chunk fetch must not poison later attempts
      nativeImagePickerPromiseRef.current = null;
      throw error;
    }
  };
  const reportImageSourceFailure = (error: unknown) => {
    setImageSourceFailed(true);
    reloadOnceForStaleChunk(error);
  };

  useEffect(() => {
    if (pickerOpen) return;
    setCardPickerOpen(false);
    setProjectImagePickerOpen(false);
  }, [pickerOpen]);

  const handleAttachmentSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    await onAddAttachments(files);
  };

  const openNativePhotoLibrary = async () => {
    const { pickNativePhotoLibraryFiles } = await loadNativeImagePicker();
    const files = await pickNativePhotoLibraryFiles();
    if (files.length > 0) {
      await onAddAttachments(files);
    }
  };
  const attachProjectImage = async (card: ImageAssetCard) => {
    try {
      const blob = await getAssetBlob(card.assetId);
      if (!blob) {
        setImageSourceFailed(true);
        return;
      }
      const meta = await getAssetMeta(card.assetId);
      const fileName = card.title || meta?.name || 'project-image.png';
      const mimeType = meta?.mimeType || blob.type || 'image/png';
      closePicker();
      await onAddAttachments([new File([blob], fileName, { type: mimeType })]);
    } catch (error) {
      reportImageSourceFailure(error);
    }
  };
  const runImageSource = (open: () => Promise<void> | void) => {
    setImageSourceFailed(false);
    closePicker();
    void Promise.resolve().then(open).catch(reportImageSourceFailure);
  };
  const openNativeFiles = async () => {
    const files = await pickNativeSystemFiles({
      accept: FILE_ACCEPT,
      multiple: true
    });
    if (files.length > 0) {
      await onAddAttachments(files);
    }
  };

  return (
    <>
      {pendingAttachmentsCount > 0 ? (
        <ChatAttachmentStrip attachments={pendingAttachments} tone="pending" onRemove={onRemoveAttachment} />
      ) : null}
      {hasUnsupportedPendingImages ? (
        <div className="attachment-warning">
          {t('chat.composer.unsupportedImages')}
        </div>
      ) : null}
      {imageSourceFailed ? (
        <div className="attachment-warning">
          {t('chat.composer.imageSourceFailed')}
        </div>
      ) : null}
      <input
        ref={imageLibraryPickerRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden-file-input"
        onChange={(event) => { void handleAttachmentSelection(event); }}
      />
      <input
        ref={filePickerRef}
        type="file"
        accept={fileAccept}
        multiple
        className="hidden-file-input"
        onChange={(event) => { void handleAttachmentSelection(event); }}
      />
      {pickerOpen ? (
        <div className="attachment-picker-sheet" id="composer-attachment-picker" role="region" aria-label={t('chat.composer.attachmentPickerAria')}>
          <div className="attachment-picker-actions">
            <button
              type="button"
              className="attachment-picker-action"
              onClick={(event) => {
                runSelectionAction(() => {
                  runImageSource(async () => {
                    if (canUseNativePhotoLibraryPicker()) {
                      await openNativePhotoLibrary();
                      return;
                    }
                    imageLibraryPickerRef.current?.click();
                  });
                }, { element: event.currentTarget });
              }}
            >
              <span className="attachment-picker-action-icon">
                <Icon name="image" size={18} />
              </span>
              <span className="attachment-picker-action-copy">
                <strong>{t('chat.composer.photoLibrary')}</strong>
              </span>
            </button>
            <button
              type="button"
              className={`attachment-picker-action ${projectImagePickerOpen ? 'active' : ''}`}
              aria-expanded={projectImagePickerOpen}
              onClick={(event) => {
                runSelectionAction(() => {
                  setProjectImagePickerOpen((open) => !open);
                }, { element: event.currentTarget });
              }}
            >
              <span className="attachment-picker-action-icon">
                <Icon name="navImage" size={18} />
              </span>
              <span className="attachment-picker-action-copy">
                <strong>{t('chat.composer.projectImages')}</strong>
              </span>
            </button>
            <button
              type="button"
              className="attachment-picker-action"
              onClick={(event) => {
                runSelectionAction(() => {
                  closePicker();
                  if (canUseNativeSystemFilePicker()) {
                    void openNativeFiles().catch(() => undefined);
                    return;
                  }
                  filePickerRef.current?.click();
                }, { element: event.currentTarget });
              }}
            >
              <span className="attachment-picker-action-icon">
                <Icon name="folder" size={18} />
              </span>
              <span className="attachment-picker-action-copy">
                <strong>{t('chat.composer.filePicker')}</strong>
              </span>
            </button>
            <button
              type="button"
              className="attachment-picker-action"
              onClick={(event) => {
                runSelectionAction(() => {
                  setCardPickerOpen(true);
                }, { element: event.currentTarget });
              }}
            >
              <span className="attachment-picker-action-icon">
                <Icon name="navCard" size={18} />
              </span>
              <span className="attachment-picker-action-copy">
                <strong>{t('chat.composer.sendCard')}</strong>
              </span>
            </button>
            {taskToolsEnabled ? (
              <button
                type="button"
                className={`attachment-picker-action ${taskModeEnabled ? 'active' : ''}`}
                aria-pressed={taskModeEnabled}
                onClick={(event) => {
                  runSelectionAction(() => {
                    onToggleTaskModeEnabled(!taskModeEnabled);
                    closePicker();
                  }, { element: event.currentTarget });
                }}
              >
                <span className="attachment-picker-action-icon">
                  <Icon name="task" size={18} />
                </span>
                <span className="attachment-picker-action-copy">
                  <strong>{taskModeEnabled ? t('chat.composer.closeTaskMode') : t('chat.composer.openTaskMode')}</strong>
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className="attachment-picker-action"
              onClick={(event) => {
                runSelectionAction(() => {
                  closePicker();
                  onOpenToolbox();
                }, { element: event.currentTarget });
              }}
            >
              <span className="attachment-picker-action-icon">
                <Icon name="layers" size={18} />
              </span>
              <span className="attachment-picker-action-copy">
                <strong>{t('chat.composer.toolbox')}</strong>
              </span>
            </button>
          </div>
          {projectImagePickerOpen ? (
            <div className="attachment-picker-card-section">
              <div className="attachment-picker-card-head">
                <strong>{t('chat.composer.projectImages')}</strong>
                <button
                  type="button"
                  className="attachment-picker-card-back"
                  onClick={(event) => {
                    runSelectionAction(() => setProjectImagePickerOpen(false), { element: event.currentTarget });
                  }}
                >
                  {t('chat.composer.back')}
                </button>
              </div>
              <div className="attachment-picker-image-grid" role="list" aria-label={t('chat.composer.projectImages')}>
                {scopedProjectImages.map((card) => (
                  <ProjectImageOption key={card.id} card={card} onSelect={attachProjectImage} />
                ))}
                {scopedProjectImages.length === 0 ? (
                  <div className="attachment-picker-card-empty">{t('chat.composer.projectImagesEmpty')}</div>
                ) : null}
              </div>
            </div>
          ) : null}
          {cardPickerOpen ? (
            <div className="attachment-picker-card-section">
              <div className="attachment-picker-card-head">
                <strong>{t('chat.composer.sendCard')}</strong>
                <button
                  type="button"
                  className="attachment-picker-card-back"
                  onClick={(event) => {
                    runSelectionAction(() => setCardPickerOpen(false), { element: event.currentTarget });
                  }}
                >
                  {t('chat.composer.back')}
                </button>
              </div>
              <div className="attachment-picker-card-list" role="list" aria-label={t('chat.composer.cardListAria')}>
                {visibleCards.map((card) => {
                  const selected = pendingCardReference?.id === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`attachment-picker-card ${selected ? 'selected' : ''}`}
                      onClick={(event) => {
                        runSelectionAction(() => {
                        onSetPendingCardReference({
                          id: card.id,
                          title: card.title,
                          cardNote: card.cardNote,
                          language: card.language,
                          code: card.code,
                          cardFaceCss: card.cardFaceCss,
                          mode: 'reference'
                        });
                        closePicker();
                        }, { element: event.currentTarget });
                      }}
                    >
                      <span className="attachment-picker-card-copy">
                        <strong>{cleanDisplayText(card.title)}</strong>
                        <span>{card.language}</span>
                      </span>
                      <span className="attachment-picker-card-preview">
                        {(card.code.trim() || t('chat.composer.emptyCardPreview')).slice(0, 72)}
                      </span>
                    </button>
                  );
                })}
                {visibleCards.length === 0 ? (
                  <div className="attachment-picker-card-empty">{t('chat.composer.noCards')}</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function ProjectImageOption({
  card,
  onSelect
}: {
  card: ImageAssetCard;
  onSelect: (card: ImageAssetCard) => Promise<void>;
}) {
  const { t } = useI18n();
  const imageUrl = useAssetObjectUrl(card.assetId, true);

  return (
    <button
      type="button"
      className="attachment-picker-image"
      aria-label={card.title || t('chat.composer.projectImages')}
      onClick={(event) => {
        runSelectionAction(() => {
          void onSelect(card);
        }, { element: event.currentTarget });
      }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" />
      ) : (
        <span className="attachment-picker-image-placeholder" aria-hidden="true" />
      )}
    </button>
  );
}
