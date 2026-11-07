// Builds a publishable copy of @vedic/engine in packages/engine/dist-pkg/.
//
//   npm run pack -w @vedic/engine          build dist-pkg/ and dry-run `npm pack` on it
//   npm publish packages/engine/dist-pkg   publish (maintainers only; see docs/releasing.md)
//
// The workspace package stays private and keeps pointing at src/ so the app and
// tests use the TypeScript directly. Only dist-pkg/ is ever published.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(here, '../..');
const out = join(here, 'dist-pkg');
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// JavaScript: one ESM file per public entry, dependencies left external.
const entries = { index: 'src/index.ts', types: 'src/types.ts', places: 'src/placeAliases.ts' };
await build({
  absWorkingDir: here,
  entryPoints: entries,
  outdir: join(out, 'dist'),
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
  external: Object.keys(pkg.dependencies ?? {}),
  logLevel: 'warning',
});

// Type declarations.
execFileSync(process.execPath, [join(repo, 'node_modules/typescript/bin/tsc'), '-p', join(here, 'tsconfig.build.json')], { stdio: 'inherit' });

const published = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  license: 'AGPL-3.0-or-later',
  type: 'module',
  author: 'Destin Jones and contributors',
  homepage: 'https://destinjones.github.io/vedic-astrology/docs/engine/',
  repository: { type: 'git', url: 'git+https://github.com/destinjones/vedic-astrology.git', directory: 'packages/engine' },
  bugs: 'https://github.com/destinjones/vedic-astrology/issues',
  keywords: ['vedic', 'jyotish', 'sidereal', 'astrology', 'swiss-ephemeris', 'wasm', 'dasha', 'nakshatra', 'varga'],
  engines: { node: '>=20' },
  sideEffects: false,
  main: './dist/index.js',
  types: './dist/types/index.d.ts',
  exports: {
    '.': { types: './dist/types/index.d.ts', import: './dist/index.js' },
    './types': { types: './dist/types/types.d.ts', import: './dist/types.js' },
    './places': { types: './dist/types/placeAliases.d.ts', import: './dist/places.js' },
    './package.json': './package.json',
  },
  files: ['dist', 'README.md', 'LICENSE', 'NOTICE'],
  dependencies: pkg.dependencies,
  publishConfig: { access: 'public' },
};
writeFileSync(join(out, 'package.json'), JSON.stringify(published, null, 2) + '\n');
copyFileSync(join(here, 'README.md'), join(out, 'README.md'));
copyFileSync(join(repo, 'LICENSE'), join(out, 'LICENSE'));
copyFileSync(join(repo, 'NOTICE'), join(out, 'NOTICE'));

// Prove it packs and imports, without publishing.
execFileSync('npm', ['pack', '--dry-run'], { cwd: out, stdio: 'inherit' });
const mod = await import(join(out, 'dist/index.js'));
if (typeof mod.createEngine !== 'function') throw new Error('dist-pkg: createEngine is not exported');
const engine = await mod.createEngine();
const chart = engine.computeChart({ date: '1869-10-02', time: '07:11', place: { name: 'Porbandar', latitude: 21.6417, longitude: 69.6293 } });
if (chart.ascendant.sign !== 7) throw new Error(`dist-pkg: expected Libra rising for the test chart, got sign ${chart.ascendant.sign}`);
console.log(`\n${pkg.name}@${pkg.version} is ready in packages/engine/dist-pkg (not published).`);
