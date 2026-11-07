/** Shared classical tables and small helpers. */
import { type Planet, type SignIndex, type Tone, type Reason, type Scored, SIGNS } from './types';

export const norm360 = (x: number) => ((x % 360) + 360) % 360;
export const signOf = (lon: number): SignIndex => Math.floor(norm360(lon) / 30);
export const degInSign = (lon: number) => norm360(lon) % 30;
export const signName = (s: SignIndex) => SIGNS[((s % 12) + 12) % 12];
/** House (1..12) of `sign` counted from `fromSign` (whole-sign). */
export const houseFrom = (fromSign: SignIndex, sign: SignIndex) => ((sign - fromSign + 12) % 12) + 1;
export const DAY_MS = 86_400_000;
export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);
export const ordinal = (n: number) => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return n + (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
};

export const SIGN_LORD: Planet[] = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
];

export const EXALTATION: Partial<Record<Planet, SignIndex>> = {
  Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6, Rahu: 1, Ketu: 7,
};

export const OWN_SIGNS: Record<Planet, SignIndex[]> = {
  Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11],
  Venus: [1, 6], Saturn: [9, 10], Rahu: [10], Ketu: [7],
};

/** Moolatrikona sign and degree range. */
export const MOOLATRIKONA: Partial<Record<Planet, [SignIndex, number, number]>> = {
  Sun: [4, 0, 20], Moon: [1, 3, 30], Mars: [0, 0, 12], Mercury: [5, 15, 20],
  Jupiter: [8, 0, 10], Venus: [6, 0, 15], Saturn: [10, 0, 20],
};

type Rel = 'friend' | 'neutral' | 'enemy';
const F = 'friend', N = 'neutral', E = 'enemy';
/** Naisargika (natural) relationships. Rahu treated like Saturn, Ketu like Mars. */
const NATURAL: Record<string, Record<string, Rel>> = {
  Sun: { Moon: F, Mars: F, Jupiter: F, Mercury: N, Venus: E, Saturn: E, Rahu: E, Ketu: E },
  Moon: { Sun: F, Mercury: F, Mars: N, Jupiter: N, Venus: N, Saturn: N, Rahu: E, Ketu: E },
  Mars: { Sun: F, Moon: F, Jupiter: F, Venus: N, Saturn: N, Mercury: E, Rahu: N, Ketu: F },
  Mercury: { Sun: F, Venus: F, Mars: N, Jupiter: N, Saturn: N, Moon: E, Rahu: F, Ketu: N },
  Jupiter: { Sun: F, Moon: F, Mars: F, Saturn: N, Mercury: E, Venus: E, Rahu: E, Ketu: F },
  Venus: { Mercury: F, Saturn: F, Mars: N, Jupiter: N, Sun: E, Moon: E, Rahu: F, Ketu: N },
  Saturn: { Mercury: F, Venus: F, Jupiter: N, Sun: E, Moon: E, Mars: E, Rahu: F, Ketu: N },
  Rahu: { Mercury: F, Venus: F, Saturn: F, Jupiter: N, Sun: E, Moon: E, Mars: E, Ketu: N },
  Ketu: { Mars: F, Jupiter: F, Sun: N, Moon: N, Venus: N, Mercury: N, Saturn: N, Rahu: N },
};
export const relation = (a: Planet, b: Planet): Rel => (a === b ? 'friend' : NATURAL[a]?.[b] ?? 'neutral');

export const NATURAL_BENEFIC: Record<Planet, number> = {
  Jupiter: 1, Venus: 0.8, Moon: 0.4, Mercury: 0.4, Sun: -0.3, Mars: -0.6, Saturn: -0.8, Rahu: -0.7, Ketu: -0.5,
};

export type Dignity = 'exalted' | 'moolatrikona' | 'own' | 'friend' | 'neutral' | 'enemy' | 'debilitated';
export const DIGNITY_SCORE: Record<Dignity, number> = {
  exalted: 1, moolatrikona: 0.8, own: 0.7, friend: 0.35, neutral: 0, enemy: -0.4, debilitated: -1,
};

