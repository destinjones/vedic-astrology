/**
 * Calibration: textbook situations must score in the direction the classical
 * texts describe. These guard the weighting documented in docs/SCORING.md.
 */
import { describe, expect, it } from 'vitest';
import {
  type NatalChart, type Planet, type Positions, PLANETS, computeAshtakavarga, lordStrength, lordship, scoreDashaTree, transitSnapshot, compoundDignity,
} from '../src';

/** Build a chart from sign indices (0 = Aries) and degrees; ascendant sign given. */
function chartOf(asc: number, place: Partial<Record<Planet, [number, number]>>, retro: Planet[] = []): NatalChart {
  const planets = {} as Positions;
  const filler: Record<Planet, [number, number]> = {
    Sun: [0, 15], Moon: [3, 15], Mars: [2, 15], Mercury: [0, 25], Jupiter: [8, 15], Venus: [1, 15], Saturn: [10, 15], Rahu: [5, 15], Ketu: [11, 15],
  };
  for (const p of PLANETS) {
    const [s, d] = place[p] ?? filler[p];
    planets[p] = { longitude: s * 30 + d, speed: p === 'Rahu' || p === 'Ketu' ? -0.05 : retro.includes(p) ? -0.1 : 1 };
  }
  return { birth: new Date('2000-01-01T00:00:00Z'), ascendant: asc * 30 + 10, planets };
}
const d = (y: number) => new Date(Date.UTC(y, 0, 1));
const score = (c: NatalChart, path: Planet[]) => {
  const raw = { path: [path[0]], start: d(2000), end: d(2020), children: path.length > 1 ? [{ path, start: d(2000), end: d(2005) }] : undefined };
  const t = scoreDashaTree(c, [raw]);
  return path.length > 1 ? t[0].children![0].score : t[0].score;
};

describe('functional nature (Laghu Parashari)', () => {
  it('yogakarakas', () => {
    expect(lordship('Saturn', 1).yogakaraka).toBe(true); // Taurus
    expect(lordship('Saturn', 6).yogakaraka).toBe(true); // Libra
    expect(lordship('Mars', 3).yogakaraka).toBe(true);   // Cancer
    expect(lordship('Mars', 4).yogakaraka).toBe(true);   // Leo
    expect(lordship('Venus', 9).yogakaraka).toBe(true);  // Capricorn
  });
  it('8th and 11th lord Jupiter is malefic for Taurus; lagna lord Jupiter stays benefic for Pisces', () => {
    expect(lordship('Jupiter', 1).value).toBeLessThan(-0.5);
    expect(lordship('Jupiter', 11).value).toBeGreaterThan(0.5);
  });
  it('8th lord who also rules the lagna is not malefic (Mars for Aries)', () => {
    expect(lordship('Mars', 0).value).toBeGreaterThan(0);
  });
  it('kendradhipati dosha weakens natural benefics ruling only kendras', () => {
    expect(lordship('Jupiter', 2).value).toBeLessThan(0); // Gemini: 7th and 10th lord
  });
});

describe('dasha lord scoring', () => {
  it('yogakaraka Saturn in own sign in the 10th (Taurus lagna) is excellent', () => {
    const c = chartOf(1, { Saturn: [10, 10] });
    expect(score(c, ['Saturn'])).toBeGreaterThanOrEqual(45);
  });
  it('Jupiter as 8th/11th lord, debilitated in the 8th (Taurus lagna) is difficult', () => {
    const c = chartOf(1, { Jupiter: [9, 10], Saturn: [5, 10], Moon: [0, 10] });
    expect(score(c, ['Jupiter'])).toBeLessThanOrEqual(-45);
  });
  it('neecha bhanga softens debilitation', () => {
    // Mars debilitated in Cancer; cancellation when the Moon (lord of Cancer) is in a kendra from lagna
    const without = chartOf(0, { Mars: [3, 10], Moon: [2, 10] });
    const withNb = chartOf(0, { Mars: [3, 10], Moon: [6, 10] });
    expect(compoundDignity(withNb, 'Mars')).toBe('debilitated');
    expect(lordStrength(withNb, 'Mars').value).toBeGreaterThan(lordStrength(without, 'Mars').value);
  });
  it('antardasha lord 6/8 from the mahadasha lord scores worse than one in trine', () => {
    const trine = chartOf(4, { Jupiter: [8, 10], Mars: [0, 10] });   // Mars 5th from Jupiter
    const shad = chartOf(4, { Jupiter: [8, 10], Mars: [3, 10] });    // Mars 8th from Jupiter
    expect(score(trine, ['Jupiter', 'Mars'])).toBeGreaterThan(score(shad, ['Jupiter', 'Mars']));
  });
  it('Rahu follows its dispositor', () => {
    const goodDisp = chartOf(1, { Rahu: [10, 5], Ketu: [4, 5], Saturn: [10, 15] }); // Saturn yogakaraka in own sign
    const badDisp = chartOf(1, { Rahu: [8, 5], Ketu: [2, 5], Jupiter: [9, 10] });   // Jupiter 8/11 lord debilitated
    expect(score(goodDisp, ['Rahu'])).toBeGreaterThan(score(badDisp, ['Rahu']) + 30);
  });
});

describe('gochara scoring', () => {
  const natal = chartOf(0, { Moon: [0, 10] }); // Moon in Aries
  const transit = (moves: Partial<Record<Planet, number>>) => {
    const pos = {} as Positions;
    for (const p of PLANETS) pos[p] = { longitude: (moves[p] ?? 6) * 30 + 15, speed: 1 };
    return transitSnapshot(natal, pos, d(2026), computeAshtakavarga(natal)).planets;
  };
  it('Jupiter 11th from the Moon helps; Saturn 8th from the Moon hurts', () => {
    const t = transit({ Jupiter: 10, Saturn: 7, Sun: 2, Mars: 2, Mercury: 1, Venus: 1, Rahu: 2, Ketu: 8 });
    expect(t.find((p) => p.planet === 'Jupiter')!.score).toBeGreaterThan(0);
    expect(t.find((p) => p.planet === 'Saturn')!.score).toBeLessThan(0);
    expect(t.find((p) => p.planet === 'Saturn')!.label).toBe('Ashtama Shani');
  });
  it('vedha cancels a favourable transit', () => {
    // Jupiter 11th (vedha house 8): put Mars in the 8th
    const free = transit({ Jupiter: 10, Mars: 2, Sun: 2, Saturn: 2, Mercury: 1, Venus: 1, Rahu: 2, Ketu: 8 });
    const blocked = transit({ Jupiter: 10, Mars: 7, Sun: 2, Saturn: 2, Mercury: 1, Venus: 1, Rahu: 2, Ketu: 8 });
    const j = (t: typeof free) => t.find((p) => p.planet === 'Jupiter')!;
    expect(j(blocked).obstructedBy).toBe('Mars');
    expect(j(blocked).score).toBeLessThan(j(free).score);
  });
});
