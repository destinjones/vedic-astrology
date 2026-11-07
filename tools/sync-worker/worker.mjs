/**
 * The explorer's optional encrypted sync store, as a Cloudflare Worker on KV.
 * It keeps opaque envelopes by a random sync ID and nothing else: browsers
 * encrypt before sending, so this never sees a passphrase, a name or a birth.
 * The request shapes are in SPEC.md next to this file.
 *
 * Bindings (wrangler.toml):
 *   SYNC          KV namespace
 *   LIMITER       rate-limit binding, keyed by sync ID (optional; an in-memory limiter is used without it)
 *   ALLOW_ORIGIN  allowed site origins, comma-separated, e.g. "https://jyotisha.app,https://destinjones.github.io"
 *                 (default *). There are no cookies, so no Allow-Credentials.
 *   SYNC_DISABLED "1" answers 503 to everything: the kill switch. Clients then fall back to file sync.
 */

export const LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  maxBlobsPerId: 50,
  ttlSeconds: 180 * 24 * 3600,
  /** requests per ID per minute, when no LIMITER binding exists */
  perMinute: 60,
};

const ID = /^[0-9a-f]{32}$/;
const SLOT = /^[a-z0-9_-]{1,32}$/;

const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

function allowOrigin(env) {
  const list = String(env.ALLOW_ORIGIN || '*').split(',').map((o) => o.trim()).filter(Boolean);
  if (list.includes('*')) return '*';
  return list.includes(env.requestOrigin) ? env.requestOrigin : list[0];
}
function cors(env) {
  return {
    'Access-Control-Allow-Origin': allowOrigin(env),
    'Access-Control-Allow-Methods': 'GET, HEAD, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, If-Match, If-None-Match',
    'Access-Control-Expose-Headers': 'ETag, Last-Modified, Retry-After',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  };
}

const say = (env, status, body = null, extra = {}) =>
  new Response(body === null ? null : typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { ...cors(env), ...(body !== null && typeof body !== 'string' ? { 'Content-Type': 'application/json' } : {}), ...extra },
  });

/* A fallback limiter for local runs. On Cloudflare, bind LIMITER instead: isolates do not share memory. */
const windows = new Map();
function memoryLimit(key, now = Date.now()) {
  const w = windows.get(key);
  if (!w || now - w.start > 60_000) { windows.set(key, { start: now, n: 1 }); if (windows.size > 10_000) windows.clear(); return true; }
  return ++w.n <= LIMITS.perMinute;
}

