import { beforeAll, describe, expect, it } from 'vitest';
import {
  KP_SUBS,
  castPrashna,
  computeKpChart,
  createEngine,
  findMuhurtas,
  kpLords,
  type Engine,
} from '../src/index';

let engine: Engine;
beforeAll(async () => {
  engine = await createEngine();
});

const angDiff = (a: number, b: number) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};

describe('KP sub table', () => {
  it('has 249 subs that tile the zodiac', () => {
    expect(KP_SUBS).toHaveLength(249);
    expect(KP_SUBS[0].start).toBe(0);
    for (let i = 1; i < 249; i++) expect(KP_SUBS[i].start).toBeCloseTo(KP_SUBS[i - 1].end, 9);
    expect(KP_SUBS[248].end).toBeCloseTo(360, 9);
    // no sub crosses a sign boundary
    for (const s of KP_SUBS) expect(Math.floor(s.start / 30 + 1e-9)).toBe(Math.floor(s.end / 30 - 1e-9));
  });
  it('matches the published table at its ends', () => {
    // 1: Aries 0°00'–0°46'40", Mars / Ketu / Ketu
    expect(KP_SUBS[0]).toMatchObject({ sign: 'mars', star: 'ketu', sub: 'ketu' });
    expect(KP_SUBS[0].end).toBeCloseTo(46 / 60 + 40 / 3600, 9);
    // 249: Pisces 27°53'20"–30°, Jupiter / Mercury / Saturn
    expect(KP_SUBS[248]).toMatchObject({ sign: 'jupiter', star: 'mercury', sub: 'saturn' });
    expect(KP_SUBS[248].start).toBeCloseTo(330 + 27 + 53 / 60 + 20 / 3600, 9);
    // Krittika's Rahu sub straddles Aries/Taurus and is split into 22 and 23
    expect(KP_SUBS[21]).toMatchObject({ sign: 'mars', star: 'sun', sub: 'rahu' });
    expect(KP_SUBS[21].start).toBeCloseTo(29 + 13 / 60 + 20 / 3600, 9);
    expect(KP_SUBS[22]).toMatchObject({ sign: 'venus', star: 'sun', sub: 'rahu', start: 30 });
  });
  it('gives sign, star, sub and sub-sub lords', () => {
    expect(kpLords(0.03)).toMatchObject({ sign: 'mars', star: 'ketu', sub: 'ketu', subSub: 'ketu', kpNumber: 1 });
    expect(kpLords(0.1).subSub).toBe('venus');
    const l = kpLords(10);
    expect(l.star).toBe('ketu');
    expect(l.sub).toBe(KP_SUBS.find((s) => 10 >= s.start && 10 < s.end)!.sub);
  });
});

