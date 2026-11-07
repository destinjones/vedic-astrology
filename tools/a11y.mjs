// Accessibility check with axe-core, run as part of `npm run smoke`, or on its own:
//   node tools/a11y.mjs                    check the built site
//   node tools/a11y.mjs --update-baseline  accept the current problems as the starting floor
//
// It fails on any new critical or serious WCAG 2.1 A/AA problem. Problems that were already
// there when the check was added are listed in tools/a11y-baseline.json; fixing one prints a
// reminder to delete its line, so the list only shrinks.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AxeBuilder } from '@axe-core/playwright';

const BASELINE = join(dirname(fileURLToPath(import.meta.url)), 'a11y-baseline.json');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const PAGES = ['', 'compare/', 'match/', 'tools/', 'app/#sample'];

async function openEverySection(page) {
  await page.waitForSelector('#yogas', { timeout: 60000 });
  // sections render when scrolled to, so visit each before checking
  for (const s of ['#jaimini .jm-karakas', '#timing .vt-card', '#events .ev-form', '#varshaphal .vp-moment']) {
    await page.locator(s.split(' ')[0]).scrollIntoViewIfNeeded();
    await page.waitForSelector(s, { timeout: 60000 });
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
}

/** Returns { problems, found } where found is every critical/serious finding as "page · rule · selector". */
export async function checkA11y(browser, origin, base) {
  // axe needs a page from browser.newContext(), not browser.newPage()
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const found = [];
  const detail = {};
  try {
    for (const p of PAGES) {
      await page.goto(`${origin}${base}${p}`, { waitUntil: 'networkidle' });
      if (p.startsWith('app/')) await openEverySection(page);
      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).exclude('canvas').analyze();
      for (const v of violations.filter((x) => x.impact === 'critical' || x.impact === 'serious')) {
        for (const n of v.nodes) {
          // dates in selectors (a date box defaults to today) would make the key change daily
          const key = `${p || 'landing'} · ${v.id} · ${n.target.join(' ').replace(/\d{4}-\d{2}-\d{2}/g, 'DATE')}`;
          found.push(key);
          detail[key] = `${v.impact}: ${v.help} (${v.helpUrl})`;
        }
      }
    }
  } finally {
    await context.close();
  }
  let baseline = [];
  try { baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).known; } catch {}
  const known = new Set(baseline);
  const problems = [...new Set(found)].filter((k) => !known.has(k)).map((k) => `accessibility: ${k} — ${detail[k]}`);
  const fixed = baseline.filter((k) => !found.includes(k));
  if (fixed.length) console.log(`Accessibility: ${fixed.length} known problem(s) are fixed; delete them from tools/a11y-baseline.json:\n  ${fixed.join('\n  ')}`);
  return { problems, found: [...new Set(found)] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { chromium } = await import('playwright');
  const { serveDist, BASE } = await import('./serve-dist.mjs');
  const { url, close } = await serveDist();
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    ...(process.env.PW_CHROMIUM_PATH && { executablePath: process.env.PW_CHROMIUM_PATH }),
  });
  try {
    const { problems, found } = await checkA11y(browser, url, BASE);
    if (process.argv.includes('--update-baseline')) {
      writeFileSync(BASELINE, `${JSON.stringify({
        $comment: 'Critical and serious axe-core findings that predate the accessibility gate. Fix them and delete the line; never add to this list by hand.',
        known: found.sort(),
      }, null, 2)}\n`);
      console.log(`Wrote ${found.length} known problem(s) to tools/a11y-baseline.json`);
    } else if (problems.length) {
      console.error(`Accessibility check failed:\n- ${problems.join('\n- ')}`);
      process.exitCode = 1;
    } else console.log('Accessibility check passed.');
  } finally {
    await browser.close();
    await close();
  }
}
