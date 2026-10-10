import { buildInternalApiEndpoint } from './chat-api/chatApiEndpoint';
import type { PullResponse, PushResponse, SyncOp } from './syncProtocol';

export type { PullResponse, SyncOp } from './syncProtocol';

function syncHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json' };
}

// Same-origin /api/sync backend exists on the deployed site but not in local `vite dev`,
// so only attempt sync when we are not on a local dev host.
export function isSyncConfigured(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '';
}

export async function pushOps(ops: SyncOp[]): Promise<PushResponse> {
  const res = await fetch(buildInternalApiEndpoint('/api/sync/push'), {
    method: 'POST',
    headers: syncHeaders(),
    body: JSON.stringify({ ops })
  });
  if (!res.ok) throw new Error(`同步上传失败（${res.status}）`);
  return (await res.json()) as PushResponse;
}

export async function pullTables(since: number | null): Promise<PullResponse> {
  const path = since === null ? '/api/sync/pull' : `/api/sync/pull?since=${since}`;
  const res = await fetch(buildInternalApiEndpoint(path), { method: 'GET', headers: syncHeaders() });
  if (!res.ok) throw new Error(`同步下载失败（${res.status}）`);
  return (await res.json()) as PullResponse;
}
