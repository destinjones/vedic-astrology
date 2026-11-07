import { beforeAll, describe, expect, it } from 'vitest';
import {
  SHADBALA_PLANETS,
  computeStrength,
  createEngine,
  dateToJd,
  drishtiValue,
  norm360,
  signOf,
  type Chart,
  type ShadbalaPlanet,
  type StrengthInput,
} from '../src/index';

const dms = (d: number, m: number, s = 0) => d + m / 60 + s / 3600;
const OBL = (23.4393 * Math.PI) / 180;
const kranti = (trop: number) => (Math.asin(Math.sin(OBL) * Math.sin((trop * Math.PI) / 180)) * 180) / Math.PI;

/**
 * B. V. Raman, "Graha and Bhava Balas", standard horoscope: female, 16 Oct 1918,
 * 2h 6m 16s p.m. LMT, 13° N, 77° 35' E, sunrise 20-32 ghatis before birth.
 * Raman's own longitudes are fed in, so the test checks the rules, not the ephemeris.
 */
function ramanInput(): StrengthInput {
  const ayanamsa = dms(21, 16);
  const lon: Record<ShadbalaPlanet, number> = {
    sun: dms(180, 53, 55),
    moon: dms(311, 17, 19),
    mars: dms(229, 30, 34),
    mercury: dms(181, 31, 34),
    jupiter: dms(84, 0, 49),
    venus: dms(171, 9, 56),
    saturn: dms(124, 22, 41),
  };
  const asc = dms(298, 27);
  const mc = dms(216, 30);
  // Sripati bhava madhyas from the lagna and the 10th
  const q1 = norm360(asc - mc) / 3;
  const q2 = (180 - norm360(asc - mc)) / 3;
  const m: number[] = [];
  m[0] = asc;
  m[9] = mc;
  m[10] = mc + q1;
  m[11] = mc + 2 * q1;
  m[1] = asc + q2;
  m[2] = asc + 2 * q2;
  for (let i = 0; i < 6; i++) if (m[i + 6] === undefined) m[i + 6] = m[i] + 180;
  for (let i = 0; i < 6; i++) if (m[i] === undefined) m[i] = m[i + 6] + 180;
  const madhya = m.map(norm360);
  // Birth 08:55:56 UT; sunrise 20.533 ghatis (8h 12m 48s) earlier; day about 11h 56m
  const jdUt = dateToJd(new Date(Date.UTC(1918, 9, 16, 8, 55, 56)));
  const sunrise = jdUt - (20 + 32 / 60) / 60;
  const sunset = sunrise + 11.93 / 24;
  const planets = {} as StrengthInput['planets'];
  for (const g of SHADBALA_PLANETS) {
    const trop = norm360(lon[g] + ayanamsa);
    planets[g] = { longitude: lon[g], latitude: 0, tropicalLongitude: trop, declination: kranti(trop) };
  }
  return {
    planets,
    nodeSigns: [],
    ascendant: asc,
    midheaven: mc,
    bhavaMadhya: madhya,
    houseSigns: madhya.map((x) => signOf(x)),
    jdUt,
    sunrise,
    sunset,
    nextSunrise: sunrise + 1,
    apparentSolarHours: 14 + 6 / 60 + 16 / 3600 + 14.3 / 60, // LMT + equation of time
    vedicDayNumber: 2421883, // 16 Oct 1918
  };
}

