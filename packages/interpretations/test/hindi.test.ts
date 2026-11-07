import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine } from '@vedic/engine';
import {
  CONJUNCTIONS,
  DOSHA_DEFINITIONS,
  EN_PHRASES,
  YOGA_DEFINITIONS,
  fromEngineChart,
  interpretChart,
  loadLocale,
  type ChartInput,
  type ContentPack,
  type Reading,
} from '../src';
import hi from '../src/locales/hi';

/** Every piece of text a reading shows, flattened. */
const texts = (r: Reading) => [r.title, r.summary, ...r.detail, ...r.strengths, ...r.challenges, ...(r.remedies ?? [])];
const LATIN_WORD = /[A-Za-z]{4,}/;

describe('Hindi readings pack', () => {
  const pack = hi as Required<ContentPack>;

  it('covers every table the English readings have', () => {
    expect(Object.keys(pack.phrases).sort()).toEqual(Object.keys(EN_PHRASES).sort());
    expect(pack.signs).toHaveLength(12);
    expect(pack.houses).toHaveLength(12);
    expect(pack.nakshatras).toHaveLength(27);
    for (const n of pack.nakshatras) expect(n.padas).toHaveLength(4);
    for (const p of Object.values(pack.planetInSign)) expect(p).toHaveLength(12);
    for (const p of Object.values(pack.planetInHouse)) expect(p).toHaveLength(12);
    expect(Object.keys(pack.planetInSign)).toHaveLength(9);
    expect(Object.keys(pack.planetInHouse)).toHaveLength(9);
    expect(pack.houseLords).toHaveLength(12);
    for (const row of pack.houseLords) expect(row).toHaveLength(12);
    expect(Object.keys(pack.conjunctions).sort()).toEqual(Object.keys(CONJUNCTIONS).sort());
    expect(Object.keys(pack.yogas).sort()).toEqual(Object.keys(YOGA_DEFINITIONS).sort());
    expect(Object.keys(pack.doshas).sort()).toEqual(Object.keys(DOSHA_DEFINITIONS).sort());
  });

  describe('on a real chart', () => {
    let chart: ChartInput;
    beforeAll(async () => {
      await loadLocale('hi');
      const engine = await createEngine();
      chart = fromEngineChart(engine.computeChart({ date: '1869-10-02', time: '07:11', place: { name: 'Porbandar', latitude: 21.6417, longitude: 69.6293 } }));
    });

    it('reads entirely in Hindi', () => {
      const r = interpretChart(chart, { locale: 'hi' });
      const all = [
        ...r.placements.flatMap(texts),
        ...r.houseLords.flatMap(texts),
        ...r.yogas.flatMap((y) => [y.name, y.reason, ...texts(y.reading)]),
        ...r.doshas.flatMap((d) => [d.name, d.reason, ...d.cancellations, ...texts(d.reading)]),
      ];
      expect(all.length).toBeGreaterThan(100);
      expect(all.filter((s) => LATIN_WORD.test(s))).toEqual([]);
    });

    it('keeps the same findings as English', () => {
      const en = interpretChart(chart);
      const hiR = interpretChart(chart, { locale: 'hi' });
      expect(hiR.yogas.map((y) => y.id)).toEqual(en.yogas.map((y) => y.id));
      expect(hiR.doshas.map((d) => [d.id, d.present, d.severity])).toEqual(en.doshas.map((d) => [d.id, d.present, d.severity]));
      expect(hiR.placements.map((p) => [p.id, p.score])).toEqual(en.placements.map((p) => [p.id, p.score]));
    });
  });
});
