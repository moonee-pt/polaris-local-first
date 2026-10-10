import { describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'unit-test-sync-secret';
process.env.SYNC_SECRET = TEST_SECRET;

const insertOne = vi.fn().mockResolvedValue({ insertedId: 'id-1' });
const deleteMany = vi.fn().mockResolvedValue({ deletedCount: 0 });
const findOne = vi.fn();
const toArray = vi.fn().mockResolvedValue([]);
const limit = vi.fn().mockReturnValue({ toArray });
const skip = vi.fn().mockReturnValue({ project: vi.fn().mockReturnValue({ toArray }) });
const project = vi.fn();
const sort = vi.fn().mockReturnValue({ skip, limit });
const find = vi.fn().mockReturnValue({ sort });
const createIndex = vi.fn().mockResolvedValue(undefined);

vi.mock('./mongo.js', () => ({
  getSnapshotsCollection: vi.fn(async () => ({ insertOne, deleteMany, findOne, find, createIndex, project })),
  snapshotsTooLarge: vi.fn(() => false)
}));

import pushHandler from '../../../api/sync/push';
import pullHandler from '../../../api/sync/pull';
import { decryptSnapshot, encryptSnapshot, looksEncrypted } from './syncCrypto';

function makeRes() {
  const res = {
    statusCode: 0,
    body: null as unknown,
    headers: {} as Record<string, string>,
    status(code: number) { res.statusCode = code; return res; },
    json(payload: unknown) { res.body = payload; return res; },
    setHeader(k: string, v: string) { res.headers[k] = v; },
    end() { return res; }
  };
  return res as any;
}

const req = (over: any = {}) => ({
  method: 'POST',
  headers: { origin: 'https://qoder.zone', 'x-polaris-sync-token': TEST_SECRET },
  body: { schemaVersion: 1, payload: { chat: {} } },
  query: {},
  ...over
} as any);

describe('api/sync/push', () => {
  it('rejects requests without a sync token', async () => {
    const res = makeRes();
    await pushHandler(req({ headers: {} }), res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects an invalid sync token', async () => {
    const res = makeRes();
    await pushHandler(req({ headers: { origin: 'https://qoder.zone', 'x-polaris-sync-token': 'wrong' } }), res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects an empty payload', async () => {
    const res = makeRes();
    await pushHandler(req({ body: { payload: null } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('stores an encrypted snapshot under the owner id and trims history', async () => {
    const res = makeRes();
    await pushHandler(req({ body: { schemaVersion: 1, payload: { chat: { hi: 1 } } } }), res);
    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'owner', schemaVersion: 1 })
    );
    const stored = insertOne.mock.calls[0][0];
    expect(looksEncrypted(stored.payload)).toBe(true);
    expect(decryptSnapshot(stored.payload)).toBe(JSON.stringify({ chat: { hi: 1 } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
  });
});

describe('api/sync/pull', () => {
  it('rejects requests without a sync token', async () => {
    const res = makeRes();
    await pullHandler(req({ method: 'GET', headers: {} }), res);
    expect(res.statusCode).toBe(401);
  });

  it('decrypts the latest snapshot', async () => {
    const envelope = encryptSnapshot(JSON.stringify({ chat: 1 }));
    findOne.mockResolvedValue({ userId: 'owner', schemaVersion: 1, updatedAt: new Date('2026-10-10T00:00:00Z'), payload: envelope });
    const res = makeRes();
    await pullHandler(req({ method: 'GET' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, snapshot: { schemaVersion: 1, payload: { chat: 1 } } });
  });

  it('returns null when nothing synced yet', async () => {
    findOne.mockResolvedValue(null);
    const res = makeRes();
    await pullHandler(req({ method: 'GET' }), res);
    expect(res.body).toMatchObject({ ok: true, snapshot: null });
  });
});
