import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type Chart, type Engine } from '@vedic/engine';
import { engineEphemeris, natalFromChart } from '../src/adapters/engine';
import { doubleTransit, doubleTransitWindows, signOf } from '../src';

let engine: Engine;
let chart: Chart;
beforeAll(async () => {
  engine = await createEngine();
  chart = engine.computeChart({ date: '1990-08-15', time: '06:30', place: { name: 'New Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' } });
});

describe('double transit windows', () => {
  it('every window is a stretch where the per-date rule holds', () => {
    const natal = natalFromChart(chart);
    const eph = engineEphemeris(engine);
    const from = new Date('2024-01-01T00:00:00Z');
    const to = new Date('2027-01-01T00:00:00Z');
    const ws = doubleTransitWindows(natal, eph, from, to, { rule: 'house-or-lord', mergeGapDays: 0 });
    expect(ws.length).toBeGreaterThan(0);
    for (const w of ws) {
      expect(w.end.getTime()).toBeGreaterThanOrEqual(w.start.getTime());
      const mid = new Date((w.start.getTime() + w.end.getTime()) / 2);
      const p = eph.positions(mid);
      expect(doubleTransit(natal, signOf(p.Jupiter.longitude), signOf(p.Saturn.longitude), w.house).active).toBe(true);
    }
    const houses = new Set(ws.map((w) => w.house));
    expect(houses.size).toBeGreaterThan(1);
  });
  it('the house-only rule is stricter and merges retrograde wobbles', () => {
    const natal = natalFromChart(chart);
    const eph = engineEphemeris(engine);
    const from = new Date('2024-01-01T00:00:00Z');
    const to = new Date('2034-01-01T00:00:00Z');
    const days = (ws: { start: Date; end: Date }[]) => ws.reduce((a, w) => a + (w.end.getTime() - w.start.getTime()), 0);
    const loose = doubleTransitWindows(natal, eph, from, to, { rule: 'house-or-lord', mergeGapDays: 0 });
    const strict = doubleTransitWindows(natal, eph, from, to, { mergeGapDays: 0 });
    expect(days(strict)).toBeLessThan(days(loose));
    const merged = doubleTransitWindows(natal, eph, from, to);
    expect(merged.length).toBeLessThanOrEqual(strict.length);
    for (const w of strict) {
      const p = eph.positions(new Date((w.start.getTime() + w.end.getTime()) / 2));
      const hSign = (signOf(natal.ascendant) + w.house - 1) % 12;
      expect([signOf(p.Jupiter.longitude), ...[5, 7, 9].map((n) => (signOf(p.Jupiter.longitude) + n - 1) % 12)]).toContain(hSign);
    }
  });
});
