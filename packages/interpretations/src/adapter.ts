import type { Chart } from '@vedic/engine/types';
import type { ChartInput, PlanetId } from './types';
import { PLANETS } from './types';

/** Map an @vedic/engine Chart to the minimal input the interpreters use. */
export function fromEngineChart(chart: Chart): ChartInput {
  const planets = {} as ChartInput['planets'];
  for (const id of PLANETS) {
    const p = chart.planets[id as PlanetId];
    planets[id] = {
      sign: p.sign,
      house: p.house,
      longitude: p.longitude,
      retrograde: p.retrograde,
      combust: p.combust,
      nakshatra: p.nakshatra,
      pada: p.pada,
      speed: p.speed,
      dignity: p.dignity,
    };
  }
  return { ascendantSign: chart.ascendant.sign, ascendantLongitude: chart.ascendant.longitude, planets };
}
