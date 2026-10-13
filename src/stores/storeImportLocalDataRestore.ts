import { collectAssetReferenceOwners } from '../engines/assetGovernance';
import {
  buildAssetMigrationPlan,
  buildChatMigrationRehearsal,
  buildChatMigrationRehearsalValidationReport,
  buildCollectionMigrationPlan,
  buildDocumentLocalDataStateFromSources,
  buildDocumentMigrationPlan,
  buildPersonaMigrationPlan,
  buildRuntimeMigrationPlan,
  buildSpaceMigrationPlan,
  getLocalDataRowKey,
  LOCAL_DATA_SCHEMA_VERSION,
  LOCAL_DATA_NAMESPACE,
  buildLocalDataStoreHydrationValidationReports,
  type ChatMigrationLegacySnapshot,
  type ChatMigrationRehearsal,
  type LocalDataCommitMeta,
  type LocalDataBackendMutation,
  type LocalDataDomain,
  type LocalDataMigrationValidationReport,
  type LocalDataReadResult,
  type LocalDataRef,
  type LocalDataStoredRow,
  type LocalDataUnitOfWork,
  type CommitPointerRow
} from '../engines/localData';
import type { StagedAssetImportEntry } from '../infrastructure/assetStore';
import { readLocalDataCensusReportForKv } from '../infrastructure/localDataHealth';
import type { PersistedCollectionState } from './collectionStorePersistence';
import {
  type LocalDataLiveSourcePromotionSkippedDomain
} from './localDataSourcePromotionPersistence';
import {
  restorePersonaMemoryDocContent,
  serializePersonaMemoryDocContentEntries,
  stripPersonaMemoryDocContent,
  type PersonaMemoryDocContentPayload
} from './personaMemoryReferenceDocPersistence';
import type { RuntimePayload } from './runtimeStorePersistence';
import type { MigratedPersistedSpaceState } from './spaceStorePersistence';
import type { PersistedChatState } from './chatCurrentPersistence';
import type { Persona } from '../types/domain';
import { createStoreLocalDataRepository } from './localDataStorePersistence';
import {
  discoverLocalDataDomainRefs,
  pruneLocalDataUnitOfWorkToChangedRows
} from './localDataStorePersistence';
import { readStoreLocalDataEntriesWithPrefix } from './storeLocalDataBackendHost';

export type StructuredImportLocalDataRestorePayload = {
  chatState: PersistedChatState;
  collectionState: PersistedCollectionState;
  personaState: {
    personas: Persona[];
    activeCollaboratorId: string | null;
    seededDefaultPersonaIds?: string[];
  };
  personaMemoryDocContent: PersonaMemoryDocContentPayload | null;
  runtimeState: RuntimePayload;
  spaceState: MigratedPersistedSpaceState;
  assetEntries: StagedAssetImportEntry[];
};

export type StructuredImportLocalDataRestoreSkippedDomain = {
  domain: LocalDataDomain;
  reason: string;
};

export type StructuredImportLocalDataRestoreResult = {
  restoredDomains: LocalDataDomain[];
  promotedDomains: LocalDataDomain[];
  skippedDomains: StructuredImportLocalDataRestoreSkippedDomain[];
  promotionSkippedDomains: LocalDataLiveSourcePromotionSkippedDomain[];
  promotionFailure: string | null;
  // Conversation ids that could not be projected during a chat restore and were quarantined
  // (kept as recoverable incomplete rows) instead of failing the whole chat domain.
  chatQuarantinedConversationIds: string[];
};

export type StructuredImportLocalDataRestoreOptions = {
  skipDomains?: LocalDataDomain[];
  committedAt?: number;
};

const STRUCTURED_IMPORT_DOMAINS = [
  'chat',
  'collection',
  'persona',
  'runtime',
  'space',
  'asset',
  'document'
] satisfies LocalDataDomain[];

function assetBinaryEntries(assetEntries: StagedAssetImportEntry[]) {
  return assetEntries.map((entry) => ({
    id: entry.meta.id,
    storageKey: entry.storageKey,
    bytes: entry.blob.size
  }));
}

function assetPreviewEntries(assetEntries: StagedAssetImportEntry[]) {
  return assetEntries.flatMap((entry) => (
    entry.previewBlob
      ? [{
          id: entry.meta.id,
          storageKey: entry.storageKey,
          bytes: entry.previewBlob.size
        }]
      : []
  ));
}

