import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type Engine } from '@vedic/engine';
import { ayanamsaAtJ2000, chartPoints, constellations, eclipseHits, findEclipses, localDateTime, localView, sankrantis, shadowCentreAt, solarPath, stars } from '../src/index';

let engine: Engine;
beforeAll(async () => { engine = await createEngine(); });

describe('eclipses', () => {
  it('finds the eclipses of 2024 with NASA kinds and dates', () => {
    const list = findEclipses(engine, new Date('2024-01-01'), new Date('2025-01-01'));
    const brief = list.map((e) => `${e.peak.slice(0, 10)} ${e.kind} ${e.type}`);
    // NASA: penumbral lunar 25 Mar, total solar 8 Apr, partial lunar 18 Sep, annular solar 2 Oct
    expect(brief).toEqual(['2024-03-25 lunar penumbral', '2024-04-08 solar total', '2024-09-18 lunar partial', '2024-10-02 solar annular']);
    const april = list[1];
    // greatest eclipse near Nazas, Mexico (25.3N, 104.1W) at 18:17 UT
    expect(april.peak.slice(11, 16)).toMatch(/^18:1[6-8]/);
    expect(april.greatest!.latitude).toBeCloseTo(25.3, 0);
    expect(april.greatest!.longitude).toBeCloseTo(-104.1, 0);
    // the Sun was in sidereal Pisces (Revati), near Rahu
    expect(april.sign).toBe(12);
    expect(april.nakshatra).toBe(27);
    expect(april.node).toBe('rahu');
  });
  it('draws the shadow path through the greatest point and across North America', () => {
    const [april] = findEclipses(engine, new Date('2024-04-01'), new Date('2024-04-30')).filter((e) => e.kind === 'solar');
    const at = shadowCentreAt(new Date(april.peak))!;
    expect(Math.abs(at.latitude - april.greatest!.latitude)).toBeLessThan(0.5);
    expect(Math.abs(at.longitude - april.greatest!.longitude)).toBeLessThan(0.5);
    const path = solarPath(april);
    expect(path.length).toBeGreaterThan(50);
    // the path crossed Dallas' latitude west of the Great Lakes and reached Newfoundland
    expect(path.some((p) => Math.abs(p.latitude - 32.8) < 0.5 && Math.abs(p.longitude + 96.8) < 1.5)).toBe(true);
    expect(path.some((p) => p.longitude > -60 && p.latitude > 45)).toBe(true);
  });
  it('tells a place whether it saw the eclipse', () => {
    const [april] = findEclipses(engine, new Date('2024-04-01'), new Date('2024-04-30')).filter((e) => e.kind === 'solar');
    const dallas = localView(april, 32.78, -96.8);
    expect(dallas.visible).toBe(true);
    expect(dallas.type).toBe('total');
    const delhi = localView(april, 28.61, 77.21);
    expect(delhi.visible).toBe(false);
  });
  it('flags an eclipse on a chart axis', () => {
    const chart = engine.computeChart({ date: '1990-08-15', time: '06:30', place: { latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' } });
    const pts = chartPoints(chart);
    const fake = { ...findEclipses(engine, new Date('2024-04-01'), new Date('2024-04-30'))[0], longitude: chart.ascendant.longitude + 1 };
    const hits = eclipseHits(fake, pts);
    expect(hits[0].point.id).toBe('asc');
    expect(hits[0].orb).toBeCloseTo(1, 6);
    const opp = eclipseHits({ ...fake, longitude: chart.planets.moon.longitude + 180.5 }, pts).find((h) => h.point.id === 'moon')!;
    expect(opp.aspect).toBe('opposite');
  });
});

describe('Sankranti ingress', () => {
  it('Mesha Sankranti 2025 falls on 14 April (Lahiri), and the year has twelve in order', () => {
    const list = sankrantis(engine, 2025);
    expect(list).toHaveLength(12);
    const { date, time } = localDateTime(list[0].utc, 'Asia/Kolkata');
    expect(date).toBe('2025-04-14');
    expect(time.slice(0, 2)).toBe('03'); // in the small hours of 14 April, IST
    for (const s of list) { const r = engine.longitudeAt('sun', s.jdUt).longitude % 30; expect(Math.min(r, 30 - r)).toBeLessThan(1e-5); }
    // Makara Sankranti in mid-January of the next year
    expect(list[9].utc.slice(0, 7)).toBe('2026-01');
  });
});

describe('stars', () => {
  it('puts Spica (Chitra) at about 180° in the Lahiri zodiac', () => {
    const ayan = ayanamsaAtJ2000(engine.ayanamsaAt(2460000.5, 'lahiri'), 2460000.5);
    const spica = stars(ayan).find((s) => s.name === 'Spica')!;
    expect(spica.longitude).toBeGreaterThan(179.8);
    expect(spica.longitude).toBeLessThan(180.2);
    expect(constellations(ayan).length).toBe(89);
  });
});
