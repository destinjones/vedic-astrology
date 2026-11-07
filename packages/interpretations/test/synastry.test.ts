import { describe, expect, it } from 'vitest';
import { PLANETS, synastry, type ChartInput, type PlanetId, type SignNumber } from '../src';

function chartOf(asc: number, signs: Partial<Record<PlanetId, number>>, lon: Partial<Record<PlanetId, number>> = {}): ChartInput {
  const planets = {} as ChartInput['planets'];
  const defaults: Record<PlanetId, number> = { sun: 1, moon: 2, mars: 3, mercury: 1, jupiter: 5, venus: 2, saturn: 7, rahu: 9, ketu: 3 };
  for (const p of PLANETS) {
    const s = (signs[p] ?? defaults[p]) as SignNumber;
    const l = lon[p] ?? (s - 1) * 30 + 15;
    planets[p] = { sign: s, house: (((s - asc + 12) % 12) + 1) as never, longitude: l, retrograde: false, nakshatra: Math.floor(l / (360 / 27)) + 1, pada: 1 };
  }
  return { ascendantSign: asc as SignNumber, planets };
}

describe('synastry', () => {
  const asha = { name: 'Asha', chart: chartOf(1, { moon: 4, venus: 2 }) };
  const ravi = { name: 'Ravi', chart: chartOf(5, { moon: 8, venus: 7, mars: 4 }, { mars: 100, venus: 195 }) };
  const r = synastry(asha, ravi);

  it("counts the other person's planets from the host's Lagna", () => {
    // Ravi's Venus in Libra (7) is Asha's 7th house from an Aries Lagna.
    const venus = r.bInA.find((o) => o.planet === 'venus')!;
    expect(venus.house).toBe(7);
    expect(venus.tone).toBe('benefic');
    expect(venus.title).toBe("Ravi's Venus in Asha's 7th house");
    // Asha's Venus in Taurus is Ravi's 10th house from a Leo Lagna.
    expect(r.aInB.find((o) => o.planet === 'venus')!.house).toBe(10);
    expect(r.bInA).toHaveLength(9);
  });

  it('names people instead of "the host" in readings', () => {
    for (const o of [...r.bInA, ...r.aInB]) {
      expect(o.summary + o.detail).not.toMatch(/the host|the other person/i);
    }
  });

  it('finds conjunctions with the degree gap', () => {
    // Asha's Moon in Cancer at 105°, Ravi's Mars in Cancer at 100°.
    const c = r.contacts.find((x) => x.a === 'moon' && x.b === 'mars' && x.kind === 'conjunction')!;
    expect(c).toBeTruthy();
    expect(c.orb).toBeCloseTo(5, 5);
  });

  it('finds graha drishti across charts', () => {
    // Asha's Saturn in Libra casts its 10th aspect on Cancer, where Ravi's Mars sits.
    const c = r.contacts.find((x) => x.a === 'saturn' && x.b === 'mars');
    expect(c?.kind).toMatch(/aspect/);
    expect(c?.tone).toBe('challenging');
  });

  it('reads Moon and Lagna sign distances', () => {
    // Cancer to Scorpio is 5/9.
    expect(r.moon.pair).toBe('5/9');
    expect(r.moon.tone).toBe('benefic');
    // Aries to Leo is 5/9 as well.
    expect(r.lagna.pair).toBe('5/9');
    const sixEight = synastry(asha, { name: 'X', chart: chartOf(1, { moon: 9 }) });
    expect(sixEight.moon.pair).toBe('6/8');
    const twoTwelve = synastry(asha, { name: 'X', chart: chartOf(1, { moon: 3 }) });
    expect(twoTwelve.moon.pair).toBe('2/12');
  });

  it('gives a summary and a bounded balance', () => {
    expect(r.highlights.length).toBeGreaterThan(1);
    expect(r.balance).toBeGreaterThanOrEqual(-10);
    expect(r.balance).toBeLessThanOrEqual(10);
    expect(r.highlights.join(' ')).toContain('partnership house');
  });
});
