import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateProviderAudioRelayTarget } from '../server/providerAudioRelayTarget.js';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: 'server/providerAudioRelayTarget', hasValidator: typeof validateProviderAudioRelayTarget === 'function' });
}
