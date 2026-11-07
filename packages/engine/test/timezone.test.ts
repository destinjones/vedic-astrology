import { describe, expect, it } from 'vitest';
import { TZ_HISTORY, historyFor, localToUtc } from '../src/index';

const codes = (r: ReturnType<typeof localToUtc>) => r.warnings.map((w) => w.code);

describe('historical time zones', () => {
  it('a modern birth has no warnings', () => {
    expect(localToUtc('1990-07-04', '12:00', 'America/New_York', undefined, -74, 40.7).warnings).toEqual([]);
  });

  it('uses and explains LMT before standard time', () => {
    const r = localToUtc('1869-10-02', '07:11', 'Asia/Kolkata', undefined, 69.6293, 21.6417);
    expect(r.localMeanTime).toBe(true);
    expect(r.utcOffsetMinutes).toBeCloseTo(69.6293 * 4, 6);
    expect(codes(r)).toEqual(['lmt_applied']);
    expect(r.warnings[0].candidates?.map((c) => c.label)).toEqual(['Local Mean Time', 'Asia/Kolkata city time']);
  });

  it('flags a pre-1900 standard zone far from the birthplace meridian', () => {
    // Britain was on GMT from 1880; Penzance's own mean time is 22 minutes behind,
    // so only a much more westerly place crosses the 30-minute line.
    const near = localToUtc('1890-05-01', '12:00', 'Europe/London', undefined, -5.54, 50.12);
    expect(codes(near)).not.toContain('pre_1900_lmt_differs');
    const far = localToUtc('1890-05-01', '12:00', 'Europe/Dublin', undefined, -10.2, 51.9);
    // Dublin used Dublin Mean Time then, which the database already has as LMT-style
    expect(codes(far)).toContain('lmt_applied');
    const us = localToUtc('1895-05-01', '12:00', 'America/Chicago', undefined, -104.8, 41.1);
    expect(codes(us)).toContain('pre_1900_lmt_differs');
    expect(us.utcOffsetMinutes).toBe(-360); // the number is unchanged; it is only a warning
  });

  it('warns on Calcutta Time in Kolkata but not elsewhere in India', () => {
    const kol = localToUtc('1930-01-01', '12:00', 'Asia/Kolkata', undefined, 88.36, 22.57);
    expect(kol.warnings.find((w) => w.ref === 'calcutta-time')?.severity).toBe('warn');
    const del = localToUtc('1930-01-01', '12:00', 'Asia/Kolkata', undefined, 77.2, 28.6);
    expect(del.warnings.some((w) => w.ref === 'calcutta-time')).toBe(false);
    expect(codes(del)).toContain('pre_1970');
    const after = localToUtc('1950-01-01', '12:00', 'Asia/Kolkata', undefined, 88.36, 22.57);
    expect(after.warnings.some((w) => w.ref === 'calcutta-time')).toBe(false);
  });

  it('warns on wartime India', () => {
    const r = localToUtc('1943-03-01', '12:00', 'Asia/Kolkata', undefined, 77.2, 28.6);
    expect(r.warnings.map((w) => w.ref)).toContain('india-war-time');
  });

  it('flags spring-forward gaps and fall-back overlaps', () => {
    const gap = localToUtc('2021-03-14', '02:30', 'America/New_York', undefined, -74, 40.7);
    expect(gap.shifted).toBe(true);
    expect(codes(gap)).toEqual(['dst_gap']);
    const dup = localToUtc('2021-11-07', '01:30', 'America/New_York', undefined, -74, 40.7);
    expect(codes(dup)).toEqual(['dst_ambiguous']);
    expect(dup.warnings[0].candidates?.map((c) => c.utcOffsetMinutes)).toEqual([-240, -300]);
    expect(dup.warnings[0].message).toMatch(new RegExp(`The ${dup.utcOffsetMinutes === -240 ? 'first' : 'second'} one`));
  });

  it('a manual offset says so', () => {
    expect(codes(localToUtc('1929-01-15', '12:00', 'America/New_York', -360))).toEqual(['manual_offset']);
  });

  it('region entries need coordinates', () => {
    expect(historyFor('Asia/Kolkata', '1930-01-01').some((e) => e.id === 'calcutta-time')).toBe(false);
    expect(historyFor('Asia/Kolkata', '1930-01-01', 22.57, 88.36).some((e) => e.id === 'calcutta-time')).toBe(true);
  });

  it('every table entry is well formed', () => {
    const ids = new Set<string>();
    for (const e of TZ_HISTORY) {
      expect(ids.has(e.id), e.id).toBe(false);
      ids.add(e.id);
      expect(e.from < e.to, e.id).toBe(true);
      expect(e.source.length, e.id).toBeGreaterThan(10);
      for (const z of e.zones) expect(() => new Intl.DateTimeFormat('en', { timeZone: z }), z).not.toThrow();
      if (e.region) expect(e.region[0] < e.region[2] && e.region[1] < e.region[3], e.id).toBe(true);
    }
  });
});
