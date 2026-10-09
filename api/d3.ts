import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Capacitor } from '@capacitor/core';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: 'capacitor', hasCapacitor: typeof Capacitor === 'object' });
}
