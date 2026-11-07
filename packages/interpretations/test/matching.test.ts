import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type Engine } from '@vedic/engine';
import {
  PLANETS,
  YONI_TABLE,
  compareManglik,
  fromEngineChart,
  matchCharts,
  nadiOf,
  taraOf,
  varnaOf,
  vashyaOf,
  yoniOf,
  type ChartInput,
  type PlanetId,
  type SignNumber,
} from '../src';

const SPAN = 360 / 27;

/** Synthetic chart with the Moon at a given sidereal longitude. */
function chart(moonLon: number, signs: Partial<Record<PlanetId, number>> = {}, asc = 1): ChartInput {
  const defaults: Record<PlanetId, number> = { sun: 5, moon: 1, mars: 3, mercury: 5, jupiter: 9, venus: 6, saturn: 10, rahu: 11, ketu: 5 };
  const planets = {} as ChartInput['planets'];
  for (const p of PLANETS) {
    const lon = p === 'moon' ? moonLon : ((signs[p] ?? defaults[p]) - 1) * 30 + 15;
    const sign = (Math.floor(lon / 30) + 1) as SignNumber;
    const nak = Math.floor(lon / SPAN) + 1;
    const pada = (Math.floor((lon % SPAN) / (SPAN / 4)) + 1) as 1 | 2 | 3 | 4;
    planets[p] = { sign, house: ((((sign - asc) % 12) + 12) % 12 + 1) as SignNumber, longitude: lon, retrograde: false, nakshatra: nak, pada };
  }
  return { ascendantSign: asc as SignNumber, planets };
}
/** Moon in the middle of nakshatra n. */
const nakMid = (n: number) => (n - 1) * SPAN + SPAN / 2;

describe('ashtakoota tables', () => {
  it('yoni table is symmetric with 4 on the diagonal and the seven enemy pairs at 0', () => {
    for (let i = 0; i < 14; i++) {
      expect(YONI_TABLE[i][i]).toBe(4);
      for (let j = 0; j < 14; j++) expect(YONI_TABLE[i][j]).toBe(YONI_TABLE[j][i]);
    }
    expect(YONI_TABLE.flat().filter((x) => x === 0)).toHaveLength(14);
  });
  it('maps nakshatras to yoni and nadi', () => {
    expect(yoniOf(1)).toBe('Horse');
    expect(yoniOf(24)).toBe('Horse');
    expect(yoniOf(23)).toBe('Lion');
    expect([1, 6, 7, 12, 13, 18, 19, 24, 25].map(nadiOf).every((n) => n === 'Adi')).toBe(true);
    expect([2, 5, 8, 11, 14, 17, 20, 23, 26].map(nadiOf).every((n) => n === 'Madhya')).toBe(true);
    expect([3, 4, 9, 10, 15, 16, 21, 22, 27].map(nadiOf).every((n) => n === 'Antya')).toBe(true);
  });
  it('splits Sagittarius and Capricorn for vashya, and varna follows the element', () => {
    expect(vashyaOf(9, 10)).toBe('Manava');
    expect(vashyaOf(9, 20)).toBe('Chatushpada');
    expect(vashyaOf(10, 10)).toBe('Chatushpada');
    expect(vashyaOf(10, 20)).toBe('Jalachara');
    expect([varnaOf(4), varnaOf(1), varnaOf(2), varnaOf(3)]).toEqual(['Brahmin', 'Kshatriya', 'Vaishya', 'Shudra']);
  });
  it('counts taras inclusively', () => {
    expect(taraOf(1, 1)).toBe(1);
    expect(taraOf(1, 3)).toBe(3);
    expect(taraOf(1, 10)).toBe(1);
    expect(taraOf(10, 1)).toBe(1);
    expect(taraOf(27, 2)).toBe(3);
  });
});

