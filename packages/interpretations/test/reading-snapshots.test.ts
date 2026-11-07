/**
 * Snapshots every reading for one fixed chart, in English and Hindi. Any change to
 * reading text, scores, yoga or dosha detection, or the ephemeris shows up as a
 * diff of test/__snapshots__/*.md in code review.
 *
 * After an intended change: npx vitest run -u   (in packages/interpretations)
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type Chart } from '@vedic/engine';
import { fromEngineChart, interpretChart, loadLocale } from '../src';
import { renderReading } from './render-reading';

// Mohandas K. Gandhi, 2 October 1869, Porbandar: a public chart with Libra rising, and the
// same birth data as interpretations.test.ts. Do not change it: the snapshot is only useful
// if the chart stays fixed.
const GANDHI = { date: '1869-10-02', time: '07:11', place: { name: 'Porbandar', latitude: 21.6417, longitude: 69.6293 } };

describe('reading snapshots', () => {
  let chart: Chart;
  beforeAll(async () => {
    chart = (await createEngine()).computeChart(GANDHI);
    await loadLocale('hi');
  });
  it('English', async () => {
    await expect(renderReading('Every reading for the Gandhi chart (English)', interpretChart(fromEngineChart(chart)))).toMatchFileSnapshot('__snapshots__/reading-gandhi.en.md');
  });
  it('Hindi', async () => {
    await expect(renderReading('Every reading for the Gandhi chart (Hindi)', interpretChart(fromEngineChart(chart), { locale: 'hi' }))).toMatchFileSnapshot('__snapshots__/reading-gandhi.hi.md');
  });
});
