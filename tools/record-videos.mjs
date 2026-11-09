// Records the tutorial and the landing-page promo from a local production build.
//
//   npm run build:pages && npm run videos            both videos
//   npm run videos -- tutorial                       only the tutorial
//   npm run videos -- promo                          only the promo
//
// Needs ffmpeg on the PATH. Writes to apps/web/public/media/:
//   tutorial.mp4, tutorial.jpg (poster), tutorial.vtt (captions), tutorial.json (chapters and transcript)
//   promo.mp4, promo.jpg, promo.vtt
// Every frame is the real app running the sample chart; the captions and chapter cards are drawn
// over it while recording (tools/video/overlay.js). Chapter ids and titles come from
// apps/web/src/tutorial/chapters.json, which the app uses for its "watch this part" links.
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { serveDist, BASE } from './serve-dist.mjs';
import { Capture, Director, vtt } from './video/director.mjs';
import { tutorial } from './video/tutorial.mjs';
import { promo } from './video/promo.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'apps/web/public/media');
const CHAPTERS = JSON.parse(readFileSync(join(ROOT, 'apps/web/src/tutorial/chapters.json'), 'utf8'));
const SIZE = { width: 1280, height: 800 };
const only = process.argv[2];
mkdirSync(OUT, { recursive: true });

const { url, close } = await serveDist();
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--hide-scrollbars'],
  ...(process.env.PW_CHROMIUM_PATH && { executablePath: process.env.PW_CHROMIUM_PATH }),
});

async function stage(name) {
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, serviceWorkers: 'block', locale: 'en-US', timezoneId: 'Asia/Kolkata', reducedMotion: 'no-preference' });
  await Director.prepare(context);
  await context.addInitScript(() => { try { localStorage.setItem('vedic.tutorialHint', 'off'); } catch { /* storage blocked */ } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => console.error('page error:', e.message));
  const cap = new Capture(page, join(process.env.VIDEO_FRAMES ?? tmpdir(), `frames-${name}`), SIZE);
  const d = new Director(page, cap);
  d.base = `${url}${BASE}`;
  /** Opens a page with the capture paused, so loading never shows in the video. */
  d.open = async (path, ready) => {
    await cap.pause();
    await page.goto(`${d.base}${path}`);
    if (ready) await page.waitForSelector(ready, { timeout: 60000 });
    await page.evaluate(() => window.__dir.mount());
    await page.waitForTimeout(600);
    await cap.resume();
  };
  /** Runs a slow step with the capture paused. */
  d.offscreen = async (fn) => { await cap.pause(); try { await fn(); } finally { await cap.resume(); } };
  return { context, page, cap, d };
}

const mb = (f) => `${(statSync(f).size / 1e6).toFixed(1)} MB`;

async function recordTutorial() {
  const { context, cap, d } = await stage('tutorial');
  const chapters = new Map(CHAPTERS.map((c, i) => [c.id, { ...c, number: i + 1 }]));
  d.chapterById = async (id) => {
    const c = chapters.get(id);
    if (!c) throw new Error(`Unknown chapter ${id}; add it to apps/web/src/tutorial/chapters.json`);
    await d.chapter(id, c.title, c.sub, c.number);
  };
  await tutorial(d);
  d.finish();
  const missing = CHAPTERS.filter((c) => !d.chapters.some((x) => x.id === c.id)).map((c) => c.id);
  if (missing.length && !process.env.CHAPTERS) throw new Error(`Chapters with no recording: ${missing.join(', ')}`);
  await cap.pause();
  const duration = cap.encode(join(OUT, 'tutorial.mp4'), { fps: 15, crf: 38, width: 1120, height: 700 });
  cap.poster(d.chapters[2].start + 6, join(OUT, 'tutorial.jpg'), { width: 1120, height: 700 });
  writeFileSync(join(OUT, 'tutorial.vtt'), vtt(d.cues));
  writeFileSync(join(OUT, 'tutorial.json'), `${JSON.stringify({
    duration: +duration.toFixed(2),
    chapters: d.chapters.map((c) => ({
      ...c,
      lines: d.cues.filter((q) => q.start >= c.start && (q.start < (d.chapters[d.chapters.indexOf(c) + 1]?.start ?? Infinity))).map((q) => q.text),
    })),
  }, null, 1)}\n`);
  console.log(`tutorial.mp4: ${Math.round(duration)} s, ${mb(join(OUT, 'tutorial.mp4'))}, ${d.chapters.length} chapters`);
  await context.close();
}

async function recordPromo() {
  const { context, cap, d } = await stage('promo');
  await promo(d);
  d.finish();
  await cap.pause();
  const duration = cap.encode(join(OUT, 'promo.mp4'), { fps: 25, crf: 33, width: 1120, height: 700, tail: 0 });
  cap.poster(d.posterAt ?? 1, join(OUT, 'promo.jpg'), { width: 1120, height: 700 });
  writeFileSync(join(OUT, 'promo.vtt'), vtt(d.cues));
  console.log(`promo.mp4: ${Math.round(duration)} s, ${mb(join(OUT, 'promo.mp4'))}`);
  await context.close();
}

try {
  if (!only || only === 'tutorial') await recordTutorial();
  if (!only || only === 'promo') await recordPromo();
} finally {
  await browser.close();
  await close();
}
