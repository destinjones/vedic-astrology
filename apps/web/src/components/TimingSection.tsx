import { useMemo } from 'react';
import { TimingDashboard } from '@vedic/timing/ui';
import { engineEphemeris, natalFromChart, scoredDashasFromChart } from '@vedic/timing/engine';
import type { Chart } from '../types/chart';

/** The timing dashboard, driven by the same engine and chart as the rest of the page. */
export default function TimingSection({ context, name }: { context: NonNullable<Chart['engineContext']>; name?: string }) {
  const { engine, chart } = context;
  const natal = useMemo(() => natalFromChart(chart), [chart]);
  const ephemeris = useMemo(
    () => engineEphemeris(engine, { ayanamsa: chart.meta.ayanamsa, nodeType: chart.meta.nodeType }),
    [engine, chart],
  );
  const dashas = useMemo(() => scoredDashasFromChart(chart, natal), [chart, natal]);
  return <TimingDashboard chart={natal} ephemeris={ephemeris} name={name} dashas={dashas} />;
}
