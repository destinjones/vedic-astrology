import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type Chart, type GrahaId } from '@vedic/engine';
import {
  arudhaOf,
  charaDasha,
  charaDashaAt,
  charaDashaReading,
  charaDashaYears,
  charaKarakas,
  jaimini,
  jaiminiLord,
  rashiAspects,
  type JaiminiInput,
} from '../src';

/** Synthetic chart: sign plus degree-in-sign for each graha. */
function chartOf(asc: number, at: Partial<Record<GrahaId, [number, number]>>): JaiminiInput {
  const defaults: Record<GrahaId, [number, number]> = {
    sun: [1, 10], moon: [2, 11], mars: [3, 12], mercury: [1, 13], jupiter: [5, 14],
    venus: [2, 15], saturn: [7, 16], rahu: [9, 17], ketu: [3, 17],
  };
  const planets = {} as Record<GrahaId, number>;
  for (const g of Object.keys(defaults) as GrahaId[]) {
    const [s, d] = at[g] ?? defaults[g];
    planets[g] = (s - 1) * 30 + d;
  }
  return { ascendantSign: asc as never, planets, birthJd: 2451545 };
}

describe('rashi drishti', () => {
  it('movable signs aspect fixed signs except the next one', () => {
    expect(rashiAspects(1)).toEqual([5, 8, 11]);
    expect(rashiAspects(4)).toEqual([2, 8, 11]);
  });
  it('fixed signs aspect movable signs except the one before', () => {
    expect(rashiAspects(2)).toEqual([4, 7, 10]);
    expect(rashiAspects(5)).toEqual([1, 7, 10]);
  });
  it('dual signs aspect the other dual signs', () => {
    expect(rashiAspects(3)).toEqual([6, 9, 12]);
    expect(rashiAspects(12)).toEqual([3, 6, 9]);
  });
  it('aspects are mutual', () => {
    for (let a = 1; a <= 12; a++) for (const b of rashiAspects(a)) expect(rashiAspects(b)).toContain(a);
  });
});

describe('chara karakas', () => {
  const c = chartOf(1, {
    sun: [1, 29], moon: [2, 5], mars: [3, 20], mercury: [4, 2], jupiter: [5, 25],
    venus: [6, 12], saturn: [7, 8], rahu: [8, 3], // Rahu 3° counts as 27°
  });
  it('ranks by degree in sign, Rahu measured backward (8 scheme)', () => {
    const k = charaKarakas(c, 8);
    expect(k.map((x) => [x.id, x.planet])).toEqual([
      ['AK', 'sun'], ['AmK', 'rahu'], ['BK', 'jupiter'], ['MK', 'mars'],
      ['PiK', 'venus'], ['PK', 'saturn'], ['GK', 'moon'], ['DK', 'mercury'],
    ]);
    expect(k[1].degree).toBeCloseTo(27, 6);
  });
  it('drops Rahu and Pitrikaraka in the 7 scheme', () => {
    const k = charaKarakas(c, 7);
    expect(k.map((x) => [x.id, x.planet])).toEqual([
      ['AK', 'sun'], ['AmK', 'jupiter'], ['BK', 'mars'], ['MK', 'venus'],
      ['PK', 'saturn'], ['GK', 'moon'], ['DK', 'mercury'],
    ]);
  });
});

describe('arudha padas', () => {
  it('counts from house to lord and as far again', () => {
    // Aries lagna, Mars in Leo: 5th, then 5th from Leo = Sagittarius
    expect(arudhaOf(chartOf(1, { mars: [5, 10] }), 1).sign).toBe(9);
  });
  it('moves 10 signs on when the pada lands in the 7th', () => {
    // Mars in Cancer: 4th from Cancer is Libra, the 7th, so Cancer
    const a = arudhaOf(chartOf(1, { mars: [4, 10] }), 1);
    expect(a.sign).toBe(4);
    expect(a.exception).toBe(true);
  });
  it('moves 10 signs on when the lord sits in the house itself', () => {
    expect(arudhaOf(chartOf(1, { mars: [1, 10] }), 1).sign).toBe(10);
  });
});

