/**
 * Offline use and updates, for every page except the embed (which runs inside
 * other people's sites).
 *
 * The service worker (public/sw.js) keeps the site's own public files, so the
 * app keeps working with no connection once it has been opened once. This file
 * registers it and tells the reader what is going on, in a small notice at the
 * bottom of the page:
 *
 *   - once, when the site has been saved for offline use;
 *   - when a new version is ready, with a Reload button (the new version waits
 *     until then, so an open page is never switched under the reader's feet);
 *   - when the connection drops, saying what still works;
 *   - on the app page, an Install button where the browser offers one.
 *
 * Nothing here stores or sends birth details. The only things kept are two
 * flags in localStorage: the "saved for offline" notice was shown, and the
 * install offer was dismissed.
 */
import { registerWorker } from './notify';

const READY_FLAG = 'vedic.offline.ready';
const INSTALL_FLAG = 'vedic.install.dismissed';

const flag = {
  get: (k: string) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } },
  set: (k: string) => { try { localStorage.setItem(k, '1'); } catch { /* private mode: show it again next time */ } },
};

interface Action { label: string; run: () => void; primary?: boolean }

const STYLE = `
.offline-note{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;
  max-width:min(560px,calc(100vw - 32px));box-sizing:border-box;padding:10px 12px 10px 16px;border-radius:12px;
  background:#1b1836;color:#ece8f6;border:1px solid #3a3466;box-shadow:0 8px 28px rgba(0,0,0,.45);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
.offline-note p{margin:0;flex:1 1 220px}
.offline-note button{font:inherit;cursor:pointer;border-radius:8px;padding:6px 12px;border:1px solid #4a4380;background:transparent;color:inherit}
.offline-note button.primary{background:#e8b65a;border-color:#e8b65a;color:#1a1530;font-weight:600}
.offline-note button:focus-visible{outline:2px solid #e8b65a;outline-offset:2px}
@media print{.offline-note{display:none}}
`;

let box: HTMLDivElement | null = null;
let hideTimer = 0;
let current = '';

/** Show one notice at a time. A later notice replaces an earlier one. */
function note(id: string, text: string, actions: Action[] = [], autoHideMs = 0) {
  if (!document.getElementById('offline-note-style')) {
    const s = document.createElement('style');
    s.id = 'offline-note-style';
    s.textContent = STYLE;
    document.head.append(s);
  }
  box?.remove();
  clearTimeout(hideTimer);
  current = id;
  box = document.createElement('div');
  box.className = 'offline-note';
  box.dataset.note = id;
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  const p = document.createElement('p');
  p.textContent = text;
  box.append(p);
  for (const a of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = a.label;
    if (a.primary) b.className = 'primary';
    b.addEventListener('click', a.run);
    box.append(b);
  }
  document.body.append(box);
  if (autoHideMs) hideTimer = window.setTimeout(() => close(id), autoHideMs);
}
function close(id?: string) {
  if (id && id !== current) return;
  box?.remove();
  box = null;
  current = '';
}

function offerUpdate(waiting: ServiceWorker) {
  note('update', 'A new version of Jyotisha Explorer is ready. Your charts and notes stay as they are.', [
    { label: 'Reload', primary: true, run: () => { reloading = true; waiting.postMessage({ type: 'skip-waiting' }); } },
    { label: 'Later', run: () => close('update') },
  ]);
}

let reloading = false;
let started = false;

/** Register the worker and wire up the notices. Safe to call more than once. */
export function initOffline(): void {
  if (started || typeof window === 'undefined' || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  // the embed, or any page shown inside a frame, leaves the worker alone
  if (window.top !== window.self) return;
  started = true;
  // the dev server has no file list to cache; the worker still runs for notifications when asked
  if (!import.meta.env.PROD) return;

  const hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) { location.reload(); return; }
    // Another tab pressed Reload. This page's scripts are still the old version, so offer the same.
    if (hadController) note('updated', 'Jyotisha Explorer was updated in another tab. Reload to use the new version.', [
      { label: 'Reload', primary: true, run: () => location.reload() },
      { label: 'Later', run: () => close('updated') },
    ]);
  });

  void registerWorker().then((reg) => {
    if (!reg) return;
    const watch = (w: ServiceWorker | null) => {
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w);
        if (w.state === 'activated' && !hadController && !flag.get(READY_FLAG)) {
          flag.set(READY_FLAG);
          note('ready', 'Saved for offline use. This site now works without an internet connection.', [{ label: 'OK', run: () => close('ready') }], 8000);
        }
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
    watch(reg.installing);
    reg.addEventListener('updatefound', () => watch(reg.installing));
    // a page left open for days still finds new versions
    const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
    setInterval(check, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  });

  const offline = () => note('offline',
    navigator.serviceWorker.controller
      ? 'You are offline. Charts, readings and timing still work. Place search uses the built-in list of towns.'
      : 'You are offline, and this site has not finished saving for offline use yet. Open it again once you are back online.',
    [{ label: 'OK', run: () => close('offline') }]);
  window.addEventListener('offline', offline);
  window.addEventListener('online', () => close('offline'));
  if (!navigator.onLine) offline();

  // The browser's own install offer, on the app page only, until dismissed once.
  if (location.pathname.endsWith('/app/') || location.pathname.endsWith('/app/index.html')) {
    window.addEventListener('beforeinstallprompt', (e) => {
      if (flag.get(INSTALL_FLAG) || current) return;
      e.preventDefault();
      const prompt = e as Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
      note('install', 'Install Jyotisha Explorer on this device to open it like an app, with or without internet.', [
        { label: 'Install', primary: true, run: () => { close('install'); void prompt.prompt().then(() => prompt.userChoice).then(() => flag.set(INSTALL_FLAG)).catch(() => {}); } },
        { label: 'Not now', run: () => { flag.set(INSTALL_FLAG); close('install'); } },
      ]);
    });
  }
}
