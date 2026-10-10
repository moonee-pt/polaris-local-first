import {
  buildCloudSyncSnapshot,
  CLOUD_SYNC_SCHEMA_VERSION,
  type StructuredExportSnapshot
} from '../stores/storeExportPackage';
import { importStructuredExportSnapshot } from '../stores/storeImportPackage';
import type { StoreTransferProgressReporter } from '../stores/storeImportProgress';
import { pushSnapshot, pullLatestSnapshot, type SyncSnapshot } from './syncClient';
import { decryptFromCloud, encryptForCloud, isCloudEnvelope } from './cloudCrypto';

export type CloudBackupResult = { updatedAt: string };
export type CloudRestoreResult = { restored: boolean; updatedAt?: string };

export class CloudPassphraseError extends Error {
  constructor() {
    super('同步密码不正确，无法解密云端备份。');
    this.name = 'CloudPassphraseError';
  }
}

export async function uploadCloudBackup(
  passphrase: string,
  options: { onProgress?: StoreTransferProgressReporter } = {}
): Promise<CloudBackupResult> {
  if (!passphrase.trim()) throw new Error('请先设置一个同步密码。');
  const snapshot = await buildCloudSyncSnapshot({ onProgress: options.onProgress });
  const envelope = await encryptForCloud(snapshot, passphrase);
  const result = await pushSnapshot(envelope, CLOUD_SYNC_SCHEMA_VERSION);
  return { updatedAt: result.updatedAt };
}

export async function downloadCloudBackup(
  passphrase: string,
  options: { onProgress?: StoreTransferProgressReporter } = {}
): Promise<CloudRestoreResult> {
  const snapshot: SyncSnapshot | null = await pullLatestSnapshot();
  if (!snapshot) return { restored: false };
  const stored = snapshot.payload;
  let parsed: StructuredExportSnapshot;
  if (isCloudEnvelope(stored)) {
    try {
      parsed = await decryptFromCloud(stored, passphrase) as StructuredExportSnapshot;
    } catch {
      throw new CloudPassphraseError();
    }
  } else {
    parsed = stored as StructuredExportSnapshot;
  }
  await importStructuredExportSnapshot(parsed, { onProgress: options.onProgress });
  return { restored: true, updatedAt: snapshot.updatedAt };
}
