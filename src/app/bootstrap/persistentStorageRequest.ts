import { recordAppRuntimeLogEntry } from '../../infrastructure/appRuntimeLog';

type StorageManagerLike = {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
};

function getStorageManager(): StorageManagerLike | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as Navigator & { storage?: StorageManagerLike }).storage ?? null;
}

// Ask the browser to treat our origin's storage as persistent. Best-effort: it lowers the
// chance a storage-pressure eviction silently wipes IndexedDB/localStorage (the root of the
// recurring "data cleared" reports on the web/Android-WebView builds). Never throws.
export async function requestPersistentStorage(): Promise<boolean> {
  const storage = getStorageManager();
  if (!storage?.persist) return false;
  try {
    if (storage.persisted && (await storage.persisted())) return true;
    const granted = await storage.persist();
    recordAppRuntimeLogEntry({
      at: Date.now(),
      kind: 'startup',
      title: '持久化存储',
      detail: granted ? '浏览器已授予持久化存储' : '浏览器未授予持久化存储（仍可能被清理）'
    });
    return granted;
  } catch {
    return false;
  }
}
