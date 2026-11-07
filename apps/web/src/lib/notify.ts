/**
 * Local notifications when a favourable window opens.
 *
 * Nothing leaves the browser. The page hands the upcoming windows to the
 * service worker, which keeps them in IndexedDB and shows a notification on
 * the first day of each one. The worker checks whenever the browser wakes it:
 * on a periodic background sync where the browser supports it (Chrome and
 * Edge, once the site is installed), and whenever the app is opened.
 * Browsers without periodic sync can only notify when the app is opened on
 * or after the first day, and the UI says so.
 */
export interface NotifyWindow {
  id: string;
  /** ISO date-time of the first day */
  start: string;
  end: string;
  title: string;
  body: string;
}

export interface NotifyState {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  enabled: boolean;
  periodicSync: boolean;
}

const FLAG = 'vedic.notify.v1';
const BASE = import.meta.env.BASE_URL;

export const notifySupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window && window.isSecureContext;

let reg: Promise<ServiceWorkerRegistration | null> | null = null;
/** Register the worker once. Safe to call often. */
export function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  reg ??= navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE }).catch(() => null);
  return reg;
}

function enabledFor(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(FLAG) ?? '{}') as Record<string, boolean>; } catch { return {}; }
}

export async function notifyState(person: string): Promise<NotifyState> {
  if (!notifySupported()) return { supported: false, permission: 'unsupported', enabled: false, periodicSync: false };
  const r = await registerWorker();
  return {
    supported: true,
    permission: Notification.permission,
    enabled: !!enabledFor()[person] && Notification.permission === 'granted',
    periodicSync: !!r && 'periodicSync' in r,
  };
}

async function post(msg: unknown) {
  const r = await registerWorker();
  const sw = r?.active ?? (await navigator.serviceWorker.ready).active;
  sw?.postMessage(msg);
}

/** Ask for permission, store the windows with the worker and turn on periodic checks. */
export async function enableNotifications(person: string, windows: NotifyWindow[]): Promise<NotifyState> {
  if (!notifySupported()) return notifyState(person);
  const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (perm !== 'granted') return notifyState(person);
  const r = await registerWorker();
  await post({ type: 'windows', person, windows });
  try {
    const ps = (r as ServiceWorkerRegistration & { periodicSync?: { register(tag: string, o: { minInterval: number }): Promise<void> } }).periodicSync;
    if (ps) await ps.register('vedic-windows', { minInterval: 12 * 3600 * 1000 });
  } catch { /* not installed, or the browser said no: opening the app still checks */ }
  const flags = enabledFor();
  flags[person] = true;
  try { localStorage.setItem(FLAG, JSON.stringify(flags)); } catch { /* ignore */ }
  await post({ type: 'check' });
  return notifyState(person);
}

export async function disableNotifications(person: string): Promise<NotifyState> {
  const flags = enabledFor();
  delete flags[person];
  try { localStorage.setItem(FLAG, JSON.stringify(flags)); } catch { /* ignore */ }
  if (notifySupported()) await post({ type: 'windows', person, windows: [] });
  return notifyState(person);
}

/** Refresh the stored windows (the timeline moves on) and let the worker check, if this person has notifications on. */
export async function syncNotifications(person: string, windows: NotifyWindow[]): Promise<void> {
  if (!notifySupported() || !enabledFor()[person] || Notification.permission !== 'granted') return;
  await post({ type: 'windows', person, windows });
  await post({ type: 'check' });
}

/** On app start: if anyone has notifications on, let the worker check now. Costs nothing otherwise. */
export function checkOnOpen(): void {
  try {
    if (!notifySupported() || Notification.permission !== 'granted' || !Object.keys(enabledFor()).length) return;
    void post({ type: 'check' });
  } catch { /* ignore */ }
}
