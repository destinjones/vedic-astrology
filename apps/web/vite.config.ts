import { createReadStream, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const require = createRequire(import.meta.url)

/**
 * swisseph-wasm resolves its .wasm/.data at runtime with
 * new URL('../wasm/' + file, import.meta.url), which Vite cannot see.
 * Bundled chunks live in /assets, so ship the files at /wasm/.
 */
function swissEphAssets(): Plugin {
  return {
    name: 'swisseph-assets',
    apply: 'build',
    generateBundle() {
      const dir = join(dirname(require.resolve('swisseph-wasm/package.json')), 'wasm')
      for (const f of ['swisseph.wasm', 'swisseph.data']) {
        this.emitFile({ type: 'asset', fileName: `wasm/${f}`, source: readFileSync(join(dir, f)) })
      }
    },
  }
}

/**
 * Blender art lives in <repo>/assets/3d (outside this app). Serve it at
 * /cosmos/ in dev and copy it into dist/cosmos/ on build.
 */
const COSMOS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/3d')
const MIME: Record<string, string> = {
  '.webp': 'image/webp', '.png': 'image/png', '.glb': 'model/gltf-binary', '.json': 'application/json',
}
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}
function cosmosAssets(): Plugin {
  return {
    name: 'cosmos-assets',
    configureServer(server) {
      server.middlewares.use('/cosmos', (req, res, next) => {
        const url = decodeURIComponent((req.url ?? '/').split('?')[0])
        const file = resolve(COSMOS_DIR, '.' + url)
        if (!file.startsWith(COSMOS_DIR + sep)) return next()
        try {
          if (!statSync(file).isFile()) return next()
        } catch {
          return next()
        }
        res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream')
        res.setHeader('Cache-Control', 'public, max-age=3600')
        createReadStream(file).pipe(res)
      })
    },
    generateBundle() {
      for (const file of walk(COSMOS_DIR)) {
        const rel = relative(COSMOS_DIR, file).split(sep).join('/')
        this.emitFile({ type: 'asset', fileName: `cosmos/${rel}`, source: readFileSync(file) })
      }
    },
  }
}

const here = dirname(fileURLToPath(import.meta.url))

/** Public address of the site, for absolute og:image and og:url links. */
const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://destinjones.github.io/vedic-astrology/').replace(/\/?$/, '/')

/**
 * Link previews for a static site. A chat app or social network reads the
 * og: tags of the HTML it is given, and a share link's birth details sit after
 * the #, which never reaches it. So every famous chart gets a real page at
 * /c/<id>/ whose tags point at a pre-rendered card (public/og/<id>.jpg); the
 * page then opens the chart in the app. tools/render-og.mjs renders the cards
 * and writes public/og/index.json, which lists the pages to make.
 */
interface OgEntry { id: string; label: string; field: string; date: string; time: string; place: string; rodden: string }
function sharePages(): Plugin {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  return {
    name: 'share-pages',
    apply: 'build',
    generateBundle() {
      let list: OgEntry[] = []
      try { list = JSON.parse(readFileSync(join(here, 'public/og/index.json'), 'utf8')) } catch { return }
      for (const c of list) {
        const title = `${c.label}: Vedic birth chart`
        const desc = `${c.label}, ${c.field}. Born ${c.date} at ${c.time.slice(0, 5)} in ${c.place} (Rodden ${c.rodden}). Open the full chart, divisional charts, yogas and dashas.`
        const url = `${SITE_URL}c/${c.id}/`
        const app = `../../app/#famous=${c.id}`
        const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} · Jyotisha Explorer</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Jyotisha Explorer" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${SITE_URL}og/${c.id}.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${esc(`North Indian birth chart of ${c.label}`)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta http-equiv="refresh" content="0; url=${app}" />
<script>location.replace(${JSON.stringify(app)})</script>
<style>body{background:#0b0a1a;color:#ece8f6;font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}a{color:#e8b65a}</style>
</head>
<body><p>Opening <a href="${app}">${esc(c.label)}'s chart</a>…</p></body>
</html>
`
        this.emitFile({ type: 'asset', fileName: `c/${c.id}/index.html`, source: html })
      }
    },
  }
}

export default defineConfig({
  // GitHub Pages serves the site from /vedic-astrology/; the workflow sets VITE_BASE.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), swissEphAssets(), cosmosAssets(), sharePages()],
  build: {
    rollupOptions: {
      input: { landing: join(here, 'index.html'), app: join(here, 'app/index.html'), compare: join(here, 'compare/index.html'), match: join(here, 'match/index.html'), tools: join(here, 'tools/index.html'), embed: join(here, 'embed/index.html') },
    },
  },
  server: { fs: { allow: ['../..'] } },
  // swisseph-wasm loads its .wasm/.data relative to its own module URL
  optimizeDeps: { exclude: ['swisseph-wasm'] },
})
