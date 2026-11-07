import { describe, expect, it } from 'vitest';
import { PLANETS, porutham, rajjuOf, starCount, vedhaBetween, type ChartInput, type PlanetId, type SignNumber } from '../src';

const SPAN = 360 / 27;
function chart(moonLon: number): ChartInput {
  const planets = {} as ChartInput['planets'];
  for (const p of PLANETS as readonly PlanetId[]) {
    const lon = p === 'moon' ? moonLon : 15;
    const sign = (Math.floor(lon / 30) + 1) as SignNumber;
    planets[p] = { sign, house: sign, longitude: lon, retrograde: false, nakshatra: Math.floor(lon / SPAN) + 1, pada: 1 };
  }
  return { ascendantSign: 1 as SignNumber, planets };
}
const nakMid = (n: number) => (n - 1) * SPAN + SPAN / 2;

describe('porutham', () => {
  it('assigns rajjus in the foot-to-head zigzag', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(rajjuOf)).toEqual(['Pada', 'Kati', 'Nabhi', 'Kantha', 'Siro', 'Kantha', 'Nabhi', 'Kati', 'Pada']);
    expect(rajjuOf(14)).toBe('Siro'); // Chitra
    expect(rajjuOf(23)).toBe('Siro'); // Dhanishta
    expect(rajjuOf(27)).toBe('Pada'); // Revati
  });
  it('knows the vedha pairs', () => {
    expect(vedhaBetween(1, 18)).toBe(true);
    expect(vedhaBetween(14, 5)).toBe(true);
    expect(vedhaBetween(1, 2)).toBe(false);
  });
  it('counts from bride to groom', () => {
    expect(starCount(1, 1)).toBe(1);
    expect(starCount(27, 1)).toBe(2);
  });
  it('fails a same-rajju couple on an essential porutham', () => {
    const r = porutham(chart(nakMid(1)), chart(nakMid(9))); // Ashwini and Ashlesha, both Pada
    expect(r.rows.find((x) => x.id === 'rajju')!.result).toBe('no');
    expect(r.verdict).toBe('not_recommended');
    expect(r.rows).toHaveLength(10);
  });
  it('scores a well-agreeing couple', () => {
    // groom Rohini (Taurus), bride Uttara Phalguni... pick bride Hasta (13, Virgo); count 13→4 = 19
    const r = porutham(chart(nakMid(4)), chart(nakMid(13)));
    expect(r.starCount).toBe(19);
    expect(r.rows.find((x) => x.id === 'mahendra')!.result).toBe('match');
    expect(r.rows.find((x) => x.id === 'stree_deergha')!.result).toBe('match');
    expect(r.rows.find((x) => x.id === 'rajju')!.result).toBe('no'); // Rohini and Hasta are both Kantha
  });
});
