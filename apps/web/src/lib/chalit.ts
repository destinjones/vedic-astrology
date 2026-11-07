import type { BhavaChalit, BhavaSystem } from '@vedic/engine';
import type { PlanetId, VargaChart } from '../types/chart';

export type HouseMode = 'rashi' | BhavaSystem;

/** Bhava (1–12) of each planet, for the readings. */
export function chalitHouses(c: BhavaChalit): Partial<Record<string, number>> {
  return Object.fromEntries(Object.entries(c.planets).map(([id, p]) => [id, p!.bhava]));
}

/** The D1 varga with each planet moved into its bhava. Signs and the lagna stay as they are. */
export function withChalit(v: VargaChart, c: BhavaChalit | null): VargaChart {
  if (!c) return v;
  const planets = { ...v.planets };
  for (const id of Object.keys(planets) as PlanetId[]) {
    const p = c.planets[id];
    if (p) planets[id] = { ...planets[id], house: p.bhava };
  }
  return { ...v, planets };
}
