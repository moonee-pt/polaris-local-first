import type { ActiveThemePreview } from '../../stores/spaceStore';
import type { Persona, World } from '../../types/domain';

type DeriveAppShellStateArgs = {
  activeWorld: World;
  activeThemePreview: ActiveThemePreview;
  personas: Persona[];
  frontstageCollaboratorId: string | null;
  activeConversationLiveState: string | null;
  activeConversationCollaboratorId: string | null;
  activeConversationMessageCount: number;
  collectionRenderItemCount: number;
  labels: {
    collectionWorld: string;
    chatWorld: string;
    unnamedConversation: string;
  };
};

export function deriveAppShellState({
  activeWorld,
  activeThemePreview,
  personas,
  frontstageCollaboratorId,
  activeConversationLiveState,
  activeConversationCollaboratorId,
  activeConversationMessageCount,
  collectionRenderItemCount,
  labels
}: DeriveAppShellStateArgs) {
  const effectiveWorld = activeWorld;
  const currentCollaborator = frontstageCollaboratorId
    ? personas.find((persona) => persona.id === frontstageCollaboratorId) ?? null
    : null;
  const previewConversationId = activeThemePreview?.conversationId ?? null;
  const activeConversationCollaborator = activeConversationCollaboratorId
    ? personas.find((persona) => persona.id === activeConversationCollaboratorId) ?? currentCollaborator
    : null;
  const chatCollaborator = currentCollaborator ?? activeConversationCollaborator;
  const activeRenderLoad = effectiveWorld === 'collection'
    ? collectionRenderItemCount
    : effectiveWorld === 'chat'
      ? activeConversationMessageCount
      : 0;
  const activeChatDensity =
    activeRenderLoad >= 42
      ? 'heavy'
      : activeRenderLoad >= 22
        ? 'dense'
        : 'light';
  const chatLiveState = effectiveWorld === 'chat'
    ? (activeConversationLiveState?.trim() || null)
    : null;
  const worldLabel = effectiveWorld === 'collection'
    ? labels.collectionWorld
    : effectiveWorld === 'group'
      ? '群聊'
      : chatLiveState
        ? ''
        : labels.chatWorld;
  const worldDetail = chatLiveState;
  const showWorldLabel = true;
  const isAggregateCollectionScope = effectiveWorld === 'collection' && currentCollaborator === null;
  const showTopbarShell = activeWorld !== 'group';
  const showTopbarTitle = !isAggregateCollectionScope;
  const topbarCollaborator = effectiveWorld === 'collection'
    ? currentCollaborator
    : effectiveWorld === 'chat'
      ? chatCollaborator
      : null;
  const topbarTitle = topbarCollaborator?.name || 'Polaris';
  const topbarTitleTone: 'brand' | 'collaborator' = topbarCollaborator ? 'collaborator' : 'brand';

  return {
    previewConversationId,
    activeChatDensity,
    isAggregateCollectionScope,
    worldLabel,
    worldDetail,
    showWorldLabel,
    showTopbarShell,
    showTopbarTitle,
    topbarTitle,
    topbarTitleTone
  };
}
