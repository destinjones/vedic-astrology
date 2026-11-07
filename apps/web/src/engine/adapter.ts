import type { BirthInput, Chart, DashaPeriod, PlanetId, PlanetPosition, VargaChart, VargaId } from '../types/chart';
import { ALL_VARGAS, buildVarga } from '../lib/vargas';

/**
 * Structural view of @vedic/engine's Chart (only the fields the UI reads).
 * Kept local so the UI compiles before the engine package exists.
 */
interface EnginePoint {
  longitude: number; sign: number; degreeInSign: number; nakshatra: number; pada: number;
}
interface EnginePlanet extends EnginePoint {
  speed: number; house: number; retrograde: boolean; combust: boolean;
}
interface EngineDashaNode {
  lord: PlanetId; start: string; end: string; children?: EngineDashaNode[];
}
export interface EngineChart {
  meta: { ayanamsaValue: number };
  ascendant: EnginePoint;
  planets: Partial<Record<string, EnginePlanet>>;
  vargas?: Partial<Record<VargaId, { ascendant: { sign: number }; planets: Partial<Record<string, { sign: number; house: number }>> }>>;
  dasha?: { periods: EngineDashaNode[] };
}

const IDS: PlanetId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];

const toDasha = (n: EngineDashaNode): DashaPeriod => ({
  lord: n.lord, start: n.start, end: n.end, sub: n.children?.map(toDasha),
});

export function fromEngine(input: BirthInput, c: EngineChart): Chart {
  const planets: PlanetPosition[] = IDS.filter((id) => c.planets[id]).map((id) => {
    const p = c.planets[id]!;
    return {
      id, longitude: p.longitude, sign: p.sign, degreeInSign: p.degreeInSign,
      nakshatra: p.nakshatra, pada: p.pada, house: p.house,
      retrograde: p.retrograde, combust: p.combust, speed: p.speed,
    };
  });
  const vargas: Partial<Record<VargaId, VargaChart>> = {};
  for (const id of ALL_VARGAS) {
    const v = c.vargas?.[id];
    if (v) {
      const pl = {} as VargaChart['planets'];
      IDS.forEach((pid) => { const x = v.planets[pid]; if (x) pl[pid] = { sign: x.sign, house: x.house }; });
      vargas[id] = { id, ascSign: v.ascendant.sign, planets: pl };
    } else {
      vargas[id] = buildVarga(id, c.ascendant.longitude, planets);
    }
  }
  return {
    input,
    ascendant: {
      longitude: c.ascendant.longitude, sign: c.ascendant.sign, degreeInSign: c.ascendant.degreeInSign,
      nakshatra: c.ascendant.nakshatra, pada: c.ascendant.pada,
    },
    planets,
    vargas,
    dasha: c.dasha?.periods.map(toDasha),
    meta: { ayanamsaValue: c.meta.ayanamsaValue, source: 'engine' },
  };
}
