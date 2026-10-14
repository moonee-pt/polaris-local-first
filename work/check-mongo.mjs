import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf-8');
const match = envContent.match(/MONGODB_URI=(.+)/);
if (!match) { console.error('No MONGODB_URI in .env'); process.exit(1); }
const uri = match[1].trim();

const client = new MongoClient(uri);
try {
  await client.connect();
  console.log('Connected.');
  const db = client.db('polaris_sync');
  const tables = ['sync_settings', 'sync_providers', 'sync_collection', 'sync_personas', 'sync_conversations'];
  for (const t of tables) {
    const count = await db.collection(t).countDocuments();
    console.log(`${t}: ${count} rows`);
  }
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await client.close();
}
