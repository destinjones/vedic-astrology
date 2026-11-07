import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, dashaAt, dateToJd, localToUtc, vargaSign, type Engine } from '@vedic/engine';
import {
  EVENT_DEFS,
  WEIGHTS,
  candidateChart,
  dashaChain,
  dashaMatch,
  diffCandidates,
  eventSpan,
  rectify,
  shashtiamsaOf,
  transitMatch,
  type LifeEvent,
  type LifeEventKind,
} from '../src';

let engine: Engine;
const DELHI = { latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' };
const settings = { ayanamsa: 'lahiri' as const, nodeType: 'mean' as const };

beforeAll(async () => {
  engine = await createEngine();
});

describe('event dates', () => {
  it('parses year, month and day precision', () => {
    expect(eventSpan('2016').precision).toBe('year');
    expect(eventSpan('2016-02').end.toISOString()).toBe('2016-03-01T00:00:00.000Z');
    expect(eventSpan('2016-02-29').precision).toBe('day');
    expect(() => eventSpan('2015-02-29')).toThrow();
    expect(() => eventSpan('Feb 2016')).toThrow();
    // the shared event model stores a full date plus a precision
    expect(eventSpan({ date: '2016-02-01', precision: 'month' })).toMatchObject({ precision: 'month', end: new Date('2016-03-01T00:00:00Z') });
    expect(eventSpan({ date: '2016-01-01', precision: 'year' }).precision).toBe('year');
  });
});

describe('shashtiamsa', () => {
  it('runs forward in odd signs and backward in even signs', () => {
    expect(shashtiamsaOf(0.1)).toMatchObject({ index: 1, name: 'Ghora' });
    expect(shashtiamsaOf(29.9).index).toBe(60);
    expect(shashtiamsaOf(30.1).index).toBe(60); // Taurus starts with the 60th
    expect(shashtiamsaOf(59.9)).toMatchObject({ index: 1, name: 'Ghora' });
  });
});

describe('dasha chain', () => {
  it('matches the engine Vimshottari at several dates', () => {
    const chart = engine.computeChart({ date: '1990-08-15', time: '06:30', place: DELHI }, { dashaLevels: 3 });
    const c = candidateChart(engine, chart.meta.jdUt, DELHI, settings);
    for (const d of ['1995-03-01', '2004-07-19', '2016-02-10', '2033-12-31', '2071-06-01']) {
      const expected = dashaAt(chart.dasha, d).map((p) => p.lord);
      expect(dashaChain(c, dateToJd(new Date(d)))).toEqual(expected);
    }
  });
});

describe('change points', () => {
  const r = () =>
    rectify(engine, { date: '1990-08-15', from: '04:30', to: '08:30', place: DELHI, events: [] });

  it('finds lagna and navamsa changes to the second', () => {
    const res = r();
    const lagna = res.changePoints.filter((c) => c.kind === 'lagna');
    expect(lagna.length).toBe(2);
    for (const cp of [...lagna, ...res.changePoints.filter((c) => c.kind === 'navamsa')]) {
      const before = engine.ascendantAt(cp.jd - 2 / 86400, DELHI.latitude, DELHI.longitude);
      const after = engine.ascendantAt(cp.jd + 2 / 86400, DELHI.latitude, DELHI.longitude);
      const v = cp.kind === 'lagna' ? 'D1' : 'D9';
      expect(vargaSign(before, v)).not.toBe(vargaSign(after, v));
    }
    // D9 changes roughly every 13–17 minutes; D60 every 2 or so
    const d9 = res.changePoints.filter((c) => c.kind === 'navamsa').length;
    expect(d9).toBeGreaterThan(12);
    expect(res.changePoints.filter((c) => c.kind === 'shashtiamsa').length).toBeGreaterThan(80);
    expect(res.navamsaSegments.map((s) => s.endJd - s.startJd).reduce((a, b) => a + b, 0)).toBeCloseTo(res.window.endJd - res.window.startJd, 6);
  });

  it('reports local times at the birthplace', () => {
    const res = r();
    expect(res.window.startLocal).toBe('1990-08-15 04:30:00');
    expect(res.utcOffsetMinutes).toBe(330);
    expect(res.candidates.length).toBeGreaterThan(0);
    expect(res.notes.join(' ')).toMatch(/Add life events/);
  });

  it('handles windows that cross midnight', () => {
    const res = rectify(engine, { date: '1990-08-15', from: '23:00', to: '01:00', place: DELHI, events: [] });
    expect(res.window.minutes).toBe(120);
    expect(res.window.endLocal).toBe('1990-08-16 01:00:00');
  });
});

/**
 * Recovery test: pick a "true" birth time, choose dates for a handful of life
 * events where that chart's dashas and transits fit them best, then ask the
 * tool to find the time in a four-hour window without telling it.
 */
describe('recovers a planted birth time', () => {
  const kinds: LifeEventKind[] = ['marriage', 'childbirth', 'job', 'loss-of-father', 'property'];
  const jdOf = (t: string) => dateToJd(localToUtc('1990-08-15', t, DELHI.timezone).utc);

  function plantedEvents(trueLocal: string): LifeEvent[] {
    const c = candidateChart(engine, jdOf(trueLocal), DELHI, settings);
    return kinds.map((kind, k) => {
      const def = EVENT_DEFS[kind];
      let best = { v: -1, d: '' };
      // search a decade per event so they spread across life
      for (let m = 0; m < 120; m += 1) {
        const d = new Date(Date.UTC(2008 + k * 3, m, 15));
        const djd = dateToJd(d);
        const p = engine.positionsAt(djd, settings).planets;
        const t = { jupiter: p.jupiter.longitude, saturn: p.saturn.longitude, rahu: p.rahu.longitude, ketu: p.ketu.longitude, mars: p.mars.longitude };
        const v = WEIGHTS.dasha * dashaMatch(c, dashaChain(c, djd, 4), def, 'day').value + WEIGHTS.transit * transitMatch(c, t, def).value;
        if (v > best.v) best = { v, d: d.toISOString().slice(0, 10) };
      }
      return { kind, date: best.d };
    });
  }

  for (const trueLocal of ['07:11', '05:22', '06:47']) {
    it(`finds ${trueLocal} inside a four-hour window`, () => {
      const res = rectify(engine, { date: '1990-08-15', from: '04:45', to: '08:45', place: DELHI, events: plantedEvents(trueLocal) });
      const top = res.candidates[0];
      const truth = engine.ascendantAt(jdOf(trueLocal), DELHI.latitude, DELHI.longitude);
      expect(top.lagna.sign).toBe(vargaSign(truth, 'D1'));
      // 06:47 sits 90 s before a navamsa change, so only the minutes are checked there
      expect(Math.abs(top.jd - jdOf(trueLocal)) * 1440).toBeLessThan(10);
      if (trueLocal !== '06:47') expect(top.navamsa.sign).toBe(vargaSign(truth, 'D9'));
      expect(top.fits).toBeGreaterThanOrEqual(3);
      expect(top.events.every((e) => e.summary.length > 20 && e.dasha.parts.length === 4)).toBe(true); // exact days are checked to the sookshma
    });
  }

  it('is fast enough for the browser over a whole day', () => {
    const events = plantedEvents('07:11');
    const t0 = performance.now();
    const res = rectify(engine, { date: '1990-08-15', from: '00:00', to: '23:59', place: DELHI, events });
    expect(performance.now() - t0).toBeLessThan(5000);
    expect(res.lagnaSegments.length).toBeGreaterThanOrEqual(12);
  });
});

describe('candidate diff', () => {
  const jdOf = (t: string) => dateToJd(localToUtc('1990-08-15', t, DELHI.timezone).utc);
  it('shows what a few minutes change', () => {
    const events: LifeEvent[] = [{ kind: 'marriage', date: '2016-02' }, { kind: 'childbirth', date: '2018-11-03' }];
    const d = diffCandidates(engine, jdOf('06:00'), jdOf('06:20'), DELHI, { events });
    expect(d.minutes).toBe(20);
    const lagnaDeg = d.rows.find((r) => r.label === 'Lagna degree')!;
    expect(lagnaDeg.changed).toBe(true);
    // the planets do not change sign in twenty minutes, so D1 houses move only if the lagna does
    const lagna = d.rows.find((r) => r.label === 'Lagna')!;
    const houses = d.rows.filter((r) => r.group === 'Houses');
    expect(houses).toHaveLength(9);
    if (!lagna.changed) expect(houses.every((h) => h.a.split(' · ')[0] === h.b.split(' · ')[0])).toBe(true);
    const next = d.rows.find((r) => r.label === 'Next mahadasha begins')!;
    expect(next.changed).toBe(true); // the Moon moves ~0.17° in 20 min, a shift of days to weeks
    const ev = d.rows.filter((r) => r.group === 'Life events');
    expect(ev).toHaveLength(2);
    expect(ev.every((r) => typeof r.scoreA === 'number' && typeof r.scoreB === 'number')).toBe(true);
    expect(d.summary).toMatch(/20 minutes later/);
    expect(d.changes).toBe(d.rows.filter((r) => r.changed).length);
  });

  it('finds no change between a time and itself', () => {
    const d = diffCandidates(engine, jdOf('06:00'), jdOf('06:00'), DELHI);
    expect(d.changes).toBe(0);
  });
});
