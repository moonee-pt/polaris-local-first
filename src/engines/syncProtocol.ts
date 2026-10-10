// Shared types between the Vercel /api/sync/* handlers and the browser client.
// Kept free of Node imports so both sides can use it.

export const SYNC_TABLES = [
  'sync_settings',
  'sync_providers',
  'sync_collection',
  'sync_personas',
  'sync_conversations'
] as const;

export type SyncTableName = (typeof SYNC_TABLES)[number];

export type SyncOp =
  | { table: SyncTableName; id: string; data: unknown; delete?: false; updatedAt?: number }
  | { table: SyncTableName; id: string; delete: true; data?: undefined; updatedAt?: number };

export type SyncDoc = {
  id: string;
  data: unknown;
  updatedAt: number;
};

export type PullResponse = {
  ok: true;
  tables: Record<SyncTableName, SyncDoc[]>;
  latestAt: number;
};

export type PushRequestBody = {
  ops: SyncOp[];
};

export type PushResponse = {
  ok: true;
  applied: number;
  latestAt: number;
};
