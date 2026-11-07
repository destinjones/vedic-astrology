import { beforeAll, describe, expect, it } from 'vitest';
import {
  baladiAvastha,
  chartFlags,
  computeAvasthas,
  computeAyurdaya,
  createEngine,
  dashaJunctions,
  gandantaOf,
  inNthDegree,
  isAbhuktaMula,
  jagradadiAvastha,
  panchangaAt,
  pushkaraNavamsa,
  sripatiMadhya,
  type Engine,
} from '../src/index';

let engine: Engine;
beforeAll(async () => {
  engine = await createEngine();
});

const DELHI = { name: 'New Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' };
const sample = () => engine.computeChart({ date: '1990-08-15', time: '06:30', place: DELHI });
const ang = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

describe('bhava chalit', () => {
  it('Sripati sandhis match Swiss Ephemeris house system S', () => {
    const c = engine.computeChart({ date: '1990-08-15', time: '06:30', place: DELHI }, { houseSystem: 'sripati' });
    c.bhavaChalit.sripati.sandhi.forEach((s, i) => expect(ang(s, c.houses[i].cusp)).toBeLessThan(1e-6));
  });
  it('madhyas sit on the ascendant and MC and trisect the quadrants', () => {
    const m = sripatiMadhya(100, 10);
    expect(m[0]).toBeCloseTo(100);
    expect(m[9]).toBeCloseTo(10);
    expect(m[3]).toBeCloseTo(190);
    expect(m[1]).toBeCloseTo(130);
    expect(m[10]).toBeCloseTo(40);
  });
  it('equal chalit puts the sandhis 15° either side of the ascendant steps', () => {
    const c = sample();
    const asc = c.ascendant.longitude;
    expect(ang(c.bhavaChalit.equal.sandhi[0], asc - 15)).toBeLessThan(1e-9);
    for (const [id, p] of Object.entries(c.bhavaChalit.equal.planets)) {
      const expected = Math.floor(((((c.planets[id as 'sun'].longitude - asc + 15) % 360) + 360) % 360) / 30) + 1;
      expect(p!.bhava).toBe(expected);
      expect(p!.shifted).toBe(p!.bhava !== c.planets[id as 'sun'].house);
    }
  });
});

describe('panchanga at any date', () => {
  it('finds the Amavasya of the 8 April 2024 eclipse and when it ends', () => {
    const p = panchangaAt(engine, '2024-04-08T12:00:00Z', DELHI);
    expect(p.tithi).toBe(30);
    expect(p.tithiName).toBe('Amavasya');
    expect(p.varaName).toBe('Somavara');
    // New moon 2024-04-08 18:21 UTC
    expect(Math.abs(Date.parse(p.spans.tithi.end) - Date.parse('2024-04-08T18:21:00Z'))).toBeLessThan(3 * 60000);
    expect(p.next.tithiName).toBe('Pratipada');
  });
  it('finds the Purnima of 23 April 2024', () => {
    const p = panchangaAt(engine, '2024-04-23T12:00:00Z', DELHI);
    expect(p.tithi).toBe(15);
    expect(Math.abs(Date.parse(p.spans.tithi.end) - Date.parse('2024-04-23T23:49:00Z'))).toBeLessThan(3 * 60000);
  });
  it('agrees with the birth chart panchanga and brackets the instant', () => {
    const c = sample();
    const p = panchangaAt(engine, c.meta.jdUt, DELHI);
    expect(p.tithi).toBe(c.panchanga.tithi);
    expect(p.nakshatra).toBe(c.panchanga.nakshatra);
    expect(p.yoga).toBe(c.panchanga.yoga);
    expect(p.karana).toBe(c.panchanga.karana);
    expect(p.vara).toBe(c.panchanga.vara);
    for (const s of Object.values(p.spans)) {
      expect(Date.parse(s.start)).toBeLessThanOrEqual(Date.parse(c.meta.utc));
      expect(Date.parse(s.end)).toBeGreaterThan(Date.parse(c.meta.utc));
    }
  });
  it('a birth before sunrise keeps the previous vara', () => {
    // 2024-04-08 (Monday) 04:00 IST is before sunrise: still Sunday's Vedic day
    const p = panchangaAt(engine, '2024-04-07T22:30:00Z', DELHI);
    expect(p.varaName).toBe('Ravivara');
  });
});

