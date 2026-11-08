import { describe, expect, it } from 'vitest';
import { cleanLayout, cleanPoints, dashaChain, DEFAULT_LAYOUT, move, upsertLayout, vimshottariSubs } from '../src/lib/session';
import type { DashaPeriod } from '../src/types/chart';

describe('session points', () => {
  it('keeps good points and drops broken ones', () => {
    const list = cleanPoints([
      { id: 'a', title: 'Moon in Rohini', text: 'Calm mind', varga: 'D9', select: { kind: 'planet', id: 'moon' } },
      { id: 'b', title: 'House', varga: 'D99', select: { kind: 'planet', id: 'pluto' } },
      { title: 'no id' },
      null,
    ]);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ varga: 'D9', select: { kind: 'planet', id: 'moon' } });
    expect(list[1]).toMatchObject({ varga: 'D1', text: '', select: undefined });
    expect(cleanPoints('nonsense')).toEqual([]);
  });

  it('moves items and ignores moves out of range', () => {
    expect(move([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(move([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
    const same = [1, 2];
    expect(move(same, 0, 5)).toBe(same);
  });
});

describe('dashboard layout', () => {
  it('falls back to the default for anything unusable', () => {
    expect(cleanLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(cleanLayout({ columns: 9, panels: [] })).toEqual(DEFAULT_LAYOUT);
  });

  it('keeps known panels once each and a valid column count', () => {
    const l = cleanLayout({ columns: 3, panels: [{ id: 'x', kind: 'D9', wide: true }, { id: 'x', kind: 'D10' }, { id: 'y', kind: 'nope' }, { id: 'z', kind: 'dasha-now' }] });
    expect(l.columns).toBe(3);
    expect(l.panels).toEqual([{ id: 'x', kind: 'D9', wide: true }, { id: 'z', kind: 'dasha-now' }]);
  });

  it('saves a named layout, replacing one with the same name', () => {
    const one = upsertLayout([], 'Marriage', DEFAULT_LAYOUT);
    const two = upsertLayout(one, ' marriage ', { columns: 2, panels: DEFAULT_LAYOUT.panels });
    expect(two).toHaveLength(1);
    expect(two[0].layout.columns).toBe(2);
    expect(upsertLayout(two, '   ', DEFAULT_LAYOUT)).toBe(two);
  });
});

describe('dasha now', () => {
  const maha: DashaPeriod = { lord: 'venus', start: '2020-01-01T00:00:00Z', end: '2040-01-01T00:00:00Z' };

  it('splits a mahadasha into nine antardashas that start with its own lord and fill it', () => {
    const subs = vimshottariSubs(maha);
    expect(subs).toHaveLength(9);
    expect(subs[0].lord).toBe('venus');
    expect(subs[1].lord).toBe('sun');
    expect(Date.parse(subs[0].start)).toBe(Date.parse(maha.start));
    expect(Date.parse(subs[8].end)).toBe(Date.parse(maha.end));
  });

  it('finds the maha, antar and pratyantar running on a date', () => {
    const chain = dashaChain([maha], Date.parse('2021-06-01T00:00:00Z'));
    expect(chain.map((p) => p.lord)).toEqual(['venus', 'venus', 'rahu']);
    expect(dashaChain([maha], Date.parse('2050-01-01T00:00:00Z'))).toEqual([]);
  });
});
