// Renders the link-preview card (1200×630) of every famous chart into
// apps/web/public/og/<id>.jpg and lists them in apps/web/public/og/index.json.
// The build turns that list into /c/<id>/ pages whose og: tags show the card,
// so a famous chart's link unfurls as its chart in WhatsApp, Telegram, Slack,
// X and the rest.
//
// Run after `npm run build:pages` whenever the famous charts change:
//   npm run build:pages && node tools/render-og.mjs && npm run build:pages
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serveDist, BASE } from './serve-dist.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../apps/web/public/og');
mkdirSync(OUT, { recursive: true });

const { url, close } = await serveDist();
// CHROMIUM_PATH lets this run with a Chromium other than the one Playwright downloads
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${url}${BASE}embed/#famous-list`);
  await page.waitForSelector('body[data-ready=true]');
  const list = JSON.parse(await page.locator('#famous-list').textContent());
  const only = process.argv.slice(2);
  const todo = only.length ? list.filter((c) => only.includes(c.id)) : list;

  for (const c of todo) {
    // a fresh document each time: the embed page reads its hash once
    await page.goto('about:blank');
    await page.goto(`${url}${BASE}embed/#famous=${c.id}&card=og&s=north&th=dark`);
    await page.waitForSelector('body[data-ready=true]', { timeout: 60000 });
    await page.locator('#embed > svg').screenshot({ path: join(OUT, `${c.id}.jpg`), type: 'jpeg', quality: 82 });
    console.log(`og/${c.id}.jpg`);
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(list, null, 1) + '\n');
  console.log(`${todo.length} cards rendered; ${list.length} preview pages listed in og/index.json`);
} finally {
  await browser.close();
  await close();
}
