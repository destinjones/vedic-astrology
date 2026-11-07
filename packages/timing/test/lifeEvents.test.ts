import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type Chart, type Engine } from '@vedic/engine';
import { checkLifeEventsForChart, dashaSystemsFromChart, natalFromChart } from '../src/adapters/engine';
import {
  EVENT_SIGNIFICATIONS, LIFE_EVENT_KINDS, doubleTransit, eventWindow, lordRelevance, recurringLords, signOf, type LifeEvent,
} from '../src';

let engine: Engine;
let chart: Chart;
beforeAll(async () => {
  engine = await createEngine();
  chart = engine.computeChart({ date: '1990-08-15', time: '06:30', place: { name: 'New Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' } });
});

describe('life event model', () => {
  it('every kind has a label and the primary house first', () => {
    for (const k of LIFE_EVENT_KINDS) {
      const s = EVENT_SIGNIFICATIONS[k];
      expect(s.label.length).toBeGreaterThan(2);
      if (k !== 'other') expect(s.houses.length).toBeGreaterThan(0);
    }
    expect(EVENT_SIGNIFICATIONS.marriage.houses[0]).toBe(7);
  });
  it('turns a date and precision into a window', () => {
    const d = eventWindow({ date: '2015-06-20' });
    expect(d.end.getTime() - d.start.getTime()).toBe(86_400_000);
    const m = eventWindow({ date: '2015-06-01', precision: 'month' });
    expect(m.start.toISOString().slice(0, 10)).toBe('2015-06-01');
    expect(m.end.toISOString().slice(0, 10)).toBe('2015-07-01');
    const y = eventWindow({ date: '2015-01-01', precision: 'year' });
    expect(y.end.toISOString().slice(0, 10)).toBe('2016-01-01');
  });
});

describe('relevance', () => {
  it('the 7th lord is strongly linked to marriage', () => {
    const natal = natalFromChart(chart);
    const asc = signOf(natal.ascendant);
    const lords = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'] as const;
    const seventhLord = lords[(asc + 6) % 12];
    const r = lordRelevance(natal, seventhLord, 'marriage');
    expect(r.relevance).toBe('strong');
    expect(r.links[0]).toMatch(/7th/);
  });
  it('double transit needs both Jupiter and Saturn on the house or its lord', () => {
    const natal = natalFromChart(chart);
    const asc = signOf(natal.ascendant);
    const seventh = (asc + 6) % 12;
    // Jupiter in the 7th itself, Saturn aspecting it by its 10th aspect (from the 10th sign before)
    const dt = doubleTransit(natal, seventh, (seventh + 3) % 12, 7);
    expect(dt.jupiter.length).toBeGreaterThan(0);
    expect(dt.saturn.length).toBeGreaterThan(0);
    expect(dt.active).toBe(true);
  });
});

describe('checking events', () => {
  const events: LifeEvent[] = [
    { id: 'a', kind: 'marriage', date: '2016-02-14' },
    { id: 'b', kind: 'job', date: '2013-07-01', precision: 'month' },
    { id: 'c', kind: 'loss-of-father', date: '2020-01-01', precision: 'year' },
    { id: 'd', kind: 'other', date: '2019-05-05' },
  ];
  it('reports the dasha chain, transits, Saturn and retrogrades', () => {
    const [m, j, f, o] = checkLifeEventsForChart(engine, chart, events);
    const vim = m.dashas[0];
    expect(vim.system).toBe('vimshottari');
    expect(vim.chain.length).toBe(3);
    // the chain matches the engine's own periods at that date
    const at = m.window.mid.getTime();
    const maha = chart.dasha.periods.find((p) => Date.parse(p.start) <= at && at < Date.parse(p.end))!;
    expect(vim.chain[0].lord.toLowerCase()).toBe(maha.lord);
    expect(m.transits).toHaveLength(8);
    expect(m.doubleTransit?.house).toBe(7);
    expect(m.fit).toBeGreaterThanOrEqual(0);
    expect(m.fit).toBeLessThanOrEqual(100);
    expect(['strong', 'moderate', 'weak']).toContain(m.fitLabel);
    expect(m.percentile).toBeGreaterThanOrEqual(0);
    expect(m.percentile).toBeLessThanOrEqual(100);
    // a month window lists every antardasha it overlaps
    expect(j.dashas[0].overlapping.length).toBeGreaterThanOrEqual(1);
    expect(f.dashas[0].overlapping.length).toBeGreaterThanOrEqual(1);
    expect(o.fitLabel).toBe('n/a');
    expect(m.age).toBeCloseTo(25.5, 0);
  });
  it('finds Saturn phases (Sade Sati and the rest) when Saturn is in them', () => {
    const natal = natalFromChart(chart);
    const moon = signOf(natal.planets.Moon.longitude);
    const checks = checkLifeEventsForChart(engine, chart, Array.from({ length: 30 }, (_, i) => ({ id: String(i), kind: 'illness' as const, date: `${1995 + i}-06-01` })));
    const hits = checks.filter((c) => c.saturn.phase);
    expect(hits.length).toBeGreaterThan(5);
    for (const h of hits) {
      const sat = h.transits.find((t) => t.planet === 'Saturn')!;
      expect([12, 1, 2, 4, 8]).toContain(((sat.sign - moon + 12) % 12) + 1);
    }
  });
  it('picks up every dasha system the chart carries', () => {
    const fake = { ...chart, dashas: { yogini: { periods: chart.dasha.periods.map((p) => ({ ...p, name: 'Mangala' })) }, kalachakra: { periods: chart.dasha.periods.map((p) => ({ ...p, sign: 7 })) } } } as unknown as Chart;
    const systems = dashaSystemsFromChart(fake);
    expect(systems.map((s) => s.system)).toEqual(['vimshottari', 'yogini', 'kalachakra']);
    expect(systems[2].periods[0].sign).toBe(6);
    const [c] = checkLifeEventsForChart(engine, fake, [events[0]]);
    expect(c.dashas).toHaveLength(3);
    expect(c.dashas[1].chain[0].name).toBe('Mangala');
  });
  it('spots lords that recur across events', () => {
    const checks = checkLifeEventsForChart(engine, chart, [
      { id: '1', kind: 'marriage', date: '2016-02-14' },
      { id: '2', kind: 'childbirth', date: '2016-11-20' },
      { id: '3', kind: 'property', date: '2017-03-01' },
    ]);
    const pats = recurringLords(checks);
    for (const p of pats) expect(p.events).toBeGreaterThanOrEqual(2);
  });
});
