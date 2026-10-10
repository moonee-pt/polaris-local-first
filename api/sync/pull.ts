import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSnapshotsCollection } from '../../src/engines/server/mongo.js';
import { applySyncCors, authorizeSyncRequest, getSyncUserId } from '../../src/engines/server/syncHttp.js';
import { decryptSnapshot, looksEncrypted } from '../../src/engines/server/syncCrypto.js';

const RETENTION_LIMIT = 7;

type SnapshotDoc = {
  userId: string;
  schemaVersion: number;
  updatedAt: Date;
  payload: unknown;
};

function serialize(doc: SnapshotDoc | null | undefined) {
  if (!doc) return null;
  const payload = looksEncrypted(doc.payload)
    ? JSON.parse(decryptSnapshot(doc.payload))
    : doc.payload;
  return {
    schemaVersion: doc.schemaVersion,
    updatedAt: doc.updatedAt.toISOString(),
    payload
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

  if (!authorizeSyncRequest(req, res)) return;

  try {
    const userId = getSyncUserId(req);
    const collection = await getSnapshotsCollection();

    if (req.query.list === '1') {
      const docs = await collection
        .find<SnapshotDoc>({ userId })
        .sort({ updatedAt: -1 })
        .limit(RETENTION_LIMIT)
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
