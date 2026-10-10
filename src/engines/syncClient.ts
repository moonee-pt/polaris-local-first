import { buildInternalApiEndpoint } from './chat-api/chatApiEndpoint';

export type SyncSnapshot = {
  schemaVersion: number;
  updatedAt: string;
  payload: unknown;
};

export type PushResult = { ok: true; id: string; updatedAt: string };

function syncToken(): string {
  return (import.meta.env.VITE_POLARIS_SYNC_SECRET ?? '').trim();
}

function syncHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Polaris-Sync-Token': syncToken()
  };
}

export async function pushSnapshot(payload: unknown, schemaVersion = 1): Promise<PushResult> {
  const res = await fetch(buildInternalApiEndpoint('/api/sync/push'), {
    method: 'POST',
    headers: syncHeaders(),
    body: JSON.stringify({ schemaVersion, payload })
  });
  if (!res.ok) {
    throw new Error(`同步上传失败（${res.status}）`);
  }
  return (await res.json()) as PushResult;
}

export async function pullLatestSnapshot(): Promise<SyncSnapshot | null> {
  const res = await fetch(buildInternalApiEndpoint('/api/sync/pull'), {
    method: 'GET',
    headers: syncHeaders()
  });
  if (!res.ok) {
    throw new Error(`同步下载失败（${res.status}）`);
  }
  const data = (await res.json()) as { ok: boolean; snapshot: SyncSnapshot | null };
  return data.snapshot;
}

export async function listSnapshots(): Promise<SyncSnapshot[]> {
  const res = await fetch(buildInternalApiEndpoint('/api/sync/pull?list=1'), {
    method: 'GET',
    headers: syncHeaders()
  });
  if (!res.ok) {
    throw new Error(`同步列表读取失败（${res.status}）`);
  }
  const data = (await res.json()) as { ok: boolean; snapshots: SyncSnapshot[] };
  return data.snapshots ?? [];
}

export function isSyncConfigured(): boolean {
  return syncToken().length > 0;
}
