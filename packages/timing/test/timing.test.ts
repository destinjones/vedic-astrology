import { describe, it, expect } from 'vitest';
import {
  createAstronomyEphemeris, ascendantSidereal, lahiriAyanamsa, computeVimshottari, flattenDashas, activeDashas, computeAshtakavarga, BAV_TOTALS, SEVEN, findStations, findIngresses, saturnPhases, findRetrogrades, buildTimeline, transitSnapshot, type NatalChart, signOf, dignity, functionalNature } from '../src';

const eph = createAstronomyEphemeris();
const chartAt = (birth: Date, lat: number, lon: number): NatalChart => ({ birth, ascendant: ascendantSidereal(birth, lat, lon), planets: eph.positions(birth) });
const chart = chartAt(new Date(Date.UTC(1990, 0, 1, 17, 0)), 40.7128, -74.006);
const near = (d: Date, iso: string, hours: number) => expect(Math.abs(d.getTime() - Date.parse(iso)) / 3.6e6).toBeLessThan(hours);

describe('ephemeris fallback', () => {
  it('Lahiri ayanamsa ~24.19 deg in 2024', () => {
    expect(lahiriAyanamsa(new Date(Date.UTC(2024, 0, 1)))).toBeCloseTo(24.19, 1);
  });
  it('finds the April 2024 Mercury stations', () => {
    const st = findStations(eph, 'Mercury', new Date('2024-03-01'), new Date('2024-05-15'));
    expect(st.map((s) => s.type)).toEqual(['retrograde', 'direct']);
    near(st[0].date, '2024-04-01T22:14Z', 3);
    near(st[1].date, '2024-04-25T12:54Z', 3);
  });
  it('sidereal Saturn enters Pisces 2025-03-29 and Jupiter enters Gemini 2025-05-14', () => {
    const s = findIngresses(eph, 'Saturn', new Date('2025-01-01'), new Date('2025-06-01'));
    expect(s[0].toSign).toBe(11); near(s[0].date, '2025-03-29T12:00Z', 30);
    const j = findIngresses(eph, 'Jupiter', new Date('2025-04-01'), new Date('2025-06-01'));
    expect(j[0].toSign).toBe(2); near(j[0].date, '2025-05-14T12:00Z', 30);
  });
});

describe('dasha', () => {
  const tree = computeVimshottari(chart, { depth: 3 });
  it('spans 120 years with contiguous periods', () => {
    const years = (tree[8].end.getTime() - tree[0].start.getTime()) / (365.2425 * 864e5);
    expect(years).toBeCloseTo(120, 6);
    const pr = flattenDashas(tree, 3);
    expect(pr.length).toBe(729);
    for (let i = 1; i < pr.length; i++) expect(Math.abs(pr[i].start.getTime() - pr[i - 1].end.getTime())).toBeLessThan(2);
  });
  it('birth falls inside the first mahadasha', () => {
    const chain = activeDashas(tree, chart.birth);
    expect(chain.length).toBe(3);
    expect(chain[0].lord).toBe(tree[0].lord);
  });
  it('scores are bounded with reasons', () => {
    for (const p of flattenDashas(tree, 2)) {
      expect(p.score).toBeGreaterThanOrEqual(-100); expect(p.score).toBeLessThanOrEqual(100);
      expect(p.reasons.length).toBeGreaterThan(0);
    }
  });
});

describe('classical tables', () => {
  it('BAV totals are classical and SAV = 337', () => {
    const av = computeAshtakavarga(chart);
    for (const p of SEVEN) expect(av.bav[p].reduce((a, b) => a + b, 0)).toBe(BAV_TOTALS[p]);
    expect(av.sav.reduce((a, b) => a + b, 0)).toBe(337);
  });
  it('dignities and yogakaraka', () => {
    expect(dignity('Sun', 10)).toBe('exalted');
    expect(dignity('Saturn', 10)).toBe('debilitated');
    expect(dignity('Jupiter', 245)).toBe('moolatrikona');
    expect(functionalNature('Saturn', 1).note).toContain('yogakaraka'); // Taurus lagna
    expect(functionalNature('Mars', 3).note).toContain('yogakaraka');   // Cancer lagna
  });
});

describe('Saturn phases', () => {
  it('Aquarius Moon: Sade Sati 2020-01 to 2028-02', () => {
    const c = { ...chart, planets: { ...chart.planets, Moon: { longitude: 305, speed: 13 } } };
    const { sadeSati } = saturnPhases(eph, c, new Date('2015-01-01'), new Date('2030-01-01'));
    expect(sadeSati.length).toBe(1);
    near(sadeSati[0].start, '2020-01-24T12:00Z', 24 * 5);
    near(sadeSati[0].end, '2028-02-23T12:00Z', 24 * 10); // includes the Oct 2027 retrograde re-entry into Pisces
    expect(sadeSati[0].phases.some((p) => p.reentry)).toBe(true);
  });
});

describe('retrogrades and timeline', () => {
  it('finds Mercury retrogrades with shadows in 2024', () => {
    const r = findRetrogrades(eph, chart, new Date('2024-01-01'), new Date('2024-12-31'), ['Mercury']);
    expect(r.length).toBe(4); // Dec 2023 loop overlaps the range, then Apr, Aug, Nov 2024
    for (const p of r) { expect(p.preShadowStart! < p.stationRetrograde).toBe(true); expect(p.postShadowEnd! > p.stationDirect!).toBe(true); }
  });
  it('builds a full timeline', () => {
    const t = buildTimeline(eph, chart, { from: new Date('2025-01-01'), to: new Date('2027-01-01') });
    expect(t.series.length).toBeGreaterThan(100);
    expect(t.retrogrades.length).toBeGreaterThan(5);
    expect(t.now.planets.length).toBe(9);
    const snap = transitSnapshot(chart, eph.positions(new Date('2026-01-01')), new Date('2026-01-01'));
    expect(snap.planets.find((p) => p.planet === 'Saturn')!.sign).toBe(signOf(eph.positions(new Date('2026-01-01')).Saturn.longitude));
  });
});
