/**
 * Offline place search over a bundled GeoNames extract (see tools/build-gazetteer.mjs).
 * The data is a separate chunk loaded the first time someone types a place,
 * and the search runs entirely in the browser: nothing is sent anywhere.
 */
import { normalizePlaceName, placeAlias } from '@vedic/engine/places';
import type { City } from '../data/cities';

export interface GazetteerPlace {
  name: string;
  country: string;
  admin: string;
  latitude: number;
  longitude: number;
  population: number;
  timezone: string;
  /** normalised name, for matching */
  key: string;
  alt: string;
}

interface RawGazetteer { zones: string[]; rows: string }

let loaded: Promise<GazetteerPlace[]> | null = null;

export function parseGazetteer(raw: RawGazetteer): GazetteerPlace[] {
  return raw.rows.split('\n').map((line) => {
    const [name, country, admin, lat, lon, pop, zone, alt] = line.split('|');
    return {
      name, country, admin,
      latitude: Number(lat), longitude: Number(lon), population: Number(pop),
      timezone: raw.zones[Number(zone)], key: normalizePlaceName(name), alt: alt ? normalizePlaceName(alt) : '',
    };
  });
}

export function loadGazetteer(): Promise<GazetteerPlace[]> {
  if (!loaded) {
    loaded = import('../data/gazetteer.json').then((m) => parseGazetteer((m.default ?? m) as RawGazetteer));
    loaded.catch(() => { loaded = null; });
  }
  return loaded;
}

let regionNames: Intl.DisplayNames | null = null;
export const countryName = (code: string) => {
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(code) ?? code;
  } catch { return code; }
};

export const placeLabel = (p: GazetteerPlace) => [p.name, p.admin, countryName(p.country)].filter(Boolean).join(', ');

/**
 * Ranks places for what was typed: exact name, then names starting with it, then
 * names containing it, larger places first. "Pune, India" narrows by country.
 * Former names (Bombay, Madras) are searched under their modern name.
 */
export function searchPlacesIn(list: GazetteerPlace[], query: string, limit = 6): City[] {
  const parts = query.split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return [];
  const q = normalizePlaceName(parts[0]);
  if (q.length < 2) return [];
  const rest = parts.slice(1).map(normalizePlaceName);
  const alias = placeAlias(parts[0]);
  const modern = alias ? normalizePlaceName(alias.modern) : null;
  const scored: { p: GazetteerPlace; s: number; former?: string }[] = [];
  for (const p of list) {
    let s = -1;
    let former: string | undefined;
    if (modern && p.key === modern && (!alias?.country || countryName(p.country) === alias.country)) { s = 4; former = alias!.former; }
    else if (p.key === q || p.alt === q) s = 3;
    else if (p.key.startsWith(q)) s = 2;
    else if (q.length >= 3 && (p.key.includes(q) || p.alt.includes(q))) s = 1;
    if (s < 0) continue;
    if (rest.length) {
      const hay = normalizePlaceName(`${p.admin} ${countryName(p.country)} ${p.country}`);
      if (!rest.every((r) => hay.includes(r))) continue;
    }
    scored.push({ p, s, former });
  }
  // the list is already sorted by population, so a stable sort keeps big places first
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map(({ p, former }) => ({
    name: placeLabel(p),
    latitude: p.latitude,
    longitude: p.longitude,
    timezone: p.timezone,
    ...(former ? { formerly: former.replace(/\b\w/g, (c) => c.toUpperCase()) } : {}),
  }));
}

export async function searchGazetteer(query: string, limit = 6): Promise<City[]> {
  return searchPlacesIn(await loadGazetteer(), query, limit);
}

/* ---------- online lookups: the person can switch them off ---------- */

const ONLINE_KEY = 'vedic.placeSearchOnline';
/** Whether the birth form may also ask Open-Meteo. Defaults to yes. */
export function onlinePlaceSearch(): boolean {
  try { return localStorage.getItem(ONLINE_KEY) !== 'off'; } catch { return true; }
}
export function setOnlinePlaceSearch(on: boolean) {
  try { localStorage.setItem(ONLINE_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
}
