import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getTableCollection } from '../../src/engines/server/mongo.js';
import { applySyncCors, getSyncUserId } from '../../src/engines/server/syncHttp.js';
import { SYNC_TABLES, type PullResponse, type SyncTableName, type SyncDoc } from '../../src/engines/syncProtocol.js';

type Row = { _id: string; updatedAt: Date; data: unknown };

async function readTable(userId: string, table: SyncTableName, since: number | null): Promise<SyncDoc[]> {
  const collection = await getTableCollection(table);
  const filter: Record<string, unknown> = { userId };
  if (since !== null) filter.updatedAt = { $gt: new Date(since) };
  const docs = await collection.find<Row>(filter).toArray();
  return docs.map((doc) => ({
    id: String(doc._id),
    data: doc.data,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.getTime() : Number(doc.updatedAt ?? 0)
  }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applySyncCors(req, res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: { message: 'Method not allowed', type: 'invalid_request' } });
    return;
  }

  const sinceRaw = typeof req.query.since === 'string' ? Number(req.query.since) : null;
  const since = Number.isFinite(sinceRaw as number) ? (sinceRaw as number) : null;

  try {
    const userId = getSyncUserId(req);
    const tables = {} as Record<SyncTableName, SyncDoc[]>;
    let latestAt = 0;
    for (const table of SYNC_TABLES) {
      const rows = await readTable(userId, table, since);
      tables[table] = rows;
      for (const row of rows) if (row.updatedAt > latestAt) latestAt = row.updatedAt;
    }
    const payload: PullResponse = { ok: true, tables, latestAt };
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({ error: { message: error instanceof Error ? error.message : 'Pull failed', type: 'server_error' } });
  }
}
