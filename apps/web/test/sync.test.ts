import { describe, expect, it } from 'vitest';
import { blobUrl, deriveKeys, generatePassphrase, open, passphraseProblem, pull, push, seal, WrongPassphrase } from '../src/lib/sync';

const FAST = 1000; // rounds, to keep the test quick; the app uses 600,000

describe('encrypted sync', () => {
  it('two devices with one passphrase share an id and can read each other', async () => {
    const a = await deriveKeys('correct horse battery staple', FAST);
    const b = await deriveKeys('correct horse battery staple', FAST);
    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^[0-9a-f]{64}$/);
    const sealed = await seal(a, '{"secret":"1990-08-15 06:30 New Delhi"}');
    expect(sealed).not.toContain('1990');
    expect(sealed).not.toContain('Delhi');
    expect(await open(b, sealed)).toBe('{"secret":"1990-08-15 06:30 New Delhi"}');
  });
  it('a wrong passphrase or a tampered blob fails loudly', async () => {
    const a = await deriveKeys('correct horse battery staple', FAST);
    const c = await deriveKeys('correct horse battery stapler', FAST);
    expect(c.id).not.toBe(a.id);
    const sealed = await seal(a, 'hello');
    await expect(open(c, sealed)).rejects.toBeInstanceOf(WrongPassphrase);
    const env = JSON.parse(sealed);
    env.data = env.data.slice(0, -4) + (env.data.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await expect(open(a, JSON.stringify(env))).rejects.toBeInstanceOf(WrongPassphrase);
  });
  it('rejects weak passphrases and makes strong ones', () => {
    expect(passphraseProblem('short')).toBeTruthy();
    expect(passphraseProblem('aaaaaaaaaaaaaaaaaaaa')).toBeTruthy();
    const g = generatePassphrase();
    expect(g).toMatch(/^([a-z2-9]{5}-){5}[a-z2-9]{5}$/);
    expect(passphraseProblem(g)).toBeNull();
  });
  it('talks only to https (or localhost) and sends only ciphertext', async () => {
    expect(() => blobUrl('http://example.com/sync', 'ab')).toThrow();
    expect(blobUrl('https://example.com/sync/', 'ab')).toBe('https://example.com/sync/ab');
    const store = new Map<string, string>();
    const fake = (async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') { store.set(url, String(init.body)); return new Response(null, { status: 204 }); }
      return store.has(url) ? new Response(store.get(url)) : new Response('', { status: 404 });
    }) as typeof fetch;
    const k = await deriveKeys('correct horse battery staple', FAST);
    expect(await pull('http://localhost:8787', k.id, fake)).toBeNull();
    await push('http://localhost:8787', k.id, await seal(k, 'my charts'), fake);
    const [[url, body]] = [...store];
    expect(url).toBe(`http://localhost:8787/${k.id}`);
    expect(body).not.toContain('my charts');
    expect(await open(k, (await pull('http://localhost:8787', k.id, fake))!)).toBe('my charts');
  });
});
