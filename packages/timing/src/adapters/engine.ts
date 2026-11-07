/**
 * Bridge between @vedic/engine (Swiss Ephemeris) and the timing layer.
 *
 *   const engine = await createEngine();
 *   const chart = engine.computeChart(input);
 *   const timeline = timelineForChart(engine, chart);
 */
import type { Chart, DashaPeriod as EngineDasha, Engine, GrahaId, PositionOptions } from '@vedic/engine';
import { dateToJd } from '@vedic/engine';
import type { Ephemeris, NatalChart, Planet, PlanetPosition, Positions } from '../types';
import { PLANETS } from '../types';
import { scoreDashaTree, type DashaPeriod, type RawDasha } from '../dasha';
import { buildTimeline, type Timeline, type TimelineOptions } from '../timeline';
import { checkLifeEvent, eventBaseline, lifetimeSaturn, type DashaNode, type DashaSystemInput, type EventCheck, type LifeEvent } from '../lifeEvents';

export const toGrahaId = (p: Planet) => p.toLowerCase() as GrahaId;
export const fromGrahaId = (id: GrahaId) => (id.charAt(0).toUpperCase() + id.slice(1)) as Planet;

/** Ephemeris backed by the engine, using the same ayanamsa / node type as the natal chart. */
export function engineEphemeris(engine: Engine, options: PositionOptions = {}): Ephemeris {
  const position = (planet: Planet, d: Date): PlanetPosition => engine.longitudeAt(toGrahaId(planet), dateToJd(d), options);
  return {
    position,
    positions(d: Date) {
      const snap = engine.positionsAt(d, options);
      const out = {} as Positions;
      for (const p of PLANETS) {
        const s = snap.planets[toGrahaId(p)];
        out[p] = { longitude: s.longitude, speed: s.speed };
      }
      return out;
    },
  };
}

export function natalFromChart(chart: Chart): NatalChart {
  const planets = {} as Positions;
  for (const p of PLANETS) {
    const s = chart.planets[toGrahaId(p)];
    planets[p] = { longitude: s.longitude, speed: s.speed };
  }
  return { birth: new Date(chart.meta.utc), ascendant: chart.ascendant.longitude, planets };
}

const toRaw = (p: EngineDasha): RawDasha => ({
  path: p.path.map(fromGrahaId),
  start: new Date(p.start),
  end: new Date(p.end),
  children: p.children?.map(toRaw),
});

/** Score the engine's own Vimshottari periods so boundaries match the chart exactly. */
export function scoredDashasFromChart(chart: Chart, natal = natalFromChart(chart)): DashaPeriod[] {
  return scoreDashaTree(natal, chart.dasha.periods.map(toRaw));
}

/** Everything the timeline UI needs, computed with the engine's ephemeris and dasha. */
export function timelineForChart(engine: Engine, chart: Chart, opts: TimelineOptions = {}): Timeline {
  const natal = natalFromChart(chart);
  const eph = engineEphemeris(engine, { ayanamsa: chart.meta.ayanamsa, nodeType: chart.meta.nodeType });
  return buildTimeline(eph, natal, { dashas: scoredDashasFromChart(chart, natal), ...opts });
}

/** Structural view of a dasha tree from the engine, so newer systems light up when the engine adds them. */
interface EngineDashaTree {
  periods: EngineDasha[];
  applicable?: boolean;
}

const toNode = (p: EngineDasha): DashaNode => {
  const x = p as EngineDasha & { sign?: number; name?: string };
  return {
  lord: fromGrahaId(p.lord),
  sign: typeof x.sign === 'number' ? x.sign - 1 : undefined,
  name: x.name,
  start: new Date(p.start),
  end: new Date(p.end),
  children: p.children?.map(toNode),
  };
};

const SYSTEM_LABELS: Record<string, string> = {
  vimshottari: 'Vimshottari', yogini: 'Yogini', ashtottari: 'Ashtottari', kalachakra: 'Kalachakra', chara: 'Chara (Jaimini)',
};

/** Every dasha system the chart carries: Vimshottari always, plus Yogini, Ashtottari, Kalachakra... when present. */
export function dashaSystemsFromChart(chart: Chart): DashaSystemInput[] {
  const out: DashaSystemInput[] = [{ system: 'vimshottari', label: 'Vimshottari', periods: chart.dasha.periods.map(toNode) }];
  const extra = (chart as unknown as { dashas?: Record<string, EngineDashaTree | undefined> }).dashas;
  if (extra && typeof extra === 'object') {
    for (const [system, tree] of Object.entries(extra)) {
      if (!tree || !Array.isArray(tree.periods) || !tree.periods.length) continue;
      out.push({
        system,
        label: SYSTEM_LABELS[system] ?? system.charAt(0).toUpperCase() + system.slice(1),
        periods: tree.periods.map(toNode),
        note: tree.applicable === false ? 'Classically used only when Rahu is in a kendra or trikona from the lagna lord; it does not apply to this chart' : undefined,
      });
    }
  }
  return out;
}

/** Everything needed to check events for one chart, built once (the lifetime baseline is the slow part). */
export function lifeEventContext(engine: Engine, chart: Chart) {
  const natal = natalFromChart(chart);
  const eph = engineEphemeris(engine, { ayanamsa: chart.meta.ayanamsa, nodeType: chart.meta.nodeType });
  const systems = dashaSystemsFromChart(chart);
  const saturn = lifetimeSaturn(eph, natal);
  const to = new Date(Math.min(Date.now(), natal.birth.getTime() + 80 * 365.25 * 86_400_000));
  const baseline = eventBaseline(eph, natal, systems, saturn, to);
  return { natal, eph, systems, check: (e: LifeEvent): EventCheck => checkLifeEvent(eph, natal, e, { systems, saturn, baseline }) };
}

/** Check one or more life events against the chart with the engine's ephemeris and every dasha system it carries. */
export function checkLifeEventsForChart(engine: Engine, chart: Chart, events: LifeEvent[]): EventCheck[] {
  const ctx = lifeEventContext(engine, chart);
  return events.map(ctx.check);
}
