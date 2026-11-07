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

/**
 * Calendar of the typed date. 'auto' (the default) reads dates before
 * 15 October 1582, the first day of the Gregorian calendar, as Julian, the way
 * historical records and Astro-Databank give them. Countries switched later
 * (Britain and its colonies on 14 September 1752, Russia in 1918), so a date
 * from such a place between 1582 and the switch needs 'julian' set by hand.
 */
export type CalendarSystem = 'auto' | 'gregorian' | 'julian';

/** First day of the Gregorian calendar (the day after Julian 4 October 1582). */
export const GREGORIAN_START = '1582-10-15';

const fdiv = (a: number, b: number) => Math.floor(a / b);
const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, '0');
const ymd = (y: number, m: number, d: number) => `${y < 0 ? '-' : ''}${pad(y, 4)}-${pad(m)}-${pad(d)}`;

/** Julian day number (noon) of a date in the Julian calendar. Astronomical years (1 BC = 0). */
export function julianCalendarToJdn(year: number, month: number, day: number): number {
  const a = fdiv(14 - month, 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + fdiv(153 * m + 2, 5) + 365 * y + fdiv(y, 4) - 32083;
}

/** Proleptic Gregorian date of a Julian day number. */
export function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = fdiv(4 * a + 3, 146097);
  const c = a - fdiv(146097 * b, 4);
  const d = fdiv(4 * c + 3, 1461);
  const e = c - fdiv(1461 * d, 4);
  const m = fdiv(5 * e + 2, 153);
  return { day: e - fdiv(153 * m + 2, 5) + 1, month: m + 3 - 12 * fdiv(m, 10), year: 100 * b + d - 4800 + fdiv(m, 10) };
}

/** "YYYY-MM-DD" in the Julian calendar to the same day in the (proleptic) Gregorian calendar. */
export function julianToGregorian(date: string): string {
  const m = /^(-?\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(date.trim());
  if (!m) throw new Error(`Invalid date "${date}", expected YYYY-MM-DD`);
  const g = jdnToGregorian(julianCalendarToJdn(Number(m[1]), Number(m[2]), Number(m[3])));
  return ymd(g.year, g.month, g.day);
}

/** True when a date string sorts before 1582-10-15 (handles negative years). */
export function isBeforeGregorian(date: string): boolean {
  const m = /^(-?\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(date.trim());
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return y < 1582 || (y === 1582 && (mo < 10 || (mo === 10 && d < 15)));
}

/** Which calendar a typed date is read in. */
export const resolveCalendar = (date: string, calendar: CalendarSystem = 'auto'): 'gregorian' | 'julian' =>
  calendar === 'auto' ? (isBeforeGregorian(date) ? 'julian' : 'gregorian') : calendar;

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
  /** Calendar the typed date was read in */
  calendar: 'gregorian' | 'julian';
  /** The birth date in the proleptic Gregorian calendar, "YYYY-MM-DD" */
  gregorianDate: string;
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
  /** Calendar of `date`; 'auto' reads dates before 1582-10-15 as Julian */
  calendar: CalendarSystem = 'auto',
): ResolvedTime {
  const cal = resolveCalendar(date, calendar);
  if (cal === 'julian') {
    const r = localToUtc(julianToGregorian(date), time, timezone, utcOffsetMinutes, placeLongitude, 'gregorian');
    return { ...r, calendar: 'julian' };
  }
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
    return { utc, timezone, utcOffsetMinutes, shifted: false, localMeanTime: false, calendar: 'gregorian', gregorianDate: date.trim() };
  }
  const dt = DateTime.fromObject(
    { year, month, day, hour, minute, second, millisecond },
    { zone: timezone },
  );
  if (!dt.isValid) throw new Error(`Invalid date/time or zone: ${dt.invalidExplanation}`);
  const shifted = dt.hour !== hour || dt.minute !== minute;
  if (placeLongitude !== undefined && isMeanTimeOffset(dt.offset)) {
    const offset = placeLongitude * 4;
    const r = localToUtc(date, time, timezone, offset, undefined, 'gregorian');
    return { ...r, localMeanTime: true };
  }
  return { utc: dt.toJSDate(), timezone, utcOffsetMinutes: dt.offset, shifted, localMeanTime: false, calendar: 'gregorian', gregorianDate: date.trim() };
}
