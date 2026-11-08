// The parts of the site that break first outside Chromium: the Swiss Ephemeris WebAssembly,
// the three.js sky (WebGL), share links and the chart itself. Runs in Chromium, Firefox and WebKit.
import { test as base, expect } from '@playwright/test';

// every test fails on an uncaught error in the page, which is how WASM and WebGL problems usually show up
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await use(page);
    expect(errors, 'uncaught page errors').toEqual([]);
  },
});

test('landing page renders', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('h1')).toContainText('Your birth chart');
});

for (const p of ['compare/', 'match/', 'family/', 'tools/']) {
  test(`${p} renders`, async ({ page }) => {
    await page.goto(p);
    await expect(page.locator('#root')).not.toBeEmpty();
  });
}

test('family page reads a linked relative', async ({ page }) => {
  const at = '2026-01-01T00:00:00Z';
  const input = (name, date) => ({ name, date, time: '06:30', place: 'New Delhi, India', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata', ayanamsa: 'lahiri' });
  await page.goto('family/');
  await page.evaluate(([profiles, links]) => {
    localStorage.setItem('vedic.profiles.v1', JSON.stringify(profiles));
    localStorage.setItem('vedic.family.v1', JSON.stringify(links));
  }, [
    [{ id: 'a', label: 'Asha', input: input('Asha', '1985-04-12'), savedAt: at, updatedAt: at }, { id: 'r', label: 'Riya', input: input('Riya', '2012-08-19'), savedAt: at, updatedAt: at }],
    [{ id: 'l', fromId: 'a', toId: 'r', relation: 'child', updatedAt: at }],
  ]);
  await page.goto('family/#p=a');
  await page.reload();
  await page.getByRole('button', { name: /Riya/ }).click();
  await expect(page.getByRole('heading', { name: 'Classical link' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('heading', { name: /Moon to Moon/ })).toBeVisible();
});

test('sample chart calculates with the Swiss Ephemeris', async ({ page }) => {
  await page.goto('app/#sample');
  await page.waitForSelector('.summary-strip', { timeout: 60_000 });
  await expect(page.locator('.preview-banner'), 'WebAssembly ephemeris failed and the app fell back').toHaveCount(0);
  await expect(page.locator('.summary-item').first()).toContainText('Leo');
  await expect(page.locator('#chart .chart-svg')).toBeVisible();
  await page.locator('#chart').getByRole('tab', { name: 'D9', exact: true }).click();
  await expect(page.locator('.varga-caption')).toContainText('Navamsha');
});

test('3D sky draws with WebGL, or says plainly that it cannot', async ({ page }) => {
  await page.goto('app/#sample');
  await page.waitForSelector('.summary-strip', { timeout: 60_000 });
  // CI machines have no GPU; a browser that refuses WebGL there must get the app's message, not a blank box
  const hasWebgl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  });
  await page.locator('.sky-card').scrollIntoViewIfNeeded();
  if (!hasWebgl) {
    test.info().annotations.push({ type: 'note', description: 'this browser has no WebGL here; checked the fallback message' });
    await expect(page.locator('.sky-card .sky-overlay')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.sky-card .sky-spinner')).toHaveCount(0);
    return;
  }
  const canvas = page.locator('.sky-card canvas');
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  const box = await canvas.boundingBox();
  expect(box.width).toBeGreaterThan(100);
  expect(box.height).toBeGreaterThan(100);
});

test('a share link reopens the same chart', async ({ page, browser }) => {
  await page.goto('app/#sample');
  await page.waitForSelector('.summary-strip', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Share link' }).click();
  const link = await page.locator('.pop input[readonly]').inputValue();
  expect(link).toContain('d=');
  const other = await browser.newPage();
  await other.goto(link);
  await other.waitForSelector('.summary-strip', { timeout: 60_000 });
  await expect(other.locator('.summary-item').first()).toContainText('Leo');
  await other.close();
});
