import { resolveConversationCollaboratorId } from '../../engines/conversationOwnership';
import type { Conversation } from '../../types/domain';
import { hasArchivedConversationContent } from './conversationArchiveVisibility';

export type CollaboratorConversationCounts = {
  byCollaboratorId: Record<string, number>;
  total: number;
};

export function buildCollaboratorConversationCounts(args: {
  conversations: Conversation[];
  loadedMessageConversationIds: ReadonlySet<string>;
}): CollaboratorConversationCounts {
  const byCollaboratorId: Record<string, number> = {};
  let total = 0;

  args.conversations.forEach((conversation) => {
    if (!hasArchivedConversationContent(conversation, { loadedMessageConversationIds: args.loadedMessageConversationIds })) return;
    total += 1;
    const collaboratorId = resolveConversationCollaboratorId(conversation);
    if (!collaboratorId) return;
    byCollaboratorId[collaboratorId] = (byCollaboratorId[collaboratorId] ?? 0) + 1;
  });

  return { byCollaboratorId, total };
}
