/**
 * Ashtakavarga (Parashari): Bhinnashtakavarga for the seven planets and the
 * Sarvashtakavarga, plus transit-strength helpers.
 */
import { type NatalChart, SEVEN, type SevenPlanet, type SignIndex, SIGNS } from './types';
import { signOf } from './astro';

type Contributor = SevenPlanet | 'Lagna';
const CONTRIBUTORS: Contributor[] = [...SEVEN, 'Lagna'];

/** BAV_TABLE[planet][contributor] = houses (counted from the contributor) that receive a bindu. */
export const BAV_TABLE: Record<SevenPlanet, Record<Contributor, number[]>> = {
  Sun: {
    Sun: [1, 2, 4, 7, 8, 9, 10, 11], Moon: [3, 6, 10, 11], Mars: [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury: [3, 5, 6, 9, 10, 11, 12], Jupiter: [5, 6, 9, 11], Venus: [6, 7, 12],
    Saturn: [1, 2, 4, 7, 8, 9, 10, 11], Lagna: [3, 4, 6, 10, 11, 12],
  },
  Moon: {
    Sun: [3, 6, 7, 8, 10, 11], Moon: [1, 3, 6, 7, 10, 11], Mars: [2, 3, 5, 6, 9, 10, 11],
    Mercury: [1, 3, 4, 5, 7, 8, 10, 11], Jupiter: [1, 4, 7, 8, 10, 11, 12], Venus: [3, 4, 5, 7, 9, 10, 11],
    Saturn: [3, 5, 6, 11], Lagna: [3, 6, 10, 11],
  },
  Mars: {
    Sun: [3, 5, 6, 10, 11], Moon: [3, 6, 11], Mars: [1, 2, 4, 7, 8, 10, 11], Mercury: [3, 5, 6, 11],
    Jupiter: [6, 10, 11, 12], Venus: [6, 8, 11, 12], Saturn: [1, 4, 7, 8, 9, 10, 11], Lagna: [1, 3, 6, 10, 11],
  },
  Mercury: {
    Sun: [5, 6, 9, 11, 12], Moon: [2, 4, 6, 8, 10, 11], Mars: [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury: [1, 3, 5, 6, 9, 10, 11, 12], Jupiter: [6, 8, 11, 12], Venus: [1, 2, 3, 4, 5, 8, 9, 11],
    Saturn: [1, 2, 4, 7, 8, 9, 10, 11], Lagna: [1, 2, 4, 6, 8, 10, 11],
  },
  Jupiter: {
    Sun: [1, 2, 3, 4, 7, 8, 9, 10, 11], Moon: [2, 5, 7, 9, 11], Mars: [1, 2, 4, 7, 8, 10, 11],
    Mercury: [1, 2, 4, 5, 6, 9, 10, 11], Jupiter: [1, 2, 3, 4, 7, 8, 10, 11], Venus: [2, 5, 6, 9, 10, 11],
    Saturn: [3, 5, 6, 12], Lagna: [1, 2, 4, 5, 6, 7, 9, 10, 11],
  },
  Venus: {
    Sun: [8, 11, 12], Moon: [1, 2, 3, 4, 5, 8, 9, 11, 12], Mars: [3, 5, 6, 9, 11, 12],
    Mercury: [3, 5, 6, 9, 11], Jupiter: [5, 8, 9, 10, 11], Venus: [1, 2, 3, 4, 5, 8, 9, 10, 11],
    Saturn: [3, 4, 5, 8, 9, 10, 11], Lagna: [1, 2, 3, 4, 5, 8, 9, 11],
  },
  Saturn: {
    Sun: [1, 2, 4, 7, 8, 10, 11], Moon: [3, 6, 11], Mars: [3, 5, 6, 10, 11, 12], Mercury: [6, 8, 9, 10, 11, 12],
    Jupiter: [5, 6, 11, 12], Venus: [6, 11, 12], Saturn: [3, 5, 6, 11], Lagna: [1, 3, 4, 6, 10, 11],
  },
};

export const BAV_TOTALS: Record<SevenPlanet, number> = { Sun: 48, Moon: 49, Mars: 39, Mercury: 54, Jupiter: 56, Venus: 52, Saturn: 39 };

export interface Ashtakavarga {
  /** bav[planet][sign] = bindus 0..8 */
  bav: Record<SevenPlanet, number[]>;
  /** sav[sign] = total bindus (sum 337) */
  sav: number[];
  /** Per-sign, which contributors gave a bindu for each planet (for the "prastara" detail view). */
  prastara: Record<SevenPlanet, Contributor[][]>;
}

export function computeAshtakavarga(chart: NatalChart): Ashtakavarga {
  const signOfC = (c: Contributor): SignIndex => (c === 'Lagna' ? signOf(chart.ascendant) : signOf(chart.planets[c].longitude));
  const bav = {} as Ashtakavarga['bav'];
  const prastara = {} as Ashtakavarga['prastara'];
  for (const p of SEVEN) {
    const row = new Array(12).fill(0);
    const pr: Contributor[][] = Array.from({ length: 12 }, () => []);
    for (const c of CONTRIBUTORS) {
      const from = signOfC(c);
      for (const h of BAV_TABLE[p][c]) {
        const s = (from + h - 1) % 12;
        row[s]++;
        pr[s].push(c);
      }
    }
    bav[p] = row;
    prastara[p] = pr;
  }
  const sav = new Array(12).fill(0).map((_, s) => SEVEN.reduce((a, p) => a + bav[p][s], 0));
  return { bav, sav, prastara };
}

/**
 * Kakshya: each sign is split into 8 sub-divisions of 3deg45' ruled in order by
 * Saturn, Jupiter, Mars, Sun, Venus, Mercury, Moon, Lagna. A transit is
 * strongest when the kakshya lord contributed a bindu to that sign.
 */
export const KAKSHYA_ORDER: Contributor[] = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Lagna'];
export function kakshya(lon: number): { index: number; lord: Contributor } {
  const i = Math.floor(((lon % 30) + 30) % 30 / 3.75);
  return { index: i, lord: KAKSHYA_ORDER[i] };
}

/** Human-readable reading of a sign's SAV score. */
export function savQuality(points: number): string {
  if (points >= 32) return 'very strong sign: transits here bring notable gains';
  if (points >= 28) return 'above average: generally supportive';
  if (points >= 25) return 'average';
  return 'weak sign: transits here need extra care';
}

export function describeAshtakavarga(av: Ashtakavarga) {
  return SIGNS.map((name, s) => ({ sign: s, name, sav: av.sav[s], quality: savQuality(av.sav[s]) }));
}
