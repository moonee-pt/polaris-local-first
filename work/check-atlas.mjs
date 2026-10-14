import { MongoClient } from 'mongodb';
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf-8');
const match = env.match(/^MONGODB_URI=(.+)$/m);
if (!match) { console.error('no MONGODB_URI'); process.exit(1); }
const uri = match[1].trim();

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
try {
  await client.connect();
  const adminDb = client.db().admin();
  const { databases } = await adminDb.listDatabases();
  console.log('Atlas 上所有库：');
  for (const d of databases) console.log(`  ${d.name}  (sizeOnDisk: ${Math.round((d.sizeOnDisk||0)/1024)} KB)`);

  const db = client.db('polaris');
  const tables = ['sync_settings','sync_providers','sync_collection','sync_personas','sync_conversations','snapshots'];
  console.log('\npolaris 库各集合计数：');
  for (const t of tables) {
    const n = await db.collection(t).countDocuments();
    console.log(`  ${t}: ${n}`);
  }

  const convos = await db.collection('sync_conversations').find({}, { projection: { _id:1, userId:1, updatedAt:1 } }).limit(5).toArray();
  console.log('\n最近 sync_conversations 样本：', convos);
} catch (e) {
  console.error('连接/读取失败:', e.message);
  console.error('栈:', e.stack);
} finally {
  await client.close();
}
