import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * swisseph-wasm loads `../wasm/swisseph.{wasm,data}` relative to its own module URL at runtime,
 * which the bundler can't see. Emit both files where the bundled chunk will look for them.
 */
function swissephAssets(): Plugin {
  const require = createRequire(import.meta.url);
  const dir = join(dirname(require.resolve('swisseph-wasm/package.json')), 'wasm');
  return {
    name: 'swisseph-assets',
    apply: 'build',
    generateBundle() {
      for (const f of ['swisseph.wasm', 'swisseph.data']) {
        this.emitFile({ type: 'asset', fileName: `wasm/${f}`, source: readFileSync(join(dir, f)) });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), swissephAssets()],
  base: './',
  optimizeDeps: { exclude: ['swisseph-wasm'] },
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 1500 },
});
