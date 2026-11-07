import * as Astronomy from 'astronomy-engine';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createEngine,
  dashaAt,
  dashaLevel,
  localToUtc,
  vargaSign,
  vimshottari,
  type Chart,
  type Engine,
} from '../src/index';

let engine: Engine;
let gandhi: Chart;

beforeAll(async () => {
  engine = await createEngine();
  // M. K. Gandhi, 2 Oct 1869, 07:11 local mean time, Porbandar (widely published data)
  gandhi = engine.computeChart({
    date: '1869-10-02',
    time: '07:11',
    place: { name: 'Porbandar, India', latitude: 21.6417, longitude: 69.6293 },
  });
});

const angDiff = (a: number, b: number) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};

describe('reference chart (Gandhi, Lahiri, whole sign)', () => {
  it('uses the birthplace mean time before Indian standard time', () => {
    expect(gandhi.meta.localMeanTime).toBe(true);
    expect(gandhi.meta.utcOffsetMinutes).toBeCloseTo(69.6293 * 4, 3);
  });
  it('has Libra lagna and the classic placements', () => {
    expect(gandhi.ascendant.signSlug).toBe('libra');
    const p = gandhi.planets;
    expect([p.mars.sign, p.mercury.sign, p.venus.sign]).toEqual([7, 7, 7]);
    expect(p.sun.signSlug).toBe('virgo');
    expect(p.sun.house).toBe(12);
    expect(p.moon.signSlug).toBe('cancer');
    expect(p.moon.house).toBe(10);
    expect(p.moon.nakshatraSlug).toBe('ashlesha');
    expect(p.jupiter.signSlug).toBe('aries');
    expect(p.jupiter.retrograde).toBe(true);
    expect(p.saturn.signSlug).toBe('scorpio');
    expect(p.rahu.signSlug).toBe('cancer');
    expect(p.ketu.signSlug).toBe('capricorn');
    expect(p.venus.dignity).toBe('own');
    expect(gandhi.panchanga.varaName).toBe('Shanivara'); // Saturday
  });
  it('builds 12 houses with lords and occupants', () => {
    expect(gandhi.houses).toHaveLength(12);
    expect(gandhi.houses[0].lord).toBe('venus');
    expect(gandhi.houses[0].occupants.sort()).toEqual(['mars', 'mercury', 'venus']);
  });
  it('computes all 20 vargas', () => {
    expect(Object.keys(gandhi.vargas)).toHaveLength(20);
    const d9 = gandhi.vargas.D9!;
    for (const [id, pl] of Object.entries(d9.planets)) {
      expect(pl!.sign).toBe(vargaSign(gandhi.planets[id as 'sun'].longitude, 9));
    }
  });
  it('Vimshottari starts from Mercury (Ashlesha)', () => {
    expect(gandhi.dasha.startLord).toBe('mercury');
    expect(gandhi.dasha.periods[0].lord).toBe('mercury');
  });
});

describe('ephemeris accuracy vs independent astronomy-engine', () => {
  const dates = ['1950-03-15T06:00:00Z', '1987-11-30T22:15:00Z', '2024-04-10T12:00:00Z'];
  for (const iso of dates) {
    it(`tropical positions agree at ${iso}`, () => {
      const jd = engine.positionsAt(iso).jdUt;
      const ay = engine.ayanamsaAt(jd);
      const snap = engine.positionsAt(iso);
      const t = new Date(iso);
      const bodies: [keyof typeof snap.planets, Astronomy.Body, number][] = [
        ['sun', Astronomy.Body.Sun, 0.01],
        ['moon', Astronomy.Body.Moon, 0.02],
        ['mercury', Astronomy.Body.Mercury, 0.02],
        ['venus', Astronomy.Body.Venus, 0.02],
        ['mars', Astronomy.Body.Mars, 0.02],
        ['jupiter', Astronomy.Body.Jupiter, 0.02],
        ['saturn', Astronomy.Body.Saturn, 0.02],
      ];
      for (const [id, body, tol] of bodies) {
        const vec = Astronomy.GeoVector(body, t, true);
        const tropical = Astronomy.Ecliptic(vec).elon; // true ecliptic & equinox of date
        const sidereal = tropical - ay;
        expect(angDiff(snap.planets[id]!.longitude, sidereal), `${id}`).toBeLessThan(tol + 0.01);
      }
    });
  }
  it('Lahiri ayanamsa at J2000 is 23°51\'', () => {
    expect(engine.ayanamsaAt(2451545.0, 'lahiri')).toBeCloseTo(23.857, 2);
  });
  it('Mercury is retrograde on 2024-04-10 and direct on 2024-05-10', () => {
    expect(engine.positionsAt('2024-04-10T12:00:00Z').planets.mercury.retrograde).toBe(true);
    expect(engine.positionsAt('2024-05-10T12:00:00Z').planets.mercury.retrograde).toBe(false);
  });
  it('flags combustion near the Sun', () => {
    // Mercury inferior conjunction 2024-04-11
    const c = engine.computeChart({
      date: '2024-04-11',
      time: '12:00',
      place: { latitude: 28.6139, longitude: 77.209 },
    });
    expect(c.planets.mercury.combust).toBe(true);
    expect(c.planets.jupiter.combust).toBe(false);
  });
});

