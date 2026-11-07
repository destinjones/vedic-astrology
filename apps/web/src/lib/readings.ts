import type { Chart as EngineChart } from '@vedic/engine';
import type { ChartInterpretation, Citation, NakshatraProfile, Reading, RuleSource } from '@vedic/interpretations';

export type { Citation, Reading, RuleSource };

export interface Knowledge {
  report: ChartInterpretation;
  getNakshatra: (num: number) => NakshatraProfile;
  /** Language the readings are written in (English when the chosen one has no translation yet). */
  locale: string;
}

/** The reading library is large, so it loads as its own chunk after the chart appears; each language pack is another chunk. */
/** bhavaHouses: bhava chalit houses, so placement readings follow the bhava instead of the sign. */
export async function loadKnowledge(chart: EngineChart, locale = 'en', bhavaHouses?: Partial<Record<string, number>>): Promise<Knowledge> {
  const m = await import('@vedic/interpretations');
  const loaded = m.hasReadings(locale) ? await m.loadLocale(locale) : 'en';
  const L = m.localizer(loaded);
  return { report: m.interpretChart(m.fromEngineChart(chart), { locale: loaded, bhavaHouses }), getNakshatra: (n) => L.nakshatra(n), locale: loaded };
}
