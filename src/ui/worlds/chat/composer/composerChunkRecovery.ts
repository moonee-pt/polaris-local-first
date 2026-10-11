const STALE_CHUNK_SIGNATURES = [
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'failed to load module script'
];

const RELOAD_FLAG = 'polaris.composer-stale-chunk-reload';

/** True when a dynamic import failed because the chunk itself could not be fetched. */
export function isStaleChunkError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : '';
  if (!message) return false;
  const normalized = message.toLowerCase();
  return STALE_CHUNK_SIGNATURES.some((signature) => normalized.includes(signature));
}

/**
 * A chunk that disappeared after a rebuild never comes back, so retrying is pointless:
 * reload once to pick up the new build. Guarded so a reload loop cannot start.
 */
export function reloadOnceForStaleChunk(error: unknown) {
  if (!isStaleChunkError(error)) return false;
  if (typeof window === 'undefined' || typeof window.location?.reload !== 'function') return false;
  try {
    if (window.sessionStorage.getItem(RELOAD_FLAG) === '1') return false;
    window.sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
