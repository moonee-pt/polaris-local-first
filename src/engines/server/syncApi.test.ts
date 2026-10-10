import { describe, expect, it, vi } from 'vitest';

const insertOne = vi.fn().mockResolvedValue({ insertedId: 'id-1' });
const deleteMany = vi.fn().mockResolvedValue({ deletedCount: 0 });
const findOne = vi.fn();
const toArray = vi.fn().mockResolvedValue([]);
const limit = vi.fn().mockReturnValue({ toArray });
const sort = vi.fn().mockReturnValue({ skip: vi.fn().mockReturnValue({ project: vi.fn().mockReturnValue({ toArray }) }), limit });
const project = vi.fn();
const find = vi.fn().mockReturnValue({ sort });
const createIndex = vi.fn().mockResolvedValue(undefined);

vi.mock('./mongo.js', () => ({
  getSnapshotsCollection: vi.fn(async () => ({ insertOne, deleteMany, findOne, find, createIndex, project })),
  snapshotsTooLarge: vi.fn(() => false)
}));

import pushHandler from '../../../api/sync/push';
import pullHandler from '../../../api/sync/pull';

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
  headers: { origin: 'https://qoder.zone', 'x-polaris-device-id': 'device-abc' },
  body: { schemaVersion: 1, payload: { chat: {} } },
  query: {},
  ...over
} as any);

describe('api/sync/push', () => {
  it('rejects requests without a device id', async () => {
    const res = makeRes();
    await pushHandler(req({ headers: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects an empty payload', async () => {
    const res = makeRes();
    await pushHandler(req({ body: { payload: null } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('stores a snapshot and trims history', async () => {
    const res = makeRes();
    await pushHandler(req(), res);
    expect(insertOne).toHaveBeenCalledWith(expect.objectContaining({ userId: 'device-abc', schemaVersion: 1 }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
  });
});

describe('api/sync/pull', () => {
  it('returns the latest snapshot', async () => {
    findOne.mockResolvedValue({ userId: 'device-abc', schemaVersion: 1, updatedAt: new Date('2026-10-10T00:00:00Z'), payload: { chat: 1 } });
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
