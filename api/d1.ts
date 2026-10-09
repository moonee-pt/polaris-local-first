import type { VercelRequest, VercelResponse } from '@vercel/node';
import { once } from 'node:events';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: 'node:events', hasOnce: typeof once === 'function' });
}
