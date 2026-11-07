import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
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

export default defineConfig({
  plugins: [react(), swissEphAssets()],
  // swisseph-wasm loads its .wasm/.data relative to its own module URL
  optimizeDeps: { exclude: ['swisseph-wasm'] },
})
