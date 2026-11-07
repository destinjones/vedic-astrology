/**
 * Yogini, Ashtottari and Kalachakra dashas.
 *
 * All three are Moon-based like Vimshottari and return the same tree shape
 * (`DashaPeriod` with `children`), so `dashaAt` and `dashaLevel` work on them.
 * Every tree starts with the period running at birth and runs until at least
 * 120 years after birth, repeating the cycle where it is shorter than that.
 */
import { DEFAULT_DASHA_YEAR_DAYS } from './dasha';
import { NAKSHATRA_SPAN, PADA_SPAN, SIGN_NAMES } from './constants';
import { dateToJd, jdToIso } from './time';
import type {
  AshtottariDasha,
  DashaPeriod,
  GrahaId,
  KalachakraDasha,
  Pada,
  SignNumber,
  YoginiDasha,
} from './types';
import { nakshatraOf, norm360, signLord } from './zodiac';

export interface DashaSystemOptions {
  /** 1–5, default 3 */
  levels?: number;
  /** Days per year, default 365.2425 */
  yearDays?: number;
  /** How many years after birth to cover, default 120 */
  spanYears?: number;
}

/** One step of a dasha sequence: a lord (or sign) and its weight in years */
interface Unit {
  lord: GrahaId;
  sign?: SignNumber;
  name?: string;
  years: number;
}

/** Sub-period sequence of a period: proportional to each unit's years */
type SubSequence = (u: Unit) => Unit[];

function makePeriod(
  u: Unit,
  level: number,
  startJd: number,
  years: number,
  yearDays: number,
  parentPath: GrahaId[],
  endJd = startJd + years * yearDays,
): DashaPeriod {
  const p: DashaPeriod = {
    lord: u.lord,
    level,
    startJd,
    endJd,
    start: jdToIso(startJd),
    end: jdToIso(endJd),
    years,
    path: [...parentPath, u.lord],
  };
  if (u.sign) p.sign = u.sign;
  if (u.name) p.name = u.name;
  return p;
}

function subdivide(parent: DashaPeriod, unit: Unit, sub: SubSequence, levels: number, yearDays: number): void {
  if (parent.level >= levels) return;
  const seq = sub(unit);
  const total = seq.reduce((s, x) => s + x.years, 0);
  let jd = parent.startJd;
  parent.children = seq.map((u, i) => {
    const years = (parent.years * u.years) / total;
    const end = i === seq.length - 1 ? parent.endJd : jd + years * yearDays;
    const child = makePeriod(u, parent.level + 1, jd, years, yearDays, parent.path, end);
    subdivide(child, u, sub, levels, yearDays);
    jd = end;
    return child;
  });
}

interface Common {
  levels: number;
  yearDays: number;
  birthJd: number;
  untilJd: number;
}

function common(birth: Date | number, opts: DashaSystemOptions): Common {
  const levels = Math.max(1, Math.min(5, opts.levels ?? 3));
  const yearDays = opts.yearDays ?? DEFAULT_DASHA_YEAR_DAYS;
  const birthJd = typeof birth === 'number' ? birth : dateToJd(birth);
  return { levels, yearDays, birthJd, untilJd: birthJd + (opts.spanYears ?? 120) * yearDays };
}

/**
 * Lay mahadashas end to end. `next(i)` gives the i-th mahadasha and the
 * sequence its sub-periods follow; the first one starts at `firstStartJd`.
 */
function layOut(
  c: Common,
  firstStartJd: number,
  next: (i: number) => { unit: Unit; sub: SubSequence },
): DashaPeriod[] {
  const periods: DashaPeriod[] = [];
  let jd = firstStartJd;
  for (let i = 0; jd < c.untilJd; i++) {
    const { unit, sub } = next(i);
    const p = makePeriod(unit, 1, jd, unit.years, c.yearDays, []);
    subdivide(p, unit, sub, c.levels, c.yearDays);
    periods.push(p);
    jd = p.endJd;
  }
  return periods;
}

/** Rotate a cyclic list so it starts at index `from` */
const rotate = <T>(list: readonly T[], from: number): T[] =>
  list.map((_, i) => list[(from + i) % list.length]);

// ---------------------------------------------------------------- Yogini

/** The eight yoginis in order, with their planets and years (36 in all) */
export const YOGINIS: readonly { name: string; lord: GrahaId; years: number }[] = [
  { name: 'Mangala', lord: 'moon', years: 1 },
  { name: 'Pingala', lord: 'sun', years: 2 },
  { name: 'Dhanya', lord: 'jupiter', years: 3 },
  { name: 'Bhramari', lord: 'mars', years: 4 },
  { name: 'Bhadrika', lord: 'mercury', years: 5 },
  { name: 'Ulka', lord: 'saturn', years: 6 },
  { name: 'Siddha', lord: 'venus', years: 7 },
  { name: 'Sankata', lord: 'rahu', years: 8 },
];
const YOGINI_UNITS: Unit[] = YOGINIS.map((y) => ({ ...y }));

