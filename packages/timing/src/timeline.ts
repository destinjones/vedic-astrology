/**
 * One call that builds everything the timeline UI needs.
 */
import { type Ephemeris, type NatalChart, type Planet, PLANETS, type Tone } from './types';
import { addDays, DAY_MS, toneOf } from './astro';
import { activeDashas, computeVimshottari, type DashaOptions, type DashaPeriod } from './dasha';
import { computeAshtakavarga, type Ashtakavarga, describeAshtakavarga } from './ashtakavarga';
import { saturnPhases, type SaturnPhase, type SadeSatiSpell, type SeriesPoint, transitBaseline, transitSeries, transitSnapshot, type TransitSnapshot } from './transits';
import { findRetrogrades, type RetrogradePeriod } from './retrograde';
import { findIngresses, type Ingress } from './events';

export interface TimelineOptions extends DashaOptions {
  from?: Date;
  to?: Date;
  /** Sampling step for the transit / combined series, days. Default 7. */
  stepDays?: number;
  /** Share of the combined score that comes from dasha (rest from transits). Default 0.6 (dasha promises, transits trigger). */
  dashaShare?: number;
  /** Pre-computed dasha tree (e.g. scored engine periods). */
  dashas?: DashaPeriod[];
  /** Score transits against the chart's own long-run baseline (default true). */
  relativeTransits?: boolean;
}

export interface CombinedPoint extends SeriesPoint {
  /** Transit score relative to this chart's long-run baseline. */
  relTransit: number;
  dasha: number;
  combined: number;
  tone: Tone;
  dashaPath: Planet[];
}

export interface Window {
  start: Date;
  end: Date;
  tone: 'favourable' | 'challenging';
  average: number;
  peak: number;
  dashaPath: Planet[];
  drivers: string[];
}

export interface Timeline {
  range: { from: Date; to: Date };
  transitBaseline: number;
  dashas: DashaPeriod[];
  current: DashaPeriod[];
  ashtakavarga: Ashtakavarga & { signs: ReturnType<typeof describeAshtakavarga> };
  series: CombinedPoint[];
  windows: Window[];
  retrogrades: RetrogradePeriod[];
  saturn: { phases: SaturnPhase[]; sadeSati: SadeSatiSpell[] };
  ingresses: Ingress[];
  now: TransitSnapshot;
}

const SLOW: Planet[] = ['Jupiter', 'Saturn', 'Rahu', 'Ketu', 'Mars'];

export function buildTimeline(eph: Ephemeris, chart: NatalChart, opts: TimelineOptions = {}): Timeline {
  const now = new Date();
  const from = opts.from ?? addDays(now, -365 * 2);
  const to = opts.to ?? addDays(now, 365 * 5);
  const step = opts.stepDays ?? 7;
  const share = opts.dashaShare ?? 0.6;
  const dashas = opts.dashas ?? computeVimshottari(chart, { depth: opts.depth ?? 3, yearDays: opts.yearDays });

  const tseries = transitSeries(eph, chart, from, to, step);
  const baseline = opts.relativeTransits === false ? 0 : transitBaseline(eph, chart, new Date((from.getTime() + to.getTime()) / 2));
  const series: CombinedPoint[] = tseries.map((pt) => {
    const relTransit = Math.max(-100, Math.min(100, pt.transit - baseline));
    const chain = activeDashas(dashas, pt.date);
    const leaf = chain[chain.length - 1];
    const dasha = leaf?.score ?? 0;
    const combined = Math.round(share * dasha + (1 - share) * relTransit);
    return { ...pt, relTransit: Math.round(relTransit), dasha, combined, tone: toneOf(combined), dashaPath: leaf?.path ?? [] };
  });

  const windows = findWindows(series, step);
  const av = computeAshtakavarga(chart);
  const ingresses = SLOW.flatMap((p) => findIngresses(eph, p, from, to)).sort((a, b) => a.date.getTime() - b.date.getTime());
  return {
    range: { from, to },
    transitBaseline: Math.round(baseline),
    dashas,
    current: activeDashas(dashas, now),
    ashtakavarga: { ...av, signs: describeAshtakavarga(av) },
    series,
    windows,
    retrogrades: findRetrogrades(eph, chart, from, to),
    saturn: saturnPhases(eph, chart, addDays(chart.birth, 1), addDays(chart.birth, 365.25 * 100)),
    ingresses,
    now: transitSnapshot(chart, eph.positions(now), now, av),
  };
}

/** Contiguous stretches (after light smoothing) of clearly favourable or clearly challenging weather. */
export function findWindows(series: CombinedPoint[], stepDays: number, threshold = 18, minDays = 21): Window[] {
  const smooth = series.map((_, i) => {
    const a = series.slice(Math.max(0, i - 2), i + 3);
    return a.reduce((s, p) => s + p.combined, 0) / a.length;
  });
  const out: Window[] = [];
  let i = 0;
  while (i < series.length) {
    const sgn = smooth[i] >= threshold ? 1 : smooth[i] <= -threshold ? -1 : 0;
    if (!sgn) { i++; continue; }
    let j = i;
    while (j + 1 < series.length && (sgn > 0 ? smooth[j + 1] >= threshold : smooth[j + 1] <= -threshold)) j++;
    const days = (j - i + 1) * stepDays;
    if (days >= minDays) {
      const seg = series.slice(i, j + 1);
      const avg = seg.reduce((s, p) => s + p.combined, 0) / seg.length;
      const peakPt = seg.reduce((b, p) => (sgn > 0 ? p.combined > b.combined : p.combined < b.combined) ? p : b);
      // drivers: the transiting planets pushing hardest in this direction on average
      const totals = PLANETS.map((p) => [p, seg.reduce((s, x) => s + x.byPlanet[p], 0) / seg.length] as const)
        .sort((a, b) => (sgn > 0 ? b[1] - a[1] : a[1] - b[1])).slice(0, 3)
        .filter(([, v]) => sgn * v > 5).map(([p, v]) => `${p} transit (${v > 0 ? '+' : ''}${Math.round(v)})`);
      const dashaName = peakPt.dashaPath.join('–');
      out.push({
        start: seg[0].date, end: new Date(seg[seg.length - 1].date.getTime() + stepDays * DAY_MS),
        tone: sgn > 0 ? 'favourable' : 'challenging', average: Math.round(avg), peak: peakPt.combined, dashaPath: peakPt.dashaPath,
        drivers: [`${dashaName} dasha (${peakPt.dasha > 0 ? '+' : ''}${peakPt.dasha})`, ...totals],
      });
    }
    i = j + 1;
  }
  return out;
}

