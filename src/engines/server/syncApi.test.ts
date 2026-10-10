import { beforeEach, describe, expect, it, vi } from 'vitest';

type TableMock = {
  updateOne: ReturnType<typeof vi.fn>;
  deleteOne: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  createIndex: ReturnType<typeof vi.fn>;
};

function makeTable(rows: Array<{ _id: string; updatedAt: Date; data: unknown }> = []): TableMock {
  const toArray = vi.fn().mockResolvedValue(rows);
  return {
    updateOne: vi.fn().mockResolvedValue({ upsertedId: 'x' }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    find: vi.fn().mockReturnValue({ toArray }),
    createIndex: vi.fn().mockResolvedValue(undefined)
  };
}

const tables: Record<string, TableMock> = {};
function getTable(name: string): TableMock {
  if (!tables[name]) tables[name] = makeTable();
  return tables[name];
}

vi.mock('./mongo.js', () => ({
  getTableCollection: vi.fn(async (name: string) => getTable(name)),
  getSnapshotsCollection: vi.fn(async () => getTable('snapshots')),
  docTooLarge: vi.fn(() => false),
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
  headers: { origin: 'https://qoder.zone' },
  body: { ops: [] },
  query: {},
  ...over
} as any);

describe('api/sync/push (table ops)', () => {
  it('rejects non-POST', async () => {
    const res = makeRes();
    await pushHandler(req({ method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects a missing ops array', async () => {
    const res = makeRes();
    await pushHandler(req({ body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects an op with an unknown table name', async () => {
    const res = makeRes();
    await pushHandler(
      req({ body: { ops: [{ table: 'sync_bogus', id: 'x', data: 1 }] } }),
      res
    );
    expect(res.statusCode).toBe(400);
  });

  it('upserts settings and conversations with owner scope', async () => {
    for (const key of Object.keys(tables)) delete tables[key];
    const res = makeRes();
    await pushHandler(
      req({
        body: {
          ops: [
            { table: 'sync_settings', id: 'global', data: { spaceState: { theme: 'dark' } } },
            { table: 'sync_conversations', id: 'c-1', data: { id: 'c-1', title: 'hi', messages: [] } }
          ]
        }
      }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, applied: 2 });
    expect(getTable('sync_settings').updateOne).toHaveBeenCalledWith(
      { userId: 'owner', _id: 'global' },
      expect.objectContaining({ $set: expect.objectContaining({ userId: 'owner' }) }),
      { upsert: true }
    );
    expect(getTable('sync_conversations').updateOne).toHaveBeenCalled();
  });

  it('deletes a row when op.delete is true', async () => {
    for (const key of Object.keys(tables)) delete tables[key];
    const res = makeRes();
    await pushHandler(req({ body: { ops: [{ table: 'sync_personas', id: 'p-9', delete: true }] } }), res);
    expect(getTable('sync_personas').deleteOne).toHaveBeenCalledWith({ userId: 'owner', _id: 'p-9' });
    expect(getTable('sync_personas').updateOne).not.toHaveBeenCalled();
  });
});

describe('api/sync/pull (all tables)', () => {
  beforeEach(() => {
    for (const key of Object.keys(tables)) delete tables[key];
  });

  it('rejects non-GET', async () => {
    const res = makeRes();
    await pullHandler(req({ method: 'POST' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('returns every table with owner-scoped rows and a latestAt marker', async () => {
    tables.sync_settings = makeTable([
      { _id: 'global', updatedAt: new Date('2026-10-10T00:00:00Z'), data: { spaceState: { theme: 'light' } } }
    ]);
    tables.sync_conversations = makeTable([
      { _id: 'c-1', updatedAt: new Date('2026-10-11T00:00:00Z'), data: { id: 'c-1', messages: [] } }
    ]);
    const res = makeRes();
    await pullHandler(req({ method: 'GET', body: undefined }), res);
    expect(res.statusCode).toBe(200);
    const body = res.body as any;
    expect(body.ok).toBe(true);
    expect(body.tables.sync_settings).toEqual([
      { id: 'global', data: { spaceState: { theme: 'light' } }, updatedAt: Date.parse('2026-10-10T00:00:00Z') }
    ]);
    expect(body.tables.sync_conversations[0].id).toBe('c-1');
    expect(body.latestAt).toBe(Date.parse('2026-10-11T00:00:00Z'));
  });

  it('filters by updatedAt when ?since is provided', async () => {
    tables.sync_conversations = makeTable();
    const res = makeRes();
    await pullHandler(req({ method: 'GET', query: { since: '1700000000000' }, body: undefined }), res);
    const find = getTable('sync_conversations').find;
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'owner',
      updatedAt: { $gt: new Date(1700000000000) }
    }));
    expect(res.statusCode).toBe(200);
  });
});