describe('dual lords', () => {
  it('a lord sitting in the sign gives way to the other', () => {
    expect(jaiminiLord(chartOf(1, { saturn: [11, 5], rahu: [3, 5] }), 11).lord).toBe('rahu');
    expect(jaiminiLord(chartOf(1, { mars: [8, 5], ketu: [4, 5] }), 8).lord).toBe('ketu');
  });
  it('then the one with more company', () => {
    expect(jaiminiLord(chartOf(1, { saturn: [7, 5], rahu: [10, 5], sun: [10, 1], moon: [10, 2] }), 11).lord).toBe('rahu');
  });
});

describe('chara dasha', () => {
  it('counts forward for savya signs and backward for the others', () => {
    // Aries: Mars in Leo, 5 signs forward, 4 years
    expect(charaDashaYears(chartOf(1, { mars: [5, 10] }), 1)).toMatchObject({ count: 5, direction: 'forward', years: 4 });
    // Cancer: Moon in Aries, 4 signs backward, 3 years
    expect(charaDashaYears(chartOf(1, { moon: [1, 10] }), 4)).toMatchObject({ count: 4, direction: 'backward', years: 3 });
  });
  it('gives 12 years for a lord in its own sign and adjusts for exaltation', () => {
    expect(charaDashaYears(chartOf(1, { mars: [1, 10] }), 1).years).toBe(12);
    // Cancer, Moon exalted in Taurus: 3 backward = 2 years, +1
    expect(charaDashaYears(chartOf(1, { moon: [2, 10] }), 4)).toMatchObject({ count: 3, adjustment: 1, years: 3 });
  });
  it('runs forward when the 9th from lagna is savya, backward otherwise', () => {
    const fwd = charaDasha(chartOf(1, {}));
    expect(fwd.direction).toBe('forward');
    expect(fwd.order.slice(0, 3)).toEqual([1, 2, 3]);
    const back = charaDasha(chartOf(2, {}));
    expect(back.direction).toBe('backward');
    expect(back.order.slice(0, 3)).toEqual([2, 1, 12]);
  });
  it('starts at birth, is contiguous, and the second cycle uses 12 minus the first', () => {
    const c = chartOf(1, {});
    const d = charaDasha(c);
    expect(d.periods[0].startJd).toBe(c.birthJd);
    for (let i = 1; i < d.periods.length; i++) expect(d.periods[i].startJd).toBeCloseTo(d.periods[i - 1].endJd, 6);
    const first = d.periods.filter((p) => p.cycle === 1);
    const second = d.periods.filter((p) => p.cycle === 2);
    for (const p of second) expect(p.years).toBe(12 - first.find((f) => f.sign === p.sign)!.years);
    const last = d.periods[d.periods.length - 1];
    expect(last.endJd - c.birthJd).toBeGreaterThanOrEqual(120 * d.yearDays - 1e-6);
  });
  it('splits each sign into 12 equal antardashas ending with the sign itself', () => {
    const md = charaDasha(chartOf(1, {})).periods[0];
    expect(md.children).toHaveLength(12);
    expect(md.children![0].sign).toBe(2);
    expect(md.children![11].sign).toBe(1);
    expect(md.children![11].endJd).toBe(md.endJd);
  });
});

describe('real chart (Gandhi)', () => {
  let chart: Chart;
  beforeAll(async () => {
    const engine = await createEngine();
    chart = engine.computeChart({
      date: '1869-10-02', time: '07:11',
      place: { name: 'Porbandar, India', latitude: 21.6417, longitude: 69.6293 },
    });
  });
  it('Arudha Lagna is Cancer (Venus in Libra lagna)', () => {
    const j = jaimini(chart);
    expect(j.arudhaLagna.sign).toBe(4);
    expect(j.arudhaLagna.house).toBe(10);
  });
  it('produces readings, a chara dasha and a current period', () => {
    const j = jaimini(chart, { karakaScheme: 7 });
    expect(j.karakas).toHaveLength(7);
    expect(j.charaDasha.direction).toBe('forward'); // 9th from Libra is Gemini
    expect(j.charaDasha.periods[0].sign).toBe(7);
    for (const r of Object.values(j.readings)) {
      expect(r.title).toBeTruthy();
      expect(r.detail.length).toBeGreaterThan(0);
    }
    const { mahadasha } = charaDashaAt(j.charaDasha, '1900-01-01T00:00:00Z');
    expect(mahadasha).toBeDefined();
    expect(charaDashaReading(j, mahadasha!).detail.length).toBeGreaterThan(1);
  });
});
