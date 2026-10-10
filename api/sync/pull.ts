import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSnapshotsCollection } from '../../src/engines/server/mongo.js';
import { applySyncCors, getSyncUserId } from '../../src/engines/server/syncHttp.js';

type SnapshotDoc = {
  userId: string;
  schemaVersion: number;
  updatedAt: Date;
  payload: unknown;
};

function serialize(doc: SnapshotDoc | null | undefined) {
  if (!doc) return null;
  return {
    schemaVersion: doc.schemaVersion,
    updatedAt: doc.updatedAt.toISOString(),
    payload: doc.payload
  };
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

  const userId = getSyncUserId(req);
  if (!userId) {
    res.status(400).json({ error: { message: 'Missing X-Polaris-Device-Id', type: 'invalid_request' } });
    return;
  }

  try {
    const collection = await getSnapshotsCollection();

    if (req.query.list === '1') {
      const docs = await collection
        .find<SnapshotDoc>({ userId })
        .sort({ updatedAt: -1 })
        .limit(7)
        .toArray();
      res.status(200).json({ ok: true, snapshots: docs.map(serialize) });
      return;
    }

    const latest = await collection.findOne<SnapshotDoc>({ userId }, { sort: { updatedAt: -1 } });
    res.status(200).json({ ok: true, snapshot: serialize(latest) });
  } catch (error) {
    res.status(500).json({ error: { message: error instanceof Error ? error.message : 'Pull failed', type: 'server_error' } });
  }
}
