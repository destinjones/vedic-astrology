// Renders the app icons in apps/web/public/icons/ from the favicon artwork. Run: node tools/render-app-icons.mjs
import { chromium } from 'playwright';
const out = new URL('../apps/web/public/icons', import.meta.url).pathname;
const star = '<path d="M16 4l2.6 8.4L27 16l-8.4 2.6L16 27l-2.6-8.4L5 16l8.4-3.6z" fill="#e8b65a"/>';
// "any": the favicon as is. "maskable": full-bleed square, star inside the 80% safe zone.
const any = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#120f2a"/>${star}</svg>`;
const mask = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#120f2a"/><g transform="translate(16 16) scale(.62) translate(-16 -15.5)">${star}</g></svg>`;
await (async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
  const p = await b.newPage();
  for (const [name, svg, size] of [['icon-192.png', any, 192], ['icon-512.png', any, 512], ['icon-maskable-512.png', mask, 512], ['apple-touch-icon.png', mask, 180]]) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await p.screenshot({ path: `${out}/${name}`, omitBackground: true });
  }
  await b.close();
})();
