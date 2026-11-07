import type { Chart as EngineChart } from '@vedic/engine';
import type { ChartInterpretation, NakshatraProfile, Reading } from '@vedic/interpretations';

export type { Reading };

export interface Knowledge {
  report: ChartInterpretation;
  getNakshatra: (num: number) => NakshatraProfile;
  /** Language the readings are written in (English when the chosen one has no translation yet). */
  locale: string;
}

/** The reading library is large, so it loads as its own chunk after the chart appears; each language pack is another chunk. */
export async function loadKnowledge(chart: EngineChart, locale = 'en'): Promise<Knowledge> {
  const m = await import('@vedic/interpretations');
  const loaded = m.hasReadings(locale) ? await m.loadLocale(locale) : 'en';
  const L = m.localizer(loaded);
  return { report: m.interpretChart(m.fromEngineChart(chart), { locale: loaded }), getNakshatra: (n) => L.nakshatra(n), locale: loaded };
}
