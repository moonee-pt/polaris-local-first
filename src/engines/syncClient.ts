import { buildInternalApiEndpoint } from './chat-api/chatApiEndpoint';
import { getPolarisDeviceId } from './freeProvider';

export type SyncSnapshot = {
  schemaVersion: number;
  updatedAt: string;
  payload: unknown;
};

export type PushResult = { ok: true; id: string; updatedAt: string };

function syncHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Polaris-Device-Id': getPolarisDeviceId()
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
