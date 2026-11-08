/**
 * Shared set-up for the consultation tools: the timing layer's view of the
 * chart, an ephemeris on the same zodiac, the scored Vimshottari tree and
 * ashtakavarga. Built once and passed to the snapshot, talking points and
 * question finder so the three agree with each other and with the timing
 * dashboard.
 */
import type { Chart, Engine } from '@vedic/engine';
import type { ChartInterpretation, RuleSource } from '@vedic/interpretations';
import { formatCitation } from '@vedic/interpretations';
import {
  type Ashtakavarga,
  type DashaPeriod,
  type Ephemeris,
  type NatalChart,
  type Planet,
  activeDashas,
  childrenOf,
  computeAshtakavarga,
  signOf,
} from '@vedic/timing';
import { engineEphemeris, natalFromChart, scoredDashasFromChart } from '@vedic/timing/engine';

export interface ConsultContext {
  engine: Engine;
  chart: Chart;
  report: ChartInterpretation;
  natal: NatalChart;
  eph: Ephemeris;
  /** Scored Vimshottari mahadashas (with sub-periods where the engine computed them). */
  dashas: DashaPeriod[];
  av: Ashtakavarga;
  now: Date;
  /** Sign index, 0 = Aries. */
  ascSign: number;
  moonSign: number;
}

export function consultContext(engine: Engine, chart: Chart, report: ChartInterpretation, now: Date = new Date()): ConsultContext {
  const natal = natalFromChart(chart);
  return {
    engine,
    chart,
    report,
    natal,
    eph: engineEphemeris(engine, { ayanamsa: chart.meta.ayanamsa, nodeType: chart.meta.nodeType }),
    dashas: scoredDashasFromChart(chart, natal),
    av: computeAshtakavarga(natal),
    now,
    ascSign: signOf(natal.ascendant),
    moonSign: signOf(natal.planets.Moon.longitude),
  };
}

/** Sub-periods of a period: the engine's own where it computed them, otherwise split here. */
export function subPeriods(ctx: Pick<ConsultContext, 'natal'>, p: DashaPeriod): DashaPeriod[] {
  return p.children?.length ? p.children : childrenOf(ctx.natal, p);
}

/** Mahadasha, antardasha and pratyantardasha running at `at`. */
export function runningChain(ctx: ConsultContext, at: Date = ctx.now): DashaPeriod[] {
  const out: DashaPeriod[] = [];
  let level: DashaPeriod[] = ctx.dashas;
  for (let i = 0; i < 3; i++) {
    const p = activeDashas(level, at)[0] ?? level.find((d) => d.start <= at && at < d.end);
    if (!p) break;
    out.push(p);
    level = subPeriods(ctx, p);
  }
  return out;
}

/** Short citation label for a rule source, e.g. "BPHS 36.1–3", or the non-classical note's first clause. */
export function citeOf(source: RuleSource | null | undefined): string | undefined {
  if (!source) return undefined;
  if (source.citations.length) return source.citations.map(formatCitation).join('; ');
  return source.nonClassical ? 'later convention, no classical verse found' : undefined;
}

export const PLANET_ID = (p: Planet) => p.toLowerCase() as Lowercase<Planet>;
export const fromId = (id: string) => (id.charAt(0).toUpperCase() + id.slice(1)) as Planet;

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Mar 2027" */
export const monthYear = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
