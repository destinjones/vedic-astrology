/**
 * A record of every request this page has made, read from the browser's own
 * Resource Timing buffer. That buffer is filled by the browser, not by our
 * code, so it also catches requests we did not write a fetch() for: images,
 * map tiles, scripts, fonts and the WebAssembly ephemeris.
 *
 * It is a convenience view. The ground truth is your browser's DevTools
 * Network tab, which also shows requests the page tried and the browser
 * blocked.
 */

export interface LoggedRequest {
  /** milliseconds since the page started loading */
  at: number;
  url: string;
  host: string;
  /** what the browser says started it: fetch, img, script, link, css... */
  kind: string;
  /** true when it went to this site's own host */
  sameSite: boolean;
  /** bytes over the wire, 0 when cached or when the server hides it */
  bytes: number;
}

type Listener = (all: LoggedRequest[]) => void;

const entries: LoggedRequest[] = [];
const listeners = new Set<Listener>();
let started = false;

function add(list: PerformanceEntryList) {
  let changed = false;
  for (const e of list as PerformanceResourceTiming[]) {
    let u: URL;
    try { u = new URL(e.name); } catch { continue; }
    if (u.protocol === 'data:' || u.protocol === 'blob:') continue;
    entries.push({
      at: Math.round(e.startTime),
      url: e.name,
      host: u.host,
      kind: e.initiatorType || 'other',
      sameSite: u.origin === location.origin,
      bytes: e.transferSize ?? 0,
    });
    changed = true;
  }
  if (changed) listeners.forEach((l) => l(entries.slice()));
}

/** Start listening. Safe to call more than once. Picks up requests made before it was called. */
export function startRequestLog() {
  if (started || typeof PerformanceObserver === 'undefined') return;
  started = true;
  // the default buffer holds 250 entries; a long session with map tiles can pass that
  try { performance.setResourceTimingBufferSize(5000); } catch { /* old browser */ }
  try {
    new PerformanceObserver((l) => add(l.getEntries())).observe({ type: 'resource', buffered: true });
  } catch {
    add(performance.getEntriesByType('resource'));
  }
}

export function getRequests(): LoggedRequest[] {
  return entries.slice();
}

export function onRequests(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Where a third-party host fits in the privacy page's list. */
export function describeHost(host: string): string {
  if (host === 'geocoding-api.open-meteo.com') return 'Place search (Open-Meteo): the text you typed in the place box';
  if (host === 'tile.openstreetmap.org' || host.endsWith('.tile.openstreetmap.org')) return 'Map preview (OpenStreetMap): the map tiles around the place you picked';
  if (host === 'nominatim.openstreetmap.org') return 'Place search fallback (Nominatim)';
  if (host.endsWith('.goatcounter.com')) return 'Visit counter (GoatCounter): the page path and event name only, never your birth details';
  return 'Not on the privacy page list. If you set up encrypted sync, this may be the address you typed in. Otherwise please report it.';
}
