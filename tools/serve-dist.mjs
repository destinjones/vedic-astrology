// A tiny static server that serves apps/web/dist under the same path as GitHub Pages.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = '/vedic-astrology/';
const DIST = join(dirname(fileURLToPath(import.meta.url)), '../apps/web/dist');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml', '.txt': 'text/plain',
};

export function serveDist(port = 0) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!path.startsWith(BASE)) { res.writeHead(404).end(); return; }
    let file = normalize(join(DIST, path.slice(BASE.length)));
    if (!file.startsWith(DIST + sep) && file !== DIST) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve({
      url: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
    }));
  });
}

// `node tools/serve-dist.mjs [port]` serves the build on its own, for Playwright and Lighthouse.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { url } = await serveDist(Number(process.argv[2] ?? 4173));
  console.log(`Serving apps/web/dist at ${url}${BASE}`);
}
