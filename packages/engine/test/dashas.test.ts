import { describe, expect, it } from 'vitest';
import {
  ashtottari,
  ashtottariApplies,
  dashaAt,
  dashaLevel,
  kalachakra,
  kalachakraCycle,
  KALACHAKRA_SIGN_YEARS,
  yogini,
  type DashaPeriod,
  type Pada,
} from '../src/index';

const JD = 2451545.0; // 2000-01-01 12:00 UT
const YEAR = 365.2425;
const NAK = 360 / 27;
const PADA = NAK / 4;

function expectTiled(periods: DashaPeriod[]) {
  for (let i = 1; i < periods.length; i++) expect(periods[i].startJd).toBeCloseTo(periods[i - 1].endJd, 9);
  for (const p of periods) {
    if (!p.children) continue;
    expect(p.children[0].startJd).toBe(p.startJd);
    expect(p.children[p.children.length - 1].endJd).toBe(p.endJd);
    expect(p.children.reduce((s, c) => s + c.years, 0)).toBeCloseTo(p.years, 9);
    expectTiled(p.children);
  }
}

describe('yogini', () => {
  it('Ashwini starts with Bhramari (Mars, 4 years)', () => {
    const d = yogini(0, JD);
    expect(d.startYogini).toBe(4);
    expect(d.periods[0].name).toBe('Bhramari');
    expect(d.periods[0].lord).toBe('mars');
    expect(d.balanceYears).toBeCloseTo(4, 9);
    expect(d.periods[0].startJd).toBeCloseTo(JD, 9);
  });
  it('maps nakshatras to yoginis in eights', () => {
    // Rohini (4) -> 7 Siddha, Punarvasu (7) -> 2 Pingala, Revati (27) -> 6 Ulka
    expect(yogini(3 * NAK + 1, JD).periods[0].name).toBe('Siddha');
    expect(yogini(6 * NAK + 1, JD).periods[0].name).toBe('Pingala');
    expect(yogini(26 * NAK + 1, JD).periods[0].name).toBe('Ulka');
  });
  it('balance follows the part of the nakshatra left', () => {
    const d = yogini(NAK + NAK / 4, JD); // a quarter into Bharani -> Bhadrika (5y)
    expect(d.periods[0].name).toBe('Bhadrika');
    expect(d.balanceYears).toBeCloseTo(3.75, 9);
  });
  it('covers 120 years in 36-year cycles and sub-periods start from the yogini', () => {
    const d = yogini(123.4, JD, { levels: 3 });
    expect(d.periods.at(-1)!.endJd).toBeGreaterThanOrEqual(JD + 120 * YEAR);
    expect(d.periods.slice(0, 8).reduce((s, p) => s + p.years, 0)).toBe(36);
    expectTiled(d.periods);
    for (const p of d.periods) expect(p.children![0].name).toBe(p.name);
    expect(dashaLevel(d, 2)).toHaveLength(d.periods.length * 8);
    expect(dashaAt(d, '2030-06-01T00:00:00Z')).toHaveLength(3);
  });
});