describe('KP chart', () => {
  it('uses KP ayanamsa and Placidus cusps', () => {
    const input = { date: '1990-08-15', time: '06:30', place: { latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' } };
    const kp = computeKpChart(engine, input);
    const ref = engine.computeChart(input, { ayanamsa: 'krishnamurti', houseSystem: 'placidus' });
    expect(kp.ayanamsa).toBe('krishnamurti');
    expect(kp.houseSystem).toBe('placidus');
    expect(angDiff(kp.cusps[0].longitude, ref.ascendant.longitude)).toBeLessThan(1e-6);
    expect(angDiff(kp.planets.moon.longitude, ref.planets.moon.longitude)).toBeLessThan(1e-6);
    for (let i = 0; i < 12; i++) expect(angDiff(kp.cusps[i].longitude, ref.houses[i].cusp)).toBeLessThan(1e-6);
    // Placidus cusps are unequal
    expect(angDiff(kp.cusps[1].longitude - kp.cusps[0].longitude, 30)).toBeGreaterThan(0.5);
    // opposite cusps are 180° apart
    expect(angDiff(kp.cusps[0].longitude + 180, kp.cusps[6].longitude)).toBeLessThan(1e-6);
    // every planet's house follows its bhava
    for (const p of Object.values(kp.planets)) expect(p.house).toBeGreaterThanOrEqual(1);
    // significations are consistent
    const sun = kp.significations.sun;
    expect(sun.levelB).toEqual([kp.planets.sun.house]);
    expect(sun.levelA).toEqual([kp.planets[kp.planets.sun.lords.star].house]);
    expect(kp.ruling.planets).toContain(kp.ruling.dayLord);
    // 15 Aug 1990 was a Wednesday, after sunrise
    expect(kp.ruling.dayLord).toBe('mercury');
    const all = kp.houseSignificators.flatMap((h) => h.levelB);
    expect(all.sort()).toEqual(Object.keys(kp.planets).sort());
  });
  it('falls back to Porphyry above the polar circle', () => {
    const kp = computeKpChart(engine, { date: '2000-06-21', time: '12:00', place: { latitude: 78.2, longitude: 15.6 } });
    expect(kp.houseSystem).toBe('porphyry');
    expect(kp.cusps).toHaveLength(12);
  });
});

describe('Prashna', () => {
  const place = { latitude: 13.0827, longitude: 80.2707, timezone: 'Asia/Kolkata' };
  it('casts a time chart with a verdict', () => {
    const r = castPrashna(engine, { ...place, when: '2026-11-07T05:30:00Z', topic: 'career', question: 'Will I get the job?' });
    expect(r.method).toBe('time');
    expect(r.subLord).toBe(r.chart.cusps[9].lords.sub);
    expect(['yes', 'likely_yes', 'mixed', 'likely_no', 'no']).toContain(r.verdict);
    expect(r.factors.length).toBeGreaterThan(4);
    expect(r.summary.length).toBeGreaterThan(20);
  });
  it('sets the ascendant from a KP number', () => {
    for (const n of [1, 100, 249]) {
      const r = castPrashna(engine, { ...place, when: '2026-11-07T05:30:00Z', topic: 'marriage', kpNumber: n });
      expect(r.method).toBe('kp_number');
      expect(r.chart.cusps[0].kpNumber).toBe(n);
      expect(angDiff(r.chart.cusps[0].longitude, KP_SUBS[n - 1].start)).toBeLessThan(1e-4);
      // the cusps come from the moment that degree rises, within a day of the question
      expect(Math.abs(r.cuspJdUt - r.chart.jdUt)).toBeLessThanOrEqual(0.5 + 1e-6);
      const asc = engine.ascendantAt(r.cuspJdUt, place.latitude, place.longitude, 'krishnamurti');
      expect(angDiff(asc, KP_SUBS[n - 1].start)).toBeLessThan(0.01);
    }
  });
  it('rejects bad numbers', () => {
    expect(() => castPrashna(engine, { ...place, topic: 'general', kpNumber: 250 })).toThrow();
  });
});

describe('Muhurta', () => {
  const place = { latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' };
  it('tiles the range and scores windows', () => {
    const t0 = Date.now();
    const r = findMuhurtas(engine, { ...place, activity: 'marriage', start: '2026-11-08T18:30:00Z', end: '2026-11-15T18:30:00Z', natal: { moonNakshatra: 4, moonSign: 2, lagnaSign: 5 } });
    const ms = Date.now() - t0;
    expect(ms).toBeLessThan(15000);
    expect(r.windows[0].start).toBe('2026-11-08T18:30:00.000Z');
    for (let i = 1; i < r.windows.length; i++) expect(r.windows[i].startJd).toBeCloseTo(r.windows[i - 1].endJd, 6);
    expect(r.best.length).toBeGreaterThan(0);
    expect(r.best.every((w) => w.grade !== 'avoid')).toBe(true);
    expect(r.best[0].score).toBeGreaterThanOrEqual(r.best[r.best.length - 1].score);
    expect(r.days.length).toBeGreaterThanOrEqual(7);
    const rahu = r.windows.filter((w) => w.state.period === 'rahu_kalam');
    expect(rahu.length).toBeGreaterThan(0);
    expect(rahu.every((w) => w.grade === 'avoid')).toBe(true);
  });
  it('puts Rahu kalam where panchangas print it', () => {
    // Monday 9 Nov 2026, New Delhi: Rahu kalam is the 2nd eighth of the day, about 08:05–09:25 IST
    const r = findMuhurtas(engine, { ...place, activity: 'general', start: '2026-11-09T00:00:00Z', end: '2026-11-09T12:00:00Z' });
    const rk = r.windows.filter((w) => w.state.period === 'rahu_kalam');
    const s = new Date(rk[0].start).getTime();
    const e = new Date(rk[rk.length - 1].end).getTime();
    const ist = (ms: number) => new Date(ms + 330 * 60000).toISOString().slice(11, 16);
    expect(ist(s) >= '07:55' && ist(s) <= '08:15').toBe(true);
    expect(ist(e) >= '09:15' && ist(e) <= '09:35').toBe(true);
  });
});
