import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CORS_METHODS, handleSyncPull, type SyncResponse } from '../../src/engines/server/syncCore.js';

function writeSyncResponse(res: VercelResponse, result: SyncResponse) {
  if (result.corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', result.corsOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', CORS_METHODS.pull);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (result.json === undefined) {
    res.status(result.status).end();
    return;
  }
  res.status(result.status).json(result.json);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query ?? {})) {
    query[key] = Array.isArray(value) ? (value[0] ?? '') : String(value ?? '');
  }
  writeSyncResponse(res, await handleSyncPull({
    method: req.method ?? 'GET',
    path: req.url ?? '',
    query,
    body: null,
    origin: req.headers.origin || ''
  }));
}
