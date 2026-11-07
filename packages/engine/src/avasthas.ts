/**
 * Avasthas: the condition of a planet, which decides how much of what it
 * promises it can actually give. Three schemes from BPHS ch. 45 (Avastha
 * adhyaya), all computed from the natal chart.
 *
 *  - Baladi (age): by degree within the sign. Odd signs: 0–6° Bala (infant),
 *    6–12° Kumara (youth), 12–18° Yuva (adult), 18–24° Vriddha (old),
 *    24–30° Mrita (dead). Even signs run the other way. Bala gives a quarter,
 *    Kumara half, Yuva full, Vriddha very little and Mrita nothing.
 *  - Jagradadi (wakefulness): Jagrat (awake) in its own or exaltation sign,
 *    Swapna (dreaming) in a friend's or neutral sign, Sushupti (asleep) in an
 *    enemy's sign or debilitation. Full, middling and no results.
 *  - Deeptadi (luminosity), nine states: Deepta (exalted), Swastha (own or
 *    moolatrikona), Mudita (great friend's sign), Shanta (friend's sign), Deena
 *    (neutral sign), Duhkhita (enemy's sign), Khala (great enemy's sign or
 *    debilitated), Kopa (combust: overpowered by the Sun) and Vikala (with a
 *    natural malefic). Kopa takes precedence because combustion overrides sign
 *    dignity; Vikala is reported alongside the sign state.
 */
import type { Chart, Dignity, GrahaId } from './types';

export type BaladiAvastha = 'bala' | 'kumara' | 'yuva' | 'vriddha' | 'mrita';
export type JagradadiAvastha = 'jagrat' | 'swapna' | 'sushupti';
export type DeeptadiAvastha =
  | 'deepta'
  | 'swastha'
  | 'mudita'
  | 'shanta'
  | 'deena'
  | 'duhkhita'
  | 'khala'
  | 'kopa'
  | 'vikala';

/** Share of a planet's results each Baladi state allows (BPHS 45.3–4) */
export const BALADI_FACTOR: Record<BaladiAvastha, number> = { bala: 0.25, kumara: 0.5, yuva: 1, vriddha: 0.1, mrita: 0 };
export const JAGRADADI_FACTOR: Record<JagradadiAvastha, number> = { jagrat: 1, swapna: 0.5, sushupti: 0 };

export interface PlanetAvasthas {
  planet: GrahaId;
  baladi: BaladiAvastha;
  baladiFactor: number;
  jagradadi: JagradadiAvastha;
  jagradadiFactor: number;
  deeptadi: DeeptadiAvastha;
  /** Also with a natural malefic in its sign (Vikala), when the main Deeptadi state is something else */
  vikala: boolean;
  /** Short plain-English verdict combining the three */
  verdict: string;
}

const MALEFICS: GrahaId[] = ['sun', 'mars', 'saturn', 'rahu', 'ketu'];
const AVASTHA_PLANETS: GrahaId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];

export function baladiAvastha(longitude: number): BaladiAvastha {
  const l = ((longitude % 360) + 360) % 360;
  const sign = Math.floor(l / 30) + 1;
  const i = Math.min(4, Math.floor((l % 30) / 6));
  const order: BaladiAvastha[] = ['bala', 'kumara', 'yuva', 'vriddha', 'mrita'];
  return sign % 2 === 1 ? order[i] : order[4 - i];
}

export function jagradadiAvastha(d: Dignity): JagradadiAvastha {
  if (d === 'exalted' || d === 'moolatrikona' || d === 'own') return 'jagrat';
  if (d === 'great_friend' || d === 'friend' || d === 'neutral') return 'swapna';
  return 'sushupti';
}

export function deeptadiFromDignity(d: Dignity): DeeptadiAvastha {
  switch (d) {
    case 'exalted': return 'deepta';
    case 'moolatrikona':
    case 'own': return 'swastha';
    case 'great_friend': return 'mudita';
    case 'friend': return 'shanta';
    case 'neutral': return 'deena';
    case 'enemy': return 'duhkhita';
    default: return 'khala';
  }
}

const AGE_TEXT: Record<BaladiAvastha, string> = {
  bala: 'infant: a quarter of its results',
  kumara: 'youth: half its results',
  yuva: 'adult: its full results',
  vriddha: 'old: very little of its results',
  mrita: 'dead: hardly any of its results',
};

export function computeAvasthas(chart: Pick<Chart, 'planets'>): PlanetAvasthas[] {
  return AVASTHA_PLANETS.map((g) => {
    const p = chart.planets[g];
    const dignity = p.dignity ?? 'neutral';
    const baladi = baladiAvastha(p.longitude);
    const jagradadi = jagradadiAvastha(dignity);
    const withMalefic = MALEFICS.some((m) => m !== g && chart.planets[m].sign === p.sign);
    const deeptadi: DeeptadiAvastha = p.combust ? 'kopa' : deeptadiFromDignity(dignity);
    const vikala = withMalefic;
    const wake = jagradadi === 'jagrat' ? 'awake' : jagradadi === 'swapna' ? 'dreaming' : 'asleep';
    const verdict = `${AGE_TEXT[baladi]}; ${wake}${p.combust ? ', and burnt by the Sun' : ''}${vikala ? ', disturbed by a malefic' : ''}.`;
    return {
      planet: g,
      baladi,
      baladiFactor: BALADI_FACTOR[baladi],
      jagradadi,
      jagradadiFactor: JAGRADADI_FACTOR[jagradadi],
      deeptadi,
      vikala,
      verdict: verdict.charAt(0).toUpperCase() + verdict.slice(1),
    };
  });
}
