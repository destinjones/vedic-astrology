import { DateTime } from 'luxon';
import tzlookup from 'tz-lookup';

/** Julian Day (UT) of a JS Date. Pure math, no ephemeris needed. */
export const dateToJd = (d: Date) => d.getTime() / 86400000 + 2440587.5;
export const jdToDate = (jd: number) => new Date(Math.round((jd - 2440587.5) * 86400000));
export const jdToIso = (jd: number) => jdToDate(jd).toISOString();

/** IANA timezone for a coordinate (offline lookup) */
export function timezoneAt(latitude: number, longitude: number): string {
  return tzlookup(latitude, longitude);
}

export interface ResolvedTime {
  utc: Date;
  timezone: string;
  utcOffsetMinutes: number;
  /** The local time did not exist (spring-forward gap) and was shifted */
  shifted: boolean;
  /**
   * True when the zone's historical offset was a city mean time (not a multiple
   * of 15 min, i.e. before standard time) and the birthplace's own Local Mean
   * Time (longitude × 4 min) was used instead. Pass utcOffsetMinutes to override.
   */
  localMeanTime: boolean;
}

/**
 * Offsets that are not a whole multiple of 15 minutes are local mean times of
 * some reference city (e.g. Asia/Kolkata before 1906 uses Howrah/Madras mean
 * time). For a birth elsewhere, the birthplace's own mean time is closer to
 * what the clock read.
 */
const isMeanTimeOffset = (offsetMin: number) => Math.abs(offsetMin % 15) > 1e-6;

/**
 * Convert a local civil date/time at a place to UTC using the historical IANA
 * rules (including DST, war time and pre-standard LMT where the tz database
 * has it). A manual utcOffsetMinutes overrides the rules.
 */
export function localToUtc(
  date: string,
  time: string,
  timezone: string,
  utcOffsetMinutes?: number,
  /** Birthplace longitude (east +). Enables per-place LMT before standard time */
  placeLongitude?: number,
): ResolvedTime {
  const m = /^(-?\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(time.trim());
  if (!m) throw new Error(`Invalid date "${date}", expected YYYY-MM-DD`);
  if (!t) throw new Error(`Invalid time "${time}", expected HH:mm or HH:mm:ss`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [hour, minute] = [Number(t[1]), Number(t[2])];
  const secF = t[3] ? Number(t[3]) : 0;
  const second = Math.floor(secF);
  const millisecond = Math.round((secF - second) * 1000);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || secF >= 60)
    throw new Error(`Invalid date/time ${date} ${time}`);

  if (utcOffsetMinutes !== undefined) {
    const ms =
      Date.UTC(year, month - 1, day, hour, minute, second, millisecond) - utcOffsetMinutes * 60000;
    const utc = new Date(ms);
    if (year < 100) utc.setUTCFullYear(year, month - 1, day);
    return { utc, timezone, utcOffsetMinutes, shifted: false, localMeanTime: false };
  }
  const dt = DateTime.fromObject(
    { year, month, day, hour, minute, second, millisecond },
    { zone: timezone },
  );
  if (!dt.isValid) throw new Error(`Invalid date/time or zone: ${dt.invalidExplanation}`);
  const shifted = dt.hour !== hour || dt.minute !== minute;
  if (placeLongitude !== undefined && isMeanTimeOffset(dt.offset)) {
    const offset = placeLongitude * 4;
    const r = localToUtc(date, time, timezone, offset);
    return { ...r, localMeanTime: true };
  }
  return { utc: dt.toJSDate(), timezone, utcOffsetMinutes: dt.offset, shifted, localMeanTime: false };
}
