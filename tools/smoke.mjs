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

  // the other pages render (a page error is recorded by the handler above)
  for (const p of ['compare/', 'match/', 'tools/']) {
    await page.goto(`${url}${BASE}${p}`, { waitUntil: 'networkidle' });
    if (!(await page.locator('#root').innerText()).trim()) problems.push(`${p}: page is blank`);
  }

  await page.goto(`${url}${BASE}app/#sample`);
  await page.waitForSelector('.summary-strip', { timeout: 60000 });
  await page.waitForSelector('#yogas', { timeout: 60000 });
  if (await page.locator('.preview-banner').count()) problems.push('app fell back to the preview calculator: the Swiss Ephemeris did not load');
  const lagna = await page.locator('.summary-item').first().innerText();
  if (!lagna.includes('Leo')) problems.push(`sample chart lagna should be Leo, got: ${lagna}`);

  // personal features: today brief, Sade Sati countdown, rarity, the birth-time slider, story, ayanamsa diff, calendar feeds
  await page.waitForSelector('#today .fy-tiles', { timeout: 60000 }).catch(() => problems.push('today brief did not appear'));
  if (!/\d/.test(await page.locator('#sade-sati .fy-count b').innerText().catch(() => ''))) problems.push('Sade Sati countdown shows no number');
  await page.waitForSelector('#rarity .fy-count b', { timeout: 60000 }).catch(() => problems.push('rarity percentile did not appear'));
  const reach = async (sel) => {
    for (let i = 0; i < 60 && !(await page.locator(sel).count()); i++) { await page.mouse.wheel(0, 600); await page.waitForTimeout(100); }
    return page.locator(sel).first().scrollIntoViewIfNeeded().then(() => true, () => false);
  };
  if (await reach('#birth-time input[type=range]')) {
    const lagnaBefore = await page.locator('#birth-time .bts-facts li').first().innerText();
    await page.locator('#birth-time input[type=range]').focus();
    await page.keyboard.press('End'); // three hours later: a new sign has risen
    await page.waitForSelector('#birth-time .bts-facts li.is-moved', { timeout: 10000 }).catch(() => problems.push('birth-time slider: nothing moved three hours later'));
    if ((await page.locator('#birth-time .bts-facts li').first().innerText()) === lagnaBefore) problems.push('birth-time slider: the lagna did not change');
    await page.keyboard.press('Home');
  } else problems.push('birth-time slider missing');
  if (!(await reach('#story .story-ch'))) problems.push('chart story missing');
  else if (!(await page.locator('#story h4').first().innerText()).includes('Leo')) problems.push('chart story: first chapter should be about Leo rising');
  await page.locator('#yogas .yd-beginner input').check();
  if (await page.locator('#yogas .yd-grid > div').count() > 5) problems.push('beginner view shows more than five findings');
  await page.locator('#yogas .yd-beginner input').uncheck();
  if (!(await reach('#ayanamsa-diff .ayd-table'))) problems.push('ayanamsa diff missing');
  else if ((await page.locator('#ayanamsa-diff .ayd-table tbody tr').count()) !== 11) problems.push('ayanamsa diff: expected 10 bodies and the dasha row');
  for (const f of ['feeds/index.json', 'feeds/panchanga-new-delhi.ics']) {
    const r = await page.request.get(`${url}${BASE}${f}`);
    if (!r.ok()) problems.push(`${f}: ${r.status()}`);
    else if (f.endsWith('.ics') && !(await r.text()).startsWith('BEGIN:VCALENDAR')) problems.push(`${f} is not a calendar`);
  }

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
  // back at the chart, so the 3D view pauses (it only animates on screen, and without a GPU it is slow)
  // jump there without waiting for frames: with the 3D view on screen a software GPU can drop to a couple of
  // frames a second, too slow for Playwright's stable-element wait
  await page.evaluate(() => window.scrollTo(0, document.getElementById('chart').getBoundingClientRect().top + window.scrollY - 20));
  await page.locator('#chart').scrollIntoViewIfNeeded();
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  // the chart re-renders after each switch, which can take a while on a slow machine, so wait for the caption
  const captionShows = (name) => page.locator('.varga-caption', { hasText: name }).waitFor({ timeout: 15000 }).then(() => true, () => false);
  await page.keyboard.press('9');
  if (!(await captionShows('Navamsha'))) problems.push('keyboard: 9 did not open the Navamsha');
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('.qs-input').fill('dashamsha');
  // wait for the list to filter before choosing, so a slow machine does not pick the old top result
  await page.locator('.qs-list [role=option]').first().filter({ hasText: 'Dashamsha' }).waitFor({ timeout: 10000 }).catch(() => {});
  await page.keyboard.press('Enter');
  if (!(await captionShows('Dashamsha'))) problems.push('quick switch: "dashamsha" + Enter did not open the D10');
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
} catch (e) {
  // a step that throws still reports what went wrong before it
  problems.push(`stopped: ${e.message.split('\n')[0]}`);
} finally {
  await browser.close();
  await close();
}

if (problems.length) {
  console.error(`Site check failed:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('Site check passed: landing page, engine, readings, Jaimini, timeline, transit search, event checker, sky view, keyboard, annual chart, PDF report, saved charts, share links and the personal features (today brief, Sade Sati, birth-time slider, story, beginner view, ayanamsa diff, calendar feeds) all work.');
