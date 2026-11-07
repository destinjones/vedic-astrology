/**
 * Cross-device sync without an account. Everything is encrypted in this
 * browser with a key derived from a passphrase, and only ciphertext ever
 * leaves it:
 *
 *   passphrase ──PBKDF2-SHA-256, 600,000 rounds──▶ 512 bits
 *                                                  ├─ 256: AES-256-GCM key (never leaves the browser)
 *                                                  └─ 256: sync id, the blob's name on the server
 *
 * Two devices that type the same passphrase derive the same id and key, so
 * they find and open the same blob; the server only sees a random-looking id
 * and an encrypted body. The blob can travel as a file (any cloud folder or a
 * USB stick) or through a URL the person controls: any server that answers
 * GET and PUT on <base>/<id>, such as tools/sync-server.mjs, a WebDAV folder
 * or an object store. There is no default server.
 *
 * Syncing merges: charts, tabs, notes and history from either side are kept.
 * Deleting something on one device does not delete it on the other.
 */

export const SYNC_FORMAT = 'jyotisha-sync';
export const PBKDF2_ROUNDS = 600_000;
const SALT = new TextEncoder().encode('jyotisha-explorer/sync/v1');
const MIN_PASSPHRASE = 16;

export interface SyncKeys { key: CryptoKey; id: string }

export interface SyncEnvelope {
  format: typeof SYNC_FORMAT;
  v: 1;
  kdf: { name: 'PBKDF2-SHA-256'; rounds: number };
  /** base64 */
  iv: string;
  /** base64 AES-GCM ciphertext with tag */
  data: string;
  /** ISO time it was sealed; also inside the ciphertext */
  at: string;
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (u: Uint8Array) => Array.from(u, (b) => b.toString(16).padStart(2, '0')).join('');

export function passphraseProblem(p: string): string | null {
  if (p.trim().length < MIN_PASSPHRASE) return `Use at least ${MIN_PASSPHRASE} characters. Four or more random words work well.`;
  if (/^(.)\1+$/.test(p) || /^(?:0123456789|1234567890|password|qwerty)/i.test(p)) return 'That passphrase is too easy to guess.';
  return null;
}

/** A strong random passphrase: six groups of five letters, about 140 bits. */
export function generatePassphrase(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(30));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return Array.from({ length: 6 }, (_, i) => chars.slice(i * 5, i * 5 + 5).join('')).join('-');
}

export async function deriveKeys(passphrase: string, rounds = PBKDF2_ROUNDS): Promise<SyncKeys> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: SALT, iterations: rounds }, base, 512));
  const key = await crypto.subtle.importKey('raw', bits.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return { key, id: hex(bits.slice(32)) };
}

export async function seal(keys: SyncKeys, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const at = new Date().toISOString();
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(keys.id) }, keys.key, new TextEncoder().encode(plaintext));
  const env: SyncEnvelope = { format: SYNC_FORMAT, v: 1, kdf: { name: 'PBKDF2-SHA-256', rounds: PBKDF2_ROUNDS }, iv: b64(iv), data: b64(new Uint8Array(ct)), at };
  return JSON.stringify(env);
}

export class WrongPassphrase extends Error { constructor() { super('Wrong passphrase, or the file was changed'); } }

export async function open(keys: SyncKeys, sealed: string): Promise<string> {
  let env: SyncEnvelope;
  try { env = JSON.parse(sealed); } catch { throw new Error('Not an encrypted sync file'); }
  if (env?.format !== SYNC_FORMAT || env.v !== 1) throw new Error('Not an encrypted sync file');
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv), additionalData: new TextEncoder().encode(keys.id) }, keys.key, unb64(env.data));
    return new TextDecoder().decode(pt);
  } catch {
    throw new WrongPassphrase();
  }
}

/* ---------- transport: a URL the person controls ---------- */

export function blobUrl(base: string, id: string): string {
  const u = new URL(base);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)))
    throw new Error('Use an https:// address (http is allowed only for localhost).');
  u.pathname = `${u.pathname.replace(/\/+$/, '')}/${id}`;
  return u.toString();
}

/** null when nothing is stored there yet */
export async function pull(base: string, id: string, f: typeof fetch = fetch): Promise<string | null> {
  const res = await f(blobUrl(base, id), { method: 'GET', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`The sync server answered ${res.status}`);
  return res.text();
}

export async function push(base: string, id: string, sealed: string, f: typeof fetch = fetch): Promise<void> {
  const res = await f(blobUrl(base, id), { method: 'PUT', body: sealed, headers: { 'Content-Type': 'application/octet-stream' }, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!res.ok) throw new Error(`The sync server answered ${res.status}`);
}

/* ---------- settings (the passphrase itself is never stored) ---------- */

const URL_KEY = 'vedic.sync.url';
export const loadSyncUrl = () => { try { return localStorage.getItem(URL_KEY) ?? ''; } catch { return ''; } };
export const storeSyncUrl = (u: string) => { try { if (u) localStorage.setItem(URL_KEY, u); else localStorage.removeItem(URL_KEY); } catch { /* ignore */ } };
