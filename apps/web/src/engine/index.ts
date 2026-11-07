import type { BirthInput, Chart } from '../types/chart';
import { fromEngine } from './adapter';
import { mockChart } from './mock';

/**
 * Single seam between the UI and @vedic/engine.
 * The engine (Swiss Ephemeris WASM) is loaded lazily on first use; if it
 * fails to load, the UI falls back to the approximate preview calculator.
 */
let enginePromise: Promise<import('@vedic/engine').Engine> | null = null;

async function loadEngine() {
  if (!enginePromise) {
    enginePromise = import('@vedic/engine').then((m) => m.createEngine());
    enginePromise.catch(() => { enginePromise = null; });
  }
  return enginePromise;
}

export async function computeChart(input: BirthInput): Promise<Chart> {
  try {
    const engine = await loadEngine();
    const c = engine.computeChart(
      {
        date: input.date,
        time: input.time,
        name: input.name,
        place: { name: input.place, latitude: input.latitude, longitude: input.longitude, timezone: input.timezone || undefined },
      },
      { ayanamsa: input.ayanamsa, dashaLevels: 2 },
    );
    return fromEngine(input, c);
  } catch (err) {
    console.error('Engine unavailable, using preview calculator', err);
    return mockChart(input);
  }
}

export async function searchPlaces(query: string, signal?: AbortSignal) {
  const { geocode } = await import('@vedic/engine');
  return geocode(query, { limit: 6, signal });
}
