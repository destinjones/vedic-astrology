import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type Chart } from '@vedic/engine';
import {
  CONJUNCTIONS,
  HOUSE_LORD_IN,
  NAKSHATRAS,
  PLANETS,
  PLANET_IN_HOUSE,
  PLANET_IN_SIGN,
  PLANET_IN_NAKSHATRA_TEXT,
  detectDoshas,
  detectYogas,
  fromEngineChart,
  getPlanetInNakshatra,
  interpretChart,
  type ChartInput,
  type PlanetId,
  type SignNumber,
} from '../src';

/** Build a synthetic chart from sign placements (whole sign, mid-sign longitudes). */
function chartOf(asc: number, signs: Partial<Record<PlanetId, number>>, lon: Partial<Record<PlanetId, number>> = {}): ChartInput {
  const planets = {} as ChartInput['planets'];
  const defaults: Record<PlanetId, number> = { sun: 1, moon: 2, mars: 3, mercury: 1, jupiter: 5, venus: 2, saturn: 7, rahu: 9, ketu: 3 };
  for (const p of PLANETS) {
    const s = (signs[p] ?? defaults[p]) as SignNumber;
    const l = lon[p] ?? (s - 1) * 30 + 15;
    planets[p] = { sign: s, house: (((s - asc + 12) % 12) + 1) as never, longitude: l, retrograde: p === 'rahu' || p === 'ketu', nakshatra: Math.floor(l / (360 / 27)) + 1, pada: 1 };
  }
  return { ascendantSign: asc as SignNumber, planets };
}

describe('knowledge base completeness', () => {
  it('has 108 planet-in-sign and 108 planet-in-house entries', () => {
    for (const p of PLANETS) {
      expect(PLANET_IN_SIGN[p]).toHaveLength(12);
      expect(PLANET_IN_HOUSE[p]).toHaveLength(12);
      for (const e of [...PLANET_IN_SIGN[p], ...PLANET_IN_HOUSE[p]]) {
        expect(e[0].length).toBeGreaterThan(10);
        expect(e[1].length).toBeGreaterThan(40);
      }
    }
  });
  it('has 144 house-lord entries and 27 nakshatras', () => {
    expect(HOUSE_LORD_IN).toHaveLength(12);
    for (const row of HOUSE_LORD_IN) expect(row).toHaveLength(12);
    expect(NAKSHATRAS).toHaveLength(27);
    for (const n of NAKSHATRAS) expect(n.padas).toHaveLength(4);
  });
  it('covers all 35 possible conjunction pairs', () => {
    let count = 0;
    for (let i = 0; i < PLANETS.length; i++)
      for (let j = i + 1; j < PLANETS.length; j++) {
        const a = PLANETS[i], b = PLANETS[j];
        if ((a === 'rahu' && b === 'ketu') || (a === 'ketu' && b === 'rahu')) continue;
        expect(CONJUNCTIONS[[a, b].sort().join('+')], `${a}+${b}`).toBeDefined();
        count++;
      }
    expect(count).toBe(35);
    expect(Object.keys(CONJUNCTIONS)).toHaveLength(35);
  });
  it('has a reading for all 243 planet-in-nakshatra cells, written or composed', () => {
    for (const p of PLANETS) for (let n = 1; n <= 27; n++) {
      const r = getPlanetInNakshatra(p, n, 2);
      const written = PLANET_IN_NAKSHATRA_TEXT[p]?.[n];
      // composed: three paragraphs plus the pada; written: the contributor's paragraphs plus the pada
      expect(r.detail.length).toBe(written ? written.detail.length + 1 : 4);
      if (written) expect(r.summary).toBe(written.summary);
    }
  });
  it('uses a hand-written nakshatra reading only in English', () => {
    const written = PLANET_IN_NAKSHATRA_TEXT.moon![4];
    expect(getPlanetInNakshatra('moon', 4).summary).toBe(written.summary);
    expect(getPlanetInNakshatra('moon', 4, undefined, { locale: 'hi' }).summary).not.toBe(written.summary);
  });
});

