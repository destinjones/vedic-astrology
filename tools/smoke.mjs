// Refuses to publish a broken site. Serves the built site under the Pages path and
// checks in a real browser that the engine, art, readings and timeline all load.
import { chromium } from 'playwright';
import { serveDist, BASE } from './serve-dist.mjs';

const { url, close } = await serveDist();
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const problems = [];

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const offsite = new Set();
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console error: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
  page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) offsite.add(r.url()); });

  await page.goto(`${url}${BASE}`, { waitUntil: 'networkidle' });
  if (!(await page.locator('h1').innerText()).includes('Your entire sky')) problems.push('landing page: headline missing');
  const brokenImages = await page.evaluate(() => [...document.images].filter((i) => i.loading !== 'lazy' && !i.naturalWidth).map((i) => i.src));
  brokenImages.forEach((s) => problems.push(`broken image: ${s}`));
  if (offsite.size) problems.push(`landing page called other sites: ${[...offsite].join(', ')}`);

  await page.goto(`${url}${BASE}app/#sample`);
  await page.waitForSelector('.summary-strip', { timeout: 60000 });
  await page.waitForSelector('#yogas', { timeout: 60000 });
  if (await page.locator('.preview-banner').count()) problems.push('app fell back to the preview calculator: the Swiss Ephemeris did not load');
  const lagna = await page.locator('.summary-item').first().innerText();
  if (!lagna.includes('Leo')) problems.push(`sample chart lagna should be Leo, got: ${lagna}`);

  await page.locator('#timing').scrollIntoViewIfNeeded();
  await page.waitForSelector('#timing .vt-card', { timeout: 60000 });
  await page.locator('#events').scrollIntoViewIfNeeded();
  await page.waitForSelector('#events .ev-form', { timeout: 60000 });
  await page.locator('.sky-card').scrollIntoViewIfNeeded();
  await page.waitForSelector('.sky-card canvas', { timeout: 60000 });
  await page.waitForTimeout(1500);

  const away = [...offsite];
  if (away.length) problems.push(`opening a chart called other sites: ${away.join(', ')}`);
} finally {
  await browser.close();
  await close();
}

if (problems.length) {
  console.error(`Site check failed:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('Site check passed: landing page, engine, readings, timeline and sky view all load.');
