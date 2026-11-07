/*
 * Jyotisha Explorer service worker: local notifications only.
 *
 * The app posts each person's upcoming favourable windows here; they are kept
 * in IndexedDB (this browser only, nothing is sent anywhere). On every check
 * the worker shows one notification per window whose first day has come,
 * once. Checks run on a periodic background sync where the browser offers it,
 * and whenever the app is opened.
 *
 * There is deliberately no fetch handler: this worker does not cache or
 * intercept anything, so it cannot serve stale pages.
 */
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

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// one job at a time, so a check always sees the windows posted just before it
let queue = Promise.resolve();
const serial = (job) => (queue = queue.then(job, job));

self.addEventListener('message', (e) => {
  const m = e.data || {};
  if (m.type === 'windows' && typeof m.person === 'string') e.waitUntil(serial(() => setWindows(m.person.slice(0, 200), m.windows)));
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
