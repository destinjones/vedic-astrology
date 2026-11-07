import { createReadStream, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, runnerImport, type Plugin } from 'vite'
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

/**
 * The static /learn/ pages (src/learn/pages.ts): nakshatras, signs, planets, houses,
 * yogas, doshas and the glossary. Written into dist/learn/ on build, with their own
 * learn/sitemap.xml, and rendered on request in dev.
 */
interface LearnPage { file: string; html: string }
interface LearnModule {
  learnPages(o: { base: string; css: string[]; head?: string; counter?: string }): LearnPage[]
  learnSitemap(pages: LearnPage[]): string
}
function learnPagesPlugin(): Plugin {
  let base = '/'
  const counter = process.env.VITE_GOATCOUNTER || undefined
  return {
    name: 'learn-pages',
    configResolved(c) { base = c.base },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split(/[?#]/)[0]
        if (!url.startsWith(base + 'learn/')) return next()
        try {
          const mod = (await server.ssrLoadModule('/src/learn/pages.ts')) as LearnModule
          const head = `\n    <script type="module" src="${base}@vite/client"></script><script type="module" src="${base}src/learn/style.ts"></script>`
          const want = url.slice(base.length).replace(/\/?$/, '/') + 'index.html'
          const page = mod.learnPages({ base, css: [], head }).find((p) => p.file === want)
          if (!page) return next()
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(page.html)
        } catch (e) {
          next(e)
        }
      })
    },
    async generateBundle(_, bundle) {
      // The stylesheet can be split (the fonts are shared with the landing page), so gather the CSS of every chunk the entry pulls in.
      const css: string[] = []
      const visit = (name: string, seen = new Set<string>()) => {
        const c = bundle[name]
        if (!c || c.type !== 'chunk' || seen.has(name)) return
        seen.add(name)
        c.imports.forEach((i) => visit(i, seen))
        for (const f of c.viteMetadata?.importedCss ?? []) if (!css.includes(f)) css.push(f)
      }
      const entry = Object.values(bundle).find((c) => c.type === 'chunk' && c.isEntry && c.name === 'learn')
      if (entry) visit(entry.fileName)
      if (!css.length) this.error('learn-pages: the learn stylesheet was not built')
      const { module: mod } = await runnerImport<LearnModule>(join(here, 'src/learn/pages.ts'))
      const pages = mod.learnPages({ base, css: css.map((f) => base + f), counter })
      for (const p of pages) this.emitFile({ type: 'asset', fileName: p.file, source: p.html })
      this.emitFile({ type: 'asset', fileName: 'learn/sitemap.xml', source: mod.learnSitemap(pages) })
    },
  }
}

export default defineConfig({
  // GitHub Pages serves the site from /vedic-astrology/; the workflow sets VITE_BASE.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), swissEphAssets(), cosmosAssets(), learnPagesPlugin()],
  build: {
    rollupOptions: {
      input: { landing: join(here, 'index.html'), app: join(here, 'app/index.html'), compare: join(here, 'compare/index.html'), match: join(here, 'match/index.html'), tools: join(here, 'tools/index.html'), learn: join(here, 'src/learn/style.ts') },
    },
  },
  server: { fs: { allow: ['../..'] } },
  // swisseph-wasm loads its .wasm/.data relative to its own module URL
  optimizeDeps: { exclude: ['swisseph-wasm'] },
})