/**
 * Yogini dasha. The starting yogini is (birth nakshatra number + 3) counted
 * in eights, so Ashwini starts with Bhramari. Each cycle is 36 years; the
 * balance of the first yogini follows the part of the Moon's nakshatra left.
 * Sub-periods start from the period's own yogini.
 */
export function yogini(moonLongitude: number, birth: Date | number, opts: DashaSystemOptions = {}): YoginiDasha {
  const c = common(birth, opts);
  const nk = nakshatraOf(moonLongitude);
  const startIdx = (nk.info.number + 3 - 1) % 8;
  const first = YOGINI_UNITS[startIdx];
  const sub: SubSequence = (u) => rotate(YOGINI_UNITS, YOGINI_UNITS.findIndex((y) => y.name === u.name));
  const periods = layOut(c, c.birthJd - nk.fraction * first.years * c.yearDays, (i) => ({
    unit: YOGINI_UNITS[(startIdx + i) % 8],
    sub,
  }));
  return {
    system: 'yogini',
    startYogini: startIdx + 1,
    startLord: first.lord,
    elapsedFraction: nk.fraction,
    balanceYears: first.years * (1 - nk.fraction),
    yearDays: c.yearDays,
    periods,
  };
}

// ---------------------------------------------------------------- Ashtottari

/**
 * Ashtottari lords in order with their years (108 in all) and the stretch of
 * nakshatras each one rules, counted from Ardra. Saturn's stretch is
 * Purva Ashadha, Uttara Ashadha (with Abhijit) and Shravana.
 */
export const ASHTOTTARI: readonly { lord: GrahaId; years: number; firstNakshatra: number; nakshatras: number }[] = [
  { lord: 'sun', years: 6, firstNakshatra: 6, nakshatras: 4 },
  { lord: 'moon', years: 15, firstNakshatra: 10, nakshatras: 3 },
  { lord: 'mars', years: 8, firstNakshatra: 13, nakshatras: 4 },
  { lord: 'mercury', years: 17, firstNakshatra: 17, nakshatras: 3 },
  { lord: 'saturn', years: 10, firstNakshatra: 20, nakshatras: 3 },
  { lord: 'jupiter', years: 19, firstNakshatra: 23, nakshatras: 3 },
  { lord: 'rahu', years: 12, firstNakshatra: 26, nakshatras: 4 },
  { lord: 'venus', years: 21, firstNakshatra: 3, nakshatras: 3 },
];
const ASHTOTTARI_UNITS: Unit[] = ASHTOTTARI.map(({ lord, years }) => ({ lord, years }));

/**
 * Ashtottari dasha (108 years). The first lord rules the Moon's stretch of
 * nakshatras; the part already elapsed is the Moon's distance through that
 * whole stretch (so Abhijit needs no separate span). Sub-periods start from
 * the period's own lord, as in Jagannatha Hora.
 */
export function ashtottari(moonLongitude: number, birth: Date | number, opts: DashaSystemOptions = {}): AshtottariDasha {
  const c = common(birth, opts);
  const lon = norm360(moonLongitude);
  const startIdx = ASHTOTTARI.findIndex(
    (g) => norm360(lon - (g.firstNakshatra - 1) * NAKSHATRA_SPAN) < g.nakshatras * NAKSHATRA_SPAN,
  );
  const g = ASHTOTTARI[startIdx];
  const elapsed = norm360(lon - (g.firstNakshatra - 1) * NAKSHATRA_SPAN) / (g.nakshatras * NAKSHATRA_SPAN);
  const sub: SubSequence = (u) => rotate(ASHTOTTARI_UNITS, ASHTOTTARI_UNITS.findIndex((x) => x.lord === u.lord));
  const periods = layOut(c, c.birthJd - elapsed * g.years * c.yearDays, (i) => ({
    unit: ASHTOTTARI_UNITS[(startIdx + i) % 8],
    sub,
  }));
  return {
    system: 'ashtottari',
    startLord: g.lord,
    elapsedFraction: elapsed,
    balanceYears: g.years * (1 - elapsed),
    yearDays: c.yearDays,
    periods,
  };
}

/**
 * Classical test for Ashtottari: Rahu in a kendra or trikona counted from the
 * lagna lord's sign, but not in the lagna itself.
 */
export function ashtottariApplies(lagnaSign: SignNumber, lagnaLordSign: SignNumber, rahuSign: SignNumber): boolean {
  if (rahuSign === lagnaSign) return false;
  const house = ((rahuSign - lagnaLordSign + 12) % 12) + 1;
  return [1, 4, 5, 7, 9, 10].includes(house);
}

// ---------------------------------------------------------------- Kalachakra

/** Years of each sign, Aries..Pisces (the years of its lord) */
export const KALACHAKRA_SIGN_YEARS = [7, 16, 9, 21, 5, 9, 16, 7, 10, 4, 4, 10] as const;

/**
 * The nine signs (1–12) of each pada, for the four chakras:
 * Ashwini and Bharani groups (savya), Rohini and Mrigashira groups (apasavya).
 * Each row's first sign is the deha, its last the jeeva.
 */
