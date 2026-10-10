import { useEffect } from 'react';
import { getCloudLastSyncIso, runAutoCloudBackup, syncOnStartup } from '../engines/cloudSync';

const STARTUP_DELAY_MS = 5_000;
const TICK_MS = 30_000;
const REFRESH_MIN_GAP_MS = 60_000;

function lastSyncAgeMs(): number {
  const raw = getCloudLastSyncIso();
  if (!raw) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? Date.now() - parsed : Number.POSITIVE_INFINITY;
}

// Background cloud sync: startup pulls any cloud-newer rows into local, then pushes
// only the rows whose content hash changed. A 30s tick keeps edits flowing without
// re-uploading the whole chat corpus, and tab-hide forces a final flush.
export function useCloudAutoSync(): void {
  useEffect(() => {
    let cancelled = false;

    const startupTimer = window.setTimeout(() => {
      if (!cancelled) void syncOnStartup();
    }, STARTUP_DELAY_MS);

    const tickId = window.setInterval(() => {
      void runAutoCloudBackup();
    }, TICK_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void runAutoCloudBackup();
        return;
      }
      if (document.visibilityState === 'visible' && lastSyncAgeMs() > REFRESH_MIN_GAP_MS) {
        void syncOnStartup();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(startupTimer);
      window.clearInterval(tickId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}
