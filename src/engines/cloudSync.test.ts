import { describe, expect, it } from 'vitest';
import { buildOps, filterWipedDeviceOps, hashData, retainProtectedRows, type Row } from './cloudSync';
import { SYNC_TABLES, type SyncOp } from './syncProtocol';

type HashCache = Record<(typeof SYNC_TABLES)[number], Record<string, string>>;

function emptyCache(): HashCache {
  return Object.fromEntries(SYNC_TABLES.map((t) => [t, {}])) as HashCache;
}

function cacheWith(conversations: string[], personas: string[] = []): HashCache {
  const c = emptyCache();
  for (const id of conversations) c.sync_conversations[id] = hashData({ id });
  for (const id of personas) c.sync_personas[id] = hashData({ id });
  return c;
}

describe('filterWipedDeviceOps', () => {
  it('drops conversation/persona deletions when the local store looks wiped', () => {
    const previous = cacheWith(['c1', 'c2'], ['p1']);
    const rows: Row[] = [
      { table: 'sync_personas', id: 'meta', data: {} }
    ];
    const { ops } = buildOps(rows, previous);
    const deletesBefore = ops.filter((op) => op.delete).length;
    expect(deletesBefore).toBeGreaterThan(0);
    const safe = filterWipedDeviceOps(ops, rows, previous);
    const wipedDeletes = safe.filter((op) => op.delete && (op.table === 'sync_conversations' || op.table === 'sync_personas'));
    expect(wipedDeletes).toHaveLength(0);
  });

  it('keeps genuine single-row deletions when the local store still has conversations', () => {
    const previous = cacheWith(['c1', 'c2']);
    const rows: Row[] = [
      { table: 'sync_conversations', id: 'c1', data: { id: 'c1' } }
    ];
    const { ops } = buildOps(rows, previous);
    const safe = filterWipedDeviceOps(ops, rows, previous);
    const del = safe.find((op): op is SyncOp & { delete: true } => Boolean(op.delete) && op.id === 'c2');
    expect(del).toBeDefined();
  });

  it('retainProtectedRows keeps wiped rows in the cache so the guard keeps firing', () => {
    const previous = cacheWith(['c1'], []);
    const next = emptyCache();
    const safeOps = filterWipedDeviceOps(buildOps([], previous).ops, [], previous);
    const retained = retainProtectedRows(next, safeOps, previous);
    expect(retained.sync_conversations.c1).toBe(previous.sync_conversations.c1);
  });
});
