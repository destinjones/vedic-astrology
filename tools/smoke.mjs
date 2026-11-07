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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
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

  await page.locator('#jaimini').scrollIntoViewIfNeeded();
  await page.waitForSelector('#jaimini .jm-karakas', { timeout: 60000 });
  if ((await page.locator('#jaimini .jm-karakas tbody tr').count()) !== 8) problems.push('Jaimini: expected 8 chara karakas');
  if (!(await page.locator('#jaimini .dasha-seg').count())) problems.push('Jaimini: chara dasha timeline is empty');

  await page.locator('#timing').scrollIntoViewIfNeeded();
  await page.waitForSelector('#timing .vt-card', { timeout: 60000 });
  await page.fill('#vt-transit-search input[type=search]', 'Next Jupiter return');
  await page.click('#vt-transit-search .vt-ask button');
  await page.waitForSelector('#vt-transit-search .vt-results .vt-item', { timeout: 30000 }).catch(() => problems.push('transit search returned no results'));
  await page.locator('#events').scrollIntoViewIfNeeded();
  await page.waitForSelector('#events .ev-form', { timeout: 60000 });
  await page.locator('.sky-card').scrollIntoViewIfNeeded();
  await page.waitForSelector('.sky-card canvas', { timeout: 60000 });
  await page.waitForTimeout(1500);

  // keyboard: a number key switches the divisional chart, and the quick switcher finds and opens one
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  await page.keyboard.press('9');
  if (!(await page.locator('.varga-caption').innerText()).includes('Navamsha')) problems.push('keyboard: 9 did not open the Navamsha');
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('.qs-input').fill('dashamsha');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  if (!(await page.locator('.varga-caption').innerText()).includes('Dashamsha')) problems.push('quick switch: "dashamsha" + Enter did not open the D10');
  await page.locator('#varshaphal').scrollIntoViewIfNeeded();
  await page.waitForSelector('#varshaphal .vp-moment', { timeout: 60000 });
  const yearStart = await page.locator('#varshaphal .vp-moment').innerText();
  if (!/\d{2}:\d{2}:\d{2}/.test(yearStart)) problems.push(`annual chart: no return time to the second, got: ${yearStart}`);
  // the PDF report is generated in the browser; make sure it downloads and is a real PDF
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 180000 }),
    page.getByRole('button', { name: 'Download PDF report' }).click(),
  ]);
  const pdfPath = await download.path();
  const { readFileSync } = await import('node:fs');
  const pdf = readFileSync(pdfPath);
  if (pdf.subarray(0, 5).toString() !== '%PDF-') problems.push('PDF report: download is not a PDF');
  else if (pdf.length < 300_000) problems.push(`PDF report: suspiciously small (${pdf.length} bytes)`);

  const away = [...offsite];
  if (away.length) problems.push(`opening a chart called other sites: ${away.join(', ')}`);

  // Saved charts and share links: save the open chart, then reopen it from its link in a fresh browser.
  await page.getByRole('button', { name: /Save$/ }).click();
  await page.locator('.pop input').fill('Smoke test');
  await page.locator('.pop').getByRole('button', { name: 'Save chart' }).click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vedic.profiles.v1') ?? '[]'));
  if (stored.length !== 1 || stored[0].label !== 'Smoke test') problems.push('saving a chart did not store it in the browser');
  await page.getByRole('button', { name: 'Share link' }).click();
  const link = await page.locator('.pop input[readonly]').inputValue();
  if (!link.includes(`${BASE}app/#`) || !link.includes('d=')) problems.push(`share link looks wrong: ${link}`);
  const fresh = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  fresh.on('pageerror', (e) => problems.push(`share link page error: ${e.message}`));
  await fresh.goto(link);
  await fresh.waitForSelector('.summary-strip', { timeout: 60000 });
  const sharedLagna = await fresh.locator('.summary-item').first().innerText();
  if (!sharedLagna.includes('Leo')) problems.push(`share link should reopen the Leo lagna sample, got: ${sharedLagna}`);
} finally {
  await browser.close();
  await close();
}

if (problems.length) {
  console.error(`Site check failed:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('Site check passed: landing page, engine, readings, timeline, sky view, saved charts and share links all work.');
