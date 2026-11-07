import { beforeAll, describe, expect, it } from 'vitest';
import { castPrashna, createEngine, dashaAt, prashnaTiming, vimshottari, PRASHNA_TOPICS, type Engine } from '../src/index';

let engine: Engine;
beforeAll(async () => {
  engine = await createEngine();
});
const place = { latitude: 13.0827, longitude: 80.2707, timezone: 'Asia/Kolkata' };

describe('prashna timing', () => {
  it('starts the dasha of the question from the Moon at the moment of asking', () => {
    const r = castPrashna(engine, { ...place, when: '2026-11-07T05:30:00Z', topic: 'career' });
    const t = prashnaTiming(r);
    const d = vimshottari(r.chart.planets.moon.longitude, r.chart.jdUt, { levels: 3 });
    expect(t.running).toEqual(dashaAt(d, r.chart.jdUt).map((p) => p.lord));
    expect(t.horizonDays).toBe(730);
  });

  it('only returns periods whose bhukti and antara lords both fulfil the question', () => {
    let found = 0;
    for (const topic of PRASHNA_TOPICS.map((x) => x.id)) {
      for (const when of ['2026-01-10T03:00:00Z', '2026-06-21T12:00:00Z', '2026-11-07T05:30:00Z']) {
        const r = castPrashna(engine, { ...place, when, topic });
        const t = prashnaTiming(r);
        for (const w of t.windows) {
          for (const g of w.path.slice(1)) {
            expect(t.lords[g].fulfils).toBe(true);
            expect(t.lords[g].favourable.length).toBeGreaterThan(0);
          }
          expect(Date.parse(w.end)).toBeGreaterThan(Date.parse(w.start));
          expect(Date.parse(w.start)).toBeGreaterThanOrEqual(Date.parse(r.chart.utc) - 1000);
          expect(Date.parse(w.start) - Date.parse(r.chart.utc)).toBeLessThan(t.horizonDays * 864e5);
        }
        for (let i = 1; i < t.windows.length; i++) expect(Date.parse(t.windows[i].start)).toBeGreaterThanOrEqual(Date.parse(t.windows[i - 1].end) - 1000);
        if (t.first) {
          found++;
          expect(t.summary).toContain(t.first.start.slice(0, 10));
          for (const s of t.first.sookshma ?? []) {
            expect(t.lords[s.lord].fulfils).toBe(true);
            expect(Date.parse(s.start)).toBeGreaterThanOrEqual(Date.parse(t.first.start) - 1000);
            expect(Date.parse(s.start)).toBeLessThan(Date.parse(t.first.end));
          }
        } else {
          expect(t.summary).toMatch(/no clear time/);
        }
      }
    }
    expect(found).toBeGreaterThan(10);
  });

  it('looks months ahead for a lost item', () => {
    const r = castPrashna(engine, { ...place, when: '2026-11-07T05:30:00Z', topic: 'lost_item' });
    expect(prashnaTiming(r).horizonDays).toBe(120);
  });
});
