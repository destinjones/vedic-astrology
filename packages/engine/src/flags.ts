/**
 * Classical degree flags and dasha junctions, computed from a natal chart.
 *
 *  - Gandanta: the knot where a water sign ends and a fire sign begins
 *    (Cancer/Leo, Scorpio/Sagittarius, Pisces/Aries). The last pada of
 *    Ashlesha, Jyeshtha and Revati and the first pada of Magha, Mula and
 *    Ashwini; the closer to the junction, the tighter the knot.
 *  - Abhukta Mula: the last ghatis of Jyeshtha and the first of Mula. Texts
 *    give between 1 and 8 ghatis; we use 2 ghatis either side (nakshatra
 *    ghatis, 1/60 of the asterism, so 26′40″ of arc each side).
 *  - Graha yuddha: two of Mars, Mercury, Jupiter, Venus and Saturn within one
 *    degree of longitude. Surya Siddhanta ch. 7 gives the win to the planet
 *    further north (greater ecliptic latitude).
 *  - Mrityu bhaga: a degree in each sign that is critical for each planet and
 *    the lagna. The table is the one attributed to Kausika Hora and reproduced
 *    by later compilers (Phaladeepika commentaries, Jataka Parijata editions);
 *    editions disagree on a few entries.
 *  - Pushkara navamsa and Pushkara bhaga: the nourishing navamsas (those that
 *    fall in Venus, Jupiter, Moon and Mercury signs as tradition lists them)
 *    and one nourishing degree per sign.
 *  - Dasha sandhi and chidra: the junction between two mahadashas, and the
 *    last antardasha of each mahadasha (its chidra or "hole"), both held to be
 *    unsettled stretches.
 */
import type { Chart, DashaPeriod, GrahaId, PlanetId } from './types';
import { norm360 } from './zodiac';

export type FlagKind =
  | 'gandanta'
  | 'abhukta_mula'
  | 'graha_yuddha'
  | 'mrityu_bhaga'
  | 'pushkara_navamsa'
  | 'pushkara_bhaga';

export interface ChartFlag {
  kind: FlagKind;
  /** Point the flag is on */
  point: PlanetId | 'asc';
  /** Other planet involved (graha yuddha: the opponent) */
  other?: PlanetId;
  /** Severe (gandanta within 48′ of the junction, mrityu bhaga) or supportive (pushkara) */
  tone: 'hard' | 'caution' | 'good';
  title: string;
  detail: string;
  source: string;
}

const NAK = 360 / 27;
const PADA = NAK / 4;
const SIGN = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const NAME: Record<string, string> = {
  asc: 'Lagna', sun: 'Sun', moon: 'Moon', mars: 'Mars', mercury: 'Mercury', jupiter: 'Jupiter',
  venus: 'Venus', saturn: 'Saturn', rahu: 'Rahu', ketu: 'Ketu',
};
const fmt = (deg: number) => {
  const d = Math.floor(deg);
  const m = Math.round((deg - d) * 60);
  return m === 60 ? `${d + 1}°00′` : `${d}°${String(m).padStart(2, '0')}′`;
};

/** Junction longitudes: 0° Aries (= 360), 120° Leo, 240° Sagittarius */
const JUNCTIONS = [0, 120, 240];

export interface GandantaInfo {
  /** Degrees from the water/fire junction (always ≤ 3°20′ inside gandanta) */
  distance: number;
  /** Which side of the junction */
  side: 'water' | 'fire';
  junction: string;
}

export function gandantaOf(lon: number): GandantaInfo | null {
  const l = norm360(lon);
  for (const j of JUNCTIONS) {
    const before = norm360(j - l); // l is before j (water side)
    const after = norm360(l - j); // l is after j (fire side)
    const names = j === 0 ? 'Pisces–Aries (Revati–Ashwini)' : j === 120 ? 'Cancer–Leo (Ashlesha–Magha)' : 'Scorpio–Sagittarius (Jyeshtha–Mula)';
    if (before > 0 && before <= PADA) return { distance: before, side: 'water', junction: names };
    if (after < PADA) return { distance: after, side: 'fire', junction: names };
  }
  return null;
}

/** Abhukta Mula: within 2 nakshatra-ghatis of the Jyeshtha–Mula junction (240°) */
export const ABHUKTA_ARC = (NAK * 2) / 60;
export function isAbhuktaMula(moonLon: number): boolean {
  const d = Math.abs(norm360(moonLon - 240 + 180) - 180);
  return d <= ABHUKTA_ARC;
}

