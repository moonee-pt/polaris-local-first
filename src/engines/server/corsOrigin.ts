const POLARIS_API_ALLOWED_ORIGINS = new Set([
  'capacitor://localhost',
  'polaris://app',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
  'http://localhost:5173',
  'http://127.0.0.1',
  'https://127.0.0.1',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173',
  'https://qoder.zone',
  'https://www.qoder.zone'
]);

export function isAllowedPolarisApiOrigin(origin: string) {
  if (!origin) return false;
  if (POLARIS_API_ALLOWED_ORIGINS.has(origin)) return true;
  if (/^https:\/\/[\w-]+\.vercel\.app$/i.test(origin)) return true;
  const extra = readExtraOrigins();
  return extra.size > 0 && extra.has(origin);
}

function readExtraOrigins(): Set<string> {
  const raw = typeof process !== 'undefined' && process.env ? process.env.POLARIS_API_EXTRA_ORIGINS : undefined;
  if (!raw) return new Set();
  return new Set(raw.split(',').map((entry) => entry.trim().replace(/\/+$/, '')).filter(Boolean));
}
