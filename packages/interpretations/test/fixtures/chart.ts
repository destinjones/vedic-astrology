import { PLANETS, type ChartInput, type PlanetId, type SignNumber } from '../../src';

/**
 * A synthetic chart in as few fields as possible, so a fixture reads like a
 * chart description: ascendant sign, the sign of each graha, and optionally
 * the degree within that sign (default 15). Ketu is always opposite Rahu.
 */
export interface YogaFixture {
  asc: number;
  signs: Record<Exclude<PlanetId, 'ketu'>, number>;
  degrees?: Partial<Record<PlanetId, number>>;
  /** Grahas to mark as combust. */
  combust?: PlanetId[];
  /** A sentence on why this chart forms the yoga, for a human reviewer. */
  note?: string;
}

const NAK = 360 / 27;

export function chartFromFixture(f: YogaFixture): ChartInput {
  const planets = {} as ChartInput['planets'];
  const signs: Record<PlanetId, number> = { ...f.signs, ketu: ((f.signs.rahu + 5) % 12) + 1 };
  for (const p of PLANETS) {
    const s = signs[p] as SignNumber;
    const deg = p === 'ketu' ? (f.degrees?.rahu ?? 15) : (f.degrees?.[p] ?? 15);
    const longitude = (s - 1) * 30 + deg;
    planets[p] = {
      sign: s,
      house: (((s - f.asc + 12) % 12) + 1) as never,
      longitude,
      retrograde: p === 'rahu' || p === 'ketu',
      combust: f.combust?.includes(p) ?? false,
      nakshatra: Math.floor(longitude / NAK) + 1,
      pada: Math.floor((longitude % NAK) / (NAK / 4)) + 1,
    } as ChartInput['planets'][PlanetId];
  }
  return { ascendantSign: f.asc as SignNumber, planets };
}
