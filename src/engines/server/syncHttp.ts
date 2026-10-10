import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAllowedPolarisApiOrigin } from './corsOrigin.js';

// Single-tenant personal app: every device shares one private data slot.
export const SYNC_OWNER_ID = 'owner';

export function applySyncCors(req: VercelRequest, res: VercelResponse, methods: string) {
  const origin = req.headers.origin || '';
  if (isAllowedPolarisApiOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function getSyncUserId(_req: VercelRequest): string {
  return SYNC_OWNER_ID;
}

export function parseSyncBody(req: VercelRequest): unknown {
  if (typeof req.body === 'string') {
    return req.body.trim() ? JSON.parse(req.body) : {};
  }
  return req.body ?? {};
}
