import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAllowedPolarisApiOrigin } from './corsOrigin.js';

export function applySyncCors(req: VercelRequest, res: VercelResponse, methods: string) {
  const origin = req.headers.origin || '';
  if (isAllowedPolarisApiOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Polaris-Device-Id');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function getSyncUserId(req: VercelRequest): string | null {
  const deviceId = (req.headers['x-polaris-device-id'] as string | undefined)?.trim();
  return deviceId || null;
}

export function parseSyncBody(req: VercelRequest): unknown {
  if (typeof req.body === 'string') {
    return req.body.trim() ? JSON.parse(req.body) : {};
  }
  return req.body ?? {};
}
