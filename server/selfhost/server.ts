import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { handleSyncPull, handleSyncPush, type SyncRequest } from '../../src/engines/server/syncCore.js';

// Self-hostable Polaris API + static frontend. This is the platform-independent alternative
// to the Vercel serverless functions: it runs the *same* sync core against the same MongoDB
// Atlas cluster, so pointing the frontend at this server (VITE_POLARIS_API_ORIGIN) — or just
// serving dist/ and the API from one host — needs no data migration. Move hosts freely; the
// database and this file are the whole backend.
//
// Env:
//   MONGODB_URI   MongoDB Atlas connection string (same value as on Vercel).
//   PORT          Listen port (default 8787).
//   HOST          Bind host (default 0.0.0.0).
//   STATIC_DIR    Built frontend directory to serve (default ./dist).

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? 'dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

function readRawBody(req: IncomingMessage): Promise<string | null> {
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') return Promise.resolve(null);
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf-8') || null));
    req.on('error', rejectBody);
  });
}

function toSyncRequest(req: IncomingMessage, rawBody: string | null): SyncRequest {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams) query[key] = value;
  return {
    method: req.method ?? 'GET',
    path: url.pathname,
    query,
    body: rawBody,
    origin: (req.headers.origin as string) || ''
  };
}

function applyCors(res: ServerResponse, corsOrigin: string | null) {
  if (corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

async function serveStatic(pathname: string, res: ServerResponse): Promise<void> {
  const safeRel = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(STATIC_DIR, safeRel);
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, 'index.html');
    const body = await readFile(filePath);
    res.setHeader('Content-Type', MIME_TYPES[extname(filePath)] ?? 'application/octet-stream');
    res.writeHead(200);
    res.end(body);
  } catch {
    // Single-page app fallback: unknown paths render index.html.
    try {
      const fallback = await readFile(join(STATIC_DIR, 'index.html'));
      res.setHeader('Content-Type', MIME_TYPES['.html']);
      res.writeHead(200);
      res.end(fallback);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;

  if (pathname === '/api/sync/push' || pathname === '/api/sync/pull') {
    const isPush = pathname === '/api/sync/push';
    res.setHeader('Access-Control-Allow-Methods', isPush ? 'POST, OPTIONS' : 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
      applyCors(res, null);
      res.writeHead(204);
      res.end();
      return;
    }
    let result;
    try {
      const rawBody = await readRawBody(req);
      result = isPush
        ? await handleSyncPush(toSyncRequest(req, rawBody))
        : await handleSyncPull(toSyncRequest(req, rawBody));
    } catch (error) {
      applyCors(res, null);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: { message: error instanceof Error ? error.message : 'Sync failed', type: 'server_error' } }));
      return;
    }
    applyCors(res, result.corsOrigin);
    if (result.json === undefined) {
      res.writeHead(result.status);
      res.end();
      return;
    }
    res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result.json));
    return;
  }

  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  await serveStatic(pathname === '/' ? '/index.html' : pathname, res);
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Polaris selfhost server listening on http://${HOST}:${PORT} (static dir: ${STATIC_DIR})`);
});