describe('matchCharts', () => {
  it('gives every koota its classical maximum and sums to at most 36', () => {
    const r = matchCharts(chart(nakMid(1)), chart(nakMid(8)));
    expect(r.kootas.map((k) => k.max)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(r.max).toBe(36);
    expect(r.total).toBeLessThanOrEqual(36);
    expect(r.total).toBe(r.kootas.reduce((s, k) => s + k.points, 0));
    for (const k of r.kootas) {
      expect(k.about.length).toBeGreaterThan(80);
      expect(k.explanation.length).toBeGreaterThan(30);
    }
  });

  it('same nakshatra and pada: full on most kootas, Nadi dosha without exception', () => {
    const r = matchCharts(chart(nakMid(4)), chart(nakMid(4)));
    const by = Object.fromEntries(r.kootas.map((k) => [k.id, k.points]));
    expect(by).toMatchObject({ varna: 1, vashya: 2, tara: 3, yoni: 4, graha_maitri: 5, gana: 6, bhakoot: 7, nadi: 0 });
    expect(r.total).toBe(28);
    const nadi = r.doshas.find((d) => d.id === 'nadi')!;
    expect(nadi.cancelled).toBe(false);
  });

  it('cancels Nadi dosha for the same nakshatra in different signs', () => {
    // Krittika spans Aries 26°40' to Taurus 10°: pada 1 in Aries, pada 2 in Taurus
    const r = matchCharts(chart(27.5), chart(31));
    expect(r.a.nakshatra).toBe(3);
    expect(r.b.nakshatra).toBe(3);
    const nadi = r.doshas.find((d) => d.id === 'nadi')!;
    expect(nadi.cancelled).toBe(true);
    expect(r.adjustedTotal).toBeGreaterThan(r.total);
  });

  it('flags 6/8 Bhakoot and cancels it when both signs share a lord', () => {
    // Aries Moon (Mars) with Scorpio Moon (Mars): 8th from each other
    const r = matchCharts(chart(nakMid(1)), chart(7 * 30 + 5));
    const bh = r.kootas.find((k) => k.id === 'bhakoot')!;
    expect(bh.points).toBe(0);
    expect(bh.dosha?.cancelled).toBe(true);
    // Aries (Mars) with Virgo (Mercury): 6/8, Mars and Mercury not friends
    const r2 = matchCharts(chart(nakMid(1)), chart(5 * 30 + 15));
    expect(r2.kootas.find((k) => k.id === 'bhakoot')!.dosha?.cancelled).toBe(false);
  });

  it('scores the sworn-enemy yoni pair at 0 and Graha Maitri from natural friendship', () => {
    // Ashwini (Horse) vs Hasta (Buffalo)
    const r = matchCharts(chart(nakMid(1)), chart(nakMid(13)));
    expect(r.kootas.find((k) => k.id === 'yoni')!.points).toBe(0);
    // Aries (Mars) vs Virgo (Mercury): Mars → Mercury enemy, Mercury → Mars neutral = 0.5
    expect(r.kootas.find((k) => k.id === 'graha_maitri')!.points).toBe(0.5);
  });

  it('assigns a band from the classical total', () => {
    const r = matchCharts(chart(nakMid(1)), chart(nakMid(13)));
    const expected = r.total >= 33 ? 'excellent' : r.total >= 25 ? 'very_good' : r.total >= 18 ? 'acceptable' : 'not_recommended';
    expect(r.band).toBe(expected);
    expect(r.summary).toContain('of 36');
  });
});

describe('compareManglik', () => {
  it('neither, both, balanced and mismatch', () => {
    // Mars in the 3rd from Aries ascendant, Moon in Aries, Venus in Virgo → Mars 10th from Venus: not Manglik
    const calm = chart(15, { mars: 3, venus: 6, saturn: 10, rahu: 11, ketu: 5 });
    // Mars in the 7th (Libra), not in own sign: Manglik from ascendant and Moon
    const fiery = chart(15, { mars: 7, venus: 6, jupiter: 12, saturn: 6, rahu: 3, ketu: 9 });
    expect(compareManglik(calm, calm).status).toBe('neither');
    expect(compareManglik(fiery, fiery).status).toBe('both');
    // calm chart with Saturn in the 7th from the ascendant balances
    const balancer = chart(15, { mars: 3, venus: 6, saturn: 7, rahu: 11, ketu: 5 });
    const bal = compareManglik(fiery, balancer);
    expect(bal.status).toBe('balanced');
    expect(bal.balancing.join(' ')).toContain('Saturn');
    // no malefic in 1, 2, 4, 7, 8, 12 from ascendant or Moon in the calm chart
    const plain = chart(15, { mars: 3, venus: 6, saturn: 10, rahu: 11, ketu: 5 });
    expect(compareManglik(fiery, plain).status).toBe('mismatch');
  });
});

describe('real charts', () => {
  let engine: Engine;
  beforeAll(async () => { engine = await createEngine(); });
  it('matches two engine charts in both seat orders', () => {
    const a = fromEngineChart(engine.computeChart({ date: '1990-08-15', time: '06:30', place: { latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' } }));
    const b = fromEngineChart(engine.computeChart({ date: '1992-03-02', time: '18:10', place: { latitude: 19.076, longitude: 72.8777, timezone: 'Asia/Kolkata' } }));
    const r1 = matchCharts(a, b);
    const r2 = matchCharts(b, a);
    for (const r of [r1, r2]) {
      expect(r.total).toBeGreaterThanOrEqual(0);
      expect(r.total).toBeLessThanOrEqual(36);
      expect(r.manglik.headline.length).toBeGreaterThan(10);
    }
    // seat-independent kootas agree
    for (const id of ['yoni', 'graha_maitri', 'bhakoot', 'nadi']) {
      expect(r1.kootas.find((k) => k.id === id)!.points).toBe(r2.kootas.find((k) => k.id === id)!.points);
    }
  });
});
