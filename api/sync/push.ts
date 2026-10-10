import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSnapshotsCollection, snapshotsTooLarge } from '../../src/engines/server/mongo.js';
import { applySyncCors, authorizeSyncRequest, getSyncUserId, parseSyncBody } from '../../src/engines/server/syncHttp.js';
import { encryptSnapshot } from '../../src/engines/server/syncCrypto.js';

const RETENTION = 7;

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

  if (!authorizeSyncRequest(req, res)) return;

  let body: { schemaVersion?: number; payload?: unknown };
  try {
    body = parseSyncBody(req) as typeof body;
  } catch {
    res.status(400).json({ error: { message: 'Invalid JSON body', type: 'invalid_request' } });
    return;
  }

  if (body.payload === undefined || body.payload === null) {
    res.status(400).json({ error: { message: 'Empty payload', type: 'invalid_request' } });
    return;
  }

  if (snapshotsTooLarge(body.payload)) {
    res.status(413).json({ error: { message: 'Snapshot exceeds 16MB', type: 'payload_too_large' } });
    return;
  }

  try {
    const userId = getSyncUserId(req);
    const collection = await getSnapshotsCollection();
    const now = new Date();
    const encrypted = encryptSnapshot(JSON.stringify(body.payload));
    const insert = await collection.insertOne({
      userId,
      schemaVersion: typeof body.schemaVersion === 'number' ? body.schemaVersion : 1,
      updatedAt: now,
      payload: encrypted
    });

    const stale = await collection
      .find({ userId })
      .sort({ updatedAt: -1 })
      .skip(RETENTION)
      .project({ _id: 1 })
      .toArray();
    if (stale.length > 0) {
      await collection.deleteMany({ _id: { $in: stale.map((doc) => doc._id) } });
    }

    res.status(200).json({ ok: true, id: insert.insertedId, updatedAt: now.toISOString() });
  } catch (error) {
    res.status(500).json({ error: { message: error instanceof Error ? error.message : 'Sync failed', type: 'server_error' } });
  }
}