function restoreFailureReason(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (error && typeof error === 'object' && 'causeError' in error) {
    const causeError = (error as { causeError?: unknown }).causeError;
    if (causeError) {
      const causeMessage = causeError instanceof Error ? causeError.message : String(causeError);
      return `${message}: ${causeMessage}`;
    }
  }
  return message;
}

export type ChatRestoreSalvage = {
  rehearsal: ChatMigrationRehearsal;
  quarantinedConversationIds: string[];
};

type ChatRestoreSalvageContext = {
  version: number;
  committedAt: number;
  knownCollaboratorIds: readonly string[];
};

type ChatSnapshotConversation = ChatMigrationLegacySnapshot['conversations'][number];

// A quarantined conversation is projected as an incomplete catalog row with no record body, so
// strip the (possibly malformed) messages and carry only the counts the planner requires.
function toQuarantinedConversation(conversation: ChatSnapshotConversation): ChatSnapshotConversation {
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  const expectedLatestMessageTimestamp = messages.reduce(
    (latest, message) => Math.max(latest, Number(message?.timestamp) || 0),
    0
  );
  const { messages: _messages, ...rest } = conversation;
  return {
    ...rest,
    expectedMessageCount: messages.length,
    expectedLatestMessageTimestamp
  };
}

// Build the chat restore rehearsal. The fast path projects every conversation as-is. If that
// throws — a single malformed conversation (duplicate/blank id, a non-string attachment assetId,
// etc.) aborts the whole synchronous projection — fall back to screening each conversation on its
// own and quarantining only the unprojectable ones, so one bad row can never cost the whole chat
// domain. If even the salvaged projection throws, the error propagates and the chat domain is
// skipped exactly as before (nothing is written; the store is left untouched).
export function buildChatRestoreRehearsalWithSalvage(
  snapshot: ChatMigrationLegacySnapshot,
  context: ChatRestoreSalvageContext
): ChatRestoreSalvage {
  const build = (candidate: ChatMigrationLegacySnapshot) => buildChatMigrationRehearsal({
    snapshot: candidate,
    version: context.version,
    committedAt: context.committedAt,
    unitId: `import-chat-${context.committedAt}`,
    knownCollaboratorIds: context.knownCollaboratorIds
  });

  try {
    return { rehearsal: build(snapshot), quarantinedConversationIds: [] };
  } catch {
    // Fall through to per-conversation salvage.
  }

  const priorQuarantined = new Set(snapshot.quarantinedConversationIds ?? []);
  const seenIds = new Set<string>();
  const projectable: ChatSnapshotConversation[] = [];
  const unprojectable: ChatSnapshotConversation[] = [];
  for (const conversation of snapshot.conversations) {
    const id = typeof conversation.id === 'string' ? conversation.id : '';
    // A blank or duplicate id can never become a distinct row; drop it rather than abort.
    if (!id.trim() || seenIds.has(id)) continue;
    seenIds.add(id);
    if (priorQuarantined.has(id)) {
      projectable.push(conversation);
      continue;
    }
    try {
      build({ conversations: [conversation], activeConversationId: null });
      projectable.push(conversation);
    } catch {
      unprojectable.push(conversation);
    }
  }

  const salvagedIds = unprojectable.map((conversation) => conversation.id);
  const rehearsal = build({
    conversations: [
      ...projectable,
      ...unprojectable.map(toQuarantinedConversation)
    ],
    activeConversationId: snapshot.activeConversationId,
    quarantinedConversationIds: Array.from(new Set([...priorQuarantined, ...salvagedIds]))
  });
  return { rehearsal, quarantinedConversationIds: salvagedIds };
}

