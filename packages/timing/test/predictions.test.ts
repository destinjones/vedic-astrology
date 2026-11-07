import { describe, it, expect } from 'vitest';
import {
  createAstronomyEphemeris, ascendantSidereal, computeVimshottari, activeDashas, childrenOf, deepChainAt, splitPeriod, spanLabel,
  buildIcs, icsEscape, icsFold, windowsToIcs, windowId, classifyReason, windowRules, markWindow, predictionRecord, sanitizeMarks, wilson, pastWindows,
  DASHA_YEARS, type NatalChart, type Window, type PredictionMark,
} from '../src';

const eph = createAstronomyEphemeris();
const birth = new Date(Date.UTC(1990, 0, 1, 17, 0));
const chart: NatalChart = { birth, ascendant: ascendantSidereal(birth, 40.7128, -74.006), planets: eph.positions(birth) };
const tree = computeVimshottari(chart, { depth: 3 });

describe('sookshma and prana', () => {
  it('splits a period into nine parts that start with its own lord and fill it exactly', () => {
    const p = activeDashas(tree, new Date('2026-06-01'))[2];
    const kids = childrenOf(chart, p);
    expect(kids).toHaveLength(9);
    expect(kids[0].lord).toBe(p.lord);
    expect(kids[0].path).toEqual([...p.path, p.lord]);
    expect(kids[0].start.getTime()).toBe(p.start.getTime());
    expect(kids[8].end.getTime()).toBe(p.end.getTime());
    for (let i = 1; i < 9; i++) expect(kids[i].start.getTime()).toBe(kids[i - 1].end.getTime());
    // each share is lord years / 120 of the parent
    const len = p.end.getTime() - p.start.getTime();
    for (const k of kids) expect((k.end.getTime() - k.start.getTime()) / len).toBeCloseTo(DASHA_YEARS[k.lord] / 120, 9);
    expect(kids.every((k) => k.level === 4 && typeof k.score === 'number')).toBe(true);
    expect(childrenOf(chart, p)).toBe(kids); // cached
  });

  it('walks down to prana at any instant', () => {
    const at = new Date('2026-06-01T12:00:00Z');
    const chain = deepChainAt(chart, tree, at);
    expect(chain.map((c) => c.level)).toEqual([1, 2, 3, 4, 5]);
    for (const c of chain) expect(c.start <= at && at < c.end).toBe(true);
    // a prana lasts hours to a few days
    const prana = chain[4];
    const hours = (prana.end.getTime() - prana.start.getTime()) / 3.6e6;
    expect(hours).toBeGreaterThan(0.5);
    expect(hours).toBeLessThan(24 * 8);
    expect(childrenOf(chart, prana)).toEqual([]);
  });

  it('labels spans', () => {
    const t = new Date('2026-01-01T00:00:00Z');
    expect(spanLabel(t, new Date(t.getTime() + 5.5 * 3.6e6))).toBe('5 h 30 m');
    expect(spanLabel(t, new Date(t.getTime() + 10 * 864e5))).toBe('10 d');
    expect(spanLabel(t, new Date(t.getTime() + 3.2 * 365.25 * 864e5))).toBe('3 y 2 mo');
    expect(splitPeriod(['Venus'], t, new Date(t.getTime() + 120 * 864e5)).map((r) => r.path[1])[0]).toBe('Venus');
  });
});

const W = (o: Partial<Window> = {}): Window => ({
  start: new Date('2024-03-04T00:00:00Z'), end: new Date('2024-04-15T00:00:00Z'), tone: 'favourable', average: 31, peak: 44,
  dashaPath: ['Jupiter', 'Venus', 'Moon'], drivers: ['Jupiter–Venus–Moon dasha (+38)', 'Jupiter transit (+14)', 'Saturn transit (-9)'], ...o,
});