describe('ashtottari', () => {
  it('Ardra start gives a full Sun dasha', () => {
    const d = ashtottari(5 * NAK, JD);
    expect(d.startLord).toBe('sun');
    expect(d.balanceYears).toBeCloseTo(6, 9);
  });
  it('the Rahu stretch wraps from Uttara Bhadrapada to Bharani', () => {
    const d = ashtottari(0, JD); // start of Ashwini: half of Rahu's four nakshatras gone
    expect(d.startLord).toBe('rahu');
    expect(d.elapsedFraction).toBeCloseTo(0.5, 9);
    expect(d.balanceYears).toBeCloseTo(6, 9);
  });
  it('Krittika to Mrigashira is Venus, Purva Ashadha to Shravana is Saturn', () => {
    expect(ashtottari(2 * NAK + 0.1, JD).startLord).toBe('venus');
    expect(ashtottari(19 * NAK + 0.1, JD).startLord).toBe('saturn');
    expect(ashtottari(21 * NAK + NAK - 0.1, JD).startLord).toBe('saturn');
    expect(ashtottari(22 * NAK + 0.1, JD).startLord).toBe('jupiter');
  });
  it('one cycle is 108 years and periods tile', () => {
    const d = ashtottari(200, JD, { levels: 3 });
    expect(d.periods.slice(0, 8).reduce((s, p) => s + p.years, 0)).toBe(108);
    expect(d.periods.at(-1)!.endJd).toBeGreaterThanOrEqual(JD + 120 * YEAR);
    expectTiled(d.periods);
    for (const p of d.periods) expect(p.children![0].lord).toBe(p.lord);
  });
  it('applies when Rahu is in a kendra or trikona from the lagna lord, not in lagna', () => {
    // Aries lagna, Mars in Cancer: Rahu in Libra is 4th from Mars
    expect(ashtottariApplies(1, 4, 7)).toBe(true);
    expect(ashtottariApplies(1, 4, 5)).toBe(false); // 2nd from Mars
    expect(ashtottariApplies(1, 4, 1)).toBe(false); // in lagna
  });
});

describe('kalachakra', () => {
  it('paramayus per pada: savya 100/85/83/86, apasavya 86/83/85/100', () => {
    const sum = (n: number, p: Pada) => kalachakraCycle(n, p).reduce((s, x) => s + KALACHAKRA_SIGN_YEARS[x - 1], 0);
    for (const n of [0, 1, 2, 6, 7, 26]) expect([1, 2, 3, 4].map((p) => sum(n, p as Pada))).toEqual([100, 85, 83, 86]);
    for (const n of [3, 4, 5, 9, 23]) expect([1, 2, 3, 4].map((p) => sum(n, p as Pada))).toEqual([86, 83, 85, 100]);
  });
  it('Ashwini pada 1 at its start runs Aries to Sagittarius', () => {
    const d = kalachakra(0, JD, { levels: 1 });
    expect(d.direction).toBe('savya');
    expect(d.paramayus).toBe(100);
    expect([d.deha, d.jeeva]).toEqual([1, 9]);
    expect(d.periods.slice(0, 9).map((p) => p.sign)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(d.periods[0]).toMatchObject({ name: 'Aries', lord: 'mars', years: 7 });
    expect(d.balanceYears).toBeCloseTo(7, 9);
    // then Ashwini pada 2's cycle
    expect(d.periods[9].sign).toBe(10);
  });
  it('starts from the sign running at birth', () => {
    // half way through Ashwini pada 1: 50 of 100 years lived -> Leo (7+16+9+21=53 > 50 -> Cancer)
    const d = kalachakra(PADA / 2, JD, { levels: 1 });
    expect(d.periods[0].sign).toBe(4);
    expect(d.balanceYears).toBeCloseTo(3, 9);
    expect(d.periods[0].startJd).toBeCloseTo(JD - 18 * YEAR, 6);
  });
  it('Rohini pada 1 is apasavya from Sagittarius to Cancer', () => {
    const d = kalachakra(3 * NAK + 0.01, JD, { levels: 1 });
    expect(d.direction).toBe('apasavya');
    expect(d.paramayus).toBe(86);
    expect([d.deha, d.jeeva]).toEqual([9, 4]);
  });
  it('sub-periods cycle through the same nine signs and tile', () => {
    const d = kalachakra(77.7, JD, { levels: 3 });
    expect(d.periods.at(-1)!.endJd).toBeGreaterThanOrEqual(JD + 120 * YEAR);
    expectTiled(d.periods);
    for (const p of d.periods) {
      expect(p.children).toHaveLength(9);
      expect(p.children![0].sign).toBe(p.sign);
    }
    expect(dashaAt(d, '2040-01-01T00:00:00Z')).toHaveLength(3);
  });
});