/** Mrityu bhaga: the critical degree (1–30, "in the Nth degree") per sign, Aries first */
export const MRITYU_BHAGA: Record<GrahaId | 'asc', number[]> = {
  asc: [1, 9, 21, 22, 25, 2, 4, 23, 18, 20, 24, 10],
  sun: [20, 9, 12, 6, 8, 24, 16, 17, 22, 2, 3, 23],
  moon: [26, 22, 13, 25, 24, 11, 26, 14, 13, 25, 5, 12],
  mars: [19, 18, 25, 23, 29, 28, 24, 21, 2, 15, 11, 6],
  mercury: [15, 14, 13, 12, 8, 18, 20, 10, 21, 22, 7, 5],
  jupiter: [19, 29, 12, 27, 6, 4, 23, 10, 17, 11, 15, 28],
  venus: [18, 15, 11, 17, 10, 13, 4, 6, 27, 12, 29, 19],
  saturn: [10, 4, 7, 9, 12, 16, 3, 18, 28, 14, 13, 15],
  rahu: [14, 13, 12, 11, 24, 23, 22, 21, 12, 20, 18, 8],
  ketu: [8, 18, 20, 19, 21, 22, 23, 24, 11, 12, 13, 14],
};

/** Pushkara bhaga: one nourishing degree per sign ("in the Nth degree"), Aries first */
export const PUSHKARA_BHAGA = [21, 14, 18, 8, 19, 9, 24, 11, 23, 14, 19, 9];

/**
 * Pushkara navamsas, as navamsa numbers (1–9) inside each element's signs:
 * fire 7 and 9, earth 3 and 5, air 6 and 8, water 1 and 3.
 */
export const PUSHKARA_NAVAMSA: Record<'fire' | 'earth' | 'air' | 'water', number[]> = {
  fire: [7, 9],
  earth: [3, 5],
  air: [6, 8],
  water: [1, 3],
};
const ELEMENT = ['fire', 'earth', 'air', 'water'] as const;

export function inNthDegree(lon: number, n: number): boolean {
  const d = norm360(lon) % 30;
  return d >= n - 1 && d < n;
}

export function pushkaraNavamsa(lon: number): boolean {
  const l = norm360(lon);
  const sign = Math.floor(l / 30);
  const nav = Math.floor((l % 30) / (30 / 9)) + 1;
  return PUSHKARA_NAVAMSA[ELEMENT[sign % 4]].includes(nav);
}

const YUDDHA: GrahaId[] = ['mars', 'mercury', 'jupiter', 'venus', 'saturn'];

export interface GrahaYuddha {
  winner: GrahaId;
  loser: GrahaId;
  separation: number;
}

/** Planetary wars: pairs of the five starry planets within 1° of longitude */
export function grahaYuddhas(chart: Pick<Chart, 'planets'>): GrahaYuddha[] {
  const out: GrahaYuddha[] = [];
  for (let i = 0; i < YUDDHA.length; i++) {
    for (let j = i + 1; j < YUDDHA.length; j++) {
      const a = chart.planets[YUDDHA[i]];
      const b = chart.planets[YUDDHA[j]];
      const sep = Math.abs(norm360(a.longitude - b.longitude + 180) - 180);
      if (sep >= 1) continue;
      const aWins = a.latitude >= b.latitude;
      out.push({ winner: aWins ? a.id as GrahaId : b.id as GrahaId, loser: aWins ? b.id as GrahaId : a.id as GrahaId, separation: sep });
    }
  }
  return out;
}

