/**
 * A minimal store for the explorer's encrypted sync, for anyone who wants to
 * run their own. It keeps opaque blobs by id and nothing else: the browser
 * encrypts with a key derived from the passphrase before sending, so this
 * server never sees birth data, names or the passphrase.
 *
 *   node tools/sync-server.mjs                 # http://localhost:8787, blobs in ./sync-data
 *   PORT=9000 SYNC_DIR=/var/lib/jyotisha-sync ALLOW_ORIGIN=https://destinjones.github.io node tools/sync-server.mjs
 *
 * Put it behind HTTPS (a reverse proxy, or a tunnel) for use from the public site.
 * GET /<id> returns the blob or 404; PUT /<id> stores it. Ids are 64 hex chars.
 */
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PORT = Number(process.env.PORT ?? 8787);
const DIR = resolve(process.env.SYNC_DIR ?? 'sync-data');
const ORIGIN = process.env.ALLOW_ORIGIN ?? '*';
const MAX = 4 * 1024 * 1024;
mkdirSync(DIR, { recursive: true });

const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
};

createServer((req, res) => {
  const id = /^\/([0-9a-f]{64})$/.exec(new URL(req.url ?? '/', 'http://x').pathname)?.[1];
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  if (!id) return res.writeHead(404, cors).end();
  const file = join(DIR, id);
  if (req.method === 'GET') {
    if (!existsSync(file)) return res.writeHead(404, cors).end();
    return res.writeHead(200, { ...cors, 'Content-Type': 'application/octet-stream' }).end(readFileSync(file));
  }
  if (req.method === 'PUT') {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX) { res.writeHead(413, cors).end(); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => {
      if (size > MAX) return;
      const body = Buffer.concat(chunks);
      // only accept what the app sends: an encrypted envelope, never plaintext data
      try {
        const env = JSON.parse(body.toString('utf8'));
        if (env.format !== 'jyotisha-sync' || typeof env.data !== 'string' || typeof env.iv !== 'string') throw new Error();
      } catch { return res.writeHead(400, cors).end(); }
      writeFileSync(file + '.tmp', body);
      renameSync(file + '.tmp', file);
      res.writeHead(204, cors).end();
    });
    return;
  }
  res.writeHead(405, cors).end();
}).listen(PORT, () => console.log(`Encrypted sync store on http://localhost:${PORT}, blobs in ${DIR}`));
