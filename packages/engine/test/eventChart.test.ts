import { beforeAll, describe, expect, it } from 'vitest';
import { castEventChart, contactsBetween, createEngine, dashaAt, type Engine, type GrahaId } from '../src/index';

let engine: Engine;
beforeAll(async () => {
  engine = await createEngine();
});
const delhi = { name: 'New Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' };

describe('event chart', () => {
  it('casts the moment on its own', () => {
    const r = castEventChart(engine, { date: '2016-02-14', time: '10:30', place: delhi });
    expect(r.chart.meta.input.date).toBe('2016-02-14');
    expect(r.natal).toBeUndefined();
    expect(r.summary).toMatch(/rising, Moon in/);
  });

  it('reads the moment against a birth chart', () => {
    const natal = engine.computeChart({ date: '1990-08-15', time: '06:30', place: delhi }, { dashaLevels: 3 });
    const r = castEventChart(engine, { date: '2016-02-14', time: '10:30', place: delhi }, natal);
    const n = r.natal!;
    expect(n.age).toBeCloseTo(25.5, 1);
    // houses are whole signs from the natal lagna
    for (const g of ['sun', 'moon', 'saturn'] as GrahaId[]) {
      expect(n.houses[g]).toBe(((r.chart.planets[g].sign - natal.ascendant.sign + 12) % 12) + 1);
    }
    // natal periods to the sookshma, agreeing with the chart's own maha–antar–pratyantar
    expect(n.dasha).toHaveLength(4);
    const own = dashaAt(natal.dasha, r.chart.meta.jdUt).map((p) => p.lord);
    expect(n.dasha.slice(0, 3).map((d) => d.lord)).toEqual(own);
    for (const c of n.contacts) expect(c.orb).toBeLessThanOrEqual(3);
    expect(r.summary).toMatch(/natal \d+(st|nd|rd|th) house/);
  });

  it('finds contacts and skips node pairs', () => {
    const lon = (x: number) => ({ sun: x, moon: 0, mars: 0, mercury: 0, jupiter: 0, venus: 0, saturn: 0, rahu: 0, ketu: 180 }) as Record<GrahaId, number>;
    const c = contactsBetween(lon(181), { ...lon(10), asc: 1 });
    expect(c.find((x) => x.planet === 'sun' && x.natal === 'moon')).toMatchObject({ kind: 'opposition', orb: 1 });
    expect(c.find((x) => x.planet === 'rahu' && x.natal === 'ketu')).toBeUndefined();
    expect(c[0].orb).toBeLessThanOrEqual(c[c.length - 1].orb);
  });
});