describe('Shadbala against Raman’s worked example', () => {
  const s = computeStrength(ramanInput()).shadbala;
  const P = s.planets;

  it('gets the lords of year, month, weekday and hour', () => {
    expect(s.context.varaLord).toBe('mercury'); // Wednesday
    expect(s.context.horaLord).toBe('moon');
    expect(s.context.masaLord).toBe('mercury');
    expect(s.context.abdaLord).toBe('saturn');
    expect(s.context.dayBirth).toBe(true);
  });

  it('matches the Sthana Bala sub-components', () => {
    const book: Record<ShadbalaPlanet, [number, number, number, number]> = {
      // uchcha, ojayugma, kendradi, drekkana
      sun: [3.0, 30, 60, 15],
      moon: [32.75, 15, 30, 0],
      mars: [37.06, 15, 30, 0],
      mercury: [54.5, 30, 60, 0],
      jupiter: [56.33, 15, 15, 0],
      venus: [1.95, 30, 15, 15],
      saturn: [34.8, 15, 30, 0],
    };
    for (const g of SHADBALA_PLANETS) {
      const [u, o, k, d] = book[g];
      expect(P[g].sthana.uchcha, g).toBeCloseTo(u, 0);
      expect(P[g].sthana.ojayugma, g).toBe(o);
      expect(P[g].sthana.kendradi, g).toBe(k);
      expect(P[g].sthana.drekkana, g).toBe(d);
    }
  });

  it('matches Dig Bala', () => {
    const book = { sun: 48.1, moon: 31.56, mars: 55.7, mercury: 21.09, jupiter: 11.5, venus: 15.15, saturn: 58.02 };
    for (const g of SHADBALA_PLANETS) expect(Math.abs(P[g].dig - book[g]), g).toBeLessThan(0.5);
  });

  it('matches the Kala Bala parts', () => {
    const book: Record<ShadbalaPlanet, { nat: number; paksha: number; ayana: number }> = {
      sun: { nat: 48.32, paksha: 16.54, ayana: 38.12 },
      moon: { nat: 11.68, paksha: 86.92, ayana: 43.44 },
      mars: { nat: 11.68, paksha: 16.54, ayana: 1.84 },
      mercury: { nat: 60, paksha: 16.54, ayana: 41.25 },
      jupiter: { nat: 48.32, paksha: 43.46, ayana: 59.4 },
      venus: { nat: 48.32, paksha: 43.46, ayana: 23.75 },
      saturn: { nat: 11.68, paksha: 16.54, ayana: 13.75 },
    };
    for (const g of SHADBALA_PLANETS) {
      expect(Math.abs(P[g].kala.natonnata - book[g].nat), g).toBeLessThan(0.6);
      expect(Math.abs(P[g].kala.paksha - book[g].paksha), g).toBeLessThan(0.3);
      // Raman's kranti tables round to a few arc-minutes
      expect(Math.abs(P[g].kala.ayana - book[g].ayana), g).toBeLessThan(2);
    }
    expect(P.jupiter.kala.tribhaga).toBe(60);
    expect(P.saturn.kala.tribhaga).toBe(60);
    expect(P.saturn.kala.abda).toBe(15);
    expect(P.mercury.kala.masa).toBe(30);
    expect(P.mercury.kala.vara).toBe(45);
    expect(P.moon.kala.hora).toBe(60);
  });

  it('matches Drik Bala to within a virupa or two', () => {
    const book = { sun: 15.86, moon: -21.73, mars: 0.95, mercury: 15.64, jupiter: -16.03, venus: 18.47 };
    for (const [g, v] of Object.entries(book)) expect(Math.abs(P[g as ShadbalaPlanet].drik - v), g).toBeLessThan(2);
  });

  it('lands near the book totals (Raman used his own mean-motion cheshta)', () => {
    const rupas = { sun: 7.08, moon: 6.5, mars: 4.97, mercury: 8.85, jupiter: 7.23, venus: 6.27, saturn: 6.49 };
    for (const g of SHADBALA_PLANETS) expect(Math.abs(P[g].rupas - rupas[g]), g).toBeLessThan(0.6);
  });
});

describe('Bhava Bala against Raman’s worked example', () => {
  const b = computeStrength(ramanInput()).bhavaBala;
  it('matches the book’s house totals', () => {
    const book = [7.89, 8.51, 6.11, 6.74, 9.49, 7.21, 7.0, 9.67, 7.35, 6.21, 8.44, 7.09];
    // The 12th is left out: our trisected Sripati madhya for it sits on the
    // Sagittarius/Capricorn line, and the book's exact cusp is not printed.
    for (let i = 0; i < 11; i++) expect(Math.abs(b[i].rupas - book[i]), `house ${i + 1}`).toBeLessThan(0.3);
  });
  it('uses the lord’s Shadbala and the sign class', () => {
    expect(b[0].lord).toBe('saturn');
    expect(b[0].signType).toBe('jalachara'); // second half of Capricorn
    expect(b[9].signType).toBe('keeta'); // Scorpio
  });
});

describe('drishti values', () => {
  it('follows the BPHS curve with special aspects', () => {
    expect(drishtiValue('sun', 180)).toBe(60);
    expect(drishtiValue('sun', 90)).toBe(45);
    expect(drishtiValue('mars', 90)).toBe(60);
    expect(drishtiValue('mars', 210)).toBe(60);
    expect(drishtiValue('jupiter', 120)).toBe(60);
    expect(drishtiValue('jupiter', 240)).toBe(60);
    expect(drishtiValue('saturn', 60)).toBe(60);
    expect(drishtiValue('saturn', 270)).toBe(60);
    expect(drishtiValue('venus', 10)).toBe(0);
  });
});

describe('strength in computeChart', () => {
  let chart: Chart;
  beforeAll(async () => {
    const e = await createEngine();
    chart = e.computeChart({ date: '1869-10-02', time: '07:11', place: { latitude: 21.6417, longitude: 69.6293 } });
  });
  it('fills chart.strength for the seven grahas and twelve houses', () => {
    const s = chart.strength!;
    expect(Object.keys(s.shadbala.planets).sort()).toEqual([...SHADBALA_PLANETS].sort());
    expect(s.shadbala.order).toHaveLength(7);
    expect(s.bhavaBala).toHaveLength(12);
    for (const g of SHADBALA_PLANETS) {
      const x = s.shadbala.planets[g];
      expect(x.rupas).toBeGreaterThan(2);
      expect(x.rupas).toBeLessThan(14);
      expect(x.sthana.uchcha).toBeGreaterThanOrEqual(0);
      expect(x.sthana.uchcha).toBeLessThanOrEqual(60);
      expect(x.cheshta).toBeGreaterThanOrEqual(0);
      expect(x.cheshta).toBeLessThanOrEqual(60);
    }
    expect(new Set(s.bhavaBala.map((b) => b.rank)).size).toBe(12);
    // Venus is lord of houses 1 and 8, so both get the same adhipati bala
    expect(s.bhavaBala[0].adhipati).toBe(s.shadbala.planets.venus.total);
  });
  it('can be turned off', async () => {
    const e = await createEngine();
    const c = e.computeChart({ date: '1869-10-02', time: '07:11', place: { latitude: 21.6417, longitude: 69.6293 } }, { strength: false });
    expect(c.strength).toBeUndefined();
  });
});
