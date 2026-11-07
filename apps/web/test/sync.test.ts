import { describe, expect, it } from 'vitest';
import worker, { LIMITS } from '../../../tools/sync-worker/worker.mjs';
import {
  blobUrl, Conflict, formatSyncId, generatePassphrase, newSyncId, normaliseSyncId, open, passphraseProblem, pull, push, remove,
  seal, ServerUnavailable, syncRound, unlock, WrongPassphrase,
} from '../src/lib/sync';

const FAST = { m: 8 * 1024, t: 1, p: 1 }; // cheap Argon2id for tests; the app uses 64 MiB, 3 passes

/** an in-memory KV with the calls the Worker makes */
function memoryKv() {
  const m = new Map<string, { value: ArrayBuffer; metadata: unknown }>();
  return {
    m,
    async getWithMetadata(k: string) { const v = m.get(k); return v ? { value: v.value, metadata: v.metadata } : { value: null, metadata: null }; },
    async put(k: string, value: Uint8Array, o: { metadata?: unknown }) { m.set(k, { value: value.slice().buffer, metadata: o.metadata }); },
    async delete(k: string) { m.delete(k); },
    async list({ prefix }: { prefix: string }) { return { keys: [...m].filter(([k]) => k.startsWith(prefix)).map(([name, v]) => ({ name, metadata: v.metadata })), list_complete: true }; },
  };
}
function server(extra: Record<string, unknown> = {}) {
  const kv = memoryKv();
  let n = 0;
  const env = { BLOBS: kv, LIMITER: { limit: async () => ({ success: true }) }, ...extra };
  const f = (async (url: string, init?: RequestInit) => { n++; return worker.fetch(new Request(url, init), env); }) as typeof fetch;
  return { kv, f, calls: () => n };
}
const BASE = 'https://sync.example.com';

