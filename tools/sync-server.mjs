/**
 * The sync Worker (tools/sync-worker/worker.mjs) run under plain Node, with
 * blobs kept in a folder instead of Cloudflare KV. Same requests, same caps,
 * same answers; see tools/sync-worker/SPEC.md. Good for local testing or a
 * small self-hosted box behind an HTTPS proxy.
 *
 *   node tools/sync-server.mjs                 # http://localhost:8787, blobs in ./sync-data
 *   PORT=9000 SYNC_DIR=/var/lib/jyotisha-sync ALLOW_ORIGIN=https://destinjones.github.io node tools/sync-server.mjs
 */
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import worker from './sync-worker/worker.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const DIR = resolve(process.env.SYNC_DIR ?? 'sync-data');
mkdirSync(DIR, { recursive: true });

/** The slice of the KV API the Worker uses, on files: <dir>/<id>/<slot> and <slot>.meta.json */
export function fileKv(dir) {
  const paths = (key) => { const f = join(dir, ...key.split('/')); return { f, meta: `${f}.meta.json` }; };
  const readMeta = (meta) => { try { return JSON.parse(readFileSync(meta, 'utf8')); } catch { return null; } };
  const alive = (m) => m && (!m.expires || m.expires > Date.now());
  return {
    async getWithMetadata(key) {
      const { f, meta } = paths(key);
      const m = readMeta(meta);
      if (!alive(m) || !existsSync(f)) return { value: null, metadata: null };
      const b = readFileSync(f);
      return { value: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), metadata: m.metadata };
    },
    async put(key, value, opts = {}) {
      const { f, meta } = paths(key);
      mkdirSync(join(f, '..'), { recursive: true });
      writeFileSync(`${f}.tmp`, Buffer.from(value));
      renameSync(`${f}.tmp`, f);
      writeFileSync(meta, JSON.stringify({ metadata: opts.metadata ?? null, expires: opts.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : null }));
    },
    async delete(key) {
      const { f, meta } = paths(key);
      rmSync(f, { force: true });
      rmSync(meta, { force: true });
    },
    async list({ prefix }) {
      const id = prefix.replace(/\/$/, '');
      const folder = join(dir, id);
      const names = existsSync(folder) ? readdirSync(folder).filter((n) => n.endsWith('.meta.json')).map((n) => n.slice(0, -10)) : [];
      const keys = names.map((n) => ({ name: `${id}/${n}`, metadata: readMeta(join(folder, `${n}.meta.json`)) })).filter((k) => alive(k.metadata))
        .map((k) => ({ name: k.name, metadata: k.metadata.metadata }));
      return { keys, list_complete: true };
    },
  };
}

const env = { BLOBS: fileKv(DIR), ALLOW_ORIGIN: process.env.ALLOW_ORIGIN ?? '*', SYNC_DISABLED: process.env.SYNC_DISABLED ?? '0' };

createServer(async (req, res) => {
  try {
    const chunks = [];
    let size = 0;
    for await (const c of req) { size += c.length; if (size > 2 * 1024 * 1024 + 1) break; chunks.push(c); }
    const hasBody = !['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(req.method ?? 'GET');
    const request = new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers, body: hasBody ? Buffer.concat(chunks) : undefined });
    const answer = await worker.fetch(request, env);
    res.writeHead(answer.status, Object.fromEntries(answer.headers));
    res.end(Buffer.from(await answer.arrayBuffer()));
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
}).listen(PORT, () => console.log(`Encrypted sync store on http://localhost:${PORT}, blobs in ${DIR}`));
