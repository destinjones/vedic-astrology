/*
 * Jyotisha Explorer service worker: offline use and local notifications.
 *
 * Offline. The build replaces OFFLINE below with the list of files the site is
 * made of (see offlineManifest in vite.config.ts). On install the worker
 * downloads the "core" files: every page, script, style, font, the Swiss
 * Ephemeris and the built-in place list. "Lazy" files, such as the learn pages,
 * are kept once they have been opened. A request for anything else, from any
 * other site, or anything but a plain GET goes straight to the network and is
 * never stored. So the cache only ever holds the same public files every
 * visitor gets, never anyone's birth details: those stay in localStorage and
 * after the # of a link, which never reaches this worker.
 *
 * Updates. A new build makes a new worker, which waits while the old version is
 * open. The page shows "A new version is ready" (src/lib/offline.ts); pressing
 * Reload tells this worker to take over, and old caches are then deleted.
 *
 * Notifications. The app posts each person's upcoming favourable windows here;
 * they are kept in IndexedDB (this browser only, nothing is sent anywhere). On
 * every check the worker shows one notification per window whose first day has
 * come, once. Checks run on a periodic background sync where the browser offers
 * it, and whenever the app is opened.
 *
 * In development OFFLINE stays null, and the worker caches nothing.
 */
const OFFLINE = null;

const PREFIX = 'jyotisha-';
const SCOPE = new URL(self.registration.scope);
const CORE = OFFLINE ? `${PREFIX}core-${OFFLINE.version}` : '';
const LAZY = OFFLINE ? `${PREFIX}lazy-${OFFLINE.version}` : '';
const core = new Set(OFFLINE ? OFFLINE.core : []);
const lazy = new Set(OFFLINE ? OFFLINE.lazy : []);

/** The file a request is for, as the build lists it ('' is the landing page), or null when it is not ours. */
function fileOf(request) {
  if (request.method !== 'GET' || request.headers.has('range')) return null;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return null;
  let path = url.pathname.slice(SCOPE.pathname.length);
  try { path = decodeURIComponent(path); } catch { return null; }
  if (path === 'index.html' || path.endsWith('/index.html')) path = path.slice(0, -'index.html'.length);
  // a page without its trailing slash (app instead of app/)
  if (request.mode === 'navigate' && !core.has(path) && !lazy.has(path) && core.has(`${path}/`)) path += '/';
  // A query string never changes a static file. Pages may be opened with one (a campaign tag, say),
  // and get the same page; any other request with a query is not ours to answer.
  if (url.search && request.mode !== 'navigate') return null;
  return core.has(path) || lazy.has(path) ? path : null;
}
const keyOf = (path) => new URL(path, SCOPE).href;

async function precache() {
  const cache = await caches.open(CORE);
  // `reload` skips the browser's HTTP cache, so a half-updated host cannot mix two versions.
  // Any failure fails the install, and the browser tries again on the next visit.
  const list = [...core];
  for (let i = 0; i < list.length; i += 12) {
    await Promise.all(list.slice(i, i + 12).map(async (path) => {
      const res = await fetch(new Request(keyOf(path), { cache: 'reload', credentials: 'omit' }));
      if (!res.ok) throw new Error(`${res.status} ${path}`);
      await cache.put(keyOf(path), res);
    }));
  }
}

async function respond(event, path) {
  const key = keyOf(path);
  const hit = await caches.match(key, { cacheName: core.has(path) ? CORE : LAZY });
  if (hit) return hit;
  const res = await fetch(event.request);
  // keep a lazy file once seen; a core file missing from its cache (storage was cleared) is put back
  if (res.ok && res.type === 'basic' && !res.redirected) {
    const copy = res.clone();
    event.waitUntil(caches.open(core.has(path) ? CORE : LAZY).then((c) => c.put(key, copy)).catch(() => {}));
  }
  return res;
}

self.addEventListener('install', (e) => {
  if (OFFLINE) e.waitUntil(precache());
  // The first install takes over at once. An update waits until the page says so, so an open
  // page never loads half its scripts from one version and half from the next.
  if (!self.registration.active || !OFFLINE) self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = new Set([CORE, LAZY]);
    for (const name of await caches.keys()) if (name.startsWith(PREFIX) && !keep.has(name)) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  if (!OFFLINE) return;
  const path = fileOf(e.request);
  if (path === null) return; // not one of the site's own files: the browser fetches it as usual
  e.respondWith(respond(e, path));
});

const DB = 'vedic-notify';
const STORE = 'kv';

function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function get(key) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function put(key, value) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const clean = (w) =>
  w && typeof w.id === 'string' && typeof w.start === 'string' && typeof w.end === 'string'
    ? { id: w.id.slice(0, 160), start: w.start, end: w.end, title: String(w.title || 'A favourable window opens').slice(0, 120), body: String(w.body || '').slice(0, 400) }
    : null;

async function setWindows(person, windows) {
  const all = (await get('windows')) || {};
  const list = Array.isArray(windows) ? windows.map(clean).filter(Boolean).slice(0, 200) : [];
  if (list.length) all[person] = list;
  else delete all[person];
  await put('windows', all);
}

async function check() {
  const all = (await get('windows')) || {};
  const shown = new Set((await get('shown')) || []);
  const now = Date.now();
  let changed = false;
  for (const list of Object.values(all)) {
    for (const w of list) {
      const start = Date.parse(w.start), end = Date.parse(w.end);
      if (!(start <= now && now < end) || shown.has(w.id)) continue;
      await self.registration.showNotification(w.title, {
        body: w.body,
        tag: w.id,
        icon: new URL('favicon.svg', self.registration.scope).href,
        data: { url: new URL('app/#timing', self.registration.scope).href },
      });
      shown.add(w.id);
      changed = true;
    }
  }
  if (changed) await put('shown', [...shown].slice(-1000));
}


// one job at a time, so a check always sees the windows posted just before it
let queue = Promise.resolve();
const serial = (job) => (queue = queue.then(job, job));

self.addEventListener('message', (e) => {
  const m = e.data || {};
  if (m.type === 'skip-waiting') self.skipWaiting();
  else if (m.type === 'version' && e.source) e.source.postMessage({ type: 'version', version: OFFLINE ? OFFLINE.version : null });
  else if (m.type === 'windows' && typeof m.person === 'string') e.waitUntil(serial(() => setWindows(m.person.slice(0, 200), m.windows)));
  else if (m.type === 'check') e.waitUntil(serial(check));
});

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'vedic-windows') e.waitUntil(serial(check));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope));
      if (open) return open.focus().then((c) => c && 'navigate' in c ? c.navigate(url) : c);
      return self.clients.openWindow(url);
    }),
  );
});
