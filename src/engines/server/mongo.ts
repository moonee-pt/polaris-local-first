import { MongoClient, type Db, type Collection } from 'mongodb';

export const SYNC_DB_DEFAULT_NAME = 'polaris';

// Five tables split the previous all-in-one blob so a bad chunk cannot wipe everything,
// you can inspect each one in Atlas directly, and long chat histories only push the
// conversations that actually changed.
export const SYNC_TABLES = [
  'sync_settings',
  'sync_providers',
  'sync_collection',
  'sync_personas',
  'sync_conversations'
] as const;

export type SyncTableName = (typeof SYNC_TABLES)[number];

export type SyncRow = {
  _id: string;
  userId: string;
  data: unknown;
  updatedAt: Date;
  createdAt?: Date;
};

// Retained for backwards-compat with the old blob API; unused by the new sync path.
export const SNAPSHOTS_COLLECTION = 'snapshots';

const MAX_DOC_BYTES = 16 * 1024 * 1024;

type CachedClient = {
  uri: string;
  client: MongoClient;
  connect: Promise<Db>;
};

let cached: CachedClient | null = null;

function readEnv(name: string): string {
  const fromProcess = typeof process !== 'undefined' && process.env ? process.env[name] : undefined;
  return (fromProcess ?? '').trim();
}

export function getMongoUri(): string {
  return readEnv('MONGODB_URI') || readEnv('MONGO_URL');
}

export function getDbName(): string {
  return readEnv('MONGODB_DB') || SYNC_DB_DEFAULT_NAME;
}

export function docTooLarge(payload: unknown): boolean {
  try {
    const serialized = JSON.stringify(payload ?? {});
    return new TextEncoder().encode(serialized).length > MAX_DOC_BYTES;
  } catch {
    return true;
  }
}

// Kept so existing tests/imports continue to compile; new code uses getTableCollection.
export function snapshotsTooLarge(payload: unknown): boolean {
  return docTooLarge(payload);
}

async function getDb(): Promise<Db> {
  const uri = getMongoUri();
  if (!uri) throw new Error('MONGODB_URI is not configured');
  if (!cached || cached.uri !== uri) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    const connect = client.connect().then(() => client.db(getDbName()));
    cached = { uri, client, connect };
  }
  return cached.connect;
}

export async function getTableCollection(name: SyncTableName): Promise<Collection<SyncRow>> {
  const db = await getDb();
  const collection = db.collection<SyncRow>(name);
  await collection.createIndex({ userId: 1, updatedAt: -1 });
  return collection;
}

export async function getSnapshotsCollection(): Promise<Collection> {
  const db = await getDb();
  const collection = db.collection(SNAPSHOTS_COLLECTION);
  await collection.createIndex({ userId: 1, updatedAt: -1 });
  return collection;
}