/** a strong ETag: the first 128 bits of the body's SHA-256 */
const etagOf = async (bytes) => `"${hex(await crypto.subtle.digest('SHA-256', bytes)).slice(0, 32)}"`;
const matches = (header, etag) => !!header && header.split(',').map((s) => s.trim().replace(/^W\//, '')).some((t) => t === '*' || t === etag);

/** only what the app sends: an encrypted envelope, never readable data */
function looksSealed(bytes) {
  try {
    const env = JSON.parse(new TextDecoder().decode(bytes));
    return env && env.format === 'jyotisha-sync' && typeof env.iv === 'string' && typeof env.data === 'string' && typeof env.kdf === 'object'
      && Object.keys(env).every((k) => ['format', 'v', 'kdf', 'iv', 'data', 'at'].includes(k));
  } catch { return false; }
}

async function listSlots(env, id) {
  const out = [];
  let cursor;
  do {
    const page = await env.SYNC.list({ prefix: `${id}/`, cursor });
    out.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && out.length <= LIMITS.maxBlobsPerId);
  return out;
}

export default {
  async fetch(req, bindings) {
    // per-request view of the bindings that also knows the caller's Origin, for CORS
    const env = Object.assign(Object.create(bindings), { requestOrigin: req.headers.get('Origin') ?? '' });
    if (env.SYNC_DISABLED === '1') return say(env, 503, { error: 'sync is switched off; use file sync' }, { 'Retry-After': '3600' });
    if (req.method === 'OPTIONS') return say(env, 204);

    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    if (path === '' || path === '/') return say(env, 200, 'Encrypted sync store for Jyotisha Explorer. See SPEC.md in tools/sync-worker of the source.\n', { 'Content-Type': 'text/plain; charset=utf-8' });
    // the client probes this before syncing; a 503 above or any failure here means "use files"
    if (path === '/v1/health') return say(env, 200, { ok: true });
    const m = /^\/v1\/([^/]+)(?:\/([^/]+))?$/.exec(path);
    if (!m || !ID.test(m[1]) || (m[2] !== undefined && !SLOT.test(m[2]))) return say(env, 404, { error: 'not found' });
    const [, id, slot] = m;

    const allowed = env.LIMITER ? (await env.LIMITER.limit({ key: id })).success : memoryLimit(id);
    if (!allowed) return say(env, 429, { error: 'too many requests for this sync ID' }, { 'Retry-After': '60' });

    if (slot === undefined) {
      if (req.method === 'GET') {
        const keys = await listSlots(env, id);
        return say(env, 200, { slots: keys.map((k) => ({ slot: k.name.slice(id.length + 1), etag: k.metadata?.etag ?? null, updated: k.metadata?.updated ?? null })) });
      }
      if (req.method === 'DELETE') {
        for (const k of await listSlots(env, id)) await env.SYNC.delete(k.name);
        return say(env, 204);
      }
      return say(env, 405, { error: 'method not allowed' }, { Allow: 'GET, DELETE, OPTIONS' });
    }

    const key = `${id}/${slot}`;
    if (req.method === 'GET' || req.method === 'HEAD') {
      const { value, metadata } = await env.SYNC.getWithMetadata(key, 'arrayBuffer');
      if (value === null) return say(env, 404, { error: 'nothing stored' });
      const head = { ETag: metadata?.etag ?? '', 'Last-Modified': new Date(metadata?.updated ?? Date.now()).toUTCString() };
      if (matches(req.headers.get('If-None-Match'), head.ETag)) return say(env, 304, null, head);
      return new Response(req.method === 'HEAD' ? null : value, { status: 200, headers: { ...cors(env), 'Content-Type': 'application/octet-stream', ...head } });
    }

    if (req.method === 'PUT') {
      const ifMatch = req.headers.get('If-Match');
      const ifNone = req.headers.get('If-None-Match');
      if (!ifMatch && ifNone !== '*') return say(env, 428, { error: 'send If-Match with the ETag you read, or If-None-Match: * to create' });
      if (Number(req.headers.get('Content-Length') ?? 0) > LIMITS.maxBytes) return say(env, 413, { error: `blobs are limited to ${LIMITS.maxBytes} bytes` });
      const body = new Uint8Array(await req.arrayBuffer());
      if (body.byteLength > LIMITS.maxBytes) return say(env, 413, { error: `blobs are limited to ${LIMITS.maxBytes} bytes` });
      if (!looksSealed(body)) return say(env, 400, { error: 'only encrypted sync envelopes are accepted' });

      const current = await env.SYNC.getWithMetadata(key, 'arrayBuffer');
      const exists = current.value !== null;
      if (ifNone === '*' && exists) return say(env, 412, { error: 'already exists; read it and send If-Match' }, { ETag: current.metadata?.etag ?? '' });
      if (ifMatch && (!exists || !matches(ifMatch, current.metadata?.etag))) return say(env, 412, { error: 'changed since you read it' }, exists ? { ETag: current.metadata?.etag ?? '' } : {});
      if (!exists && (await listSlots(env, id)).length >= LIMITS.maxBlobsPerId) return say(env, 409, { error: `a sync ID holds at most ${LIMITS.maxBlobsPerId} blobs` });

      const etag = await etagOf(body);
      const updated = Date.now();
      await env.SYNC.put(key, body, { expirationTtl: LIMITS.ttlSeconds, metadata: { etag, updated } });
      return say(env, exists ? 200 : 201, { etag, updated: new Date(updated).toISOString() }, { ETag: etag });
    }

    if (req.method === 'DELETE') {
      await env.SYNC.delete(key);
      return say(env, 204);
    }
    return say(env, 405, { error: 'method not allowed' }, { Allow: 'GET, PUT, DELETE, OPTIONS' });
  },
};
