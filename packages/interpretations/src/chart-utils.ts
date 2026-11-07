import { PLANET_PROFILES } from './data/planets';
import { signLord } from './data/signs';
import type { ChartInput, Dignity, HouseNumber, PlanetId, SignNumber } from './types';
import { PLANETS } from './types';

export const wrapSign = (n: number): SignNumber => ((((n - 1) % 12) + 12) % 12 + 1) as SignNumber;

/** Count from sign a to sign b inclusively (a→a = 1, next sign = 2 …). */
export const signDistance = (from: number, to: number): number => ((((to - from) % 12) + 12) % 12) + 1;

/** Whole-sign house of a sign from the ascendant. */
export const houseOfSign = (chart: ChartInput, sign: number): HouseNumber =>
  signDistance(chart.ascendantSign, sign) as HouseNumber;

/** Whole-sign house of a planet (yogas are judged whole-sign, independent of the display house system). */
export const houseOf = (chart: ChartInput, p: PlanetId): HouseNumber => houseOfSign(chart, chart.planets[p].sign);

export const signOfHouse = (chart: ChartInput, h: number): SignNumber => wrapSign(chart.ascendantSign + h - 1);

export const lordOfHouse = (chart: ChartInput, h: number): PlanetId => signLord(signOfHouse(chart, h));

/** Houses a planet rules for this ascendant. Nodes rule none (classically). */
export const housesRuledBy = (chart: ChartInput, p: PlanetId): HouseNumber[] => {
  if (p === 'rahu' || p === 'ketu') return [];
  const out: HouseNumber[] = [];
  for (let h = 1; h <= 12; h++) if (lordOfHouse(chart, h) === p) out.push(h as HouseNumber);
  return out;
};

/** House position of planet b counted from planet a's sign. */
export const houseFromPlanet = (chart: ChartInput, a: PlanetId, b: PlanetId): number =>
  signDistance(chart.planets[a].sign, chart.planets[b].sign);

export const sameSign = (chart: ChartInput, a: PlanetId, b: PlanetId): boolean => chart.planets[a].sign === chart.planets[b].sign;

/** Does planet p cast a full (graha drishti) aspect on the given sign? */
export const aspectsSign = (chart: ChartInput, p: PlanetId, sign: number): boolean => {
  const d = signDistance(chart.planets[p].sign, sign);
  return PLANET_PROFILES[p].aspects.includes(d);
};

export const aspectsPlanet = (chart: ChartInput, a: PlanetId, b: PlanetId): boolean => aspectsSign(chart, a, chart.planets[b].sign);

export const mutualAspect = (chart: ChartInput, a: PlanetId, b: PlanetId): boolean => aspectsPlanet(chart, a, b) && aspectsPlanet(chart, b, a);

/** Sign exchange (parivartana) between two planets. */
export const exchange = (chart: ChartInput, a: PlanetId, b: PlanetId): boolean =>
  a !== b && signLord(chart.planets[a].sign) === b && signLord(chart.planets[b].sign) === a;

/** Conjunction, mutual aspect or exchange: the classical "sambandha". */
export const related = (chart: ChartInput, a: PlanetId, b: PlanetId): false | 'conjunction' | 'mutual aspect' | 'exchange' => {
  if (a === b) return false;
  if (sameSign(chart, a, b)) return 'conjunction';
  if (exchange(chart, a, b)) return 'exchange';
  if (mutualAspect(chart, a, b)) return 'mutual aspect';
  return false;
};

/** Planets that aspect or occupy a sign. */
export const influencesOnSign = (chart: ChartInput, sign: number): { occupants: PlanetId[]; aspecting: PlanetId[] } => {
  const occupants: PlanetId[] = [];
  const aspecting: PlanetId[] = [];
  for (const p of PLANETS) {
    if (chart.planets[p].sign === sign) occupants.push(p);
    else if (aspectsSign(chart, p, sign)) aspecting.push(p);
  }
  return { occupants, aspecting };
};

/** Simple sign-based dignity using natural relationships. Engine's compound dignity is preferred when available. */
export const naturalDignity = (p: PlanetId, sign: SignNumber, degree?: number): Dignity => {
  const pr = PLANET_PROFILES[p];
  if (pr.exaltation?.sign === sign) return 'exalted';
  if (pr.debilitation?.sign === sign) return 'debilitated';
  if (pr.moolatrikona && pr.moolatrikona.sign === sign) {
    if (degree === undefined || (degree >= pr.moolatrikona.from && degree <= pr.moolatrikona.to)) return 'moolatrikona';
  }
  if (pr.ownSigns.includes(sign)) return 'own';
  const lord = signLord(sign);
  if (lord === p) return 'own';
  if (pr.friends.includes(lord)) return 'friend';
  if (pr.enemies.includes(lord)) return 'enemy';
  return 'neutral';
};

export const dignityOf = (chart: ChartInput, p: PlanetId): Dignity => {
  const pos = chart.planets[p];
  if (pos.dignity) return pos.dignity;
  return naturalDignity(p, pos.sign, pos.longitude % 30);
};

export const isStrong = (chart: ChartInput, p: PlanetId): boolean => {
  const d = dignityOf(chart, p);
  return d === 'exalted' || d === 'moolatrikona' || d === 'own';
};

export const isWeak = (chart: ChartInput, p: PlanetId): boolean => dignityOf(chart, p) === 'debilitated' || !!chart.planets[p].combust;

export const NATURAL_BENEFICS: PlanetId[] = ['jupiter', 'venus', 'mercury', 'moon'];
export const NATURAL_MALEFICS: PlanetId[] = ['sun', 'mars', 'saturn', 'rahu', 'ketu'];

/** Moon is benefic when waxing (≥ 72° from the Sun is the strict "bright" view; we use waxing). */
export const isBenefic = (chart: ChartInput, p: PlanetId): boolean => {
  if (p === 'moon') {
    const elong = (((chart.planets.moon.longitude - chart.planets.sun.longitude) % 360) + 360) % 360;
    return elong <= 180;
  }
  if (p === 'mercury') {
    // Mercury takes on the nature of planets it is conjunct.
    const malefic = (['sun', 'mars', 'saturn', 'rahu', 'ketu'] as PlanetId[]).some((m) => sameSign(chart, 'mercury', m));
    return !malefic;
  }
  return NATURAL_BENEFICS.includes(p);
};

export const KENDRA = [1, 4, 7, 10];
export const TRIKONA = [1, 5, 9];
export const DUSTHANA = [6, 8, 12];
export const UPACHAYA = [3, 6, 10, 11];
