/**
 * Classical (Parashari) building blocks used by the scoring model.
 * Sources are noted inline; see docs/SCORING.md for the full rationale.
 */
import type { NatalChart, Planet } from './types';
import { EXALTATION, OWN_SIGNS, SIGN_LORD, degInSign, dignity, houseFrom, housesRuled, relation, signOf } from './astro';

export type CompoundDignity = 'exalted' | 'moolatrikona' | 'own' | 'great_friend' | 'friend' | 'neutral' | 'enemy' | 'great_enemy' | 'debilitated';

/** Points per dignity (BPHS 3: a planet's results scale with its dignity). */
export const COMPOUND_SCORE: Record<CompoundDignity, number> = {
  exalted: 30, moolatrikona: 24, own: 20, great_friend: 14, friend: 8, neutral: 0, enemy: -10, great_enemy: -16, debilitated: -30,
};

/**
 * Tatkalika (temporal) relationship, BPHS 3.55: planets in the 2nd, 3rd, 4th,
 * 10th, 11th and 12th from a planet are its temporary friends; the rest are enemies.
 */
export function temporalFriend(chart: NatalChart, a: Planet, b: Planet): boolean {
  const h = houseFrom(signOf(chart.planets[a].longitude), signOf(chart.planets[b].longitude));
  return [2, 3, 4, 10, 11, 12].includes(h);
}

/** Panchadha (five-fold) relationship = natural + temporal, BPHS 3.56-57. */
export function compoundRelation(chart: NatalChart, a: Planet, b: Planet): 'great_friend' | 'friend' | 'neutral' | 'enemy' | 'great_enemy' {
  if (a === b) return 'friend';
  const n = relation(a, b);
  const t = temporalFriend(chart, a, b) ? 1 : -1;
  const s = (n === 'friend' ? 1 : n === 'enemy' ? -1 : 0) + t;
  return (['great_enemy', 'enemy', 'neutral', 'friend', 'great_friend'] as const)[s + 2];
}

/** Dignity of a natal planet using the compound relationship with its sign lord. */
export function compoundDignity(chart: NatalChart, p: Planet): CompoundDignity {
  const lon = chart.planets[p].longitude;
  const base = dignity(p, lon);
  if (base === 'exalted' || base === 'debilitated' || base === 'moolatrikona' || base === 'own') return base;
  const lord = SIGN_LORD[signOf(lon)];
  if (lord === p) return 'own';
  return compoundRelation(chart, p, lord);
}

/**
 * Neecha bhanga (cancellation of debilitation), Phaladeepika 7.26-27, the
 * commonly used conditions: the lord of the debilitation sign, or the planet
 * exalted in that sign, is in a kendra from the lagna or the Moon.
 */
export function neechaBhanga(chart: NatalChart, p: Planet): string | null {
  const s = signOf(chart.planets[p].longitude);
  const asc = signOf(chart.ascendant), moon = signOf(chart.planets.Moon.longitude);
  const kendraFrom = (from: number, q: Planet) => [1, 4, 7, 10].includes(houseFrom(from, signOf(chart.planets[q].longitude)));
  const candidates: Planet[] = [SIGN_LORD[s]];
  const exaltedHere = (Object.keys(EXALTATION) as Planet[]).find((q) => EXALTATION[q] === s && q !== 'Rahu' && q !== 'Ketu');
  if (exaltedHere) candidates.push(exaltedHere);
  for (const q of candidates) {
    if (q === p) continue;
    if (kendraFrom(asc, q)) return `${q} is in a kendra from the lagna`;
    if (kendraFrom(moon, q)) return `${q} is in a kendra from the Moon`;
  }
  return null;
}

/**
 * Baladi avastha (BPHS 45): odd signs 0-6° infant, 6-12° youth, 12-18° adult,
 * 18-24° old, 24-30° dead; even signs reversed. The share of results a planet
 * can deliver: 1/4, 1/2, full, very little, nil.
 */
export const AVASTHA_FACTOR = { bala: 0.25, kumara: 0.5, yuva: 1, vriddha: 0.1, mrita: 0 } as const;
export type Avastha = keyof typeof AVASTHA_FACTOR;
export function baladiAvastha(lon: number): Avastha {
  const order: Avastha[] = ['bala', 'kumara', 'yuva', 'vriddha', 'mrita'];
  const i = Math.min(4, Math.floor(degInSign(lon) / 6));
  const odd = signOf(lon) % 2 === 0; // Aries (index 0) is an odd sign
  return odd ? order[i] : order[4 - i];
}

