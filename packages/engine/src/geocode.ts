import { placeAlias } from './placeAliases';
import { timezoneAt } from './time';
import type { GeoResult } from './types';

export interface GeocodeOptions {
  /** Max results, default 8 */
  limit?: number;
  /** ISO language for names, default "en" */
  language?: string;
  /**
   * Also ask OpenStreetMap Nominatim when Open-Meteo finds nothing. Off by default:
   * the public Nominatim policy forbids client-side autocomplete and caps a whole
   * application at 1 request per second, so a public website must not use this.
   * https://operations.osmfoundation.org/policies/nominatim/
   */
  nominatimFallback?: boolean;
  /** Custom fetch (tests, proxies) */
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

/**
 * Place search for the birth-place field. Uses the free Open-Meteo geocoding
 * API (GeoNames data, CORS enabled, no key; non-commercial use, CC BY 4.0).
 * Former names such as Bombay, Madras or Pondicherry are also searched under
 * their modern name (see placeAliases.ts); those matches carry `formerly`.
 * Set nominatimFallback for villages / addresses Open-Meteo doesn't know.
 * Timezones always come from the offline tz-lookup so they are consistent.
 */
export async function geocode(query: string, opts: GeocodeOptions = {}): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const f = opts.fetch ?? fetch;
  const limit = opts.limit ?? 8;
  const language = opts.language ?? 'en';

  // Open-Meteo matches on the place name only, so search the first comma part
  const namePart = q.split(',')[0].trim();
  const rest = q.split(',').slice(1).map((s) => s.trim().toLowerCase()).filter(Boolean);
  // Former names (Bombay, Madras, Pondicherry...) are searched under their modern name too
  const alias = placeAlias(namePart);
  const count = Math.max(limit, 20);
  const [direct, renamed] = await Promise.all([
    openMeteo(namePart, count, language, f, opts.signal),
    alias ? openMeteo(alias.modern, count, language, f, opts.signal) : Promise.resolve([]),
  ]);
  const typed = alias ? titleCase(alias.former) : '';
  const tagged = renamed.map((r) => ({ ...r, formerly: typed }));
  // keep the renamed city in its own country (Madras -> Chennai, India, not a Chennai elsewhere)
  const inCountry = tagged.filter((r) => r.country === alias?.country);
  const renamedHits = inCountry.length ? inCountry : tagged.slice(0, 1);
  let results = dedupe([...renamedHits, ...direct]);
  if (rest.length) {
    const filtered = results.filter((r) => {
      const hay = `${r.name} ${r.formerly ?? ''}`.toLowerCase();
      return rest.every((p) => hay.includes(p));
    });
    if (filtered.length) results = filtered;
  }
  if (results.length) return results.slice(0, limit);

  if (!opts.nominatimFallback) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}&accept-language=${language}&q=${encodeURIComponent(
    q,
  )}`;
  const res = await f(url, { signal: opts.signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const list = (await res.json()) as any[];
  return list.map((r) => {
    const latitude = Number(r.lat);
    const longitude = Number(r.lon);
    return {
      name: r.display_name,
      latitude,
      longitude,
      timezone: safeTz(latitude, longitude) ?? 'UTC',
      country: r.address?.country,
      admin1: r.address?.state,
    };
  });
}

async function openMeteo(
  name: string,
  count: number,
  language: string,
  f: typeof fetch,
  signal?: AbortSignal,
): Promise<GeoResult[]> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      name,
    )}&count=${count}&language=${language}&format=json`;
    const res = await f(url, { signal });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: any[] };
    return (json.results ?? []).map((r) => ({
      name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: safeTz(r.latitude, r.longitude) ?? r.timezone,
      country: r.country,
      admin1: r.admin1,
      population: r.population,
      elevation: r.elevation,
    }));
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return [];
  }
}

/** Drop repeats of the same place (same name, within about a kilometre). */
function dedupe(list: GeoResult[]): GeoResult[] {
  const seen = new Set<string>();
  return list.filter((r) => {
    const key = `${r.name}|${r.latitude.toFixed(2)}|${r.longitude.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function titleCase(s: string): string {
  return s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

function safeTz(lat: number, lon: number): string | undefined {
  try {
    return timezoneAt(lat, lon);
  } catch {
    return undefined;
  }
}
