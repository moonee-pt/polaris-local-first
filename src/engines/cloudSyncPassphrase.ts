const CLOUD_SYNC_PASSPHRASE_KEY = 'polaris-cloud-sync-passphrase-v1';

export function getCloudSyncPassphrase(): string {
  try {
    return window.localStorage.getItem(CLOUD_SYNC_PASSPHRASE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setCloudSyncPassphrase(value: string): void {
  try {
    const trimmed = value.trim();
    if (trimmed) window.localStorage.setItem(CLOUD_SYNC_PASSPHRASE_KEY, trimmed);
    else window.localStorage.removeItem(CLOUD_SYNC_PASSPHRASE_KEY);
  } catch {
    // Storage unavailable (private mode); passphrase stays in memory only.
  }
}
