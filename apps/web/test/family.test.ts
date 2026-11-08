import { beforeEach, describe, expect, it } from 'vitest';
import { PLANETS, type ChartInput, type PlanetId, type SignNumber } from '@vedic/interpretations';
import { inverseRelation, linkPeople, linkedIds, mergeLinks, parseLinks, pruneLinks, relativesOf, unlink } from '../src/lib/family';
import { bhavaLinks, familyThemes, readPair } from '../src/lib/familyReading';
import { exportAll, restoreAll } from '../src/lib/backup';
import type { Profile } from '../src/lib/profiles';
import type { Workspace } from '../src/lib/tabs';

// a tiny in-memory localStorage, so the default arguments that read it work under node
beforeEach(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k),
  };
});

const T = '2026-01-01T00:00:00.000Z';

describe('family links', () => {
  it('stores each pair once and reads it from either side', () => {
    let l = linkPeople([], 'asha', 'riya', 'child', 'elder daughter', T);
    l = linkPeople(l, 'asha', 'ravi', 'spouse', '', T);
    expect(relativesOf(l, 'asha').map((r) => [r.profileId, r.relation])).toEqual([['ravi', 'spouse'], ['riya', 'child']]);
    expect(relativesOf(l, 'riya').map((r) => [r.profileId, r.relation])).toEqual([['asha', 'parent']]);
    // linking the same pair the other way round replaces the old link
    l = linkPeople(l, 'riya', 'asha', 'mother', '', T);
    expect(l).toHaveLength(2);
    expect(relativesOf(l, 'asha').find((r) => r.profileId === 'riya')!.relation).toBe('child');
    expect(linkPeople(l, 'asha', 'asha', 'other')).toBe(l);
    expect(unlink(l, l[0].id)).toHaveLength(1);
    expect([...linkedIds(l)].sort()).toEqual(['asha', 'ravi', 'riya']);
  });

  it('inverts relations', () => {
    expect(inverseRelation('child')).toBe('parent');
    expect(inverseRelation('father')).toBe('child');
    expect(inverseRelation('spouse')).toBe('spouse');
    expect(inverseRelation('sibling')).toBe('sibling');
  });

  it('drops broken entries and links to deleted charts', () => {
    const l = parseLinks([{ fromId: 'a', toId: 'a', relation: 'child' }, { fromId: 'a', toId: 'b', relation: 'cousin' }, null, { fromId: 'a', toId: 'b', relation: 'spouse' }, { fromId: 'a', toId: 'c', relation: 'child' }]);
    expect(l.map((x) => x.relation)).toEqual(['spouse', 'child']);
    expect(pruneLinks(l, ['a', 'b'])).toHaveLength(1);
  });

  it('merges another copy, keeping the newer edit of a pair', () => {
    const here = linkPeople([], 'a', 'b', 'sibling', '', '2026-01-01T00:00:00Z');
    const there = [...linkPeople([], 'b', 'a', 'spouse', '', '2026-02-01T00:00:00Z'), ...linkPeople([], 'a', 'c', 'child', '', T)];
    const r = mergeLinks(here, there);
    expect(r.added).toBe(1);
    expect(relativesOf(r.list, 'a').map((x) => x.relation)).toEqual(['spouse', 'child']);
    expect(mergeLinks(r.list, there).added).toBe(0);
  });
});

function chartOf(asc: number, signs: Partial<Record<PlanetId, number>>): ChartInput {
  const planets = {} as ChartInput['planets'];
  const defaults: Record<PlanetId, number> = { sun: 1, moon: 2, mars: 3, mercury: 1, jupiter: 5, venus: 2, saturn: 7, rahu: 9, ketu: 3 };
  for (const p of PLANETS) {
    const s = (signs[p] ?? defaults[p]) as SignNumber;
    const l = (s - 1) * 30 + 15;
    planets[p] = { sign: s, house: (((s - asc + 12) % 12) + 1) as never, longitude: l, retrograde: false, nakshatra: (Math.floor(l / (360 / 27)) + 1) as never, pada: 1 };
  }
  return { ascendantSign: asc as SignNumber, planets };
}

