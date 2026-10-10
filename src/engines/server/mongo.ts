import { MongoClient, type Db, type Collection } from 'mongodb';

export const SYNC_DB_DEFAULT_NAME = 'polaris';
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

export function snapshotsTooLarge(payload: unknown): boolean {
  try {
    const serialized = JSON.stringify(payload ?? {});
    return new TextEncoder().encode(serialized).length > MAX_DOC_BYTES;
  } catch {
    return true;
  }
}

export async function getSnapshotsCollection(): Promise<Collection> {
  const uri = getMongoUri();
  if (!uri) {
    throw new Error('MONGODB_URI is not configured');
  }
  const dbName = getDbName();

  if (!cached || cached.uri !== uri) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    const connect = client.connect().then(() => client.db(dbName));
    cached = { uri, client, connect };
  }

  const db: Db = await cached.connect;
  const collection = db.collection(SNAPSHOTS_COLLECTION);
  await collection.createIndex({ userId: 1, updatedAt: -1 });
  return collection;
}
