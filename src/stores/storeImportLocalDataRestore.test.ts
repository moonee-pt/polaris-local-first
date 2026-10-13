import { describe, expect, it } from 'vitest';
import type { ChatMessage, Conversation } from '../types/domain';
import { buildChatRestoreRehearsalWithSalvage } from './storeImportLocalDataRestore';

const context = { version: 3, committedAt: 40, knownCollaboratorIds: ['pharos'] };

function message(id: string, timestamp: number): ChatMessage {
  return { id, role: 'user', content: id, timestamp };
}

function conversation(id: string, messages: ChatMessage[]): Conversation {
  return {
    id,
    title: id,
    collaboratorId: 'pharos',
    activeProjectId: null,
    messages,
    workspaceLedger: [],
    task: null,
    draft: '',
    pinnedAt: null,
    updatedAt: 30
  } as Conversation;
}

// A message whose attachment carries a non-string assetId makes the whole synchronous
// projection throw (collectChatMessageAssetRefs calls assetId.trim()), which is exactly the
// "one bad row aborts the chat domain" case the salvage must contain.
function brokenConversation(id: string): Conversation {
  const badMessage = {
    ...message('m-bad', 10),
    attachments: [{ assetId: 12345 }]
  } as unknown as ChatMessage;
  return conversation(id, [badMessage]);
}

describe('buildChatRestoreRehearsalWithSalvage', () => {
  it('projects every conversation on the fast path when all are valid', () => {
    const { rehearsal, quarantinedConversationIds } = buildChatRestoreRehearsalWithSalvage({
      conversations: [conversation('c-1', [message('m-1', 10)]), conversation('c-2', [message('m-2', 20)])],
      activeConversationId: 'c-1'
    }, context);

    expect(quarantinedConversationIds).toEqual([]);
    expect(rehearsal.plan.conversations.map((entry) => entry.conversation.id).sort()).toEqual(['c-1', 'c-2']);
    expect(rehearsal.plan.conversations.every((entry) => entry.bodyState === 'complete')).toBe(true);
  });

  it('quarantines only the unprojectable conversation and keeps the valid ones active', () => {
    const { rehearsal, quarantinedConversationIds } = buildChatRestoreRehearsalWithSalvage({
      conversations: [
        conversation('c-good', [message('m-1', 10)]),
        brokenConversation('c-bad'),
        conversation('c-good-2', [message('m-2', 20)])
      ],
      activeConversationId: 'c-good'
    }, context);

    expect(quarantinedConversationIds).toEqual(['c-bad']);
    const bodyStateById = new Map(rehearsal.plan.conversations.map((entry) => [entry.conversation.id, entry.bodyState]));
    expect(bodyStateById.get('c-good')).toBe('complete');
    expect(bodyStateById.get('c-good-2')).toBe('complete');
    expect(bodyStateById.get('c-bad')).toBe('incomplete');
    expect(rehearsal.plan.activeConversationId).toBe('c-good');
    expect(rehearsal.plan.legacyBaselineConversationIds).toEqual(['c-bad', 'c-good', 'c-good-2']);
  });

  it('dedupes duplicate ids instead of aborting the whole domain', () => {
    const { rehearsal, quarantinedConversationIds } = buildChatRestoreRehearsalWithSalvage({
      conversations: [conversation('c-dup', [message('m-1', 10)]), conversation('c-dup', [message('m-2', 20)])],
      activeConversationId: 'c-dup'
    }, context);

    expect(quarantinedConversationIds).toEqual([]);
    expect(rehearsal.plan.conversations.filter((entry) => entry.conversation.id === 'c-dup')).toHaveLength(1);
  });

  it('honours an incoming quarantine list and keeps those ids recoverable', () => {
    const { rehearsal, quarantinedConversationIds } = buildChatRestoreRehearsalWithSalvage({
      conversations: [
        conversation('c-good', [message('m-1', 10)]),
        conversation('c-pre', [message('m-2', 20)])
      ],
      activeConversationId: 'c-good',
      quarantinedConversationIds: ['c-pre']
    }, context);

    // A pre-quarantined id is projected as incomplete by the planner on the fast path; the
    // salvage adds nothing new, so it reports no freshly-quarantined ids.
    expect(quarantinedConversationIds).toEqual([]);
    const bodyStateById = new Map(rehearsal.plan.conversations.map((entry) => [entry.conversation.id, entry.bodyState]));
    expect(bodyStateById.get('c-pre')).toBe('incomplete');
    expect(bodyStateById.get('c-good')).toBe('complete');
  });
});
