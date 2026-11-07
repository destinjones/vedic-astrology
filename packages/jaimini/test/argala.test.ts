import { describe, expect, it } from 'vitest';
import { argalaOn } from '../src';

const at = (sign: number) => (sign - 1) * 30 + 15;
const base = { sun: at(1), moon: at(1), mars: at(1), mercury: at(1), jupiter: at(1), venus: at(1), saturn: at(1), rahu: at(1), ketu: at(7) };

describe('argala', () => {
  it('a planet in the 2nd gives argala unless the 12th holds as many', () => {
    const one = argalaOn({ ascendantSign: 5, birthJd: 0, planets: { ...base, jupiter: at(6) } }, 5);
    expect(one.entries.find((e) => e.from === 2)?.status).toBe('holds');
    expect(one.effective).toContain('jupiter');
    const blocked = argalaOn({ ascendantSign: 5, birthJd: 0, planets: { ...base, jupiter: at(6), venus: at(4) } }, 5);
    expect(blocked.entries.find((e) => e.from === 2)?.status).toBe('obstructed');
  });
  it('counts Ketu in reverse', () => {
    // Ketu in the 12th from Leo (Cancer) acts as if in the 2nd
    const r = argalaOn({ ascendantSign: 5, birthJd: 0, planets: { ...base, ketu: at(4) } }, 5);
    expect(r.entries.find((e) => e.from === 2)?.givers).toContain('ketu');
  });
  it('malefics in the 3rd give vipareeta argala', () => {
    const r = argalaOn({ ascendantSign: 5, birthJd: 0, planets: { ...base, saturn: at(7) } }, 5);
    expect(r.entries.find((e) => e.kind === 'vipareeta')?.givers).toEqual(['saturn']);
  });
});
