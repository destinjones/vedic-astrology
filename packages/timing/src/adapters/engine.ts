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
