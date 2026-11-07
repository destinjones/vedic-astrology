/**
 * Cross-device sync without an account. Everything is encrypted in this
 * browser and only ciphertext ever leaves it.
 *
 *   passphrase + random salt ──Argon2id (64 MiB, 3 passes)──▶ AES-256-GCM key
 *
 * The key never leaves the browser and the passphrase is never stored or
 * sent. The salt and the Argon2id settings travel in the clear inside each
 * encrypted envelope, so any device with the passphrase can open it.
 *
 * File sync is the default: the envelope is saved as a .jyosync file that
 * the person moves through any cloud folder. A server is optional. It stores
 * envelopes under a sync ID, a 128-bit random capability made on the first
 * device and typed or pasted into the others. The ID is not derived from the
 * passphrase, so the server cannot test passphrase guesses against it. The
 * protocol is in tools/sync-worker/SPEC.md.
 *
 * Syncing merges: charts, tabs, notes and history from either side are kept.
 * Deleting something on one device does not delete it on the other.
 */

export const SYNC_FORMAT = 'jyotisha-sync';
/** Argon2id cost: m in KiB, t passes, p lanes. OWASP's floor is m=19 MiB, t=2. */
export interface KdfParams { m: number; t: number; p: number }
export const ARGON2ID: KdfParams = { m: 64 * 1024, t: 3, p: 1 };
const MIN_PASSPHRASE = 16;

export interface SyncEnvelope {
  format: typeof SYNC_FORMAT;
  v: 2;
  kdf: { name: 'argon2id'; salt: string } & KdfParams;
  /** base64 */
  iv: string;
  /** base64 AES-GCM ciphertext with tag */
  data: string;
  /** ISO time it was sealed */
  at: string;
}

/** A derived key and what it was derived from. Kept in memory only. */
export interface SyncSecret { pass: string; salt: Uint8Array; kdf: KdfParams; key: CryptoKey }

const b64 = (u: Uint8Array) => { let s = ''; for (const b of u) s += String.fromCharCode(b); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (u: Uint8Array) => Array.from(u, (b) => b.toString(16).padStart(2, '0')).join('');
const aad = (salt: Uint8Array) => new TextEncoder().encode(`${SYNC_FORMAT}/v2:${b64(salt)}`);

export function passphraseProblem(p: string): string | null {
  if (p.trim().length < MIN_PASSPHRASE) return `Use at least ${MIN_PASSPHRASE} characters. Four or more random words work well.`;
  if (/^(.)\1+$/.test(p) || /^(?:0123456789|1234567890|password|qwerty)/i.test(p)) return 'That passphrase is too easy to guess.';
  return null;
}

/** A strong random passphrase: six groups of five characters, about 150 bits. */
export function generatePassphrase(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(30));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return Array.from({ length: 6 }, (_, i) => chars.slice(i * 5, i * 5 + 5).join('')).join('-');
}

/** Derives the AES key on this device. hash-wasm loads only when sync is used. */
export async function unlock(pass: string, salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16)), kdf: KdfParams = ARGON2ID): Promise<SyncSecret> {
  const { argon2id } = await import('hash-wasm');
  const raw = await argon2id({
    password: pass.normalize('NFKC'), salt, iterations: kdf.t, memorySize: kdf.m, parallelism: kdf.p,
    hashLength: 32, outputType: 'binary',
  });
  const key = await crypto.subtle.importKey('raw', new Uint8Array(raw), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return { pass, salt, kdf, key };
}

export async function seal(secret: SyncSecret, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(secret.salt) }, secret.key, new TextEncoder().encode(plaintext));
  const env: SyncEnvelope = {
    format: SYNC_FORMAT, v: 2, kdf: { name: 'argon2id', salt: b64(secret.salt), ...secret.kdf },
    iv: b64(iv), data: b64(new Uint8Array(ct)), at: new Date().toISOString(),
  };
  return JSON.stringify(env);
}

