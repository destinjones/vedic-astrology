// Fails the build when the built site grows past the budgets in tools/size-budget.json.
// Swiss Ephemeris WASM and three.js drift upward quietly; this makes the growth a decision.
//
//   npm run build:pages && npm run size            check against the budget
//   npm run size -- --json                          print the measurements as JSON
//
// Sizes are measured gzip -9, which is close to what a CDN serves. Raising a budget is
// fine; do it in the same pull request as the change that needs it, so a reviewer sees why.
import { readdirSync, readFileSync, statSync, appendFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(root, 'apps/web/dist');
const budget = JSON.parse(readFileSync(join(root, 'tools/size-budget.json'), 'utf8'));

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const rel = (p) => relative(DIST, p).split(sep).join('/');
const gz = (p) => gzipSync(readFileSync(p), { level: 9 }).length;

let files;
try { files = walk(DIST); } catch { console.error('No build found. Run `npm run build:pages` first.'); process.exit(1); }

const js = files.filter((f) => f.endsWith('.js'));
const css = files.filter((f) => f.endsWith('.css'));
const sum = (list, fn) => list.reduce((n, f) => n + fn(f), 0);
const raw = (f) => statSync(f).size;

// What a visitor downloads before a page is usable: the entry script, its modulepreloads and stylesheets.
function firstLoad(html) {
  const text = readFileSync(join(DIST, html), 'utf8');
  const refs = [...text.matchAll(/(?:src|href)="[^"]*\/assets\/([^"]+\.(?:js|css))"/g)].map((m) => m[1]);
  const local = [...new Set(refs)].map((r) => join(DIST, 'assets', r));
  return sum(local, gz);
}

const largest = js.map((f) => ({ file: rel(f), gzip: gz(f) })).sort((a, b) => b.gzip - a.gzip)[0];
const measured = {
  'Landing page first load (JS+CSS, gzip)': firstLoad('index.html'),
  'Chart app first load (JS+CSS, gzip)': firstLoad('app/index.html'),
  'All JavaScript (gzip)': sum(js, gz),
  'All CSS (gzip)': sum(css, gz),
  [`Largest JS chunk (gzip): ${largest.file.replace(/-[\w-]{8}\.js$/, '.js')}`]: largest.gzip,
  'Swiss Ephemeris WASM + data (raw)': sum(files.filter((f) => f.includes(`${sep}wasm${sep}`)), raw),
  '3D art in cosmos/ (raw)': sum(files.filter((f) => f.includes(`${sep}cosmos${sep}`)), raw),
  'Whole site (raw)': sum(files, raw),
};

if (process.argv.includes('--json')) { console.log(JSON.stringify(measured, null, 2)); process.exit(0); }

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const rows = [];
let failed = false;
for (const [label, bytes] of Object.entries(measured)) {
  const key = label.startsWith('Largest JS chunk') ? 'Largest JS chunk (gzip)' : label;
  const limit = budget[key];
  if (limit === undefined) { console.error(`tools/size-budget.json has no budget for "${key}"`); failed = true; continue; }
  const over = bytes > limit;
  if (over) failed = true;
  rows.push({ label, bytes, limit, over });
}

const table = ['| Measure | Size | Budget | Used |', '|---|---:|---:|---:|',
  ...rows.map((r) => `| ${r.over ? '❌ ' : ''}${r.label} | ${kb(r.bytes)} | ${kb(r.limit)} | ${Math.round((100 * r.bytes) / r.limit)}% |`)].join('\n');
console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Bundle size\n\n${table}\n\n`);

if (failed) {
  console.error('\nBundle size budget exceeded. Shrink the change, or raise the number in tools/size-budget.json and say why in the pull request.');
  process.exit(1);
}
console.log('\nBundle size is within budget.');
