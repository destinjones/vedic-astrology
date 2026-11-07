/**
 * Keeps the annotated case studies in apps/web honest: every yoga, dosha and
 * dasha period an annotation names must be what the engine computes for that chart.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, dashaAt, type Engine } from '@vedic/engine';
import { fromEngineChart, interpretChart, YOGA_DEFINITIONS, DOSHA_DEFINITIONS } from '../src';
import { CASE_STUDIES } from '../../../apps/web/src/data/caseStudies';
import { famousChartById } from '../../../apps/web/src/data/famousCharts';

let engine: Engine;
beforeAll(async () => { engine = await createEngine(); });

describe('famous chart case studies', () => {
  for (const study of CASE_STUDIES) {
    it(`${study.id}: annotations match the engine`, () => {
      const f = famousChartById(study.id);
      expect(f, 'case study must point at a famous chart').toBeDefined();
      const i = f!.input;
      const chart = engine.computeChart(
        { date: i.date, time: i.time, name: i.name, place: { name: i.place, latitude: i.latitude, longitude: i.longitude, timezone: i.timezone }, utcOffsetMinutes: i.utcOffsetMinutes },
        { ayanamsa: 'lahiri', dashaLevels: 2 },
      );
      const report = interpretChart(fromEngineChart(chart));
      for (const n of study.notes) {
        if (n.kind === 'yoga') {
          expect(YOGA_DEFINITIONS[n.id], n.id).toBeDefined();
          const hits = report.yogas.filter((y) => y.id === n.id && (n.planets ?? []).every((p) => y.involved.includes(p as never)));
          expect(hits.length, `${study.id} should detect ${n.id} ${n.planets?.join('+') ?? ''}`).toBeGreaterThan(0);
        } else {
          expect(DOSHA_DEFINITIONS[n.id], n.id).toBeDefined();
          expect(report.doshas.find((d) => d.id === n.id)?.present, `${study.id} should flag ${n.id}`).toBe(true);
        }
      }
      for (const e of study.events) {
        const [md, ad] = dashaAt(chart.dasha, `${e.date}T12:00:00Z`);
        expect(`${md?.lord}-${ad?.lord}`, `${study.id} on ${e.date}`).toBe(`${e.md}-${e.ad}`);
      }
    });
  }
});