export class WrongPassphrase extends Error { constructor() { super('Wrong passphrase, or the file was changed'); } }

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Opens an envelope. Pass the secret from an earlier call to skip a second
 * Argon2id run when the salt and settings match; the secret that opened it
 * comes back so later seals reuse it.
 */
export async function open(pass: string, sealed: string, cached?: SyncSecret | null): Promise<{ text: string; secret: SyncSecret }> {
  let env: SyncEnvelope;
  try { env = JSON.parse(sealed); } catch { throw new Error('Not an encrypted sync file'); }
  if (env?.format !== SYNC_FORMAT || env.v !== 2 || env.kdf?.name !== 'argon2id') throw new Error('Not an encrypted sync file, or one from an older version');
  const kdf = { m: env.kdf.m, t: env.kdf.t, p: env.kdf.p };
  // refuse settings that would freeze the tab, or that are too weak to trust
  if (!(kdf.m >= 8 * 1024 && kdf.m <= 1024 * 1024 && kdf.t >= 1 && kdf.t <= 20 && kdf.p >= 1 && kdf.p <= 8)) throw new Error('This file asks for key settings outside the safe range');
  const salt = unb64(env.kdf.salt);
  const secret = cached && cached.pass === pass && sameBytes(cached.salt, salt) && cached.kdf.m === kdf.m && cached.kdf.t === kdf.t && cached.kdf.p === kdf.p
    ? cached : await unlock(pass, salt, kdf);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv), additionalData: aad(salt) }, secret.key, unb64(env.data));
    return { text: new TextDecoder().decode(pt), secret };
  } catch {
    throw new WrongPassphrase();
  }
}

/* ---------- sync ID: a random capability, never derived from the passphrase ---------- */

export const newSyncId = () => hex(crypto.getRandomValues(new Uint8Array(16)));
/** Accepts the ID with or without spaces and dashes; null when it is not 32 hex digits. */
export const normaliseSyncId = (s: string) => { const t = s.toLowerCase().replace(/[\s-]/g, ''); return /^[0-9a-f]{32}$/.test(t) ? t : null; };
/** 32 hex digits in groups of four, easier to read aloud or type */
export const formatSyncId = (id: string) => id.match(/.{1,4}/g)!.join('-');

/* ---------- transport: an optional server, see tools/sync-worker/SPEC.md ---------- */

/** The slot this app uses. A sync ID can hold up to 50 slots on the server. */
const SLOT = 'main';
export const TIMEOUT_MS = 10_000;

/** The server could not be used: an error status, a timeout or no network. */
export class ServerUnavailable extends Error {}
/** Someone else wrote since we read; pull, merge and try again. */
export class Conflict extends Error {}

export function blobUrl(base: string, id: string, slot: string | null = SLOT): string {
  let u: URL;
  try { u = new URL(base); } catch { throw new ServerUnavailable('That server address is not a URL.'); }
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)))
    throw new ServerUnavailable('Use an https:// address (http is allowed only for localhost).');
  // the base may be given with or without its /v1, e.g. VITE_SYNC_URL=https://sync.example.com/v1
  u.pathname = `${u.pathname.replace(/\/+$/, '').replace(/\/v1$/, '')}/v1/${id}${slot ? `/${slot}` : ''}`;
  return u.toString();
}

/** The kill-switch probe: anything but 200 { ok: true } means "use files this time". */
export async function health(base: string, f: typeof fetch = fetch): Promise<void> {
  const res = await call(blobUrl(base, 'health', null), { method: 'GET' }, f);
  let ok = false;
  try { ok = res.ok && (await res.json())?.ok === true; } catch { /* not JSON */ }
  if (!ok) throw new ServerUnavailable(res.status === 503 ? 'The sync server is switched off for now.' : `The sync server answered ${res.status}.`);
}

