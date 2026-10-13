import {
  buildCloudSyncSnapshot,
  type StructuredExportSnapshot
} from '../stores/storeExportPackage';
import { importStructuredExportSnapshot } from '../stores/storeImportPackage';
import type { StoreImportResult } from '../stores/storeImportResult';
import type { StoreTransferProgressReporter } from '../stores/storeImportProgress';
import { pullTables, pushOps } from './syncClient';
import type { PullResponse, SyncOp, SyncTableName } from './syncProtocol';
import { SYNC_TABLES } from './syncProtocol';

// ---- localStorage markers -----------------------------------------------------

const HASH_CACHE_KEY = 'polaris-cloud-sync-hashes-v1';
const LAST_SYNC_AT_KEY = 'polaris-cloud-last-sync-at-v1';

type RowHash = string;
type HashCache = Record<SyncTableName, Record<string, RowHash>>;

function emptyHashCache(): HashCache {
  return Object.fromEntries(SYNC_TABLES.map((t) => [t, {}])) as HashCache;
}

function writeHashCache(cache: HashCache): void {
  try {
    window.localStorage.setItem(HASH_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage unavailable; next tick just re-pushes dirty rows.
  }
}

export function getLastSyncAt(): number {
  try {
    const raw = window.localStorage.getItem(LAST_SYNC_AT_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function setLastSyncAt(value: number): void {
  try {
    window.localStorage.setItem(LAST_SYNC_AT_KEY, String(value));
  } catch {
    // Ignored; marker only drives the pull-since filter.
  }
}

export function getCloudLastSyncIso(): string {
  const at = getLastSyncAt();
  return at > 0 ? new Date(at).toISOString() : '';
}

/** @deprecated Kept so existing shell imports keep compiling. */
export const getCloudLastBackupAt = getCloudLastSyncIso;

// ---- snapshot → rows ----------------------------------------------------------

export type Row = { table: SyncTableName; id: string; data: unknown };

type ChatLike = {
  conversations: Array<{ id?: string }>;
  activeConversationId?: string | null;
  activeGroupRoomId?: string | null;
  groupRooms?: unknown[];
  deletedConversationIds?: string[];
  quarantinedConversationIds?: string[];
};
type PersonaLike = {
  personas: Array<{ id?: string }>;
  activeCollaboratorId?: string | null;
  seededDefaultPersonaIds?: string[];
};

function asChat(snapshot: StructuredExportSnapshot): ChatLike {
  return (snapshot.chatState ?? { conversations: [], activeConversationId: null }) as unknown as ChatLike;
}

function asPersona(snapshot: StructuredExportSnapshot): PersonaLike {
  return (snapshot.personaState ?? { personas: [], activeCollaboratorId: null, seededDefaultPersonaIds: [] }) as unknown as PersonaLike;
}

export function splitSnapshotToRows(snapshot: StructuredExportSnapshot): Row[] {
  const rows: Row[] = [];
  const chat = asChat(snapshot);
  const persona = asPersona(snapshot);
  rows.push({
    table: 'sync_settings',
    id: 'global',
    data: {
      spaceState: snapshot.spaceState ?? {},
      activeConversationId: chat.activeConversationId ?? null,
      activeGroupRoomId: chat.activeGroupRoomId ?? null,
      groupRooms: chat.groupRooms ?? [],
      deletedConversationIds: chat.deletedConversationIds ?? [],
      quarantinedConversationIds: chat.quarantinedConversationIds ?? []
    }
  });
  rows.push({ table: 'sync_providers', id: 'global', data: snapshot.runtimeState ?? { providers: [] } });
  rows.push({ table: 'sync_collection', id: 'global', data: snapshot.collectionState ?? {} });
  rows.push({
    table: 'sync_personas',
    id: 'meta',
    data: {
      activeCollaboratorId: persona.activeCollaboratorId ?? null,
      seededDefaultPersonaIds: persona.seededDefaultPersonaIds ?? [],
      personaMemoryDocContent: snapshot.personaMemoryDocContent ?? null
    }
  });
  for (const p of persona.personas) {
    if (typeof p.id === 'string') rows.push({ table: 'sync_personas', id: p.id, data: p });
  }
  for (const conversation of chat.conversations) {
    if (typeof conversation.id === 'string') rows.push({ table: 'sync_conversations', id: conversation.id, data: conversation });
  }
  return rows;
}

// fnv-1a 32-bit over the JSON; collision chance is negligible for a personal sync cache.
export function hashData(value: unknown): RowHash {
  const text = JSON.stringify(value ?? null);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function buildOps(rows: Row[], previous: HashCache): { ops: SyncOp[]; next: HashCache } {
  const next = emptyHashCache();
  const seen: HashCache = emptyHashCache();
  const ops: SyncOp[] = [];
  for (const row of rows) {
    const hash = hashData(row.data);
    seen[row.table][row.id] = hash;
    next[row.table][row.id] = hash;
    if (previous[row.table][row.id] !== hash) ops.push({ table: row.table, id: row.id, data: row.data });
  }
  for (const table of SYNC_TABLES) {
    for (const id of Object.keys(previous[table])) {
      if (!(id in seen[table])) ops.push({ table, id, delete: true });
    }
  }
  return { ops, next };
}

// A wiped device (cleared cache / evicted IndexedDB) still has its hash cache in
// localStorage, so buildOps would happily emit DELETE ops for every conversation and persona
// the cloud still holds, wiping it. If the local snapshot carries no conversations/personas
// while the cache remembers them, treat the device as wiped and drop every deletion op — the
// startup pull/merge path restores the data instead.
export function filterWipedDeviceOps(ops: SyncOp[], rows: Row[], previous: HashCache): SyncOp[] {
  const localConversations = new Set<string>();
  const localPersonas = new Set<string>();
  for (const row of rows) {
    // The personas table always carries a 'meta' row; only real persona ids count as data.
    if (row.table === 'sync_conversations') localConversations.add(row.id);
    if (row.table === 'sync_personas' && row.id !== 'meta') localPersonas.add(row.id);
  }
  const cacheHadConversations = Object.keys(previous.sync_conversations).length > 0;
  const cacheHadPersonas = Object.keys(previous.sync_personas).some((id) => id !== 'meta');
  const wipedConversations = localConversations.size === 0 && cacheHadConversations;
  const wipedPersonas = localPersonas.size === 0 && cacheHadPersonas;
  if (!wipedConversations && !wipedPersonas) return ops;
  return ops.filter((op) => {
    if (!op.delete) return true;
    if (op.table === 'sync_conversations' && wipedConversations) return false;
    if (op.table === 'sync_personas' && wipedPersonas) return false;
    return true;
  });
}

// When deletions were suppressed as a wipe-guard, keep the remembered hashes for those still-
// live cloud rows so the guard keeps firing until the data is pulled back. Without this the
// next tick would see an empty cache and re-push the wiped-local-empty state as new rows.
export function retainProtectedRows(next: HashCache, safeOps: SyncOp[], previous: HashCache): HashCache {
  const deleted = new Set(safeOps.filter((op) => op.delete).map((op) => `${op.table}:${op.id}`));
  const result = emptyHashCache();
  for (const table of SYNC_TABLES) {
    for (const [id, hash] of Object.entries(next[table])) result[table][id] = hash;
    for (const [id, hash] of Object.entries(previous[table])) {
      if (!(id in next[table]) && !deleted.has(`${table}:${id}`)) result[table][id] = hash;
    }
  }
  return result;
}

// ---- merge cloud rows into a local snapshot -----------------------------------

export function mergeCloudIntoLocal(
  local: StructuredExportSnapshot,
  cloud: PullResponse
): StructuredExportSnapshot {
  const merged: StructuredExportSnapshot = { ...local };
  const localChat = asChat(local);
  const chat: ChatLike = {
    conversations: [...localChat.conversations],
    activeConversationId: localChat.activeConversationId ?? null
  };
  const localPersona = asPersona(local);
  const persona: PersonaLike = {
    personas: [...localPersona.personas],
    activeCollaboratorId: localPersona.activeCollaboratorId ?? null,
    seededDefaultPersonaIds: [...(localPersona.seededDefaultPersonaIds ?? [])]
  };

  for (const doc of cloud.tables.sync_settings ?? []) {
    if (doc.id !== 'global') continue;
    const d = doc.data as { spaceState?: unknown; activeConversationId?: string | null } | null;
    if (!d) continue;
    merged.spaceState = d.spaceState as StructuredExportSnapshot['spaceState'];
    chat.activeConversationId = d.activeConversationId ?? chat.activeConversationId;
  }
  for (const doc of cloud.tables.sync_providers ?? []) {
    if (doc.id === 'global') merged.runtimeState = doc.data as StructuredExportSnapshot['runtimeState'];
  }
  for (const doc of cloud.tables.sync_collection ?? []) {
    if (doc.id === 'global') merged.collectionState = doc.data as StructuredExportSnapshot['collectionState'];
  }
  for (const doc of cloud.tables.sync_personas ?? []) {
    if (doc.id === 'meta') {
      const m = doc.data as {
        activeCollaboratorId?: string | null;
        seededDefaultPersonaIds?: string[];
        personaMemoryDocContent?: unknown;
      };
      persona.activeCollaboratorId = m.activeCollaboratorId ?? persona.activeCollaboratorId;
      if (m.seededDefaultPersonaIds) persona.seededDefaultPersonaIds = m.seededDefaultPersonaIds;
      merged.personaMemoryDocContent = m.personaMemoryDocContent as StructuredExportSnapshot['personaMemoryDocContent'];
      continue;
    }
    const p = doc.data as { id: string };
    const idx = persona.personas.findIndex((x) => x.id === p.id);
    if (idx >= 0) persona.personas[idx] = p;
    else persona.personas.push(p);
  }
  for (const doc of cloud.tables.sync_conversations ?? []) {
    const c = doc.data as { id: string };
    const idx = chat.conversations.findIndex((x) => x.id === c.id);
    if (idx >= 0) chat.conversations[idx] = c;
    else chat.conversations.push(c);
  }

  merged.chatState = { ...localChat, conversations: chat.conversations, activeConversationId: chat.activeConversationId } as StructuredExportSnapshot['chatState'];
  merged.personaState = {
    ...localPersona,
    personas: persona.personas,
    activeCollaboratorId: persona.activeCollaboratorId,
    seededDefaultPersonaIds: persona.seededDefaultPersonaIds
  } as StructuredExportSnapshot['personaState'];
  return merged;
}

// ---- public sync entry points --------------------------------------------------
// Cloud sync is manual-only: it runs exclusively from the "备份到云端" /
// "从云端恢复" buttons below. There is intentionally no startup timer, no
// periodic tick, and no visibility-change trigger — background auto-sync kept
// pushing a depleted device's view over the shared cloud slot and wiping rows.

export type CloudBackupResult = { updatedAt: string };
export type CloudRestoreResult = { restored: boolean; updatedAt?: string; importResult?: StoreImportResult };

function commitCacheFor(rows: Row[], at: number): void {
  writeHashCache(
    rows.reduce((acc, row) => {
      acc[row.table][row.id] = hashData(row.data);
      return acc;
    }, emptyHashCache())
  );
  setLastSyncAt(at);
}

// Manual "Sync now" button — always push every current row, ignoring the hash cache.
export async function uploadCloudBackup(
  _unused: unknown = null,
  options: { onProgress?: StoreTransferProgressReporter } = {}
): Promise<CloudBackupResult> {
  const snapshot = await buildCloudSyncSnapshot(options.onProgress ? { onProgress: options.onProgress } : {});
  const rows = splitSnapshotToRows(snapshot);
  const result = await pushOps(rows.map((row) => ({ table: row.table, id: row.id, data: row.data })));
  commitCacheFor(rows, result.latestAt);
  return { updatedAt: new Date(result.latestAt).toISOString() };
}

// Manual "Restore from cloud" — full pull and import merged snapshot.
export async function downloadCloudBackup(
  _unused: unknown = null,
  options: { onProgress?: StoreTransferProgressReporter } = {}
): Promise<CloudRestoreResult> {
  const pull = await pullTables(null);
  if (pull.latestAt <= 0) return { restored: false };
  const local = await buildCloudSyncSnapshot();
  const merged = mergeCloudIntoLocal(local, pull);
  const importResult = await importStructuredExportSnapshot(merged, {
    ...(options.onProgress ? { onProgress: options.onProgress } : {}),
    skipDomains: ['asset']
  });
  commitCacheFor(splitSnapshotToRows(merged), pull.latestAt);
  return { restored: true, updatedAt: new Date(pull.latestAt).toISOString(), importResult };
}
