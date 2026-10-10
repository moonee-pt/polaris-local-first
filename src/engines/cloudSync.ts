import {
  buildCloudSyncSnapshot,
  CLOUD_SYNC_SCHEMA_VERSION,
  type StructuredExportSnapshot
} from '../stores/storeExportPackage';
import { importStructuredExportSnapshot } from '../stores/storeImportPackage';
import type { StoreTransferProgressReporter } from '../stores/storeImportProgress';
import { isSyncConfigured, pushSnapshot, pullLatestSnapshot, type SyncSnapshot } from './syncClient';

export type CloudBackupResult = { updatedAt: string };
export type CloudRestoreResult = { restored: boolean; updatedAt?: string };

const CLOUD_LAST_BACKUP_KEY = 'polaris-cloud-last-backup-at';

export function getCloudLastBackupAt(): string {
  try {
    return window.localStorage.getItem(CLOUD_LAST_BACKUP_KEY) ?? '';
  } catch {
    return '';
  }
}

function setCloudLastBackupAt(iso: string): void {
  try {
    window.localStorage.setItem(CLOUD_LAST_BACKUP_KEY, iso);
  } catch {
    // Storage unavailable (private mode); timestamp stays in memory only.
  }
}

function hasNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

// A fresh device with no local data must never push an empty snapshot that could
// evict good cloud backups from the retention window.
export function snapshotHasUserData(snapshot: StructuredExportSnapshot): boolean {
  if (hasNonEmptyArray((snapshot.chatState as { conversations?: unknown } | undefined)?.conversations)) return true;
  if (hasNonEmptyArray((snapshot.personaState as { personas?: unknown } | undefined)?.personas)) return true;
  const collection = snapshot.collectionState as Record<string, unknown> | undefined;
  if (collection && ['cards', 'projectFiles', 'workspaceReferenceDocs', 'roomProjects', 'imageCards'].some((key) => hasNonEmptyArray(collection[key]))) return true;
  const space = snapshot.spaceState as Record<string, unknown> | undefined;
  if (space && Object.values(space).some(hasNonEmptyArray)) return true;
  return false;
}

export async function uploadCloudBackup(
  _unused: unknown = null,
  options: { onProgress?: StoreTransferProgressReporter } = {}
): Promise<CloudBackupResult> {
  const snapshot = await buildCloudSyncSnapshot({ onProgress: options.onProgress });
  const result = await pushSnapshot(snapshot, CLOUD_SYNC_SCHEMA_VERSION);
  setCloudLastBackupAt(result.updatedAt);
  return { updatedAt: result.updatedAt };
}

export async function downloadCloudBackup(
  _unused: unknown = null,
  options: { onProgress?: StoreTransferProgressReporter } = {}
): Promise<CloudRestoreResult> {
  const snapshot: SyncSnapshot | null = await pullLatestSnapshot();
  if (!snapshot) return { restored: false };
  await importStructuredExportSnapshot(snapshot.payload as StructuredExportSnapshot, { onProgress: options.onProgress });
  return { restored: true, updatedAt: snapshot.updatedAt };
}

export type AutoCloudBackupOutcome = 'ok' | 'skipped-not-configured' | 'skipped-empty' | 'skipped-inflight' | 'error';

let autoBackupInFlight = false;

// Silent background backup. No-ops unless a sync token is baked into the build.
// Reads the persisted snapshot (durable IndexedDB data), so it is safe at any point after startup.
export async function runAutoCloudBackup(): Promise<AutoCloudBackupOutcome> {
  if (!isSyncConfigured()) return 'skipped-not-configured';
  if (autoBackupInFlight) return 'skipped-inflight';
  autoBackupInFlight = true;
  try {
    const snapshot = await buildCloudSyncSnapshot();
    if (!snapshotHasUserData(snapshot)) return 'skipped-empty';
    const result = await pushSnapshot(snapshot, CLOUD_SYNC_SCHEMA_VERSION);
    setCloudLastBackupAt(result.updatedAt);
    return 'ok';
  } catch {
    return 'error';
  } finally {
    autoBackupInFlight = false;
  }
}

export type AutoCloudRestoreOutcome = 'restored' | 'skipped-not-configured' | 'skipped-local-has-data' | 'skipped-no-cloud' | 'error';

// On a fresh device (no local data yet) pull the latest cloud snapshot so opening
// the site in another browser just shows the user's data. Never overwrites a device
// that already has its own local data.
export async function autoRestoreIfLocalEmpty(): Promise<AutoCloudRestoreOutcome> {
  if (!isSyncConfigured()) return 'skipped-not-configured';
  try {
    const local = await buildCloudSyncSnapshot();
    if (snapshotHasUserData(local)) return 'skipped-local-has-data';
    const snapshot = await pullLatestSnapshot();
    if (!snapshot || !snapshot.payload) return 'skipped-no-cloud';
    await importStructuredExportSnapshot(snapshot.payload as StructuredExportSnapshot);
    return 'restored';
  } catch {
    return 'error';
  }
}
