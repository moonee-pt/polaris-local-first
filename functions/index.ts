// Polaris 语音转发云函数（Sites edge / Deno 运行时，零依赖自包含）。
// 路由：POST <...>/audio  body: { endpoint, headers, body }
// 安全边界：只转发到公开 HTTPS 的语音服务商端点白名单，拒绝内网目标，要求上游认证头。

const FORBIDDEN_RELAY_HEADER_NAMES = new Set([
  'connection',
  'content-length',
  'host',
  'origin',
  'referer',
  'transfer-encoding'
]);

const PROVIDER_RELAY_AUTH_HEADER_NAMES = new Set([
  'authorization',
  'x-api-key',
  'x-goog-api-key',
  'xi-api-key'
]);

const ALLOWED_ORIGINS = new Set([
  'capacitor://localhost',
  'polaris://app',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
  'http://localhost:5173',
  'https://localhost:5173',
  'http://127.0.0.1',
  'https://127.0.0.1',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173'
]);

const UPSTREAM_TIMEOUT_MS = 60_000;
const MAX_RELAY_BODY_BYTES = 256 * 1024;

function json(status: number, payload: unknown, corsHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders
    }
  });
}

function isPrivateHostname(hostname: string) {
  const lower = hostname.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (!lower) return true;
  if (lower === 'localhost' || lower.endsWith('.local')) return true;
  const mappedIpv4 = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4) return isPrivateHostname(mappedIpv4[1]);
  if (lower === '::' || lower === '::1') return true;
  if (lower.includes(':') && (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:'))) {
    return true;
  }
  const ipv4 = lower.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
  }
  return false;
}

function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, '').toLowerCase();
}

function isAllowedAudioRelayPath(pathname: string) {
  const path = normalizePath(pathname);
  return path.endsWith('/audio/speech')
    || path.endsWith('/t2a_v2')
    || path.endsWith('/get_voice')
    || path.endsWith('/voice_design')
    || path.endsWith('/tts')
    || /^\/v\d+\/text-to-speech\/[^/]+$/.test(path);
}

function validateRelayEndpoint(endpoint: string): URL | string {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return '语音 relay 目标地址无效。';
  }
  if (parsed.protocol !== 'https:') return '语音 relay 只接受 HTTPS 目标。';
  if (isPrivateHostname(parsed.hostname)) return '语音 relay 目标不能是本地或内网地址。';
  if (!isAllowedAudioRelayPath(parsed.pathname)) {
    return '语音 relay 只接受公开语音生成或音色管理接口。';
  }
  return parsed;
}

async function assertResolvedPublic(parsed: URL) {
  // DNS 解析二次校验，防 DNS 重绑定指向内网。解析 API 不可用时放行（协议/路径白名单仍生效）。
  try {
    const records: string[] = [];
    for (const recordType of ['A', 'AAAA']) {
      try {
        records.push(...(await Deno.resolveDns(parsed.hostname, recordType)));
      } catch {
        // 单类型失败忽略，交由另一类型与 fetch 阶段处理
      }
    }
    if (!records.length) return;
    if (records.some((record) => isPrivateHostname(record))) {
      return '语音 relay 目标解析到了本地或内网地址。';
    }
  } catch {
    return;
  }
  return;
}

function isRelayableRequestBody(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const isNonEmptyString = (input: unknown) => typeof input === 'string' && input.trim().length > 0;

  // OpenAI 兼容 /audio/speech
  if (isNonEmptyString(record.model) && isNonEmptyString(record.input) && isNonEmptyString(record.voice)) return true;
  // MiniMax /t2a_v2 与音色管理
  if (isNonEmptyString(record.model) && isNonEmptyString(record.text) && record.stream === false && record.output_format === 'hex') return true;
  if (['system', 'voice_cloning', 'voice_generation', 'all'].includes(String(record.voice_type))) return true;
  if (isNonEmptyString(record.prompt) && isNonEmptyString(record.preview_text) && record.preview_text.length <= 500) return true;
  // ElevenLabs / FishAudio
  if (isNonEmptyString(record.text)) return true;
  return false;
}

function sanitizeRelayHeaders(rawHeaders: unknown): Record<string, string> {
  if (!rawHeaders || typeof rawHeaders !== 'object' || Array.isArray(rawHeaders)) return {};
  const result: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(rawHeaders as Record<string, unknown>)) {
    const key = rawKey.trim().toLowerCase();
    const value = typeof rawValue === 'string' ? rawValue : '';
    if (!key || !value.trim()) continue;
    if (FORBIDDEN_RELAY_HEADER_NAMES.has(key)) continue;
    if (key.startsWith('x-forwarded-')) continue;
    result[key] = value;
  }
  return result;
}

function hasAuthHeader(headers: Record<string, string>) {
  return Object.keys(headers).some((key) => PROVIDER_RELAY_AUTH_HEADER_NAMES.has(key));
}

function corsHeadersFor(origin: string) {
  if (!origin) return {};
  if (ALLOWED_ORIGINS.has(origin) || /^https:\/\/[\w-]+\.qoder\.zone$/i.test(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };
  }
  return {};
}

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const cors = corsHeadersFor(request.headers.get('origin') || '');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (!url.pathname.endsWith('/audio')) {
    return json(404, { error: { message: '未找到该接口。', type: 'not_found' } }, cors);
  }

  if (request.method !== 'POST') {
    return json(405, { error: { message: 'Method not allowed', type: 'invalid_request' } }, cors);
  }

  let payload: { endpoint?: unknown; headers?: unknown; body?: unknown };
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_RELAY_BODY_BYTES) {
      return json(413, { error: { message: '语音 relay 请求体过大。', type: 'invalid_request' } }, cors);
    }
    payload = JSON.parse(raw);
  } catch {
    return json(400, { error: { message: '语音 relay 请求体必须是合法 JSON。', type: 'invalid_request' } }, cors);
  }

  const endpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : '';
  const validated = validateRelayEndpoint(endpoint);
  if (typeof validated === 'string') {
    return json(400, { error: { message: validated, type: 'invalid_upstream' } }, cors);
  }
  const dnsIssue = await assertResolvedPublic(validated);
  if (typeof dnsIssue === 'string') {
    return json(400, { error: { message: dnsIssue, type: 'invalid_upstream' } }, cors);
  }

  if (!isRelayableRequestBody(payload.body)) {
    return json(400, { error: { message: '语音 relay 请求体必须是受支持的语音生成或音色管理请求。', type: 'invalid_request' } }, cors);
  }

  const relayHeaders = sanitizeRelayHeaders(payload.headers);
  if (!hasAuthHeader(relayHeaders)) {
    return json(400, { error: { message: '语音 relay 请求缺少上游认证头。', type: 'missing_upstream_auth' } }, cors);
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(validated.toString(), {
      method: 'POST',
      headers: { ...relayHeaders, 'content-type': relayHeaders['content-type'] ?? 'application/json' },
      body: JSON.stringify(payload.body),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? '语音上游接口响应超时。'
      : '语音 relay 请求失败。';
    return json(502, { error: { message, type: 'relay_error' } }, cors);
  }

  const headers = new Headers();
  const contentType = upstreamResponse.headers.get('content-type');
  headers.set('Cache-Control', 'no-store, no-transform');
  if (contentType) headers.set('Content-Type', contentType);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers
  });
}

// @ts-ignore Deno edge 运行时入口
Deno.serve(handler);