export async function restoreStructuredImportToLocalDataRepository(
  payload: StructuredImportLocalDataRestorePayload,
  options: StructuredImportLocalDataRestoreOptions = {}
): Promise<StructuredImportLocalDataRestoreResult> {
  const committedAt = options.committedAt ?? Date.now();
  const validatedAt = committedAt;
  const repository = createStoreLocalDataRepository({ now: () => committedAt });
  const version = LOCAL_DATA_SCHEMA_VERSION;
  const personasWithDocContent = restorePersonaMemoryDocContent(
    payload.personaState.personas,
    payload.personaMemoryDocContent
  );
  const restoredDomains: LocalDataDomain[] = [];
  const skippedDomains: StructuredImportLocalDataRestoreSkippedDomain[] = [];
  const skippedDomainSet = new Set(options.skipDomains ?? []);
  let chatSalvagedQuarantinedIds: string[] = [];

  async function prepareReplacement(unitOfWork: Parameters<typeof repository.commit>[0]) {
    const currentRows = [];
    const projectedKeys = new Set(unitOfWork.mutations.flatMap((mutation) => (
      mutation.type === 'put' || mutation.type === 'restore' ? [mutation.row.key] : []
    )));
    for (const ref of await discoverLocalDataDomainRefs(unitOfWork.domain)) {
      const current = await repository.read(ref);
      if (current.status === 'complete' || current.status === 'deleted') {
        currentRows.push(current.row);
      } else if (ref.kind !== 'domainMeta' && !projectedKeys.has(getLocalDataRowKey(ref))) {
        unitOfWork.mutations.push({
          type: 'tombstone',
          ref,
          version: unitOfWork.version,
          deletedAt: committedAt
        });
      }
    }
    pruneLocalDataUnitOfWorkToChangedRows({
      unitOfWork,
      currentRows,
      deletedAt: committedAt
    });
    return unitOfWork;
  }

  async function restoreDomain(domain: LocalDataDomain, operation: () => Promise<LocalDataCommitMeta>) {
    if (skippedDomainSet.has(domain)) {
      skippedDomains.push({ domain, reason: 'precondition-failed' });
      return;
    }
    try {
      await operation();
      restoredDomains.push(domain);
    } catch (error) {
      skippedDomains.push({ domain, reason: restoreFailureReason(error) });
    }
  }

  async function commitAndPromoteProjectedDomain(
    unitOfWork: LocalDataUnitOfWork,
    buildChatValidation?: (
      meta: LocalDataCommitMeta,
      projected: Map<string, unknown>
    ) => LocalDataMigrationValidationReport
  ) {
    const result = await repository.commitAndPromoteActiveDataSource(
      unitOfWork,
      async (meta, mutations) => {
        const projected = await buildProjectedLocalDataEntries(mutations);
        if (buildChatValidation) return buildChatValidation(meta, projected);

        const kv = Array.from(projected, ([key, value]) => ({ key, value }));
        const censusReport = await readLocalDataCensusReportForKv(kv);
        const validation = buildLocalDataStoreHydrationValidationReports({
          kv,
          censusDomains: censusReport.domains,
          domains: [unitOfWork.domain],
          validatedAt
        }).validationReports[unitOfWork.domain];
        if (!validation) {
          throw new Error(`Projected LocalData validation is missing for ${unitOfWork.domain}.`);
        }
        return validation;
      }
    );
    return result.commitMeta;
  }

  async function buildProjectedLocalDataEntries(mutations: LocalDataBackendMutation[]) {
    const entries = await readStoreLocalDataEntriesWithPrefix(`${LOCAL_DATA_NAMESPACE}:`);
    const projected = new Map(entries.map((entry) => [entry.key, entry.value]));
    for (const mutation of mutations) {
      if (mutation.type === 'delete') projected.delete(mutation.key);
      else projected.set(mutation.key, mutation.value);
    }
    return projected;
  }

  function commitMetaToPointer(meta: LocalDataCommitMeta): CommitPointerRow {
    return {
      domain: meta.domain,
      version: meta.version,
      committedAt: meta.committedAt,
      commitId: meta.commitId
    };
  }

  function projectedRead<T>(projected: Map<string, unknown>, ref: LocalDataRef): LocalDataReadResult<T> {
    const value = projected.get(getLocalDataRowKey(ref)) as LocalDataStoredRow<T> | undefined;
    if (!value) return { status: 'incomplete', ref, reason: 'Local data row is missing.', missingKeys: [getLocalDataRowKey(ref)] };
    if (value.state === 'complete') return { status: 'complete', ref, value: value.value, row: value };
    if (value.state === 'unloaded') return { status: 'unloaded', ref, row: value };
    if (value.state === 'incomplete') {
      return { status: 'incomplete', ref, reason: value.reason, missingKeys: value.missingKeys ?? [], row: value };
    }
    if (value.state === 'timedOut') return { status: 'timedOut', ref, reason: value.reason, row: value };
    return { status: 'deleted', ref, deletedAt: value.deletedAt, row: value };
  }

  await restoreDomain('chat', async () => {
    const { rehearsal: chatRehearsal, quarantinedConversationIds } = buildChatRestoreRehearsalWithSalvage(
      {
        conversations: payload.chatState.conversations,
        activeConversationId: payload.chatState.activeConversationId,
        ...(payload.chatState.quarantinedConversationIds?.length
          ? { quarantinedConversationIds: payload.chatState.quarantinedConversationIds }
          : {})
      },
      {
        version,
        committedAt,
        knownCollaboratorIds: personasWithDocContent.map((persona) => persona.id)
      }
    );
    chatSalvagedQuarantinedIds = quarantinedConversationIds;
    await prepareReplacement(chatRehearsal.unitOfWork);
    return await commitAndPromoteProjectedDomain(chatRehearsal.unitOfWork, (meta, projected) => (
      buildChatMigrationRehearsalValidationReport(chatRehearsal, {
        pointer: commitMetaToPointer(meta),
        domainMeta: projectedRead(projected, chatRehearsal.readPlan.domainMetaRef),
        rows: chatRehearsal.readPlan.conversations.map((plan) => ({
          id: plan.id,
          catalog: projectedRead(projected, plan.catalogRef),
          ...(plan.recordRef ? { record: projectedRead(projected, plan.recordRef) } : {})
        })),
        validatedAt
      })
    ));
  });

  await restoreDomain('collection', async () => {
    const collectionPlan = buildCollectionMigrationPlan({
      id: `import-collection-${committedAt}`,
      state: payload.collectionState,
      activeProjectId: payload.spaceState.collectionProjectId,
      version,
      updatedAt: committedAt
    });
    return await commitAndPromoteProjectedDomain(await prepareReplacement(collectionPlan.unitOfWork));
  });

  await restoreDomain('persona', async () => {
    const personaPlan = buildPersonaMigrationPlan({
      id: `import-persona-${committedAt}`,
      state: {
        personas: stripPersonaMemoryDocContent(personasWithDocContent),
        activeCollaboratorId: payload.personaState.activeCollaboratorId,
        seededDefaultPersonaIds: payload.personaState.seededDefaultPersonaIds ?? []
      },
      version,
      updatedAt: committedAt
    });
    return await commitAndPromoteProjectedDomain(await prepareReplacement(personaPlan.unitOfWork));
  });

  await restoreDomain('runtime', async () => {
    const runtimePlan = buildRuntimeMigrationPlan({
      id: `import-runtime-${committedAt}`,
      state: payload.runtimeState,
      version,
      updatedAt: committedAt
    });
    return await commitAndPromoteProjectedDomain(await prepareReplacement(runtimePlan.unitOfWork));
  });

  await restoreDomain('space', async () => {
    const spacePlan = buildSpaceMigrationPlan({
      id: `import-space-${committedAt}`,
      state: payload.spaceState,
      version,
      updatedAt: committedAt
    });
    return await commitAndPromoteProjectedDomain(await prepareReplacement(spacePlan.unitOfWork));
  });

  await restoreDomain('document', async () => {
    const documentPlan = buildDocumentMigrationPlan({
      id: `import-document-${committedAt}`,
      state: buildDocumentLocalDataStateFromSources({
        kv: serializePersonaMemoryDocContentEntries(payload.personaMemoryDocContent),
        personas: personasWithDocContent,
        workspaceReferenceDocs: payload.collectionState.workspaceReferenceDocs,
        updatedAt: committedAt
      }),
      version,
      updatedAt: committedAt
    });
    return await commitAndPromoteProjectedDomain(await prepareReplacement(documentPlan.unitOfWork));
  });

  await restoreDomain('asset', async () => {
    const assetPlan = buildAssetMigrationPlan({
      id: `import-asset-${committedAt}`,
      state: {
        meta: payload.assetEntries.map((entry) => entry.meta),
        binary: assetBinaryEntries(payload.assetEntries),
        preview: assetPreviewEntries(payload.assetEntries),
        ownersByAssetId: collectAssetReferenceOwners({
          conversations: payload.chatState.conversations,
          codeCards: payload.collectionState.cards,
          imageCards: payload.collectionState.imageCards,
          projectFiles: payload.collectionState.projectFiles,
          workspaceReferenceDocs: payload.collectionState.workspaceReferenceDocs,
          roomProjects: payload.collectionState.roomProjects,
          personas: personasWithDocContent,
          theme: payload.spaceState.theme,
          collaboratorThemes: payload.spaceState.collaboratorThemes,
          customization: payload.spaceState.customization,
          pendingAttachments: []
        })
      },
      version,
      updatedAt: committedAt
    });
    return await commitAndPromoteProjectedDomain(await prepareReplacement(assetPlan.unitOfWork));
  });

  return {
    restoredDomains: STRUCTURED_IMPORT_DOMAINS.filter((domain) => restoredDomains.includes(domain)),
    promotedDomains: STRUCTURED_IMPORT_DOMAINS.filter((domain) => restoredDomains.includes(domain)),
    skippedDomains,
    promotionSkippedDomains: [],
    promotionFailure: null,
    chatQuarantinedConversationIds: chatSalvagedQuarantinedIds
  };
}
