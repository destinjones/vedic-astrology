import type { Chart as EngineChart } from '@vedic/engine';
import type { ChartInterpretation, NakshatraProfile, Reading } from '@vedic/interpretations';

export type { Reading };

export interface Knowledge {
  report: ChartInterpretation;
  getNakshatra: (num: number) => NakshatraProfile;
}

/** The reading library is large, so it loads as its own chunk after the chart appears. */
export async function loadKnowledge(chart: EngineChart): Promise<Knowledge> {
  const m = await import('@vedic/interpretations');
  return { report: m.interpretChart(m.fromEngineChart(chart)), getNakshatra: m.getNakshatra };
}
