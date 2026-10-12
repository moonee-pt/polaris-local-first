import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CORS_METHODS, handleSyncPush, type SyncResponse } from '../../src/engines/server/syncCore.js';

function writeSyncResponse(res: VercelResponse, result: SyncResponse) {
  if (result.corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', result.corsOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', CORS_METHODS.push);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (result.json === undefined) {
    res.status(result.status).end();
    return;
  }
  res.status(result.status).json(result.json);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  writeSyncResponse(res, await handleSyncPush({
    method: req.method ?? 'GET',
    path: req.url ?? '',
    query: (req.query ?? {}) as Record<string, string>,
    body: req.body,
    origin: req.headers.origin || ''
  }));
}
