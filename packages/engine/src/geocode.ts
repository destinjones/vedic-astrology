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
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      namePart,
    )}&count=${Math.max(limit, 20)}&language=${language}&format=json`;
    const res = await f(url, { signal: opts.signal });
    if (res.ok) {
      const json = (await res.json()) as { results?: any[] };
      let results: GeoResult[] = (json.results ?? []).map((r) => ({
        name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: safeTz(r.latitude, r.longitude) ?? r.timezone,
        country: r.country,
        admin1: r.admin1,
        population: r.population,
        elevation: r.elevation,
      }));
      if (rest.length) {
        const filtered = results.filter((r) =>
          rest.every((p) => r.name.toLowerCase().includes(p)),
        );
        if (filtered.length) results = filtered;
      }
      if (results.length) return results.slice(0, limit);
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
  }

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

function safeTz(lat: number, lon: number): string | undefined {
  try {
    return timezoneAt(lat, lon);
  } catch {
    return undefined;
  }
}
