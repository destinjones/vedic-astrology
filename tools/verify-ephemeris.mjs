// Checks that the Swiss Ephemeris build in node_modules is byte-for-byte the one
// this project was tested against. If you upgrade swisseph-wasm on purpose, run
// `node tools/verify-ephemeris.mjs --update`, review the diff, and say why in the PR.
// See docs/ephemeris.md.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve('swisseph-wasm/package.json', { paths: [join(dirname(fileURLToPath(import.meta.url)), '../packages/engine')] }));
const lockFile = join(dirname(fileURLToPath(import.meta.url)), 'ephemeris.lock.json');
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const files = ['wasm/swisseph.wasm', 'wasm/swisseph.data', 'wasm/swisseph.js'];
const actual = {
  package: `swisseph-wasm@${pkg.version}`,
  sha256: Object.fromEntries(files.map((f) => [f, createHash('sha256').update(readFileSync(join(pkgDir, f))).digest('hex')])),
};

const { default: SwissEph } = await import(join(pkgDir, pkg.main));
const swe = new SwissEph();
await swe.initSwissEph();
actual.swissEphemeris = swe.version();
swe.close?.();

if (process.argv.includes('--update')) {
  writeFileSync(lockFile, JSON.stringify(actual, null, 2) + '\n');
  console.log(`ephemeris: recorded ${actual.package}, Swiss Ephemeris ${actual.swissEphemeris}`);
} else {
  const expected = JSON.parse(readFileSync(lockFile, 'utf8'));
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    console.error('ephemeris: the installed Swiss Ephemeris build differs from tools/ephemeris.lock.json');
    console.error('expected', expected, '\nactual  ', actual);
    process.exit(1);
  }
  console.log(`ephemeris: ${actual.package}, Swiss Ephemeris ${actual.swissEphemeris}, hashes match`);
}