async function call(url: string, init: RequestInit, f: typeof fetch): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await f(url, { ...init, signal: ctl.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch (e) {
    throw new ServerUnavailable(ctl.signal.aborted ? 'The sync server did not answer in time.' : `Could not reach the sync server (${(e as Error).message}).`);
  } finally { clearTimeout(timer); }
}

export interface Remote { text: string; etag: string | null }

/** null when nothing is stored under this ID yet */
export async function pull(base: string, id: string, f: typeof fetch = fetch): Promise<Remote | null> {
  const res = await call(blobUrl(base, id), { method: 'GET' }, f);
  if (res.status === 404) return null;
  if (!res.ok) throw new ServerUnavailable(`The sync server answered ${res.status}.`);
  return { text: await res.text(), etag: res.headers.get('ETag') };
}

/** Writes only if the blob is still the one we read (or still absent). Returns the new ETag. */
export async function push(base: string, id: string, sealed: string, etag: string | null, f: typeof fetch = fetch): Promise<string | null> {
  const res = await call(blobUrl(base, id), {
    method: 'PUT', body: sealed,
    headers: { 'Content-Type': 'application/octet-stream', ...(etag ? { 'If-Match': etag } : { 'If-None-Match': '*' }) },
  }, f);
  if (res.status === 412) throw new Conflict('Another device synced at the same moment.');
  if (!res.ok) throw new ServerUnavailable(`The sync server answered ${res.status}.`);
  return res.headers.get('ETag');
}

/** Deletes everything stored under the ID. */
export async function remove(base: string, id: string, f: typeof fetch = fetch): Promise<void> {
  const res = await call(blobUrl(base, id, null), { method: 'DELETE' }, f);
  if (!res.ok && res.status !== 404) throw new ServerUnavailable(`The sync server answered ${res.status}.`);
}

/**
 * One round: pull, merge into this browser, seal what is here now, push.
 * If another device wrote in between, it pulls and merges again (twice at most).
 */
export async function syncRound(opts: {
  base: string; id: string; pass: string; secret: SyncSecret | null;
  merge: (text: string) => string; local: () => string; f?: typeof fetch;
}): Promise<{ note: string; secret: SyncSecret }> {
  let secret = opts.secret;
  await health(opts.base, opts.f);
  for (let attempt = 0; ; attempt++) {
    const remote = await pull(opts.base, opts.id, opts.f);
    let note = 'Nothing was stored under this sync ID yet, so this browser’s data was uploaded.';
    if (remote) {
      const opened = await open(opts.pass, remote.text, secret);
      secret = opened.secret;
      note = opts.merge(opened.text);
    }
    if (!secret || secret.pass !== opts.pass) secret = await unlock(opts.pass);
    try {
      await push(opts.base, opts.id, await seal(secret, opts.local()), remote?.etag ?? null, opts.f);
      return { note, secret };
    } catch (e) {
      if (!(e instanceof Conflict) || attempt >= 2) throw e;
    }
  }
}

/* ---------- settings (the passphrase and key are never stored) ---------- */

/**
 * Servers offered by default. Set VITE_SYNC_URL at build time to list one,
 * e.g. VITE_SYNC_URL=https://sync.example.com. Anyone can also type their own.
 */
export const HOSTED_SYNC: { label: string; url: string }[] =
  import.meta.env?.VITE_SYNC_URL ? [{ label: import.meta.env.VITE_SYNC_LABEL || 'The site’s own sync server', url: String(import.meta.env.VITE_SYNC_URL) }] : [];

const get = (k: string) => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } };
const set = (k: string, v: string) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* ignore */ } };
export const loadSyncUrl = () => get('vedic.sync.url');
export const storeSyncUrl = (u: string) => set('vedic.sync.url', u);
export const loadSyncId = () => get('vedic.sync.id');
export const storeSyncId = (id: string) => set('vedic.sync.id', id);
/** Whether the "server failed, used a file" notice was shown since the last good sync */
export const fallbackNoticed = () => get('vedic.sync.fellBack') === '1';
export const setFallbackNoticed = (v: boolean) => set('vedic.sync.fellBack', v ? '1' : '');
