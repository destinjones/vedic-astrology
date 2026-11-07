import { beforeAll, describe, expect, it } from 'vitest';
import {
  createEngine,
  isBeforeGregorian,
  jdnToGregorian,
  julianCalendarToJdn,
  julianToGregorian,
  localToUtc,
  type Engine,
} from '../src/index';

let engine: Engine;
beforeAll(async () => { engine = await createEngine(); });

describe('Julian calendar', () => {
  it('anchors JDN 0 at Julian 1 January 4713 BC (astronomical year -4712)', () => {
    expect(julianCalendarToJdn(-4712, 1, 1)).toBe(0);
    expect(julianCalendarToJdn(2000, 1, 1) - 13).toBe(2451545); // Julian is 13 days behind in 2000
  });
  it('Julian 4 October 1582 is followed by Gregorian 15 October 1582', () => {
    expect(julianToGregorian('1582-10-04')).toBe('1582-10-14');
    expect(julianToGregorian('1582-10-05')).toBe('1582-10-15');
    expect(jdnToGregorian(2299161)).toEqual({ year: 1582, month: 10, day: 15 });
  });
  it('gives the published Gregorian dates of old births', () => {
    // Galileo, 15 February 1564 (Julian) = 25 February 1564 (Gregorian)
    expect(julianToGregorian('1564-02-15')).toBe('1564-02-25');
    // Julius Caesar's calendar reform year, 1 January 45 BC (astronomical -44)
    expect(julianToGregorian('-0044-01-01')).toBe('-0045-12-30');
  });
  it('reads dates before 1582-10-15 as Julian by default', () => {
    expect(isBeforeGregorian('1582-10-14')).toBe(true);
    expect(isBeforeGregorian('1582-10-15')).toBe(false);
    const auto = localToUtc('1564-02-15', '12:00', 'Europe/Rome', 60);
    expect(auto.calendar).toBe('julian');
    expect(auto.gregorianDate).toBe('1564-02-25');
    expect(auto.utc.toISOString()).toBe('1564-02-25T11:00:00.000Z');
    const greg = localToUtc('1564-02-15', '12:00', 'Europe/Rome', 60, undefined, 'gregorian');
    expect(greg.calendar).toBe('gregorian');
    expect(greg.utc.toISOString()).toBe('1564-02-15T11:00:00.000Z');
  });
  it('can read a later date as Julian (Britain before 1752)', () => {
    // Isaac Newton: 25 December 1642 (Julian) = 4 January 1643 (Gregorian)
    const r = localToUtc('1642-12-25', '01:38', 'Europe/London', -1, undefined, 'julian');
    expect(r.gregorianDate).toBe('1643-01-04');
  });
  it('a chart for a Julian date matches the same instant typed in Gregorian', () => {
    const place = { latitude: 43.7228, longitude: 10.4017, timezone: 'Europe/Rome' };
    const a = engine.computeChart({ date: '1564-02-15', time: '15:30', place, utcOffsetMinutes: 41 });
    const b = engine.computeChart({ date: '1564-02-25', time: '15:30', place, utcOffsetMinutes: 41, calendar: 'gregorian' });
    expect(a.meta.calendar).toBe('julian');
    expect(a.meta.gregorianDate).toBe('1564-02-25');
    expect(a.meta.utc).toBe(b.meta.utc);
    expect(a.planets.sun.longitude).toBeCloseTo(b.planets.sun.longitude, 9);
  });
});