describe('encrypted sync', () => {
  it('two devices with one passphrase can read each other, and the envelope holds no plaintext', async () => {
    const a = await unlock('correct horse battery staple', undefined, FAST);
    const sealed = await seal(a, '{"secret":"1990-08-15 06:30 New Delhi"}');
    expect(sealed).not.toContain('1990');
    expect(sealed).not.toContain('Delhi');
    const env = JSON.parse(sealed);
    expect(env).toMatchObject({ format: 'jyotisha-sync', v: 2, kdf: { name: 'argon2id', m: FAST.m, t: 1, p: 1 } });
    const opened = await open('correct horse battery staple', sealed);
    expect(opened.text).toBe('{"secret":"1990-08-15 06:30 New Delhi"}');
    // a second open reuses the key instead of running Argon2id again
    expect((await open('correct horse battery staple', sealed, opened.secret)).secret).toBe(opened.secret);
  });
  it('a wrong passphrase, a tampered blob or a swapped salt fails loudly', async () => {
    const a = await unlock('correct horse battery staple', undefined, FAST);
    const sealed = await seal(a, 'hello');
    await expect(open('correct horse battery stapler', sealed)).rejects.toBeInstanceOf(WrongPassphrase);
    const env = JSON.parse(sealed);
    env.data = env.data.slice(0, -4) + (env.data.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await expect(open('correct horse battery staple', JSON.stringify(env))).rejects.toBeInstanceOf(WrongPassphrase);
    const swapped = { ...JSON.parse(sealed), kdf: { ...JSON.parse(sealed).kdf, m: 2 * 1024 * 1024 } };
    await expect(open('correct horse battery staple', JSON.stringify(swapped))).rejects.toThrow(/safe range/);
  });
  it('rejects weak passphrases and makes strong ones, and sync IDs are 128 random bits', () => {
    expect(passphraseProblem('short')).toBeTruthy();
    expect(passphraseProblem('aaaaaaaaaaaaaaaaaaaa')).toBeTruthy();
    const g = generatePassphrase();
    expect(g).toMatch(/^([a-z2-9]{5}-){5}[a-z2-9]{5}$/);
    expect(passphraseProblem(g)).toBeNull();
    const id = newSyncId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(newSyncId()).not.toBe(id);
    expect(normaliseSyncId(formatSyncId(id).toUpperCase())).toBe(id);
    expect(normaliseSyncId('abc')).toBeNull();
  });
  it('talks only to https (or localhost)', () => {
    expect(() => blobUrl('http://example.com', 'ab')).toThrow(ServerUnavailable);
    expect(blobUrl('https://example.com/sync/', 'ab')).toBe('https://example.com/sync/v1/ab/main');
    expect(blobUrl('http://localhost:8787', 'ab', null)).toBe('http://localhost:8787/v1/ab');
  });
});

describe('sync server', () => {
  const id = '0123456789abcdef0123456789abcdef';
  it('stores only envelopes, with ETag and If-Match', async () => {
    const { f, kv } = server();
    const k = await unlock('correct horse battery staple', undefined, FAST);
    expect(await pull(BASE, id, f)).toBeNull();
    const first = await push(BASE, id, await seal(k, 'my charts'), null, f);
    expect(first).toMatch(/^"[0-9a-f]{32}"$/);
    // creating again, or writing with a stale ETag, is refused
    await expect(push(BASE, id, await seal(k, 'other'), null, f)).rejects.toBeInstanceOf(Conflict);
    const second = await push(BASE, id, await seal(k, 'my charts, more'), first, f);
    await expect(push(BASE, id, await seal(k, 'late'), first, f)).rejects.toBeInstanceOf(Conflict);
    const got = (await pull(BASE, id, f))!;
    expect(got.etag).toBe(second);
    expect((await open('correct horse battery staple', got.text, k)).text).toBe('my charts, more');
    const stored = new TextDecoder().decode([...kv.m.values()][0].value);
    expect(stored).not.toContain('my charts');
    // plaintext and writes without a precondition are refused
    const res = await f(`${BASE}/v1/${id}/main`, { method: 'PUT', body: '{"name":"Asha","date":"1990-08-15"}', headers: { 'If-None-Match': '*' } });
    expect(res.status).toBe(400);
    expect((await f(`${BASE}/v1/${id}/main`, { method: 'PUT', body: await seal(k, 'x') })).status).toBe(428);
    expect((await f(`${BASE}/v1/not-an-id/main`)).status).toBe(404);
  });
  it('enforces the size and count caps, sets the TTL and deletes on request', async () => {
    const { f, kv } = server();
    const big = JSON.stringify({ format: 'jyotisha-sync', v: 2, kdf: {}, iv: 'a', data: 'x'.repeat(LIMITS.maxBytes), at: '' });
    expect((await f(`${BASE}/v1/${id}/main`, { method: 'PUT', body: big, headers: { 'If-None-Match': '*' } })).status).toBe(413);
    const small = JSON.stringify({ format: 'jyotisha-sync', v: 2, kdf: {}, iv: 'a', data: 'b', at: '' });
    let ttl = 0;
    const put = kv.put.bind(kv);
    kv.put = async (k, v, o: { metadata?: unknown; expirationTtl?: number }) => { ttl = o.expirationTtl ?? 0; return put(k, v, o); };
    for (let i = 0; i < LIMITS.maxBlobsPerId; i++)
      expect((await f(`${BASE}/v1/${id}/s${i}`, { method: 'PUT', body: small, headers: { 'If-None-Match': '*' } })).status).toBe(201);
    expect(ttl).toBe(180 * 24 * 3600);
    expect((await f(`${BASE}/v1/${id}/one-more`, { method: 'PUT', body: small, headers: { 'If-None-Match': '*' } })).status).toBe(409);
    await remove(BASE, id, f);
    expect(kv.m.size).toBe(0);
  });
  it('rate limits per ID and has a kill switch', async () => {
    const limited = server({ LIMITER: { limit: async ({ key }: { key: string }) => ({ success: key !== id }) } });
    expect((await limited.f(`${BASE}/v1/${id}/main`)).status).toBe(429);
    expect((await limited.f(`${BASE}/v1/${'f'.repeat(32)}/main`)).status).toBe(404);
    const off = server({ SYNC_DISABLED: '1' });
    expect((await off.f(`${BASE}/v1/${id}/main`)).status).toBe(503);
    await expect(pull(BASE, id, off.f)).rejects.toBeInstanceOf(ServerUnavailable);
  });
  it('a sync round merges both devices, retrying after a conflict', async () => {
    const { f } = server();
    const pass = 'correct horse battery staple';
    const merged: string[] = [];
    const a = await syncRound({ base: BASE, id, pass, secret: await unlock(pass, undefined, FAST), merge: (t) => (merged.push(t), 'merged'), local: () => 'device A', f });
    expect(a.note).toMatch(/Nothing was stored/);
    // device B writes between A's read and A's write: A pulls again and merges B's data
    let sneaky = true;
    const racing = (async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT' && sneaky) {
        sneaky = false;
        const cur = (await pull(BASE, id, f))!;
        await push(BASE, id, await seal(a.secret, 'device B'), cur.etag, f);
      }
      return f(url, init);
    }) as typeof fetch;
    await syncRound({ base: BASE, id, pass, secret: a.secret, merge: (t) => (merged.push(t), 'merged'), local: () => 'device A, later', f: racing });
    expect(merged).toEqual(['device A', 'device B']);
    expect((await open(pass, (await pull(BASE, id, f))!.text, a.secret)).text).toBe('device A, later');
  });
});