describe('ics', () => {
  it('escapes text and folds long lines to 75 octets', () => {
    expect(icsEscape('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
    const folded = icsFold('DESCRIPTION:' + 'ॐ'.repeat(60));
    for (const line of folded.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').slice(1).every((l) => l.startsWith(' '))).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe('DESCRIPTION:' + 'ॐ'.repeat(60));
  });

  it('writes all-day events with an exclusive end date and stable uids', () => {
    const ics = windowsToIcs([W(), W({ tone: 'challenging', start: new Date('2024-05-01T00:00:00Z'), end: new Date('2024-06-01T12:00:00Z') })], {
      name: 'Good windows', now: new Date('2024-01-01T00:00:00Z'), person: 'Asha', uidSeed: 'x1',
    });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1); // favourable only by default
    expect(ics).toContain('DTSTART;VALUE=DATE:20240304');
    expect(ics).toContain('DTEND;VALUE=DATE:20240415');
    expect(ics).toContain(`UID:${windowId(W())}-x1@vedic-astrology`);
    expect(ics).toContain('SUMMARY:▲ Favourable window for Asha (Jupiter–Venus–Moon)');
    expect(ics).toContain('TRIGGER:PT9H');
    expect(ics.split('\r\n').every((l) => !l.includes('\n'))).toBe(true);
  });

  it('rounds a mid-day end up and skips past windows', () => {
    const ics = buildIcs([{ uid: 'a', start: new Date('2024-05-01T10:00:00Z'), end: new Date('2024-05-03T12:00:00Z'), summary: 'x' }], { name: 'n', now: new Date(0) });
    expect(ics).toContain('DTSTART;VALUE=DATE:20240501');
    expect(ics).toContain('DTEND;VALUE=DATE:20240504');
    const none = windowsToIcs([W()], { name: 'n', now: new Date('2025-01-01T00:00:00Z') });
    expect(none).not.toContain('BEGIN:VEVENT');
  });
});

describe('prediction record', () => {
  it('classifies the dasha reasons into stable rules', () => {
    expect(classifyReason('placed in the 10th house (strongest kendra)')?.key).toBe('placement-kendra');
    expect(classifyReason('[Venus] placed in the 8th house (dusthana: obstacles, sudden change)')?.key).toBe('placement-dusthana');
    expect(classifyReason('Saturn is debilitated in Aries, but debilitation is cancelled (neecha bhanga: x)')?.key).toBe('neecha-bhanga');
    expect(classifyReason('Venus sits 8th from Jupiter (6/8/12 from the main lord: friction)')?.key).toBe('pair-6-8-12');
    expect(classifyReason('natural benefic')).toBeNull();
  });

  it('collects the rules behind a window', () => {
    const rules = windowRules(W(), tree).map((r) => r.key);
    expect(rules).toContain('maha-Jupiter');
    expect(rules).toContain('antar-Venus');
    expect(rules).toContain('transit-Jupiter-up');
    expect(rules).toContain('transit-Saturn-down');
  });

  it('counts hit rates per rule and per tone', () => {
    const a = markWindow(W(), tree, 'happened');
    const b = markWindow(W({ start: new Date('2025-02-01T00:00:00Z'), end: new Date('2025-03-20T00:00:00Z') }), tree, 'didnt');
    const c = markWindow(W({ tone: 'challenging', drivers: ['x dasha (-30)', 'Saturn transit (-20)'] }), tree, 'happened');
    const rec = predictionRecord([a, b, c]);
    expect(rec.total).toBe(3);
    expect(rec.hits).toBe(2);
    expect(rec.favourable).toEqual({ hits: 1, n: 2 });
    expect(rec.challenging).toEqual({ hits: 1, n: 1 });
    const jup = rec.rules.find((r) => r.rule.key === 'transit-Jupiter-up')!;
    expect(jup).toMatchObject({ hits: 1, misses: 1, n: 2, rate: 0.5 });
    expect(jup.low).toBeLessThan(0.5);
    expect(jup.high).toBeGreaterThan(0.5);
    expect(rec.rules[0].n).toBeGreaterThanOrEqual(rec.rules[rec.rules.length - 1].n);
  });

  it('Wilson interval tightens with more marks', () => {
    const small = wilson(3, 4), big = wilson(75, 100);
    expect(small.high - small.low).toBeGreaterThan(big.high - big.low);
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 });
  });

  it('round-trips stored marks and drops junk', () => {
    const m = markWindow(W(), tree, 'happened', ' got the job ');
    expect(m.note).toBe('got the job');
    const back = sanitizeMarks(JSON.parse(JSON.stringify([m, { id: 1 }, null, { ...m, outcome: 'maybe' }])));
    expect(back).toEqual([m]);
    expect(sanitizeMarks('nope')).toEqual([]);
  });

  it('finds past windows on a grid that does not move with the end date', () => {
    const from = new Date('2015-01-01'), opts = { from, stepDays: 7 };
    const a = pastWindows(eph, chart, tree, { ...opts, to: new Date('2019-01-01') });
    const b = pastWindows(eph, chart, tree, { ...opts, to: new Date('2019-01-09') });
    expect(a.length).toBeGreaterThan(0);
    const idsA = a.filter((w) => w.end < new Date('2018-10-01')).map(windowId);
    const idsB = new Set(b.map(windowId));
    for (const id of idsA) expect(idsB.has(id)).toBe(true);
  });
});

// type-only use so the import list stays honest
export type _M = PredictionMark;
