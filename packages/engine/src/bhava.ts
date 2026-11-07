/**
 * Bhava chalit: the house (bhava) chart, as opposed to the sign (rashi) chart.
 *
 * Each bhava is centred on its bhava madhya (mid-point) and runs from the
 * sandhi (junction) before it to the sandhi after it. A planet near the edge of
 * a sign can sit in a different bhava from the house its sign gives it, and the
 * classical cross-check on any house reading is to see whether it does.
 *
 * Two methods:
 *  - sripati: the madhyas trisect each quadrant between the ascendant, the MC,
 *    the descendant and the IC (Porphyry division, as Sripati Paddhati II gives
 *    it), and each sandhi is the mid-point of two neighbouring madhyas. This is
 *    what Swiss Ephemeris calls house system 'S'.
 *  - equal: each madhya is the ascendant degree plus 30° steps, with the
 *    sandhis 15° either side (the equal-house bhava of BPHS ch. 7 commentaries).
 *
 * Lordship is not changed: the bhava keeps the lord of the sign of the house in
 * the rashi chart, as the Parashari texts read lordship by sign.
 */
import { norm360 } from './zodiac';
import type { HouseNumber, PlanetId } from './types';

export type BhavaSystem = 'sripati' | 'equal';

export interface BhavaPlacement {
  /** Bhava (1–12) the planet occupies */
  bhava: HouseNumber;
  /** House the planet's sign gives it (whole sign) */
  rashiHouse: HouseNumber;
  /** bhava differs from rashiHouse */
  shifted: boolean;
  /** Degrees from the nearest sandhi; small values are weak, mixed placements */
  fromSandhi: number;
}

export interface BhavaChalit {
  system: BhavaSystem;
  /** Bhava madhya (mid-point) longitudes, index 0 = 1st bhava */
  madhya: number[];
  /** Sandhi that opens each bhava, index 0 = start of the 1st bhava */
  sandhi: number[];
  planets: Partial<Record<PlanetId, BhavaPlacement>>;
}

/** Madhyas by Porphyry trisection of the four quadrants (Sripati). */
export function sripatiMadhya(asc: number, mc: number): number[] {
  const ic = norm360(mc + 180);
  const dsc = norm360(asc + 180);
  const m = new Array<number>(12);
  m[0] = norm360(asc);
  m[3] = ic;
  m[6] = dsc;
  m[9] = norm360(mc);
  const fill = (from: number, to: number, i: number) => {
    const span = norm360(to - from);
    m[i] = norm360(from + span / 3);
    m[i + 1] = norm360(from + (2 * span) / 3);
  };
  fill(asc, ic, 1); // 2nd, 3rd
  fill(ic, dsc, 4); // 5th, 6th
  fill(dsc, mc, 7); // 8th, 9th
  fill(mc, asc, 10); // 11th, 12th
  return m;
}

export function equalMadhya(asc: number): number[] {
  return Array.from({ length: 12 }, (_, i) => norm360(asc + 30 * i));
}

/** Sandhi i (start of bhava i+1) is the mid-point of madhya i-1 and madhya i. */
export function sandhisFrom(madhya: number[]): number[] {
  return madhya.map((m, i) => {
    const prev = madhya[(i + 11) % 12];
    return norm360(prev + norm360(m - prev) / 2);
  });
}

/** Bhava (1–12) of a longitude, given the 12 opening sandhis. */
export function bhavaOfLongitude(lon: number, sandhi: number[]): HouseNumber {
  for (let i = 0; i < 12; i++) {
    const a = sandhi[i];
    const b = sandhi[(i + 1) % 12];
    if (norm360(lon - a) < norm360(b - a)) return (i + 1) as HouseNumber;
  }
  return 1;
}

export function bhavaChalit(
  system: BhavaSystem,
  asc: number,
  mc: number,
  planets: Partial<Record<PlanetId, { longitude: number; house: number }>>,
  ascSign: number,
): BhavaChalit {
  const madhya = system === 'sripati' ? sripatiMadhya(asc, mc) : equalMadhya(asc);
  const sandhi = sandhisFrom(madhya);
  const out: BhavaChalit['planets'] = {};
  for (const [id, p] of Object.entries(planets) as [PlanetId, { longitude: number }][]) {
    if (!p) continue;
    const bhava = bhavaOfLongitude(p.longitude, sandhi);
    const sign = Math.floor(norm360(p.longitude) / 30) + 1;
    const rashiHouse = ((((sign - ascSign) % 12) + 12) % 12 + 1) as HouseNumber;
    const fromSandhi = Math.min(...sandhi.map((s) => {
      const d = Math.abs(norm360(p.longitude - s));
      return d > 180 ? 360 - d : d;
    }));
    out[id] = { bhava, rashiHouse, shifted: bhava !== rashiHouse, fromSandhi };
  }
  return { system, madhya, sandhi, planets: out };
}
