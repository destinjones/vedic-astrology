import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type Chart, type Engine } from '@vedic/engine';
import { engineEphemeris, natalFromChart, scoredDashasFromChart, timelineForChart } from '../src/adapters/engine';
import { createAstronomyEphemeris, findStations, activeDashas } from '../src';

let engine: Engine;
let chart: Chart;
beforeAll(async () => {
  engine = await createEngine();
  chart = engine.computeChart({ date: '1990-01-01', time: '12:00', place: { name: 'New York', latitude: 40.7128, longitude: -74.006 } });
});

describe('engine adapter', () => {
  it('engine and fallback ephemeris agree closely', () => {
    const d = new Date('2026-03-01T00:00:00Z');
    const a = engineEphemeris(engine).positions(d), b = createAstronomyEphemeris().positions(d);
    for (const p of ['Sun', 'Moon', 'Mars', 'Jupiter', 'Saturn'] as const) {
      const diff = Math.abs(((a[p].longitude - b[p].longitude + 540) % 360) - 180);
      expect(diff).toBeLessThan(0.05);
    }
  });
  it('stations from the engine match the published Mercury retrograde of April 2024', () => {
    const st = findStations(engineEphemeris(engine), 'Mercury', new Date('2024-03-01'), new Date('2024-05-15'));
    expect(Math.abs(st[0].date.getTime() - Date.parse('2024-04-01T22:14Z')) / 6e4).toBeLessThan(20);
  });
  it('scores the engine dasha tree with identical boundaries', () => {
    const scored = scoredDashasFromChart(chart);
    expect(scored[0].start.toISOString()).toBe(new Date(chart.dasha.periods[0].start).toISOString());
    const chain = activeDashas(scored, natalFromChart(chart).birth);
    expect(chain[0].lord.toLowerCase()).toBe(chart.dasha.startLord);
  });
  it('builds a timeline end to end', () => {
    const t = timelineForChart(engine, chart, { from: new Date('2026-01-01'), to: new Date('2027-06-01') });
    expect(t.series.length).toBeGreaterThan(50);
    expect(t.retrogrades.some((r) => r.planet === 'Mercury')).toBe(true);
  });
});

describe('transit search on the engine', () => {
  it('answers a long Saturn question quickly', async () => {
    const { answerTransitQuestion } = await import('../src');
    const eph = engineEphemeris(engine, { ayanamsa: chart.meta.ayanamsa, nodeType: chart.meta.nodeType });
    const t0 = performance.now();
    const a = answerTransitQuestion(eph, natalFromChart(chart), 'When does Saturn aspect my Moon?', { from: new Date('2026-01-01') });
    const ms = performance.now() - t0;
    expect(a.ok && a.result.hits.length).toBeGreaterThan(3);
    expect(ms).toBeLessThan(3000);
    const moon = answerTransitQuestion(eph, natalFromChart(chart), 'Moon over my Sun', { from: new Date('2026-01-01') });
    expect(moon.ok && moon.result.hits.length).toBe(12);
  });
});
