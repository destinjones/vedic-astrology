import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, norm360, type Chart, type Engine } from '@vedic/engine';
import {
  MUNTHA_HOUSE,
  MUDDA_TEXT,
  TRI_RASHI_PATI,
  YEAR_LORD_TEXT,
  computeVarshaphal,
  muddaDasha,
  panchaVargiya,
  readVarshaphal,
  sahamLongitude,
  type Varshaphal,
} from '../src/index';

let engine: Engine;
let gandhi: Chart;
let delhi: Chart;
const years: Varshaphal[] = [];

const angDiff = (a: number, b: number) => {
  const d = Math.abs(norm360(a - b));
  return d > 180 ? 360 - d : d;
};

beforeAll(async () => {
  engine = await createEngine();
  // M. K. Gandhi, 2 Oct 1869, 07:11 local mean time, Porbandar
  gandhi = engine.computeChart({ date: '1869-10-02', time: '07:11', place: { latitude: 21.6417, longitude: 69.6293 } });
  // The app's sample chart
  delhi = engine.computeChart({ date: '1990-08-15', time: '06:30', place: { latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' } });
  for (let age = 30; age < 42; age++) years.push(computeVarshaphal(engine, delhi, { age }));
});

describe('solar return', () => {
  it('year 0 is the birth moment itself', () => {
    const v = computeVarshaphal(engine, gandhi, { age: 0 });
    expect(v.returnUtc).toBe(gandhi.meta.utc);
    expect(v.returnLocal.date).toBe('1869-10-02');
    expect(v.returnLocal.time).toBe('07:11:00');
    expect(v.lagna.sign).toBe(gandhi.ascendant.sign);
  });
  it('returns the Sun to its natal sidereal degree to well under a second of time', () => {
    for (const v of years) {
      // The Sun moves about 0.000011° per second; this is a hundredth of that.
      expect(angDiff(v.returnSunLongitude, v.natalSunLongitude)).toBeLessThan(1.2e-7);
      const s = engine.longitudeAt('sun', v.returnJd, { ayanamsa: 'lahiri' });
      expect(angDiff(s.longitude, delhi.planets.sun.longitude)).toBeLessThan(1.2e-7);
    }
  });
  it('spaces returns one sidereal year apart and chains them', () => {
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i].nextReturnJd).toBeCloseTo(years[i + 1].returnJd, 8);
      expect(years[i + 1].returnJd - years[i].returnJd).toBeGreaterThan(365.2);
      expect(years[i + 1].returnJd - years[i].returnJd).toBeLessThan(365.32);
    }
  });
  it('falls near the birthday and in the asked calendar year', () => {
    const v = computeVarshaphal(engine, delhi, { year: 2026 });
    expect(v.age).toBe(36);
    expect(v.year).toBe(2026);
    expect(v.returnLocal.date.slice(5)).toMatch(/^08-1[5-7]$/);
    expect(v.returnLocal.timezone).toBe('Asia/Kolkata');
    expect(v.returnLocal.utcOffsetMinutes).toBe(330);
  });
  it('casts for another place at the same instant', () => {
    const here = computeVarshaphal(engine, delhi, { age: 36 });
    const ny = computeVarshaphal(engine, delhi, { age: 36, place: { latitude: 40.7128, longitude: -74.006 } });
    expect(ny.returnJd).toBe(here.returnJd);
    expect(ny.place.timezone).toBe('America/New_York');
    expect(ny.lagna.sign).not.toBe(here.lagna.sign);
    expect(ny.chart.planets.moon.longitude).toBeCloseTo(here.chart.planets.moon.longitude, 6);
  });
  it('rejects a negative or fractional age', () => {
    expect(() => computeVarshaphal(engine, delhi, { age: -1 })).toThrow();
    expect(() => computeVarshaphal(engine, delhi, { age: 1.5 })).toThrow();
  });
});