export function chartFlags(chart: Pick<Chart, 'planets' | 'ascendant'>): ChartFlag[] {
  const flags: ChartFlag[] = [];
  const points: [PlanetId | 'asc', number][] = [
    ['asc', chart.ascendant.longitude],
    ...(['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'] as GrahaId[]).map(
      (g) => [g, chart.planets[g].longitude] as [GrahaId, number],
    ),
  ];
  for (const [id, lon] of points) {
    const sign = Math.floor(norm360(lon) / 30);
    const deg = norm360(lon) % 30;
    const g = gandantaOf(lon);
    if (g && id !== 'rahu' && id !== 'ketu') {
      const tight = g.distance <= 0.8;
      flags.push({
        kind: 'gandanta',
        point: id,
        tone: tight ? 'hard' : 'caution',
        title: `${NAME[id]} in gandanta`,
        detail: `${fmt(deg)} ${SIGN[sign]}, ${fmt(g.distance)} from the ${g.junction} junction on the ${g.side} side. ${
          tight ? 'Within 48′ of the knot, the tightest part of it.' : 'Inside the last or first pada around the knot.'
        } ${id === 'moon' || id === 'asc' ? 'Tradition treats a gandanta Moon or lagna as the more serious case and prescribes a shanti.' : ''}`.trim(),
        source: 'BPHS (Gandanta janma shanti); Muhurta Chintamani',
      });
    }
    if (id === 'moon' && isAbhuktaMula(lon)) {
      flags.push({
        kind: 'abhukta_mula',
        point: 'moon',
        tone: 'hard',
        title: 'Moon in Abhukta Mula',
        detail: `The Moon is within ${fmt(ABHUKTA_ARC)} of the Jyeshtha–Mula junction (2 nakshatra ghatis either side). Texts differ on the width, from 1 to 8 ghatis.`,
        source: 'Muhurta Chintamani; Narada Samhita',
      });
    }
    const mb = MRITYU_BHAGA[id as GrahaId | 'asc'];
    if (mb && inNthDegree(lon, mb[sign])) {
      flags.push({
        kind: 'mrityu_bhaga',
        point: id,
        tone: 'hard',
        title: `${NAME[id]} in mrityu bhaga`,
        detail: `${fmt(deg)} ${SIGN[sign]} is in the ${mb[sign]}${ordSuffix(mb[sign])} degree, the critical degree listed for ${NAME[id]} in ${SIGN[sign]}. It weakens what ${NAME[id]} signifies; editions of the table disagree on a few entries.`,
        source: 'Kausika Hora, as tabulated in Phaladeepika commentaries',
      });
    }
    if (id !== 'rahu' && id !== 'ketu' && pushkaraNavamsa(lon)) {
      flags.push({
        kind: 'pushkara_navamsa',
        point: id,
        tone: 'good',
        title: `${NAME[id]} in a pushkara navamsa`,
        detail: `${fmt(deg)} ${SIGN[sign]} falls in a nourishing navamsa, which strengthens ${NAME[id]} much as vargottama does.`,
        source: 'Jataka Parijata; Muhurta Chintamani (pushkaramsha)',
      });
    }
    if (id !== 'rahu' && id !== 'ketu' && inNthDegree(lon, PUSHKARA_BHAGA[sign])) {
      flags.push({
        kind: 'pushkara_bhaga',
        point: id,
        tone: 'good',
        title: `${NAME[id]} on the pushkara bhaga`,
        detail: `${fmt(deg)} ${SIGN[sign]} is the single nourishing degree of ${SIGN[sign]} (the ${PUSHKARA_BHAGA[sign]}${ordSuffix(PUSHKARA_BHAGA[sign])}).`,
        source: 'Jataka Parijata; Muhurta Chintamani (pushkara bhaga)',
      });
    }
  }
  for (const w of grahaYuddhas(chart)) {
    flags.push({
      kind: 'graha_yuddha',
      point: w.loser,
      other: w.winner,
      tone: 'hard',
      title: `${NAME[w.winner]} defeats ${NAME[w.loser]} in graha yuddha`,
      detail: `${NAME[w.winner]} and ${NAME[w.loser]} are ${fmt(w.separation)} apart. ${NAME[w.winner]} is further north in latitude and wins; the loser's significations suffer and the winner gains Yuddha Bala.`,
      source: 'Surya Siddhanta ch. 7; BPHS ch. 27 (Yuddha bala)',
    });
  }
  return flags;
}

function ordSuffix(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

// ---------------------------------------------------------------- dasha junctions

export interface DashaJunction {
  /** Mahadasha ending and the one starting */
  from: GrahaId;
  to: GrahaId;
  /** The mahadasha boundary, ISO UTC */
  at: string;
  /** Sandhi window: from the last pratyantar of the outgoing dasha to the end of the first pratyantar of the incoming one */
  sandhiStart: string;
  sandhiEnd: string;
  /** Chidra: the last antardasha of the outgoing mahadasha */
  chidra: { lord: GrahaId; start: string; end: string };
}

/**
 * Sandhi and chidra for each mahadasha change in a Vimshottari tree. Needs at
 * least three levels for the pratyantar edges; with two, the sandhi uses the
 * last and first tenth of the bordering antardashas.
 */
export function dashaJunctions(periods: DashaPeriod[]): DashaJunction[] {
  const out: DashaJunction[] = [];
  for (let i = 1; i < periods.length; i++) {
    const prev = periods[i - 1];
    const next = periods[i];
    const lastAntar = prev.children?.[prev.children.length - 1];
    const firstAntar = next.children?.[0];
    if (!lastAntar || !firstAntar) continue;
    const lastPrat = lastAntar.children?.[lastAntar.children.length - 1];
    const firstPrat = firstAntar.children?.[0];
    const tenth = (p: DashaPeriod, end: boolean) => {
      const s = Date.parse(p.start);
      const e = Date.parse(p.end);
      return new Date(end ? e - (e - s) / 10 : s + (e - s) / 10).toISOString();
    };
    out.push({
      from: prev.lord,
      to: next.lord,
      at: next.start,
      sandhiStart: lastPrat ? lastPrat.start : tenth(lastAntar, true),
      sandhiEnd: firstPrat ? firstPrat.end : tenth(firstAntar, false),
      chidra: { lord: lastAntar.lord, start: lastAntar.start, end: lastAntar.end },
    });
  }
  return out;
}
