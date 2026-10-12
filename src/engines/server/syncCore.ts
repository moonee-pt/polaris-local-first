import { docTooLarge, getTableCollection } from './mongo.js';
import { isAllowedPolarisApiOrigin } from './corsOrigin.js';
import { SYNC_TABLES, type SyncOp, type SyncTableName, type SyncDoc } from '../syncProtocol.js';

// Platform-agnostic sync backend core. Both the Vercel serverless entry points and the
// self-hostable Node server call these functions; neither imports anything Vercel-specific.
// The data lives in MongoDB Atlas, so moving hosts only means pointing the frontend's
// VITE_POLARIS_API_ORIGIN at a new deploy of this same core — no data migration.

// Single-tenant personal app: every device shares one private data slot.
export const SYNC_OWNER_ID = 'owner';

export type SyncRequest = {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
  origin: string;
};

export type SyncResponse = {
  status: number;
  // undefined body => no content (e.g. 204 preflight).
  json?: unknown;
  corsOrigin: string | null;
};

const CORS_METHODS: Record<'push' | 'pull', string> = {
  push: 'POST, OPTIONS',
  pull: 'GET, OPTIONS'
};

export function resolveCorsOrigin(origin: string): string | null {
  return isAllowedPolarisApiOrigin(origin || '') ? origin : null;
}

function errorJson(message: string, type: string): SyncResponse['json'] {
  return { error: { message, type } };
}

function normalizeBody(body: unknown): { ops?: unknown } {
  if (typeof body === 'string') {
    return body.trim() ? (JSON.parse(body) as { ops?: unknown }) : {};
  }
  return (body ?? {}) as { ops?: unknown };
}

function isTableName(value: unknown): value is SyncTableName {
  return typeof value === 'string' && (SYNC_TABLES as readonly string[]).includes(value);
}

async function readTable(userId: string, table: SyncTableName, since: number | null): Promise<SyncDoc[]> {
  const collection = await getTableCollection(table);
  const filter: Record<string, unknown> = { userId };
  if (since !== null) filter.updatedAt = { $gt: new Date(since) };
  const docs = await collection
    .find<{ _id: string; updatedAt: Date; data: unknown }>(filter)
    .toArray();
  return docs.map((doc) => ({
    id: String(doc._id),
    data: doc.data,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.getTime() : Number(doc.updatedAt ?? 0)
  }));
}

export async function handleSyncPull(req: SyncRequest): Promise<SyncResponse> {
  const corsOrigin = resolveCorsOrigin(req.origin);
  if (req.method === 'OPTIONS') return { status: 204, corsOrigin };
  if (req.method !== 'GET') {
    return { status: 405, json: errorJson('Method not allowed', 'invalid_request'), corsOrigin };
  }

  const sinceRaw = req.query.since !== undefined ? Number(req.query.since) : null;
  const since = Number.isFinite(sinceRaw as number) ? (sinceRaw as number) : null;

  try {
    const tables = {} as Record<SyncTableName, SyncDoc[]>;
    let latestAt = 0;
    for (const table of SYNC_TABLES) {
      const rows = await readTable(SYNC_OWNER_ID, table, since);
      tables[table] = rows;
      for (const row of rows) if (row.updatedAt > latestAt) latestAt = row.updatedAt;
    }
    return { status: 200, json: { ok: true, tables, latestAt }, corsOrigin };
  } catch (error) {
    return {
      status: 500,
      json: errorJson(error instanceof Error ? error.message : 'Pull failed', 'server_error'),
      corsOrigin
    };
  }
}

export async function handleSyncPush(req: SyncRequest): Promise<SyncResponse> {
  const corsOrigin = resolveCorsOrigin(req.origin);
  if (req.method === 'OPTIONS') return { status: 204, corsOrigin };
  if (req.method !== 'POST') {
    return { status: 405, json: errorJson('Method not allowed', 'invalid_request'), corsOrigin };
  }

  let body: { ops?: unknown };
  try {
    body = normalizeBody(req.body);
  } catch {
    return { status: 400, json: errorJson('Invalid JSON body', 'invalid_request'), corsOrigin };
  }

  const ops = Array.isArray(body.ops) ? (body.ops as SyncOp[]) : null;
  if (!ops) {
    return { status: 400, json: errorJson('Missing ops array', 'invalid_request'), corsOrigin };
  }

  for (const op of ops) {
    if (!op || typeof op !== 'object' || !isTableName(op.table) || typeof op.id !== 'string' || !op.id) {
      return { status: 400, json: errorJson('Malformed op', 'invalid_request'), corsOrigin };
    }
    if (op.delete !== true && docTooLarge(op.data)) {
      return { status: 413, json: errorJson('Row exceeds 16MB', 'payload_too_large'), corsOrigin };
    }
  }

  try {
    const now = Date.now();
    let applied = 0;
    for (const op of ops) {
      const collection = await getTableCollection(op.table);
      if (op.delete === true) {
        await collection.deleteOne({ userId: SYNC_OWNER_ID, _id: op.id });
      } else {
        const updatedAt = new Date(typeof op.updatedAt === 'number' ? op.updatedAt : now);
        await collection.updateOne(
          { userId: SYNC_OWNER_ID, _id: op.id },
          { $set: { userId: SYNC_OWNER_ID, data: op.data, updatedAt }, $setOnInsert: { createdAt: updatedAt } },
          { upsert: true }
        );
      }
      applied += 1;
    }
    return { status: 200, json: { ok: true, applied, latestAt: now }, corsOrigin };
  } catch (error) {
    return {
      status: 500,
      json: errorJson(error instanceof Error ? error.message : 'Sync failed', 'server_error'),
      corsOrigin
    };
  }
}

export { CORS_METHODS };
