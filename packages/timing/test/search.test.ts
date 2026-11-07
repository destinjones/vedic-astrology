import { describe, expect, it } from 'vitest';
import {
  ascendantSidereal, createAstronomyEphemeris, norm360, parseTransitQuestion, resolveQuestion, searchTransits,
  answerTransitQuestion, signOf, type NatalChart,
} from '../src';

const eph = createAstronomyEphemeris();
const birth = new Date(Date.UTC(1990, 0, 1, 17, 0));
const natal: NatalChart = { birth, ascendant: ascendantSidereal(birth, 40.7128, -74.006), planets: eph.positions(birth) };
const sep = (a: number, b: number) => Math.abs(((norm360(a - b) + 540) % 360) - 180);
const near = (d: Date, iso: string, hours: number) => expect(Math.abs(d.getTime() - Date.parse(iso)) / 3.6e6).toBeLessThan(hours);

describe('transit search', () => {
  it('finds sign ingresses that match published dates', () => {
    const r = searchTransits(eph, natal, { kind: 'ingress', planet: 'Saturn', sign: 11 }, { from: new Date('2024-06-01'), to: new Date('2026-01-01') });
    expect(r.hits[0].title).toBe('Saturn enters Pisces');
    near(r.hits[0].date, '2025-03-29T12:00Z', 30);
  });

  it('finds the April 2024 Mercury retrograde station', () => {
    const r = searchTransits(eph, natal, { kind: 'station', planet: 'Mercury', station: 'retrograde' }, { from: new Date('2024-03-01'), to: new Date('2024-06-01') });
    expect(r.hits).toHaveLength(1);
    near(r.hits[0].date, '2024-04-01T22:14Z', 3);
  });

  it('every exact pass lands on the natal degree, and loops are grouped', () => {
    const r = searchTransits(eph, natal, { kind: 'aspect', planet: 'Saturn', target: 'Moon', aspect: 'conjunction' }, { from: new Date('2026-01-01'), to: new Date('2090-01-01') });
    expect(r.hits.length).toBeGreaterThanOrEqual(2);
    for (const h of r.hits) {
      for (const p of h.passes) expect(sep(eph.positions(p.date).Saturn.longitude, natal.planets.Moon.longitude)).toBeLessThan(0.01);
      expect(h.passes.length === 1 || h.passes.length === 3).toBe(true);
      expect(h.start!.getTime()).toBeLessThanOrEqual(h.date.getTime());
      expect(h.end!.getTime()).toBeGreaterThanOrEqual(h.passes[h.passes.length - 1].date.getTime());
    }
    // Saturn takes ~29.5 years to come back round.
    const gap = (r.hits[1].date.getTime() - r.hits[0].date.getTime()) / (365.25 * 864e5);
    expect(gap).toBeGreaterThan(27);
    expect(gap).toBeLessThan(31);
  });

  it('Jupiter return comes back about every 12 years', () => {
    const r = searchTransits(eph, natal, { kind: 'return', planet: 'Jupiter' }, { from: new Date('2026-01-01'), to: new Date('2050-01-01') });
    expect(r.hits.length).toBe(2);
    const gap = (r.hits[1].date.getTime() - r.hits[0].date.getTime()) / (365.25 * 864e5);
    expect(gap).toBeGreaterThan(11);
    expect(gap).toBeLessThan(13);
    expect(sep(eph.positions(r.hits[0].date).Jupiter.longitude, natal.planets.Jupiter.longitude)).toBeLessThan(0.01);
  });

  it("Saturn's 10th-house aspect sits 270 degrees ahead", () => {
    const r = searchTransits(eph, natal, { kind: 'aspect', planet: 'Saturn', target: 'Sun', aspect: 'special' }, { from: new Date('2026-01-01'), to: new Date('2060-01-01') });
    const tenth = r.hits.find((h) => h.title.includes('10th'))!;
    expect(sep(eph.positions(tenth.date).Saturn.longitude + 270, natal.planets.Sun.longitude)).toBeLessThan(0.01);
  });
});

describe('question parser', () => {
  const q = (s: string) => {
    const p = parseTransitQuestion(s);
    if (!p.ok) throw new Error(p.error);
    return p.parsed;
  };
  it('understands the common questions', () => {
    expect(q('When does Saturn next hit my Moon?').query).toEqual({ kind: 'aspect', planet: 'Saturn', target: 'Moon', aspect: 'conjunction' });
    expect(q('next jupiter return').query).toEqual({ kind: 'return', planet: 'Jupiter' });
    expect(q("When's my Saturn return?").query).toEqual({ kind: 'return', planet: 'Saturn' });
    expect(q('When does Mars enter Leo').query).toEqual({ kind: 'ingress', planet: 'Mars', sign: 4 });
    expect(q('Shani into Kumbha').query).toEqual({ kind: 'ingress', planet: 'Saturn', sign: 10 });
    expect(q('Next Mercury retrograde').query).toEqual({ kind: 'station', planet: 'Mercury', station: 'retrograde' });
    expect(q('When does Saturn go direct?').query).toEqual({ kind: 'station', planet: 'Saturn', station: 'direct' });
    expect(q('Saturn opposite my Sun').query).toEqual({ kind: 'aspect', planet: 'Saturn', target: 'Sun', aspect: 'opposition' });
    expect(q('When does Mars aspect my Lagna?').query).toEqual({ kind: 'aspect', planet: 'Mars', target: 'Ascendant', aspect: 'any' });
    expect(q('When does Saturn return to my Moon?').query).toEqual({ kind: 'aspect', planet: 'Saturn', target: 'Moon', aspect: 'conjunction' });
  });
  it('resolves houses and natal signs against the chart', () => {
    const house = resolveQuestion(q('When does Jupiter enter my 10th house?'), natal);
    expect(house.query).toEqual({ kind: 'ingress', planet: 'Jupiter', sign: (signOf(natal.ascendant) + 9) % 12 });
    const moonSign = resolveQuestion(q('When does Shani transit my Moon sign?'), natal);
    expect(moonSign.query).toEqual({ kind: 'ingress', planet: 'Saturn', sign: signOf(natal.planets.Moon.longitude) });
  });
  it('reads year limits', () => {
    const p = q('When does Rahu cross my Sun between 2027 and 2035?');
    expect(p.from!.getUTCFullYear()).toBe(2027);
    expect(p.to!.getUTCFullYear()).toBe(2036);
    expect(q('Jupiter enters Gemini in 2025').from!.getUTCFullYear()).toBe(2025);
  });
  it('explains what it could not understand', () => {
    expect(parseTransitQuestion('when will I get married').ok).toBe(false);
    const r = parseTransitQuestion('next Rahu retrograde');
    expect(r.ok).toBe(false);
  });
  it('answers end to end', () => {
    const a = answerTransitQuestion(eph, natal, 'Jupiter enters Gemini in 2025', { from: new Date('2020-01-01') });
    expect(a.ok && a.result.hits[0].title).toBe('Jupiter enters Gemini');
  });
});
