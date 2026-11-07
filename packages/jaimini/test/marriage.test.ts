import { describe, expect, it } from 'vitest';
import type { GrahaId } from '@vedic/engine';
import { jaiminiMarriage, jaiminiMatch, type JaiminiInput } from '../src';

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

describe('Jaimini marriage', () => {
  it('finds the Upapada and reads an afflicted 2nd from it', () => {
    // Aries rising: 12th is Pisces, lord Jupiter in Leo (6th from Pisces), so UL is 6th from Leo = Capricorn
    const m = jaiminiMarriage(chartOf(1, { mars: [11, 5], saturn: [11, 20], mercury: [2, 13] }));
    expect(m.upapada.sign).toBe(10);
    expect(m.secondFromUl.sign).toBe(11);
    expect(m.secondFromUl.occupants.sort()).toEqual(['mars', 'saturn']);
    expect(m.secondFromUl.tone).toBe('strained');
    expect(m.seventhFromUl.sign).toBe(4);
  });
  it('supports when benefics aspect the 2nd from UL', () => {
    // Mercury and the Sun in Aries aspect Aquarius by rashi drishti: one benefic, one malefic
    const m = jaiminiMarriage(chartOf(1, { mars: [3, 5], saturn: [2, 20], mercury: [1, 13], jupiter: [5, 14] }));
    expect(m.secondFromUl.aspecting).toContain('mercury');
    expect(m.secondFromUl.tone).toBe('supportive');
  });
  it('finds the Karakamsa and Darakaraka', () => {
    const m = jaiminiMarriage(chartOf(1, {}));
    // Saturn at 16° is furthest through its sign; Rahu counts 30 - 17 = 13
    expect(m.karakamsa.atmakaraka).toBe('saturn');
    expect(m.darakaraka.planet).toBe('sun');
  });
  it('links one partner’s lagna to the other’s Upapada', () => {
    const a = chartOf(1, {}); // UL Capricorn
    const b = chartOf(10, {}); // Capricorn rising
    const r = jaiminiMatch(a, b, { a: 'A', b: 'B' });
    expect(r.links.some((l) => l.in === 'a' && l.point === 'UL' && l.by === 'lagna')).toBe(true);
    expect(r.summary).toMatch(/Jaimini/);
  });
});