/** Graha drishti in signs, BPHS 26: all aspect the 7th; Mars 4/8, Jupiter 5/9, Saturn 3/10 (nodes per many authors: 5/9). */
export const SPECIAL_ASPECTS: Partial<Record<Planet, number[]>> = { Mars: [4, 8], Jupiter: [5, 9], Saturn: [3, 10], Rahu: [5, 9], Ketu: [5, 9] };
export function aspects(chart: NatalChart, a: Planet, b: Planet): boolean {
  const h = houseFrom(signOf(chart.planets[a].longitude), signOf(chart.planets[b].longitude));
  return h === 7 || (SPECIAL_ASPECTS[a]?.includes(h) ?? false);
}

/**
 * Sambandha (relationship) between two planets, BPHS 39-41: conjunction,
 * mutual aspect, or exchange of signs (parivartana). One-way aspect counts weaker.
 */
export function sambandha(chart: NatalChart, a: Planet, b: Planet): 'conjunction' | 'exchange' | 'mutual aspect' | 'aspect' | null {
  if (a === b) return null;
  const sa = signOf(chart.planets[a].longitude), sb = signOf(chart.planets[b].longitude);
  if (sa === sb) return 'conjunction';
  if (OWN_SIGNS[a].includes(sb) && OWN_SIGNS[b].includes(sa) && a !== 'Rahu' && a !== 'Ketu' && b !== 'Rahu' && b !== 'Ketu') return 'exchange';
  const ab = aspects(chart, a, b), ba = aspects(chart, b, a);
  if (ab && ba) return 'mutual aspect';
  if (ab || ba) return 'aspect';
  return null;
}

/** Waxing Moon (Shukla paksha) is a natural benefic, waning (Krishna) a malefic (BPHS 3.12). */
export function moonIsWaxing(chart: NatalChart): boolean {
  const el = ((chart.planets.Moon.longitude - chart.planets.Sun.longitude) % 360 + 360) % 360;
  return el < 180;
}

export interface Lordship {
  houses: number[];
  /** -1..1 functional nature. */
  value: number;
  yogakaraka: boolean;
  notes: string[];
}

/**
 * Functional nature for the ascendant (BPHS 34, Laghu Parashari 1-2):
 * - trikona lords (5th, 9th) are benefic; the lagna lord is always auspicious;
 * - lords of 3, 6, 11 are malefic, increasingly so in that order;
 * - kendra lords (4, 7, 10) lose natural beneficence (kendradhipati dosha) and
 *   natural malefics lose maleficence, the effect growing 4th < 7th < 10th;
 * - the 8th lord is malefic unless it also rules the lagna;
 * - 2nd and 12th lords are neutral and follow their associations;
 * - a planet ruling both a kendra and a trikona is a yogakaraka.
 */
export function lordship(planet: Planet, ascSign: number, chart?: NatalChart): Lordship {
  if (planet === 'Rahu' || planet === 'Ketu') return { houses: [], value: 0, yogakaraka: false, notes: ['no lordship'] };
  const houses = housesRuled(planet, ascSign);
  const natBen = planet === 'Jupiter' || planet === 'Venus' || (planet === 'Mercury') || (planet === 'Moon' && (!chart || moonIsWaxing(chart)));
  const notes: string[] = [];
  let v = 0;
  for (const h of houses) {
    switch (h) {
      case 1: v += 0.7; notes.push('lagna lord'); break;
      case 5: v += 0.8; notes.push('5th lord (trikona)'); break;
      case 9: v += 1; notes.push('9th lord (trikona)'); break;
      case 4: case 7: case 10: {
        const k = h === 4 ? 0.2 : h === 7 ? 0.3 : 0.4;
        // The lagna lord is always auspicious, so kendradhipati dosha does not apply to it.
        const dosha = natBen && !houses.includes(1);
        v += dosha ? -k : natBen ? 0 : k;
        notes.push(`${h}th lord (kendra${dosha ? ', kendradhipati dosha' : ''})`);
        break;
      }
      case 3: v -= 0.4; notes.push('3rd lord'); break;
      case 6: v -= 0.6; notes.push('6th lord'); break;
      case 11: v -= 0.7; notes.push('11th lord'); break;
      case 8: if (!houses.includes(1)) { v -= 0.8; notes.push('8th lord'); } else notes.push('8th lord, but also lagna lord'); break;
      case 2: notes.push('2nd lord (neutral)'); break;
      case 12: notes.push('12th lord (neutral)'); break;
    }
  }
  const yogakaraka = houses.some((h) => [4, 7, 10].includes(h)) && houses.some((h) => [5, 9].includes(h));
  if (yogakaraka) { v += 0.5; notes.push('yogakaraka'); }
  return { houses, value: Math.max(-1, Math.min(1, v)), yogakaraka, notes };
}

/** Back-compatible summary of {@link lordship}. */
export function functionalNature(planet: Planet, ascSign: number): { value: number; note: string } {
  const l = lordship(planet, ascSign);
  return { value: l.value, note: l.notes.join(', ') };
}
