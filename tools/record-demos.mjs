// Records the README and landing-page GIFs from a local production build.
//
//   npm run build:pages && npm run demos
//
// Writes apps/web/public/media/{explorer,sky,timeline}.gif and og.jpg.
// Each frame is a real screenshot of the running app and the sample chart.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
import { serveDist, BASE } from './serve-dist.mjs';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'apps/web/public/media');
mkdirSync(OUT, { recursive: true });

const SIZE = { width: 1120, height: 700 };
const only = process.argv[2];

const { url, close } = await serveDist();
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});

/** Screenshots at the given pace and encodes a looping GIF with measured frame delays. */
class Recorder {
  constructor(page) { this.page = page; this.frames = []; }
  async shot(holdMs = 0) {
    const t = Date.now();
    const png = PNG.sync.read(await this.page.screenshot({ type: 'png' }));
    this.frames.push({ data: png.data, width: png.width, height: png.height, delay: 80 });
    const spent = Date.now() - t;
    if (holdMs > spent) await this.page.waitForTimeout(holdMs - spent);
  }
  hold(ms) { if (this.frames.length) this.frames.at(-1).delay += ms; }
  /** Screenshots for a stretch of real time, keeping the real spacing between frames. */
  async roll(ms, everyMs = 110) {
    const end = Date.now() + ms;
    let last = Date.now();
    while (Date.now() < end) {
      await this.shot(everyMs);
      const now = Date.now();
      this.frames.at(-1).delay = now - last;
      last = now;
    }
  }
  /** Inserts short crossfades between held frames, so steps glide instead of jumping. */
  smooth(steps = 3) {
    const out = [];
    this.frames.forEach((f, i) => {
      out.push(f);
      const next = this.frames[i + 1];
      if (!next) return;
      for (let s = 1; s <= steps; s++) {
        const k = s / (steps + 1);
        const data = Buffer.alloc(f.data.length);
        for (let b = 0; b < data.length; b++) data[b] = f.data[b] + (next.data[b] - f.data[b]) * k;
        out.push({ ...f, data, delay: 50 });
      }
    });
    this.frames = out;
  }
  save(name) {
    const gif = GIFEncoder();
    let palette = null;
    this.frames.forEach((f, i) => {
      if (i % 12 === 0) palette = quantize(f.data, 200, { format: 'rgb565' });
      gif.writeFrame(applyPalette(f.data, palette, 'rgb565'), f.width, f.height, { palette, delay: f.delay });
    });
    gif.finish();
    const path = join(OUT, `${name}.gif`);
    writeFileSync(path, gif.bytes());
    if (process.env.DEMO_FRAMES) {
      for (const k of [0.35, 0.75]) {
        const f = this.frames[Math.floor(this.frames.length * k)];
        const png = new PNG({ width: f.width, height: f.height });
        png.data = Buffer.from(f.data);
        writeFileSync(join(process.env.DEMO_FRAMES, `${name}-${k}.png`), PNG.sync.write(png));
      }
    }
    console.log(`${name}.gif: ${this.frames.length} frames, ${(gif.bytes().length / 1e6).toFixed(1)} MB`);
  }
}

async function openSample(viewport = SIZE) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${url}${BASE}app/#sample`);
  await page.waitForSelector('.summary-strip');
  await page.waitForSelector('#yogas');
  return page;
}

const hideChrome = (page) => page.addStyleTag({ content: '.topbar { display: none !important; }' });

async function explorer() {
  const page = await openSample();
  await hideChrome(page);
  await page.locator('.chart-card').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.explorer-grid').getBoundingClientRect().top + scrollY - 8));
  const r = new Recorder(page);
  await page.waitForTimeout(500);
  await r.shot(); r.hold(900);
  const pick = async (abbr) => {
    await page.locator('.chart-stage svg text', { hasText: new RegExp(`^${abbr}`) }).first().click({ force: true });
    await page.waitForTimeout(250);
    await r.shot(); r.hold(1300);
  };
  await pick('Ju');
  await pick('Sa');
  await pick('Mo');
  for (const label of ['D9', 'D10', 'D60']) {
    await page.getByRole('tab', { name: label, exact: true }).click();
    await page.waitForTimeout(200);
    await r.shot(); r.hold(900);
  }
  await page.getByRole('radio', { name: 'South' }).click();
  await page.waitForTimeout(200);
  await r.shot(); r.hold(1100);
  await page.getByRole('radio', { name: 'North' }).click();
  await page.getByRole('tab', { name: 'D1', exact: true }).click();
  await page.waitForTimeout(200);
  await r.shot(); r.hold(1200);
  r.smooth();
  r.save('explorer');
  await page.close();
}

async function sky() {
  const page = await openSample({ width: 840, height: 525 });
  await hideChrome(page);
  await page.locator('.sky-card').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.sky-card').getBoundingClientRect().top + scrollY - 8));
  await page.waitForSelector('.sky-card canvas', { timeout: 60000 });
  await page.waitForTimeout(6000); // models
  const r = new Recorder(page);
  await r.roll(8000, 170);
  r.save('sky');
  await page.close();
}

async function timeline() {
  const page = await openSample();
  await hideChrome(page);
  await page.locator('#timing').scrollIntoViewIfNeeded();
  await page.waitForSelector('#timing .vt-card', { timeout: 60000 });
  await page.evaluate(() => {
    const heading = [...document.querySelectorAll('#timing h2')].find((h) => h.textContent === 'Life weather');
    window.scrollTo(0, heading.closest('.vt-card').getBoundingClientRect().top + scrollY - 8);
  });
  await page.waitForTimeout(800);
  const r = new Recorder(page);
  await r.shot(); r.hold(1400);
  for (const label of ['7 yrs', '20 yrs', 'Lifetime', '3 yrs']) {
    await page.getByRole('button', { name: label, exact: true }).first().click();
    await page.waitForTimeout(1200);
    await r.shot(); r.hold(1300);
  }
  const step = await page.evaluate(() => innerHeight * 0.6);
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(350);
    await r.shot(); r.hold(1100);
  }
  r.smooth();
  r.save('timeline');
  await page.close();
}

async function og() {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(`${url}${BASE}`);
  await page.addStyleTag({ content: '.hero{min-height:630px!important}.promises,.nav{display:none!important}.lede{display:none}' });
  await page.waitForTimeout(800);
  writeFileSync(join(ROOT, 'apps/web/public/og.jpg'), await page.screenshot({ type: 'jpeg', quality: 86 }));
  await page.close();
}

try {
  const jobs = { explorer, sky, timeline, og };
  for (const [name, job] of Object.entries(jobs)) {
    if (!only || only === name) await job();
  }
} finally {
  await browser.close();
  await close();
}