const KALACHAKRA_CYCLES: readonly (readonly (readonly number[])[])[] = [
  [
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
    [10, 11, 12, 8, 7, 6, 4, 5, 3],
    [2, 1, 12, 11, 10, 9, 1, 2, 3],
    [4, 5, 6, 7, 8, 9, 10, 11, 12],
  ],
  [
    [8, 7, 6, 4, 5, 3, 2, 1, 12],
    [11, 10, 9, 1, 2, 3, 4, 5, 6],
    [7, 8, 9, 10, 11, 12, 8, 7, 6],
    [4, 5, 3, 2, 1, 12, 11, 10, 9],
  ],
  [
    [9, 10, 11, 12, 1, 2, 3, 5, 4],
    [6, 7, 8, 12, 11, 10, 9, 8, 7],
    [6, 5, 4, 3, 2, 1, 9, 10, 11],
    [12, 1, 2, 3, 5, 4, 6, 7, 8],
  ],
  [
    [12, 11, 10, 9, 8, 7, 6, 5, 4],
    [3, 2, 1, 9, 10, 11, 12, 1, 2],
    [3, 5, 4, 6, 7, 8, 12, 11, 10],
    [9, 8, 7, 6, 5, 4, 3, 2, 1],
  ],
];

/**
 * Chakra group of a nakshatra (index 0–26): 0 Ashwini, 1 Bharani (savya),
 * 2 Rohini, 3 Mrigashira (apasavya). The pattern repeats every six nakshatras,
 * following the navamsas of the padas.
 */
export const kalachakraGroup = (nakshatraIndex: number) => [0, 1, 0, 2, 3, 2][nakshatraIndex % 6];

/** The nine signs of a nakshatra pada's cycle (nakshatra index 0–26, pada 1–4) */
export function kalachakraCycle(nakshatraIndex: number, pada: Pada): SignNumber[] {
  return KALACHAKRA_CYCLES[kalachakraGroup(nakshatraIndex)][pada - 1].slice() as SignNumber[];
}

const signUnit = (sign: SignNumber): Unit => ({
  lord: signLord(sign),
  sign,
  name: SIGN_NAMES[sign - 1],
  years: KALACHAKRA_SIGN_YEARS[sign - 1],
});

/**
 * Kalachakra dasha. The Moon's nakshatra pada picks a cycle of nine signs
 * whose years add up to its paramayus (83, 85, 86 or 100). The part of the
 * pada the Moon has crossed is the part of that cycle already lived, so
 * the first period is the sign running at birth. After the cycle ends the
 * dashas continue with the next pada's cycle. Sub-periods run through the
 * same nine signs starting from the period's own sign, in proportion to their
 * years (the method in P.V.R. Narasimha Rao's book).
 */
export function kalachakra(moonLongitude: number, birth: Date | number, opts: DashaSystemOptions = {}): KalachakraDasha {
  const c = common(birth, opts);
  const lon = norm360(moonLongitude);
  const padaIdx = Math.min(107, Math.floor(lon / PADA_SPAN));
  const padaFraction = (lon - padaIdx * PADA_SPAN) / PADA_SPAN;
  const cycleOf = (k: number) => kalachakraCycle(Math.floor((k % 108) / 4), ((k % 4) + 1) as Pada);

  const birthCycle = cycleOf(padaIdx);
  const units = birthCycle.map(signUnit);
  const paramayus = units.reduce((s, u) => s + u.years, 0);

  // Find the sign running at birth inside the birth pada's cycle.
  let lived = padaFraction * paramayus;
  let first = 0;
  while (first < 8 && lived >= units[first].years) {
    lived -= units[first].years;
    first++;
  }
  const elapsedFraction = lived / units[first].years;

  // Mahadashas: rest of the birth cycle, then the following padas' cycles.
  const queue: { sign: SignNumber; cycle: SignNumber[] }[] = [];
  const fill = (k: number, from: number) => {
    const cyc = cycleOf(k);
    for (let i = from; i < 9; i++) queue.push({ sign: cyc[i], cycle: cyc });
  };
  fill(padaIdx, first);
  let k = padaIdx;
  const periods = layOut(c, c.birthJd - lived * c.yearDays, (i) => {
    while (i >= queue.length) fill(++k, 0);
    const { sign, cycle } = queue[i];
    const sub: SubSequence = (u) => rotate(cycle, cycle.indexOf(u.sign!)).map(signUnit);
    return { unit: signUnit(sign), sub };
  });

  const nakIdx = Math.floor(padaIdx / 4);
  const group = kalachakraGroup(nakIdx);
  return {
    system: 'kalachakra',
    direction: group < 2 ? 'savya' : 'apasavya',
    pada: ((padaIdx % 4) + 1) as Pada,
    paramayus,
    deha: birthCycle[0],
    jeeva: birthCycle[8],
    elapsedFraction,
    balanceYears: units[first].years - lived,
    yearDays: c.yearDays,
    periods,
  };
}
