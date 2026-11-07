/**
 * Vimshottari below the pratyantar: sookshma (level 4) and prana (level 5).
 *
 * A full lifetime tree to prana is about 60,000 periods, so the deeper levels
 * are built on demand for one period at a time. The rule is the same at every
 * level (BPHS 46): the sub-periods start from the period's own lord and run
 * through the nine lords in Vimshottari order, each lasting
 * parent length × lord years / 120.
 */
import { type NatalChart, type Planet } from './types';
import { DASHA_ORDER, DASHA_YEARS, scoreDashaTree, type DashaPeriod, type RawDasha } from './dasha';

export const DASHA_LEVEL_NAMES = ['Mahadasha', 'Antardasha', 'Pratyantardasha', 'Sookshma', 'Prana'] as const;

/** Raw sub-periods of one span, starting from the span's lord. */
export function splitPeriod(path: Planet[], start: Date, end: Date): RawDasha[] {
  const lord = path[path.length - 1];
  const total = end.getTime() - start.getTime();
  const i0 = DASHA_ORDER.indexOf(lord);
  const out: RawDasha[] = [];
  let t = start.getTime();
  for (let k = 0; k < 9; k++) {
    const sub = DASHA_ORDER[(i0 + k) % 9];
    const e = k === 8 ? end.getTime() : t + (total * DASHA_YEARS[sub]) / 120;
    out.push({ path: [...path, sub], start: new Date(t), end: new Date(e) });
    t = e;
  }
  return out;
}

/**
 * Scored children of a period, built if the tree stops above them. The
 * result is cached on the period, so asking twice is free.
 */
export function childrenOf(chart: NatalChart, period: DashaPeriod): DashaPeriod[] {
  if (period.level >= 5) return [];
  if (period.children?.length) return period.children;
  const raw = splitPeriod(period.path, period.start, period.end);
  period.children = scoreDashaTree(chart, raw);
  return period.children;
}

/**
 * The running chain from maha down to `depth` (default prana) at an instant,
 * building the missing levels on the way.
 */
export function deepChainAt(chart: NatalChart, mahas: DashaPeriod[], at: Date, depth: 1 | 2 | 3 | 4 | 5 = 5): DashaPeriod[] {
  const chain: DashaPeriod[] = [];
  let list: DashaPeriod[] = mahas;
  while (chain.length < depth) {
    const hit = list.find((p) => p.start <= at && at < p.end);
    if (!hit) break;
    chain.push(hit);
    if (chain.length >= depth) break;
    list = childrenOf(chart, hit);
  }
  return chain;
}

/** Human length of a span: "3 y 2 m", "14 d", "9 h 40 m". */
export function spanLabel(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  const h = ms / 3_600_000;
  if (h < 48) {
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return hh ? `${hh} h${mm ? ` ${mm} m` : ''}` : `${mm} m`;
  }
  const d = h / 24;
  if (d < 62) return `${Math.round(d)} d`;
  const months = d / 30.4375;
  if (months < 24) return `${Math.round(months)} mo`;
  const y = Math.floor(months / 12), m = Math.round(months - y * 12);
  return `${y} y${m ? ` ${m} mo` : ''}`;
}
