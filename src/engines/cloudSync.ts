import {
  buildCloudSyncSnapshot,
  type StructuredExportSnapshot
} from '../stores/storeExportPackage';
import { importStructuredExportSnapshot } from '../stores/storeImportPackage';
import type { StoreTransferProgressReporter } from '../stores/storeImportProgress';
import { isSyncConfigured, pullTables, pushOps } from './syncClient';
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

function readHashCache(): HashCache {
  try {
    const raw = window.localStorage.getItem(HASH_CACHE_KEY);
    if (!raw) return emptyHashCache();
    const parsed = JSON.parse(raw) as Partial<HashCache>;
    const out = emptyHashCache();
    for (const table of SYNC_TABLES) Object.assign(out[table], parsed[table] ?? {});
    return out;
  } catch {
    return emptyHashCache();
  }
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

type ChatLike = { conversations: Array<{ id?: string }>; activeConversationId?: string | null };
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
    data: { spaceState: snapshot.spaceState ?? {}, activeConversationId: chat.activeConversationId ?? null }
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

let syncInFlight = false;

export type SyncTickResult = 'ok' | 'skipped-not-configured' | 'skipped-inflight' | 'skipped-clean' | 'error';

export type StartupResult = 'restored' | 'pushed' | 'clean' | 'skipped-not-configured' | 'error';

// Startup: pull cloud rows newer than our last sync, merge them into local, import the
// merged snapshot back into the store, then push whatever local rows are still dirty.
export async function syncOnStartup(): Promise<StartupResult> {
  if (!isSyncConfigured()) return 'skipped-not-configured';
  if (syncInFlight) return 'skipped-not-configured';
  syncInFlight = true;
  try {
    const since = getLastSyncAt();
    const cache = readHashCache();
    const hasCache = SYNC_TABLES.some((t) => Object.keys(cache[t]).length > 0);
    let pull: PullResponse | null = null;
    let pullFailed = false;
    try {
      pull = await pullTables(since > 0 ? since : null);
    } catch {
      pullFailed = true;
    }
    // A fresh device that cannot see the cloud has no way to know whether pushing its
    // own (possibly empty) rows would clobber real cloud data — bail out.
    if (pullFailed && !hasCache) return 'error';

    if (pull && pull.latestAt > since) {
      const local = await buildCloudSyncSnapshot();
      const merged = mergeCloudIntoLocal(local, pull);
      await importStructuredExportSnapshot(merged);
    }

    const snapshot = await buildCloudSyncSnapshot();
    const rows = splitSnapshotToRows(snapshot);
    const { ops, next } = buildOps(rows, cache);
    if (ops.length > 0) {
      const result = await pushOps(ops);
      writeHashCache(next);
      setLastSyncAt(Math.max(result.latestAt, pull?.latestAt ?? 0));
      return 'pushed';
    }
    if (pull && pull.latestAt > since) return 'restored';
    return 'clean';
  } catch {
    return 'error';
  } finally {
    syncInFlight = false;
  }
}

export async function runAutoCloudBackup(): Promise<SyncTickResult> {
  if (!isSyncConfigured()) return 'skipped-not-configured';
  if (syncInFlight) return 'skipped-inflight';
  syncInFlight = true;
  try {
    const snapshot = await buildCloudSyncSnapshot();
    const rows = splitSnapshotToRows(snapshot);
    const cache = readHashCache();
    const { ops, next } = buildOps(rows, cache);
    if (ops.length === 0) return 'skipped-clean';
    const result = await pushOps(ops);
    writeHashCache(next);
    setLastSyncAt(result.latestAt);
    return 'ok';
  } catch {
    return 'error';
  } finally {
    syncInFlight = false;
  }
}

/** @deprecated Alias so existing imports keep working. */
export const autoRestoreIfLocalEmpty = syncOnStartup;

export type CloudBackupResult = { updatedAt: string };
export type CloudRestoreResult = { restored: boolean; updatedAt?: string };

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
  await importStructuredExportSnapshot(merged, options.onProgress ? { onProgress: options.onProgress } : {});
  commitCacheFor(splitSnapshotToRows(merged), pull.latestAt);
  return { restored: true, updatedAt: new Date(pull.latestAt).toISOString() };
}
