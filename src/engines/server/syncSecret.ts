export function getSyncSecret(): string {
  return (process.env.SYNC_SECRET ?? process.env.VITE_POLARIS_SYNC_SECRET ?? '').trim();
}