describe('Muntha and office-bearers', () => {
  it('moves the Muntha one sign a year from the birth lagna', () => {
    for (const v of years) {
      expect(v.muntha.sign).toBe(((delhi.ascendant.sign - 1 + v.age) % 12) + 1);
      expect(v.muntha.house).toBe(((v.muntha.sign - v.lagna.sign + 12) % 12) + 1);
    }
  });
  it('names five office-bearers and picks the year lord among them', () => {
    for (const v of years) {
      expect(v.officeBearers).toHaveLength(5);
      expect(v.officeBearers[0].planet).toBe('sun'); // Leo rises at this birth
      expect(v.officeBearers.map((b) => b.planet)).toContain(v.yearLord.planet);
      expect(v.yearLord.planet).not.toBe('moon');
      const aspecting = v.officeBearers.filter((b) => b.aspectsLagna && b.planet !== 'moon');
      if (aspecting.length) {
        expect(aspecting.map((b) => b.planet)).toContain(v.yearLord.planet);
        expect(v.yearLord.strength).toBeCloseTo(Math.max(...aspecting.map((b) => b.strength)), 9);
      }
    }
  });
  it('uses the tri-rashi table for day and night charts', () => {
    expect(TRI_RASHI_PATI.day).toHaveLength(12);
    expect(TRI_RASHI_PATI.night).toHaveLength(12);
    for (const v of years) {
      const t = v.officeBearers.find((b) => b.role === 'tri_rashi_pati')!;
      expect(t.planet).toBe(TRI_RASHI_PATI[v.isDayChart ? 'day' : 'night'][v.lagna.sign - 1]);
      const d = v.officeBearers.find((b) => b.role === 'dina_ratri_pati')!;
      const s = v.isDayChart ? v.chart.planets.sun.sign : v.chart.planets.moon.sign;
      expect(d.planet).toBe(['mars', 'venus', 'mercury', 'moon', 'sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'saturn', 'jupiter'][s - 1]);
    }
  });
  it('calls a sunrise birth a day chart', () => {
    // Gandhi was born shortly after sunrise
    expect(computeVarshaphal(engine, gandhi, { age: 0 }).isDayChart).toBe(true);
  });
});

describe('Pancha-vargiya bala', () => {
  it('gives full exaltation points at the exact degree and none at debilitation', () => {
    expect(panchaVargiya('sun', 10).uchcha).toBeCloseTo(20, 9);
    expect(panchaVargiya('sun', 190).uchcha).toBeCloseTo(0, 9);
    expect(panchaVargiya('saturn', 200).uchcha).toBeCloseTo(20, 9);
  });
  it('scores own sign, own hadda, drekkana and navamsa in full', () => {
    // Venus at 2° Libra: own sign, own drekkana and own navamsa; the hadda is Saturn's (0–6), a friend
    const v = panchaVargiya('venus', 180 + 2);
    expect(v.kshetra).toBe(30);
    expect(v.haddaLord).toBe('saturn');
    expect(v.hadda).toBe(7.5);
    expect(v.drekkana).toBe(10);
    expect(v.navamsa).toBe(5);
    expect(panchaVargiya('venus', 180 + 22).hadda).toBe(15);
    expect(v.total).toBeCloseTo(v.raw / 4, 9);
  });
  it('stays on the 0–20 scale', () => {
    for (const v of years) for (const s of Object.values(v.strengths)) {
      expect(s.total).toBeGreaterThanOrEqual(0);
      expect(s.total).toBeLessThanOrEqual(20);
    }
  });
});

describe('Tajika aspects and yogas', () => {
  it('only aspects by 1, 3, 4, 5, 7, 9, 10 and 11 signs, except a coming Ithasala', () => {
    for (const v of years) for (const a of v.aspects) {
      if (a.phase === 'bhavishyat') continue;
      expect([1, 3, 4, 5, 7, 9, 10, 11]).toContain(a.distance);
      expect(a.relation === 'none').toBe(!a.withinOrb);
    }
  });
  it('marks Ithasala as applying and Ishrafa as separating', () => {
    for (const v of years) for (const a of v.aspects) {
      if (a.relation === 'ithasala') expect(a.applying).toBe(true);
      if (a.relation === 'ishrafa') expect(a.applying).toBe(false);
      expect(a.orb).toBeGreaterThanOrEqual(7);
      expect(a.orb).toBeLessThanOrEqual(13.5);
    }
  });
  it('never finds Ikkavala and Induvara together', () => {
    for (const v of years) {
      const ids = v.yogas.map((y) => y.id);
      expect(ids.includes('ikkavala') && ids.includes('induvara')).toBe(false);
    }
  });
  it('judges seven life areas', () => {
    for (const v of years) {
      expect(v.areas.map((a) => a.house)).toEqual([2, 4, 5, 7, 9, 10, 11]);
      for (const a of v.areas) expect(a.why.length).toBeGreaterThan(20);
    }
  });
});

describe('Sahams', () => {
  it('adds a sign when the third point is not between the other two', () => {
    // Moon 100, Sun 40, Lagna 70: Lagna lies between Sun and Moon, no extra sign
    expect(sahamLongitude(100, 40, 70)).toEqual({ longitude: 130, addedSign: false });
    // Lagna 200 is outside 40→100, so 30° is added
    expect(sahamLongitude(100, 40, 200)).toEqual({ longitude: 290, addedSign: true });
    // Wraps around Aries
    expect(sahamLongitude(10, 350, 0).longitude).toBeCloseTo(20, 9);
  });
  it('computes Punya Saham from Moon, Sun and Lagna, reversed at night', () => {
    for (const v of years) {
      const p = v.sahams.find((s) => s.id === 'punya')!;
      const { sun, moon } = v.chart.planets;
      const asc = v.chart.ascendant.longitude;
      const want = v.isDayChart ? sahamLongitude(moon.longitude, sun.longitude, asc) : sahamLongitude(sun.longitude, moon.longitude, asc);
      expect(p.longitude).toBeCloseTo(want.longitude, 9);
      expect(p.formula).toBe(v.isDayChart ? 'Moon − Sun + Lagna' : 'Sun − Moon + Lagna');
    }
  });
  it('lists twenty Sahams with their lords', () => {
    expect(years[0].sahams).toHaveLength(20);
  });
});

describe('Mudda dasha', () => {
  it('starts year 0 with the natal Vimshottari lord and its balance', () => {
    const v = computeVarshaphal(engine, gandhi, { age: 0 });
    expect(v.mudda[0].lord).toBe(gandhi.dasha.startLord);
    const full = ((v.nextReturnJd - v.returnJd) * 17) / 120; // Mercury's share
    expect(v.mudda[0].days).toBeCloseTo(full * (1 - gandhi.dasha.elapsedFraction), 6);
  });
  it('advances one lord each year and tiles the year exactly', () => {
    const order = ['ketu', 'venus', 'sun', 'moon', 'mars', 'rahu', 'jupiter', 'saturn', 'mercury'];
    for (const v of years) {
      const first = order[(order.indexOf(delhi.dasha.startLord) + v.age) % 9];
      expect(v.mudda[0].lord).toBe(first);
      expect(v.mudda[0].startJd).toBeCloseTo(v.returnJd, 9);
      expect(v.mudda[v.mudda.length - 1].endJd).toBeCloseTo(v.nextReturnJd, 9);
      for (let i = 1; i < v.mudda.length; i++) expect(v.mudda[i].startJd).toBeCloseTo(v.mudda[i - 1].endJd, 9);
      const total = v.mudda.reduce((s, p) => s + p.days, 0);
      expect(total).toBeCloseTo(v.nextReturnJd - v.returnJd, 6);
      for (const p of v.mudda) {
        const sub = p.children!.reduce((s, c) => s + c.days, 0);
        expect(sub).toBeCloseTo(p.days, 6);
      }
    }
  });
  it('works without an annual chart', () => {
    const m = muddaDasha(delhi, 0, 0, 360);
    expect(m.reduce((s, p) => s + p.days, 0)).toBeCloseTo(360, 9);
  });
});

describe('readings', () => {
  it('has text for every Muntha house, year lord and Mudda lord', () => {
    for (let h = 1; h <= 12; h++) expect(MUNTHA_HOUSE[h].length).toBeGreaterThan(40);
    for (const t of Object.values(YEAR_LORD_TEXT)) expect(t.strong && t.weak).toBeTruthy();
    expect(Object.keys(MUDDA_TEXT)).toHaveLength(9);
  });
  it('reads every year with a headline, overview and the running Mudda period', () => {
    for (const v of years) {
      const r = readVarshaphal(v, new Date((v.returnJd - 2440587.5 + 100) * 864e5));
      expect(r.headline).toBeTruthy();
      expect(r.overview.length).toBeGreaterThan(0);
      expect(r.yearLord.text.join(' ')).toContain('lord of the year');
      expect(r.currentMudda).toBeDefined();
      expect(v.score).toBeGreaterThanOrEqual(-100);
      expect(v.score).toBeLessThanOrEqual(100);
    }
  });
});
