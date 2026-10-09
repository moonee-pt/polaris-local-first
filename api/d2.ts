import type { VercelRequest, VercelResponse } from '@vercel/node';
import { lookup } from 'node:dns/promises';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: 'node:dns/promises', hasLookup: typeof lookup === 'function' });
}
