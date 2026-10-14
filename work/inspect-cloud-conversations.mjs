import { MongoClient } from 'mongodb';
import { readFileSync } from 'node:fs';
const env = readFileSync(new URL('../.env', import.meta.url), 'utf-8');
const uri = env.match(/^MONGODB_URI=(.+)$/m)[1].trim();
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
await client.connect();
const db = client.db('polaris');
const convos = await db.collection('sync_conversations').find({}).sort({ updatedAt: -1 }).toArray();
console.log(`sync_conversations 现有 ${convos.length} 条：`);
for (const c of convos) {
  const d = c.data ?? {};
  const msgs = Array.isArray(d.messages) ? d.messages : [];
  console.log('\n================================================');
  console.log('id       :', c._id);
  console.log('标题     :', d.title ?? d.name ?? '（无）');
  console.log('updatedAt:', c.updatedAt ? new Date(c.updatedAt).toISOString() : '（无）');
  console.log('createdAt:', c.createdAt ? new Date(c.createdAt).toISOString() : '（无）');
  console.log('消息数   :', msgs.length);
  console.log('字节数   :', JSON.stringify(d).length);
  msgs.slice(0, 6).forEach((m, i) => {
    const role = m.role ?? m.sender ?? '?';
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '').slice(0, 200);
    console.log(`  [${i}] ${role}: ${content.slice(0, 160).replace(/\n/g, ' ')}`);
  });
  if (msgs.length > 6) console.log(`  … 还有 ${msgs.length - 6} 条`);
}
const personas = await db.collection('sync_personas').find({}).toArray();
console.log(`\nsync_personas ${personas.length} 条：`, personas.map(p => `${p._id}${p.data?.name ? '(' + p.data.name + ')' : ''}`).join(', '));
await client.close();
