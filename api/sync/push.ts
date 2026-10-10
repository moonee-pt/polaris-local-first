import type { VercelRequest, VercelResponse } from '@vercel/node';
import { docTooLarge, getTableCollection } from '../../src/engines/server/mongo.js';
import { applySyncCors, getSyncUserId, parseSyncBody } from '../../src/engines/server/syncHttp.js';
import type { SyncOp, SyncTableName } from '../../src/engines/syncProtocol.js';
import { SYNC_TABLES } from '../../src/engines/syncProtocol.js';

function isTableName(value: unknown): value is SyncTableName {
  return typeof value === 'string' && (SYNC_TABLES as readonly string[]).includes(value);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applySyncCors(req, res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed', type: 'invalid_request' } });
    return;
  }

  let body: { ops?: unknown };
  try {
    body = parseSyncBody(req) as typeof body;
  } catch {
    res.status(400).json({ error: { message: 'Invalid JSON body', type: 'invalid_request' } });
    return;
  }

  const ops = Array.isArray(body.ops) ? (body.ops as SyncOp[]) : null;
  if (!ops) {
    res.status(400).json({ error: { message: 'Missing ops array', type: 'invalid_request' } });
    return;
  }

  for (const op of ops) {
    if (!op || typeof op !== 'object' || !isTableName(op.table) || typeof op.id !== 'string' || !op.id) {
      res.status(400).json({ error: { message: 'Malformed op', type: 'invalid_request' } });
      return;
    }
    if (op.delete !== true && docTooLarge(op.data)) {
      res.status(413).json({ error: { message: 'Row exceeds 16MB', type: 'payload_too_large' } });
      return;
    }
  }

  try {
    const userId = getSyncUserId(req);
    const now = Date.now();
    let applied = 0;

    for (const op of ops) {
      const collection = await getTableCollection(op.table);
      if (op.delete === true) {
        await collection.deleteOne({ userId, _id: op.id });
      } else {
        const updatedAt = new Date(typeof op.updatedAt === 'number' ? op.updatedAt : now);
        await collection.updateOne(
          { userId, _id: op.id },
          { $set: { userId, data: op.data, updatedAt }, $setOnInsert: { createdAt: updatedAt } },
          { upsert: true }
        );
      }
      applied += 1;
    }

    res.status(200).json({ ok: true, applied, latestAt: now });
  } catch (error) {
    res.status(500).json({ error: { message: error instanceof Error ? error.message : 'Sync failed', type: 'server_error' } });
  }
}
