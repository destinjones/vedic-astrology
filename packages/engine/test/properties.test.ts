/**
 * Property-based tests: invariants that must hold for every chart, checked on
 * random births. fast-check shrinks any failure to a minimal case and prints a
 * seed; re-run with that seed to reproduce.
 */
import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  GRAHAS,
  VARGA_IDS,
  createEngine,
  decodeChartRequest,
  encodeChartRequest,
  houseFrom,
  nakshatraOf,
  normDegree,
  roundDegree,
  sameDegree,
  vargaSign,
  vimshottari,
  type ChartRequest,
  type Engine,
} from '../src/index';

let engine: Engine;
beforeAll(async () => {
  engine = await createEngine();
});

const RUNS = Number(process.env.FC_RUNS ?? 60);

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
/** Births across the bundled Swiss Ephemeris range, anywhere on Earth. */
const birth = fc.record({
  year: fc.integer({ min: 1801, max: 2399 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }),
  hour: fc.integer({ min: 0, max: 23 }),
  minute: fc.integer({ min: 0, max: 59 }),
  latitude: fc.double({ min: -89.9, max: 89.9, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
});
const polar = birth.map((b) => ({ ...b, latitude: (b.latitude >= 0 ? 1 : -1) * (66.6 + (Math.abs(b.latitude) % 23.3)) }));
const anyLon = fc.double({ min: -1e4, max: 1e4, noNaN: true });

type Birth = { year: number; month: number; day: number; hour: number; minute: number; latitude: number; longitude: number };
const compute = (b: Birth) =>
  engine.computeChart(
    {
      date: `${b.year}-${pad(b.month)}-${pad(b.day)}`,
      time: `${pad(b.hour)}:${pad(b.minute)}`,
      place: { latitude: b.latitude, longitude: b.longitude, timezone: 'UTC' },
    },
    { dashaLevels: 2, strength: false },
  );

const inCircle = (x: number) => Number.isFinite(x) && x >= 0 && x < 360;

describe('every chart', () => {
  it('has finite angles in [0, 360) and whole-sign houses that are a bijection onto the signs', () => {
    fc.assert(
      fc.property(birth, (b) => {
        const c = compute(b);
        expect(inCircle(c.ascendant.longitude)).toBe(true);
        for (const id of GRAHAS) expect(inCircle(c.planets[id].longitude), id).toBe(true);
        const signs = c.houses.map((h) => h.sign);
        expect(new Set(signs).size).toBe(12);
        expect(c.houses.map((h) => h.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        expect(c.houses[0].sign).toBe(c.ascendant.sign);
        for (const id of GRAHAS) expect(c.planets[id].house).toBe(houseFrom(c.ascendant.sign, c.planets[id].sign));
        // Rahu and Ketu are always opposite
        expect(sameDegree(normDegree(c.planets.rahu.longitude + 180), c.planets.ketu.longitude)).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });

  it('has no NaN at polar latitudes', () => {
    fc.assert(
      fc.property(polar, (b) => {
        const c = compute(b);
        expect(inCircle(c.ascendant.longitude)).toBe(true);
        expect(inCircle(c.midheaven.longitude)).toBe(true);
        for (const h of c.houses) expect(inCircle(h.cusp)).toBe(true);
        for (const id of GRAHAS) expect(Number.isFinite(c.planets[id].speed)).toBe(true);
      }),
      { numRuns: Math.ceil(RUNS / 2) },
    );
  });
});

describe('dasha periods', () => {
  it('mahadashas are contiguous and one cycle is exactly 120 years; sub-periods tile their parent', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 359.999999, noNaN: true }), fc.integer({ min: 2378497, max: 2597641 }), (moon, jd) => {
        const d = vimshottari(moon, jd, { levels: 2 });
        const nine = d.periods.slice(0, 9);
        for (let i = 1; i < d.periods.length; i++) expect(d.periods[i].startJd).toBeCloseTo(d.periods[i - 1].endJd, 6);
        expect(nine.reduce((s, p) => s + p.years, 0)).toBeCloseTo(120, 9);
        expect(nine[8].endJd - nine[0].startJd).toBeCloseTo(120 * d.yearDays, 4);
        expect(nine[0].startJd).toBeLessThanOrEqual(jd + 1e-6);
        expect(nine[0].endJd).toBeGreaterThan(jd - 1e-6);
        for (const p of nine) {
          const kids = p.children ?? [];
          expect(kids).toHaveLength(9);
          expect(kids[0].startJd).toBeCloseTo(p.startJd, 6);
          expect(kids[8].endJd).toBeCloseTo(p.endJd, 6);
          expect(kids.reduce((s, k) => s + k.years, 0)).toBeCloseTo(p.years, 9);
        }
      }),
      { numRuns: RUNS * 3 },
    );
  });
});

describe('zodiac helpers', () => {
  it('every longitude maps to a valid sign in every varga, and a nakshatra and pada', () => {
    fc.assert(
      fc.property(anyLon, (lon) => {
        for (const v of VARGA_IDS) {
          const s = vargaSign(lon, v);
          expect(Number.isInteger(s) && s >= 1 && s <= 12, `${v} ${lon}`).toBe(true);
        }
        const n = nakshatraOf(lon);
        expect(n.info.number >= 1 && n.info.number <= 27).toBe(true);
        expect(n.pada >= 1 && n.pada <= 4).toBe(true);
        expect(n.fraction >= 0 && n.fraction < 1).toBe(true);
      }),
      { numRuns: RUNS * 10 },
    );
  });

  it('D1 is the identity', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 359.9999, noNaN: true }), (lon) => {
        expect(vargaSign(lon, 'D1')).toBe(Math.floor(lon / 30) + 1);
      }),
      { numRuns: RUNS * 5 },
    );
  });

  it('roundDegree and sameDegree agree', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 360, noNaN: true }), (x) => {
        expect(sameDegree(roundDegree(x), x)).toBe(true);
        expect(sameDegree(normDegree(x + 360), x)).toBe(true);
      }),
      { numRuns: RUNS * 10 },
    );
  });
});

describe('ChartRequest codec', () => {
  const zones = ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London', 'Australia/Adelaide', 'Asia/Kathmandu'];
  const req: fc.Arbitrary<ChartRequest> = fc.record(
    {
      v: fc.constant(1 as const),
      name: fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim() === s && s.length > 0),
      date: fc.tuple(fc.integer({ min: 1, max: 9999 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 })).map(([y, m, d]) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`),
      time: fc.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 })).map(([h, m]) => `${pad(h)}:${pad(m)}`),
      place: fc.record(
        {
          name: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim() === s && s.length > 0),
          latitude: fc.integer({ min: -9_000_000, max: 9_000_000 }).map((x) => x / 1e5 || 0),
          longitude: fc.integer({ min: -18_000_000, max: 18_000_000 }).map((x) => x / 1e5 || 0),
          timezone: fc.constantFrom(...zones),
        },
        { requiredKeys: ['latitude', 'longitude', 'timezone'] },
      ),
      utcOffsetMinutes: fc.integer({ min: -720, max: 840 }),
      ayanamsa: fc.constantFrom('lahiri', 'raman', 'krishnamurti', 'true_chitra', 'fagan_bradley'),
    },
    { requiredKeys: ['v', 'date', 'time', 'place', 'ayanamsa'] },
  );

  it('decode(encode(x)) === x for every request', () => {
    fc.assert(
      fc.property(req, (r) => {
        const d = decodeChartRequest(encodeChartRequest(r));
        expect(d.ok && d.request).toEqual(r);
      }),
      { numRuns: RUNS * 10 },
    );
  });
});
