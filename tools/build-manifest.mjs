// Writes SHA256SUMS for every file of the built site, so anyone can check that what is deployed
// is exactly what this commit builds:
//   git checkout v1.2.3 && npm ci && npm run build:pages && npm run verify:build
//   then compare apps/web/dist/SHA256SUMS with the one attached to the GitHub release
// (or fetch https://destinjones.github.io/vedic-astrology/SHA256SUMS).
//
//   node tools/build-manifest.mjs             print the manifest and write dist/SHA256SUMS
//   node tools/build-manifest.mjs --check F   fail unless the build matches manifest F
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '../apps/web/dist');
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const lines = walk(DIST)
  .map((f) => relative(DIST, f).split(sep).join('/'))
  .filter((f) => f !== 'SHA256SUMS')
  .sort()
  .map((f) => `${createHash('sha256').update(readFileSync(join(DIST, f))).digest('hex')}  ${f}`);
const manifest = `${lines.join('\n')}\n`;

const i = process.argv.indexOf('--check');
if (i > 0) {
  const want = new Map(readFileSync(process.argv[i + 1], 'utf8').trim().split('\n').map((l) => l.split(/\s+/).reverse()));
  const have = new Map(lines.map((l) => l.split(/\s+/).reverse()));
  const diff = [...new Set([...want.keys(), ...have.keys()])].filter((f) => want.get(f) !== have.get(f));
  if (diff.length) {
    console.error(`The build is not reproducible: ${diff.length} file(s) differ:\n- ${diff.slice(0, 50).join('\n- ')}`);
    process.exit(1);
  }
  console.log(`Reproducible: all ${have.size} files match ${process.argv[i + 1]}.`);
} else {
  writeFileSync(join(DIST, 'SHA256SUMS'), manifest);
  const all = createHash('sha256').update(manifest).digest('hex');
  console.log(`${lines.length} files, build digest ${all}`);
}
