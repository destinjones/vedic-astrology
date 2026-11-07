import { DASHA_ORDER, DASHA_TOTAL_YEARS, DASHA_YEARS } from './constants';
import { jdToIso, dateToJd } from './time';
import type { DashaPeriod, GrahaId, VimshottariDasha } from './types';
import { nakshatraOf } from './zodiac';

export const DEFAULT_DASHA_YEAR_DAYS = 365.2425;

export interface VimshottariOptions {
  /** 1–5, default 3 */
  levels?: number;
  /** Days per year, default 365.2425 */
  yearDays?: number;
}

/**
 * Build the Vimshottari sub-periods of a period. The sequence of sub-lords
 * starts from the period lord itself; each sub-period is proportional to the
 * sub-lord's years / 120.
 */
function subdivide(parent: DashaPeriod, levels: number, yearDays: number): void {
  if (parent.level >= levels) return;
  const startIdx = DASHA_ORDER.indexOf(parent.lord);
  let jd = parent.startJd;
  parent.children = [];
  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[(startIdx + i) % 9];
    const years = (parent.years * DASHA_YEARS[lord]) / DASHA_TOTAL_YEARS;
    const endJd = i === 8 ? parent.endJd : jd + years * yearDays;
    const child: DashaPeriod = {
      lord,
      level: parent.level + 1,
      startJd: jd,
      endJd,
      start: jdToIso(jd),
      end: jdToIso(endJd),
      years,
      path: [...parent.path, lord],
    };
    subdivide(child, levels, yearDays);
    parent.children.push(child);
    jd = endJd;
  }
}

/**
 * Vimshottari dasha from the Moon's sidereal longitude at birth.
 * The first mahadasha starts before birth (by the elapsed part of the Moon's
 * nakshatra); periods cover one full 120-year cycle from that start.
 */
export function vimshottari(
  moonLongitude: number,
  birth: Date | number,
  opts: VimshottariOptions = {},
): VimshottariDasha {
  const levels = Math.max(1, Math.min(5, opts.levels ?? 3));
  const yearDays = opts.yearDays ?? DEFAULT_DASHA_YEAR_DAYS;
  const birthJd = typeof birth === 'number' ? birth : dateToJd(birth);
  const nk = nakshatraOf(moonLongitude);
  const startLord = nk.info.lord;
  const elapsedFraction = nk.fraction;
  const firstYears = DASHA_YEARS[startLord];
  const balanceYears = firstYears * (1 - elapsedFraction);

  let jd = birthJd - elapsedFraction * firstYears * yearDays;
  const startIdx = DASHA_ORDER.indexOf(startLord);
  const periods: DashaPeriod[] = [];
  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[(startIdx + i) % 9];
    const years = DASHA_YEARS[lord];
    const endJd = jd + years * yearDays;
    const p: DashaPeriod = {
      lord,
      level: 1,
      startJd: jd,
      endJd,
      start: jdToIso(jd),
      end: jdToIso(endJd),
      years,
      path: [lord],
    };
    subdivide(p, levels, yearDays);
    periods.push(p);
    jd = endJd;
  }
  return { system: 'vimshottari', startLord, elapsedFraction, balanceYears, yearDays, periods };
}

/**
 * Active chain of periods at a moment: [maha, antar, pratyantar, ...].
 * Works for every dasha system. Returns [] outside the computed window.
 */
export function dashaAt(dasha: { periods: DashaPeriod[] }, when: Date | string | number): DashaPeriod[] {
  const jd =
    typeof when === 'number' ? when : dateToJd(typeof when === 'string' ? new Date(when) : when);
  const chain: DashaPeriod[] = [];
  let list: DashaPeriod[] | undefined = dasha.periods;
  while (list) {
    const p: DashaPeriod | undefined = list.find((x) => jd >= x.startJd && jd < x.endJd);
    if (!p) break;
    chain.push(p);
    list = p.children;
  }
  return chain;
}

/** Flatten periods at a given level (1 = maha, 2 = antar, ...) */
export function dashaLevel(dasha: { periods: DashaPeriod[] }, level: number): DashaPeriod[] {
  const out: DashaPeriod[] = [];
  const walk = (ps: DashaPeriod[] | undefined) => {
    for (const p of ps ?? []) {
      if (p.level === level) out.push(p);
      else walk(p.children);
    }
  };
  walk(dasha.periods);
  return out;
}

export type { GrahaId };