describe('yoga detection (synthetic charts)', () => {
  const ids = (c: ChartInput) => detectYogas(c).map((y) => y.id);
  it('finds Hamsa for Jupiter exalted in a kendra', () => {
    expect(ids(chartOf(1, { jupiter: 4 }))).toContain('hamsa');
    expect(ids(chartOf(1, { jupiter: 5 }))).not.toContain('hamsa');
  });
  it('finds Gaja Kesari when Jupiter is in a kendra from the Moon', () => {
    expect(ids(chartOf(1, { moon: 2, jupiter: 8 }))).toContain('gaja-kesari');
    expect(ids(chartOf(1, { moon: 2, jupiter: 3 }))).not.toContain('gaja-kesari');
  });
  it('finds the yogakaraka for Taurus ascendant (Saturn)', () => {
    const y = detectYogas(chartOf(2, {})).find((y) => y.id === 'yogakaraka');
    expect(y?.involved).toEqual(['saturn']);
  });
  it('finds Viparita (Harsha) when the 6th lord is in the 8th', () => {
    // Aries asc: 6th = Virgo (Mercury); 8th = Scorpio
    expect(ids(chartOf(1, { mercury: 8, sun: 8 }))).toContain('harsha');
  });
  it('finds a sign exchange', () => {
    // Mars in Taurus, Venus in Aries, Aries asc -> 1st and 2nd lords exchange
    const y = detectYogas(chartOf(1, { mars: 2, venus: 1 })).find((y) => y.category === 'parivartana');
    expect(y?.id).toBe('maha-parivartana');
  });
});

describe('dosha detection (synthetic charts)', () => {
  it('flags Manglik for Mars in the 7th and cancels it in Capricorn', () => {
    const m1 = detectDoshas(chartOf(1, { mars: 7, jupiter: 6 })).find((d) => d.id === 'manglik')!;
    expect(m1.present).toBe(true);
    const m2 = detectDoshas(chartOf(4, { mars: 10, jupiter: 6 })).find((d) => d.id === 'manglik')!;
    expect(m2.severity).toBe('cancelled');
  });
  it('detects Kaal Sarp when all planets are on one side of the nodes', () => {
    const c = chartOf(1, { rahu: 1, ketu: 7, sun: 2, moon: 3, mars: 4, mercury: 2, jupiter: 5, venus: 3, saturn: 6 }, { rahu: 5, ketu: 185 });
    const k = detectDoshas(c).find((d) => d.id === 'kaal-sarp')!;
    expect(k.present).toBe(true);
    expect(k.name).toContain('Anant');
  });
});

describe('real chart from the engine (Gandhi)', () => {
  let chart: Chart;
  beforeAll(async () => {
    const engine = await createEngine();
    chart = engine.computeChart({ date: '1869-10-02', time: '07:11', place: { name: 'Porbandar', latitude: 21.6417, longitude: 69.6293 } });
  });
  it('interprets the full chart', () => {
    const input = fromEngineChart(chart);
    expect(input.ascendantSign).toBe(7);
    const r = interpretChart(input);
    expect(r.placements.length).toBeGreaterThan(27);
    expect(r.houseLords).toHaveLength(12);
    const y = r.yogas.map((x) => x.id);
    // Libra rising with Venus, Mars and Mercury in Libra; Moon + Rahu in Cancer; Jupiter in Aries.
    expect(y).toContain('malavya');
    expect(y).toContain('gaja-kesari');
    expect(y).toContain('yogakaraka');
    expect(r.yogas.find((x) => x.id === 'yogakaraka')?.involved).toEqual(['saturn']);
    const manglik = r.doshas.find((d) => d.id === 'manglik')!;
    expect(manglik.severity).toBe('cancelled');
    expect(manglik.cancellations.join(' ')).toMatch(/Jupiter/);
    expect(r.doshas.find((d) => d.id === 'kaal-sarp')?.severity).toBe('low');
    expect(r.doshas.some((d) => d.id === 'gandanta')).toBe(true);
    expect(r.doshas.some((d) => d.id === 'grahan')).toBe(true);
  });
});
