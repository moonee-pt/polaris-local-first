import { useEffect } from 'react';
import { autoRestoreIfLocalEmpty, getCloudLastBackupAt, runAutoCloudBackup } from '../engines/cloudSync';

const STARTUP_DELAY_MS = 8_000;
const INTERVAL_MS = 5 * 60 * 1000;
const FOCUS_MIN_GAP_MS = 60 * 1000;

function lastBackupAgeMs(): number {
  const raw = getCloudLastBackupAt();
  if (!raw) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? Date.now() - parsed : Number.POSITIVE_INFINITY;
}

async function syncOnStartup(): Promise<void> {
  const restored = await autoRestoreIfLocalEmpty();
  if (restored !== 'restored') {
    await runAutoCloudBackup();
  }
}

// Background cloud sync: on open it restores into an empty device or backs up a
// populated one, then keeps pushing every few minutes and whenever the tab is left.
export function useCloudAutoSync(): void {
  useEffect(() => {
    let cancelled = false;

    const startupTimer = window.setTimeout(() => {
      if (!cancelled) void syncOnStartup();
    }, STARTUP_DELAY_MS);

    const intervalId = window.setInterval(() => {
      void runAutoCloudBackup();
    }, INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void runAutoCloudBackup();
        return;
      }
      if (document.visibilityState === 'visible' && lastBackupAgeMs() > FOCUS_MIN_GAP_MS) {
        void syncOnStartup();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(startupTimer);
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}
