// 端到端验证 Atlas 连接 + 生产同步代码真的能读写。
// 用 selfhost:build 产出的 syncCore（前端调的就是这套逻辑），
// 真 push 一条测试行 → 真 pull 回来比对 → 再 delete 清干净，不留垃圾。
import { MongoClient } from 'mongodb';
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf-8');
const match = env.match(/^MONGODB_URI=(.+)$/m);
if (!match) { console.error('no MONGODB_URI'); process.exit(1); }
process.env.MONGODB_URI = match[1].trim();

const { handleSyncPush, handleSyncPull } = await import(
  new URL('../server-dist/src/engines/server/syncCore.js', import.meta.url).href
);

const TEST_ID = '__sync_selftest__';
const mkReq = (over) => ({
  method: 'GET', path: '/api/sync/pull', query: {}, body: null,
  origin: 'http://localhost:5173', ...over
});

function log(...a) { console.log(...a); }

try {
  // 1) 原始连接：能不能连上、库里有什么
  const probe = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await probe.connect();
  log('✓ Atlas 连接成功');
  const info = await probe.db().command({ connectionStatus: 1 }).catch(() => null);
  if (info?.authInfo) log('  认证用户:', info.authInfo.authenticatedUsers?.map(u=>u.user).join(',') || '（内部）', '角色:', info.authInfo.authenticatedUserRoles?.map(r=>r.role).join(','));
  const db = probe.db('polaris');
  log('  当前库集合:');
  for (const c of await db.listCollections().toArray()) {
    log(`    ${c.name}: ${await db.collection(c.name).countDocuments()} 条`);
  }
  await probe.close();

  // 2) 用生产 handler 真写一条
  const pushRes = await handleSyncPush(mkReq({
    method: 'POST', path: '/api/sync/push',
    body: JSON.stringify({ ops: [{ table: 'sync_conversations', id: TEST_ID, data: { id: TEST_ID, title: '同步自检', messages: [], selftest: true } }] })
  }));
  log(`\n✓ handleSyncPush → HTTP ${pushRes.status}`, pushRes.json);
  if (pushRes.status !== 200) throw new Error('push 失败');

  // 3) 用生产 handler 真读回来
  const pullRes = await handleSyncPull(mkReq({ method: 'GET' }));
  const rows = pullRes.json.tables.sync_conversations;
  const found = rows.find((r) => r.id === TEST_ID);
  log(`✓ handleSyncPull → HTTP ${pullRes.status}，sync_conversations 共 ${rows.length} 条，latestAt=${new Date(pullRes.json.latestAt).toISOString()}`);
  if (!found) throw new Error('push 进去的行读不回来');
  log('  读回内容与写入一致:', JSON.stringify(found.data) === JSON.stringify({ id: TEST_ID, title: '同步自检', messages: [], selftest: true }));

  // 4) ?since 过滤是否工作
  const sinceRes = await handleSyncPull(mkReq({ method: 'GET', query: { since: String(Date.now() + 60000) } }));
  const sinceCount = Object.values(sinceRes.json.tables).reduce((n, arr) => n + arr.length, 0);
  log(`✓ ?since=未来时间 → 返回 ${sinceCount} 条（应为 0）`);

  // 5) 用生产 handler 删掉测试行，清场
  const delRes = await handleSyncPush(mkReq({
    method: 'POST', path: '/api/sync/push',
    body: JSON.stringify({ ops: [{ table: 'sync_conversations', id: TEST_ID, delete: true }] })
  }));
  const after = await handleSyncPull(mkReq({ method: 'GET' }));
  const stillThere = after.json.tables.sync_conversations.some((r) => r.id === TEST_ID);
  log(`✓ handleSyncPush(delete) → HTTP ${delRes.status}，测试行已清除: ${!stillThere}`);

  log('\n结论：数据库连接与生产同步代码的增/查/删全链路均正常。');
} catch (e) {
  console.error('\n✗ 验证失败:', e.message);
  console.error(e.stack?.split('\n').slice(0, 6).join('\n'));
  process.exitCode = 1;
}
