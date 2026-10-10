import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAllowedPolarisApiOrigin } from './corsOrigin.js';
import { getSyncSecret } from './syncSecret.js';

// Single-tenant personal app: every device shares one private data slot.
export const SYNC_OWNER_ID = 'owner';

export function applySyncCors(req: VercelRequest, res: VercelResponse, methods: string) {
  const origin = req.headers.origin || '';
  if (isAllowedPolarisApiOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Polaris-Device-Id, X-Polaris-Sync-Token');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// Constant-time comparison to avoid leaking the token through timing.
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Returns true when the request carries the correct built-in sync token; otherwise
// writes a 401 and returns false.
export function authorizeSyncRequest(req: VercelRequest, res: VercelResponse): boolean {
  const secret = getSyncSecret();
  const provided = (req.headers['x-polaris-sync-token'] as string | undefined)?.trim() ?? '';
  if (!secret || !provided || !tokenMatches(provided, secret)) {
    res.status(401).json({ error: { message: 'Unauthorized', type: 'unauthorized' } });
    return false;
  }
  return true;
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
