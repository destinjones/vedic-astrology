// Opens the good-first-issues in docs/community/good-first-issues.json on GitHub.
// Needs the GitHub CLI, signed in with write access: `gh auth login`.
//
//   node tools/seed-issues.mjs            dry run: print what would be created
//   node tools/seed-issues.mjs --create   create them (skips titles that already exist)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const REPO = 'destinjones/vedic-astrology';
const issues = JSON.parse(readFileSync(new URL('../docs/community/good-first-issues.json', import.meta.url), 'utf8'));
const create = process.argv.includes('--create');
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8' });

const existing = create ? new Set(JSON.parse(gh(['issue', 'list', '-R', REPO, '--state', 'all', '--limit', '500', '--json', 'title'])).map((i) => i.title)) : new Set();
const labels = [...new Set(issues.flatMap((i) => i.labels))];
if (create) for (const l of labels) { try { gh(['label', 'create', l, '-R', REPO]); } catch { /* exists */ } }

for (const i of issues) {
  if (existing.has(i.title)) { console.log(`skip (exists): ${i.title}`); continue; }
  if (!create) { console.log(`would create: ${i.title}  [${i.labels.join(', ')}]`); continue; }
  const body = i.body.replace(/\]\((?!https?:)/g, `](https://github.com/${REPO}/blob/main/`);
  const url = gh(['issue', 'create', '-R', REPO, '--title', i.title, '--body', body, ...i.labels.flatMap((l) => ['--label', l])]).trim();
  console.log(`created: ${url}`);
}
