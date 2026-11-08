import type { ChartInput } from '@vedic/interpretations';
import type { BirthInput, Chart } from '../types/chart';
import { readLastChart } from '../lib/lastChart';

/** The sample chart the app opens with, used when this browser has no chart of its own yet. */
export const SAMPLE_INPUT: BirthInput = {
  name: 'Sample chart', date: '1990-08-15', time: '06:30', place: 'New Delhi, India',
  latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata', ayanamsa: 'lahiri',
};

/** The chart last opened in the explorer, if any. */
export function lastInput(): BirthInput | null {
  try {
    const o = readLastChart() as Partial<BirthInput> | null;
    if (o && typeof o.date === 'string' && typeof o.time === 'string' && Number.isFinite(o.latitude) && Number.isFinite(o.longitude)) return { ...SAMPLE_INPUT, name: '', ...o };
  } catch { /* ignore */ }
  return null;
}

/** The interpretation library's view of a chart: from the engine when it ran, else from the UI chart. */
export async function interpretInput(chart: Chart): Promise<ChartInput> {
  const m = await import('@vedic/interpretations');
  if (chart.engineContext) return m.fromEngineChart(chart.engineContext.chart);
  const planets = {} as ChartInput['planets'];
  for (const p of chart.planets) {
    planets[p.id] = {
      sign: p.sign as ChartInput['planets']['sun']['sign'], house: p.house as ChartInput['planets']['sun']['house'], longitude: p.longitude,
      retrograde: p.retrograde, combust: p.combust, nakshatra: p.nakshatra, pada: p.pada as 1, speed: p.speed,
    };
  }
  return { ascendantSign: chart.ascendant.sign as ChartInput['ascendantSign'], ascendantLongitude: chart.ascendant.longitude, planets };
}