describe('avasthas', () => {
  it('Baladi runs forward in odd signs and backward in even ones', () => {
    expect(baladiAvastha(3)).toBe('bala'); // Aries 3°
    expect(baladiAvastha(15)).toBe('yuva');
    expect(baladiAvastha(29)).toBe('mrita');
    expect(baladiAvastha(33)).toBe('mrita'); // Taurus 3°
    expect(baladiAvastha(59)).toBe('bala');
  });
  it('Jagradadi follows dignity', () => {
    expect(jagradadiAvastha('exalted')).toBe('jagrat');
    expect(jagradadiAvastha('neutral')).toBe('swapna');
    expect(jagradadiAvastha('debilitated')).toBe('sushupti');
  });
  it('gives every graha three states, and a combust one is Kopa', () => {
    const c = sample();
    const a = computeAvasthas(c);
    expect(a).toHaveLength(7);
    for (const x of a) if (c.planets[x.planet].combust) expect(x.deeptadi).toBe('kopa');
  });
});

describe('classical flags', () => {
  it('finds gandanta on either side of the water–fire knots only', () => {
    expect(gandantaOf(359)?.side).toBe('water');
    expect(gandantaOf(1)?.side).toBe('fire');
    expect(gandantaOf(121)?.side).toBe('fire');
    expect(gandantaOf(238)?.side).toBe('water');
    expect(gandantaOf(100)).toBeNull();
    expect(gandantaOf(30)).toBeNull();
  });
  it('Abhukta Mula is the narrow arc around 240°', () => {
    expect(isAbhuktaMula(240.2)).toBe(true);
    expect(isAbhuktaMula(239.7)).toBe(true);
    expect(isAbhuktaMula(241)).toBe(false);
  });
  it('pushkara navamsas and the Nth degree', () => {
    expect(pushkaraNavamsa(21)).toBe(true); // Aries 21°: 7th navamsa
    expect(pushkaraNavamsa(5)).toBe(false);
    expect(pushkaraNavamsa(91)).toBe(true); // Cancer 1°: 1st navamsa
    expect(inNthDegree(20.5, 21)).toBe(true);
    expect(inNthDegree(21.5, 21)).toBe(false);
  });
  it('flags a planetary war with the northern planet winning', () => {
    const c = sample();
    const fake = structuredClone(c);
    fake.planets.mars.longitude = 100.2; fake.planets.mars.latitude = 1;
    fake.planets.venus.longitude = 100.6; fake.planets.venus.latitude = -1;
    const war = chartFlags(fake).find((f) => f.kind === 'graha_yuddha');
    expect(war?.other).toBe('mars');
    expect(war?.point).toBe('venus');
  });
  it('dasha sandhi brackets each mahadasha change, and chidra is the last antardasha', () => {
    const c = sample();
    const j = dashaJunctions(c.dasha.periods);
    expect(j.length).toBe(c.dasha.periods.length - 1);
    for (const x of j) {
      expect(Date.parse(x.sandhiStart)).toBeLessThan(Date.parse(x.at));
      expect(Date.parse(x.sandhiEnd)).toBeGreaterThan(Date.parse(x.at));
      expect(x.chidra.end).toBe(x.at);
    }
  });
});

describe('ayurdaya', () => {
  it('gives three totals in a plausible range with the caveat attached', () => {
    const a = computeAyurdaya(sample());
    expect(a.methods.map((m) => m.method)).toEqual(['pindayu', 'amsayu', 'nisargayu']);
    for (const m of a.methods) {
      expect(m.years).toBeGreaterThan(0);
      expect(m.years).toBeLessThan(200);
    }
    expect(a.range[0]).toBeLessThanOrEqual(a.range[1]);
    expect(a.caveat).toMatch(/not a prediction/);
  });
});