describe('family reading', () => {
  // Asha: Aries rising, Moon in Cancer. Riya: Leo rising (Asha's 5th), Moon in Scorpio (5th from Asha's Moon).
  const asha = { id: 'asha', name: 'Asha', chart: chartOf(1, { moon: 4 }) };
  const riya = { id: 'riya', name: 'Riya', chart: chartOf(5, { moon: 8 }) };
  const ravi = { id: 'ravi', name: 'Ravi', chart: chartOf(7, { moon: 4, venus: 7 }) };

  it('finds the classical bhava links for the relation', () => {
    const links = bhavaLinks(asha, riya, 'child');
    expect(links.map((b) => `${b.point}:${b.from}:${b.house}`)).toEqual(['Lagna:Lagna:5', 'Moon:Moon:5']);
    expect(links[0].text).toContain("Riya's Lagna is Leo, the 5th sign from Asha's Lagna");
    expect(bhavaLinks(asha, riya, 'other')).toEqual([]);
    // Ravi's Libra Lagna is 7th from Asha's Aries Lagna
    expect(bhavaLinks(asha, ravi, 'spouse').some((b) => b.point === 'Lagna' && b.house === 7)).toBe(true);
  });

  it('reads a child without the partner-only parts, and a spouse with matching', () => {
    const child = readPair(asha, riya, 'child');
    expect(child.match).toBeUndefined();
    expect(child.highlights).toEqual([]);
    expect(child.moon.count).toBe(5);
    expect(child.contacts.length).toBeLessThanOrEqual(4);
    const spouse = readPair(asha, ravi, 'spouse');
    expect(spouse.match!.max).toBe(36);
    expect(spouse.match!.total).toBeGreaterThanOrEqual(0);
    expect(spouse.highlights.length).toBeGreaterThan(0);
  });

  it('finds what repeats through the family', () => {
    const themes = familyThemes([asha, riya, ravi], { asha: '1980-01-01', riya: '2010-01-01', ravi: '1979-01-01' });
    const titles = themes.map((t) => t.title);
    expect(titles).toContain('Moon in Cancer'); // Asha and Ravi
    expect(themes.find((t) => t.title === 'Moon in Cancer')!.members).toEqual(['asha', 'ravi']);
    expect(titles).toContain('Saturn in Libra'); // all three, births far enough apart to count
    // births close together: slow planets are not counted
    expect(familyThemes([asha, ravi], { asha: '1980-01-01', ravi: '1980-06-01' }).some((t) => t.title.startsWith('Saturn'))).toBe(false);
    expect(familyThemes([asha])).toEqual([]);
  });
});

describe('backup', () => {
  const input = (date: string) => ({ name: '', date, time: '06:30', place: 'Delhi', latitude: 28.6, longitude: 77.2, timezone: 'Asia/Kolkata', ayanamsa: 'lahiri' as const });
  const prof = (id: string, date: string): Profile => ({ id, label: id, input: input(date), savedAt: T, updatedAt: T });
  const ws: Workspace = { tabs: [{ id: 't1', label: '', input: null, notes: '', log: [], events: [] }], activeId: 't1', archived: [] };

  it('carries family links and points them at charts already saved under another id', () => {
    const theirs = [prof('x1', '1980-01-01'), prof('x2', '2010-01-01')];
    const text = exportAll(ws, theirs, linkPeople([], 'x1', 'x2', 'child', '', T));
    // the first chart is already here as 'mine'
    const r = restoreAll(ws, [prof('mine', '1980-01-01')], text, { family: [] });
    expect(r.linksAdded).toBe(1);
    expect(relativesOf(r.family, 'mine').map((x) => [x.profileId, x.relation])).toEqual([['x2', 'child']]);
    // restoring again adds nothing
    expect(restoreAll(ws, r.profiles, text, { family: r.family }).linksAdded).toBe(0);
  });
});