export function dignity(planet: Planet, lon: number): Dignity {
  const s = signOf(lon), d = degInSign(lon);
  const ex = EXALTATION[planet];
  if (ex !== undefined && s === ex) return 'exalted';
  if (ex !== undefined && s === (ex + 6) % 12) return 'debilitated';
  const mt = MOOLATRIKONA[planet];
  if (mt && s === mt[0] && d >= mt[1] && d < mt[2]) return 'moolatrikona';
  if (OWN_SIGNS[planet].includes(s)) return 'own';
  const r = relation(planet, SIGN_LORD[s]);
  return r === 'friend' ? 'friend' : r === 'enemy' ? 'enemy' : 'neutral';
}

/** Combustion orbs (degrees from Sun). Retrograde Mercury/Venus have smaller orbs. */
export function isCombust(planet: Planet, lon: number, sunLon: number, retro: boolean): boolean {
  const orbs: Partial<Record<Planet, number>> = {
    Moon: 12, Mars: 17, Mercury: retro ? 12 : 14, Jupiter: 11, Venus: retro ? 8 : 10, Saturn: 15,
  };
  const orb = orbs[planet];
  if (!orb) return false;
  const sep = Math.abs(((lon - sunLon + 540) % 360) - 180);
  return sep < orb;
}

export const KENDRA = [1, 4, 7, 10];
export const TRIKONA = [1, 5, 9];
export const DUSTHANA = [6, 8, 12];
export const UPACHAYA = [3, 6, 10, 11];

/** Houses ruled by `planet` for a given ascendant sign (whole-sign). */
export function housesRuled(planet: Planet, ascSign: SignIndex): number[] {
  return OWN_SIGNS[planet]
    .filter(() => planet !== 'Rahu' && planet !== 'Ketu')
    .map((s) => houseFrom(ascSign, s));
}

/**
 * Functional nature of a planet for an ascendant, in -1..1, with reasons.
 * Trikona lords benefic, 3/6/11 lords malefic, 8th lord malefic unless also lagna lord,
 * kendra lordship neutralises natural benefics (kendradhipati dosha) and helps malefics.
 */
export function functionalNature(planet: Planet, ascSign: SignIndex): { value: number; note: string } {
  if (planet === 'Rahu' || planet === 'Ketu') {
    return { value: -0.2, note: `${planet} has no lordship; acts through its sign lord and placement` };
  }
  const hs = housesRuled(planet, ascSign);
  let v = 0;
  const notes: string[] = [];
  const isNatBen = NATURAL_BENEFIC[planet] > 0;
  for (const h of hs) {
    if (h === 1) { v += 0.6; notes.push('lagna lord'); }
    else if (h === 5 || h === 9) { v += 0.8; notes.push(`${ordinal(h)} lord (trikona)`); }
    else if (h === 4 || h === 7 || h === 10) { v += isNatBen ? -0.2 : 0.3; notes.push(`${ordinal(h)} lord (kendra)`); }
    else if (h === 2) { v += 0.05; notes.push('2nd lord'); }
    else if (h === 12) { v -= 0.25; notes.push('12th lord'); }
    else if (h === 3 || h === 6 || h === 11) { v -= 0.45; notes.push(`${ordinal(h)} lord`); }
    else if (h === 8) { v -= hs.includes(1) ? 0 : 0.6; notes.push('8th lord'); }
  }
  // Yogakaraka: rules a kendra and a trikona (not lagna counted as both)
  const kendra = hs.filter((h) => [4, 7, 10].includes(h)).length > 0;
  const trikona = hs.filter((h) => [5, 9].includes(h)).length > 0;
  if (kendra && trikona) { v += 0.5; notes.push('yogakaraka'); }
  return { value: Math.max(-1, Math.min(1, v)), note: notes.join(', ') || 'no lordship' };
}

export function toneOf(score: number): Tone {
  if (score >= 45) return 'excellent';
  if (score >= 15) return 'good';
  if (score > -15) return 'mixed';
  if (score > -45) return 'challenging';
  return 'difficult';
}

export function scored(reasons: Reason[], scale = 100): Scored {
  const raw = reasons.reduce((a, r) => a + r.weight, 0);
  // soft-clip to -100..100
  const score = Math.round(100 * Math.tanh(raw / scale));
  return { score, tone: toneOf(score), reasons: reasons.filter((r) => Math.abs(r.weight) >= 0.5).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)) };
}
