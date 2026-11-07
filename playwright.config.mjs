// Browser tests against the built site (npm run build:pages first).
//   npm run test:visual            chart screenshots, Chromium
//   npm run test:browsers          the site in Chromium, Firefox and WebKit (Safari's engine)
//   npm run test:visual -- --update-snapshots   accept new chart pictures (see e2e/README.md)
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const chromiumArgs = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
// PW_CHROMIUM_PATH points at an already-installed Chromium when the bundled one is not downloaded
const chromium = { args: chromiumArgs, ...(process.env.PW_CHROMIUM_PATH && { executablePath: process.env.PW_CHROMIUM_PATH }) };

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: {
    timeout: 20_000,
    // Charts are SVG with bundled web fonts, so pictures are stable; allow only anti-aliasing noise.
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, threshold: 0.2, animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  // one folder of pictures per platform, so a Mac run never compares against Linux pictures
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{testFilePath}/{arg}{ext}',
  fullyParallel: true,
  // GitHub's Linux runners have 4 cores; the default of half of them leaves the chart pictures waiting
  workers: process.env.CI ? 4 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/vedic-astrology/`,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    trace: 'off',
  },
  webServer: {
    command: `node tools/serve-dist.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/vedic-astrology/`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'visual', testMatch: /visual\.spec/, use: { ...devices['Desktop Chrome'], launchOptions: chromium } },
    { name: 'chromium', testMatch: /browsers\.spec/, use: { ...devices['Desktop Chrome'], launchOptions: chromium } },
    // headless Firefox turns WebGL off without a GPU; force Mesa's software renderer so three.js is really tested
    { name: 'firefox', testMatch: /browsers\.spec/, use: { ...devices['Desktop Firefox'], launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true, 'webgl.disabled': false } } } },
    { name: 'webkit', testMatch: /browsers\.spec/, use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-safari', testMatch: /browsers\.spec/, use: { ...devices['iPhone 15'] } },
  ],
});
