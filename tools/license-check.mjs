// Fails when a dependency's licence could conflict with shipping this project under AGPL-3.0-or-later.
// Reads package-lock.json, so it checks exactly what `npm ci` installs, platform-specific packages included.
//
//   npm run licenses              check
//   npm run licenses -- --list    also print every package and its licence
//
// The policy lives in tools/license-policy.json:
//   allowed      SPDX ids that are compatible with AGPL-3.0-or-later when shipped in the site
//   devAllowed   extra ids accepted for build and test tools, which are never shipped
//   exceptions   "package-name": "reason", for a reviewed one-off (keep this short)
import { readFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const policy = JSON.parse(readFileSync(join(root, 'tools/license-policy.json'), 'utf8'));
const allowed = new Set(policy.allowed);
const devAllowed = new Set([...policy.allowed, ...policy.devAllowed]);

// A small SPDX expression evaluator: ids, AND, OR, WITH and parentheses.
// Anything it does not recognise counts as not allowed, so "MIT OR SEE LICENSE IN x" passes on MIT.
export function satisfies(expr, ok) {
  const tokens = expr.replace(/[()]/g, ' $& ').trim().split(/\s+/);
  let i = 0;
  const atom = () => {
    const t = tokens[i++];
    if (t === '(') { const v = or(); i++; return v; }
    let id = t;
    if (tokens[i] === 'WITH') { i++; id = `${t} WITH ${tokens[i++]}`; }
    // swallow free text such as "SEE LICENSE IN FILE.md" up to the next operator
    while (i < tokens.length && !['AND', 'OR', ')'].includes(tokens[i])) id += ` ${tokens[i++]}`;
    return ok.has(id) || ok.has(id.replace(/\+$/, '-or-later'));
  };
  const and = () => { let v = atom(); while (tokens[i] === 'AND') { i++; v = atom() && v; } return v; };
  const or = () => { let v = and(); while (tokens[i] === 'OR') { i++; v = and() || v; } return v; };
  return or();
}

const problems = [];
const seen = [];
for (const [path, pkg] of Object.entries(lock.packages)) {
  if (!path || pkg.link) continue; // the root and workspace links
  const workspace = !path.includes('node_modules/');
  const name = workspace ? path : path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
  const license = pkg.license ?? (workspace ? 'AGPL-3.0-or-later' : undefined);
  const dev = Boolean(pkg.dev);
  seen.push({ name, license, dev });
  if (policy.exceptions[name]) continue;
  if (!license) { problems.push(`${name}: declares no licence`); continue; }
  if (!satisfies(license, dev ? devAllowed : allowed)) {
    problems.push(`${name}${dev ? ' (dev only)' : ''}: "${license}" is not on the allowed list`);
  }
}

if (process.argv.includes('--list')) for (const s of seen) console.log(`${s.dev ? 'dev ' : 'ship'}  ${s.license ?? '(none)'}  ${s.name}`);

const counts = {};
for (const s of seen.filter((x) => !x.dev)) counts[s.license] = (counts[s.license] ?? 0) + 1;
const summary = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l} ×${n}`).join(', ');
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Dependency licences\n\nShipped: ${summary}\n\n${problems.length ? problems.map((p) => `- ❌ ${p}`).join('\n') : 'All compatible with AGPL-3.0-or-later.'}\n\n`);
}

if (problems.length) {
  console.error(`Licence check failed:\n- ${problems.join('\n- ')}\n\nIf a licence is fine, add it to tools/license-policy.json with a note in the pull request.`);
  process.exit(1);
}
console.log(`Licence check passed: ${seen.length} packages. Shipped: ${summary}.`);
