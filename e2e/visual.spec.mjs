// Visual regression for the chart, the product itself: every divisional chart, in both
// North and South Indian style, at phone, tablet and desktop widths, for the fixed sample chart.
// A change to a picture fails CI and shows the before/after/diff in the HTML report.
import { test, expect } from '@playwright/test';

const VARGAS = ['D1', 'D2', 'D3', 'D4', 'D7', 'D9', 'D10', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60'];
const BREAKPOINTS = { phone: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 }, desktop: { width: 1280, height: 900 } };
const STYLES = { north: 'North', south: 'South' };
// Flatten the page's background gradients while taking pictures: they add nothing to what is being
// checked, make every PNG several times larger, and dither differently across GPUs.
const FLAT = 'body, .card { background: #17142f !important; backdrop-filter: none !important; box-shadow: none !important; }';

// The drifting starfield behind this long page repaints every frame, which a software GPU manages
// at about two frames a second; Playwright's stable-element checks then time out on CI. Reduced
// motion stops it (as the site does for visitors who ask) and leaves the chart itself unchanged.
test.use({ reducedMotion: 'reduce' });

for (const [size, viewport] of Object.entries(BREAKPOINTS)) {
  for (const [style, label] of Object.entries(STYLES)) {
    test(`chart ${style} ${size}`, async ({ page }) => {
      // 16 pictures per test, each taken until two in a row match; CI runners need several minutes
      test.setTimeout(10 * 60_000);
      await page.setViewportSize(viewport);
      await page.goto('app/#sample');
      await page.waitForSelector('.summary-strip', { timeout: 60_000 });
      await expect(page.locator('.preview-banner'), 'the Swiss Ephemeris should load, not the preview calculator').toHaveCount(0);
      const card = page.locator('#chart');
      await card.scrollIntoViewIfNeeded();
      await card.getByRole('radio', { name: label, exact: true }).click();
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);

      for (const id of VARGAS) {
        await card.getByRole('tab', { name: id, exact: true }).click();
        await expect(card.getByRole('tab', { name: id, exact: true })).toHaveAttribute('aria-selected', 'true');
        await page.mouse.move(0, 0);
        await expect.soft(card, `${id} ${style} chart at ${size} width`).toHaveScreenshot(`${style}-${size}-${id}.png`, { style: FLAT });
      }
    });
  }
}
