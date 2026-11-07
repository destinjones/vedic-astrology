/**
 * A cookieless visit counter (GoatCounter), for one funnel:
 *   landing → app → chart submitted → first planet click → return within 7 days.
 *
 * Off unless the build sets VITE_GOATCOUNTER to a GoatCounter site code (the
 * Pages workflow reads it from the GOATCOUNTER_CODE repository variable).
 *
 * What is sent, and only this: the page path (never the # fragment, where share
 * links keep birth details, and never the query), the page title, the screen width,
 * the referring site's host name, and the names of the events above. No cookies.
 * GoatCounter does not store IP addresses; it counts unique visits with a hash that
 * changes daily. Nothing is sent when the browser asks not to be tracked (Do Not
 * Track or Global Privacy Control).
 *
 * To spot a return visit, two day numbers are kept in this browser's localStorage
 * (va.first, va.ret). They never leave the device.
 */

const CODE: string | undefined = import.meta.env.VITE_GOATCOUNTER || undefined;

const DAY = 86_400_000;

function allowed(): boolean {
  if (!CODE || typeof navigator === 'undefined') return false;
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  return n.doNotTrack !== '1' && !n.globalPrivacyControl;
}

function send(params: Record<string, string>) {
  if (!allowed()) return;
  const q = new URLSearchParams({ ...params, s: String(screen.width), rnd: Math.random().toString(36).slice(2) });
  const url = `https://${CODE}.goatcounter.com/count?${q}`;
  try {
    if (navigator.sendBeacon?.(url)) return;
  } catch { /* fall through */ }
  new Image().src = url;
}

function referrerHost(): string | undefined {
  try {
    const r = document.referrer && new URL(document.referrer);
    return r && r.host !== location.host ? r.host : undefined;
  } catch {
    return undefined;
  }
}

/** Count a view of this page. Path only: the # fragment can hold birth details. */
export function trackPageview() {
  const r = referrerHost();
  send({ p: location.pathname, t: document.title, ...(r ? { r } : {}) });
  checkReturn();
}

/** Count a named event, such as "chart-submit". */
export function trackEvent(name: string) {
  send({ p: name, t: name, e: 'true' });
}

const once = new Set<string>();
/** Count an event at most once per page load. */
export function trackOnce(name: string) {
  if (once.has(name)) return;
  once.add(name);
  trackEvent(name);
}

/**
 * Sends "return-7d" when this browser comes back on a later day within seven
 * days of its first counted visit. At most once a day. After seven days the
 * window starts again from the next visit.
 */
function checkReturn() {
  if (!allowed()) return;
  try {
    const today = Math.floor(Date.now() / DAY);
    const first = Number(localStorage.getItem('va.first'));
    if (!first || today - first > 7) {
      localStorage.setItem('va.first', String(today));
      return;
    }
    if (today > first && Number(localStorage.getItem('va.ret')) !== today) {
      localStorage.setItem('va.ret', String(today));
      trackEvent('return-7d');
    }
  } catch { /* storage blocked: skip the return check */ }
}