describe('vargas', () => {
  const L = (sign: number, deg: number) => (sign - 1) * 30 + deg;
  it('D9 navamsa', () => {
    expect(vargaSign(L(1, 0.5), 9)).toBe(1);
    expect(vargaSign(L(1, 3.5), 9)).toBe(2);
    expect(vargaSign(L(2, 0.5), 9)).toBe(10);
    expect(vargaSign(L(3, 0.5), 9)).toBe(7);
    expect(vargaSign(L(4, 29.9), 9)).toBe(12);
  });
  it('D2 hora / D3 drekkana / D30 trimsamsa / D60', () => {
    expect(vargaSign(L(1, 5), 2)).toBe(5);
    expect(vargaSign(L(1, 20), 2)).toBe(4);
    expect(vargaSign(L(2, 5), 2)).toBe(4);
    expect(vargaSign(L(1, 15), 3)).toBe(5);
    expect(vargaSign(L(1, 25), 3)).toBe(9);
    expect(vargaSign(L(1, 7), 30)).toBe(11);
    expect(vargaSign(L(2, 7), 30)).toBe(6);
    expect(vargaSign(L(1, 0.4), 60)).toBe(1);
    expect(vargaSign(L(1, 0.6), 60)).toBe(2);
  });
  it('D10 even signs start from the 9th', () => {
    expect(vargaSign(L(2, 1), 10)).toBe(10);
    expect(vargaSign(L(1, 1), 10)).toBe(1);
  });
});

describe('vimshottari', () => {
  it('Moon at 0° Aries gives a full Ketu dasha', () => {
    const d = vimshottari(0, new Date('2000-01-01T00:00:00Z'), { levels: 2 });
    expect(d.startLord).toBe('ketu');
    expect(d.balanceYears).toBeCloseTo(7, 6);
    const total = d.periods.reduce((s, p) => s + p.years, 0);
    expect(total).toBe(120);
  });
  it('sub-periods tile their parent exactly', () => {
    const d = vimshottari(123.456, new Date('1990-05-05T05:05:00Z'), { levels: 3 });
    for (const maha of d.periods) {
      expect(maha.children![0].startJd).toBe(maha.startJd);
      expect(maha.children![8].endJd).toBe(maha.endJd);
      expect(maha.children![0].lord).toBe(maha.lord);
      const sum = maha.children!.reduce((s, c) => s + c.years, 0);
      expect(sum).toBeCloseTo(maha.years, 9);
    }
    expect(dashaLevel(d, 3)).toHaveLength(9 * 9 * 9);
    const chain = dashaAt(d, '2010-01-01T00:00:00Z');
    expect(chain).toHaveLength(3);
    expect(chain[1].path[0]).toBe(chain[0].lord);
  });
  it('half-elapsed nakshatra gives half balance', () => {
    // middle of Bharani (Venus): 13°20' + 6°40'
    const d = vimshottari(20, 2451545.0);
    expect(d.startLord).toBe('venus');
    expect(d.balanceYears).toBeCloseTo(10, 6);
  });
});

describe('time zones', () => {
  it('applies historical DST (New York, July 1990)', () => {
    const r = localToUtc('1990-07-04', '12:00', 'America/New_York');
    expect(r.utcOffsetMinutes).toBe(-240);
    expect(r.utc.toISOString()).toBe('1990-07-04T16:00:00.000Z');
  });
  it('applies British double summer time (1944)', () => {
    const r = localToUtc('1944-06-06', '12:00', 'Europe/London');
    expect(r.utcOffsetMinutes).toBe(120);
  });
  it('manual offset overrides the rules', () => {
    const r = localToUtc('1990-07-04', '12:00', 'America/New_York', -300);
    expect(r.utc.toISOString()).toBe('1990-07-04T17:00:00.000Z');
  });
  it('looks the zone up from coordinates', () => {
    const c = engine.computeChart({
      date: '2000-01-01',
      time: '12:00',
      place: { latitude: 40.7128, longitude: -74.006 },
    });
    expect(c.meta.timezone).toBe('America/New_York');
    expect(c.meta.utc).toBe('2000-01-01T17:00:00.000Z');
  });
});

describe('options', () => {
  it('supports other ayanamsas, house systems and outer planets', () => {
    const input = { date: '1990-05-05', time: '05:05', place: { latitude: 19.076, longitude: 72.8777 } };
    const kp = engine.computeChart(input, { ayanamsa: 'krishnamurti', houseSystem: 'placidus', includeOuterPlanets: true, nodeType: 'true' });
    const la = engine.computeChart(input);
    expect(Math.abs(kp.meta.ayanamsaValue - la.meta.ayanamsaValue)).toBeLessThan(0.2);
    expect(kp.planets.pluto).toBeDefined();
    expect(kp.houses.every((h) => h.number >= 1)).toBe(true);
    // all planets assigned to exactly one house
    const occ = kp.houses.flatMap((h) => h.occupants);
    expect(new Set(occ).size).toBe(12);
  });
  it('rejects bad input', () => {
    expect(() => engine.computeChart({ date: '1990-13-05', time: '05:05', place: { latitude: 0, longitude: 0 } })).toThrow();
    expect(() => engine.computeChart({ date: '1990-01-05', time: '25:05', place: { latitude: 0, longitude: 0 } })).toThrow();
  });
});
