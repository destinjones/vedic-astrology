// Checks that the built site installs as an app and works with no connection:
//   - the manifest is valid enough to install (name, start_url, 192 and 512 PNG icons);
//   - after one visit the service worker controls the page and has cached the core files;
//   - with the network off, the app, the Swiss Ephemeris, a chart and the built-in place search still work;
//   - the offline copy holds only the site's own files: no other site, no query strings, nothing a visitor typed;
//   - a new build is offered with a Reload button, and pressing it loads the new version.
//
//   npm run build:pages && npm run offline
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serveDist, BASE } from './serve-dist.mjs';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '../apps/web/dist');
const swPath = join(DIST, 'sw.js');
const swSource = readFileSync(swPath, 'utf8');
const problems = [];
const { url, close } = await serveDist();
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  ...(process.env.PW_CHROMIUM_PATH && { executablePath: process.env.PW_CHROMIUM_PATH }),
});

try {
  const offline = JSON.parse(swSource.match(/const OFFLINE = (\{.*\});/)?.[1] ?? 'null');
  if (!offline) throw new Error('dist/sw.js has no file list: the offline-manifest build step did not run');

  // 1. the manifest
  const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8'));
  for (const k of ['name', 'short_name', 'start_url', 'display']) if (!manifest[k]) problems.push(`manifest: no ${k}`);
  for (const size of ['192x192', '512x512']) if (!manifest.icons.some((i) => i.sizes === size && i.type === 'image/png')) problems.push(`manifest: no ${size} PNG icon`);
  if (!manifest.icons.some((i) => i.purpose === 'maskable')) problems.push('manifest: no maskable icon');
  for (const i of manifest.icons) if (!offline.core.includes(i.src)) problems.push(`manifest: icon ${i.src} is not in the build`);

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));

  // 2. first visit, online: a chart with a name, so we can look for it in the cache afterwards
  const secret = 'Zebulon Quixote';
  await page.goto(`${url}${BASE}app/?utm_source=test#sample`);
  await page.waitForSelector('.summary-strip', { timeout: 60000 });
  if (!(await page.evaluate(() => document.querySelector('link[rel=manifest]')?.getAttribute('href')))) problems.push('app page: no manifest link');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 120000 }).catch(() => problems.push('service worker never took control'));
  await page.waitForSelector('.offline-note[data-note=ready]', { timeout: 10000 }).catch(() => problems.push('no "saved for offline use" notice after the first visit'));
  // something a visitor types goes into localStorage and the # only, never into the cache
  await page.evaluate((s) => { localStorage.setItem('vedic.test', s); location.hash = `name=${encodeURIComponent(s)}`; }, secret);

  const cached = await page.evaluate(async () => {
    const out = [];
    for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) out.push({ name, url: r.url });
    return out;
  });
  const prefix = `${url}${BASE}`;
  const allowed = new Set([...offline.core, ...offline.lazy].map((f) => prefix + f));
  const coreCached = new Set(cached.filter((c) => c.name.includes('core-')).map((c) => c.url));
  const missing = offline.core.filter((f) => !coreCached.has(prefix + f));
  if (missing.length) problems.push(`not cached for offline use: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` and ${missing.length - 5} more` : ''}`);
  for (const c of cached) {
    if (!allowed.has(c.url)) problems.push(`cache holds a file that is not part of the build: ${c.url}`);
    if (/[?#]/.test(c.url)) problems.push(`cache key has a query or fragment: ${c.url}`);
  }
  if (cached.some((c) => !c.name.endsWith(offline.version))) problems.push('cache name does not match the build version');

  // 3. offline: reload the app and other pages, make a chart, search the built-in places
  await context.setOffline(true);
  await page.goto(`${url}${BASE}app/#sample`);
  await page.waitForSelector('.summary-strip', { timeout: 60000 }).catch(() => problems.push('offline: the app did not load'));
  if (await page.locator('.preview-banner').count()) problems.push('offline: the Swiss Ephemeris did not load');
  const lagna = await page.locator('.summary-item').first().innerText().catch(() => '');
  if (!lagna.includes('Leo')) problems.push(`offline: sample chart lagna should be Leo, got: ${lagna}`);
  await page.waitForSelector('.offline-note[data-note=offline]', { timeout: 5000 }).catch(() => problems.push('offline: no "you are offline" notice'));
  for (const p of ['', 'compare/', 'match/', 'tools/', 'privacy/']) {
    const res = await page.goto(`${url}${BASE}${p}`).catch(() => null);
    if (!res || !res.ok()) problems.push(`offline: ${p || 'landing page'} did not load`);
  }
  // the built-in town list answers place search with no network
  await page.evaluate(() => localStorage.clear()); // a first visit: the app opens on the birth form
  await page.goto(`${url}${BASE}app/`);
  const placeBox = page.locator('.place-field input').first();
  if (await placeBox.waitFor({ timeout: 30000 }).then(() => true, () => false)) {
    await placeBox.fill('Varanasi');
    await page.locator('.place-field li, .place-field [role=option]', { hasText: 'Varanasi' }).first().waitFor({ timeout: 15000 })
      .catch(() => problems.push('offline: place search found nothing in the built-in list'));
  } else problems.push('offline: no place box in the birth form');
  await context.setOffline(false);

  // nothing typed reached the cache, under any key or in any body
  const leaked = await page.evaluate(async (s) => {
    for (const name of await caches.keys()) {
      const c = await caches.open(name);
      for (const r of await c.keys()) {
        if (r.url.includes(encodeURIComponent(s)) || r.url.includes(s)) return r.url;
        const type = (await c.match(r))?.headers.get('content-type') ?? '';
        if (/html|json|javascript|text/.test(type) && (await (await c.match(r)).text()).includes(s)) return r.url;
      }
    }
    return '';
  }, secret);
  if (leaked) problems.push(`the offline copy holds something the visitor typed: ${leaked}`);

  // 4. an update: a new sw.js is offered, and Reload switches to it
  writeFileSync(swPath, swSource.replace(`"version":"${offline.version}"`, '"version":"update-test"'));
  await page.goto(`${url}${BASE}app/#sample`);
  await page.waitForSelector('.summary-strip', { timeout: 60000 });
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
  await page.waitForSelector('.offline-note[data-note=update]', { timeout: 120000 }).then(async () => {
    await Promise.all([page.waitForEvent('load', { timeout: 60000 }), page.locator('.offline-note[data-note=update] button.primary').click()]);
    await page.waitForFunction(async () => (await caches.keys()).every((k) => k.endsWith('update-test')), null, { timeout: 30000 })
      .catch(() => problems.push('update: old caches were not removed after Reload'));
  }, () => problems.push('update: no "new version is ready" notice'));

  await context.close();
} catch (e) {
  problems.push(`check crashed: ${e.message}`);
} finally {
  writeFileSync(swPath, swSource);
  await browser.close();
  await close();
}

if (problems.length) {
  console.error(`Offline check failed:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('Offline check passed: installable, works with no connection, caches only the site\'s own files, and offers updates.');
