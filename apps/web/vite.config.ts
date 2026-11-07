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

export default defineConfig({
  // GitHub Pages serves the site from /vedic-astrology/; the workflow sets VITE_BASE.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), swissEphAssets(), cosmosAssets()],
  build: {
    rollupOptions: {
      input: { landing: join(here, 'index.html'), app: join(here, 'app/index.html'), match: join(here, 'match/index.html') },
    },
  },
  server: { fs: { allow: ['../..'] } },
  // swisseph-wasm loads its .wasm/.data relative to its own module URL
  optimizeDeps: { exclude: ['swisseph-wasm'] },
})
