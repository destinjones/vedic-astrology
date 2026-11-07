/**
 * Where the IANA time zone database and the clock on the wall can disagree.
 *
 * The tz database is very good, but it records the rules of each zone's main
 * city, and before 1970 it is only promised to be right there. A birth in 1930
 * Calcutta, wartime London or pre-partition Dhaka can be an hour or more off
 * if the rules are taken on trust, which moves the ascendant by a whole sign.
 *
 * `TZ_HISTORY` lists the known cases. `localToUtc` checks it and returns any
 * match as a `TimeWarning`, so the UI can ask the person to confirm the offset
 * (and set `utcOffsetMinutes` when the birth certificate says otherwise).
 *
 * Add an entry when you find a case: give a source in `source`, keep the
 * region box tight, and add a test in test/timezone.test.ts.
 */

export type TimeWarningCode =
  /** Birthplace Local Mean Time was used because the zone had no standard time yet */
  | 'lmt_applied'
  /** Before 1900 the zone already had a standard time, but the place's own LMT is far from it */
  | 'pre_1900_lmt_differs'
  /** The local time did not exist (spring-forward gap) and was moved */
  | 'dst_gap'
  /** The local time happened twice (fall-back overlap); the earlier one was used */
  | 'dst_ambiguous'
  /** A known case in TZ_HISTORY where civil practice differed from the database */
  | 'zone_era'
  /** Before 1970 the tz database only promises accuracy for the zone's main city */
  | 'pre_1970'
  /** A manual offset was given; zone rules were not used */
  | 'manual_offset';

export interface TimeWarning {
  code: TimeWarningCode;
  /** 'warn' may change the chart; 'info' is context worth showing on request */
  severity: 'warn' | 'info';
  message: string;
  /** Offsets, in minutes east of UTC, that the person may want to choose between */
  candidates?: { label: string; utcOffsetMinutes: number }[];
  /** TZ_HISTORY entry id, for 'zone_era' */
  ref?: string;
}

export interface TzHistoryEntry {
  id: string;
  /** IANA zones the entry applies to */
  zones: string[];
  /** Local date range, inclusive start, exclusive end, "YYYY-MM-DD" */
  from: string;
  to: string;
  /** Optional lat/lon box [south, west, north, east]; the whole zone when absent */
  region?: [number, number, number, number];
  severity: 'warn' | 'info';
  message: string;
  candidates?: { label: string; utcOffsetMinutes: number }[];
  source: string;
}

const hm = (h: number, m: number, s = 0) => h * 60 + m + s / 60;

export const TZ_HISTORY: readonly TzHistoryEntry[] = Object.freeze([
  {
    id: 'calcutta-time',
    zones: ['Asia/Kolkata', 'Asia/Calcutta'],
    from: '1906-01-01',
    to: '1948-09-01',
    region: [21.0, 86.0, 27.5, 90.5],
    severity: 'warn',
    message:
      'Calcutta kept its own Calcutta Time (UTC+5:53:20) for civil use until 1948, while the time zone database uses IST (UTC+5:30) from 1906. Check which one the birth record used.',
    candidates: [
      { label: 'Calcutta Time', utcOffsetMinutes: hm(5, 53, 20) },
      { label: 'IST', utcOffsetMinutes: hm(5, 30) },
    ],
    source: 'Time zone database asia file, Asia/Kolkata comments',
  },
  {
    id: 'bombay-time',
    zones: ['Asia/Kolkata', 'Asia/Calcutta'],
    from: '1906-01-01',
    to: '1955-01-01',
    region: [17.5, 72.0, 20.5, 74.5],
    severity: 'warn',
    message:
      'Bombay kept Bombay Time (UTC+4:51) for local use until about 1955, while the time zone database uses IST (UTC+5:30). Check which one the birth record used.',
    candidates: [
      { label: 'Bombay Time', utcOffsetMinutes: hm(4, 51) },
      { label: 'IST', utcOffsetMinutes: hm(5, 30) },
    ],
    source: 'Time zone database asia file, Asia/Kolkata comments',
  },
  {
    id: 'india-war-time',
    zones: ['Asia/Kolkata', 'Asia/Calcutta', 'Asia/Karachi', 'Asia/Dhaka'],
    from: '1941-10-01',
    to: '1945-10-15',
    severity: 'warn',
    message:
      'Wartime India advanced its clocks (UTC+6:30) for parts of 1941–1945, and the dates varied by region. Confirm the offset from the birth record.',
    candidates: [
      { label: 'War time', utcOffsetMinutes: hm(6, 30) },
      { label: 'IST', utcOffsetMinutes: hm(5, 30) },
    ],
    source: 'Time zone database asia file, Asia/Kolkata war-time rules',
  },
  {
    id: 'pre-partition',
    zones: ['Asia/Karachi', 'Asia/Dhaka'],
    from: '1800-01-01',
    to: '1947-08-15',
    severity: 'info',
    message:
      'Before partition in 1947 this area was part of British India, and its clocks followed Indian time rules and local city times. The modern zone history here is reconstructed.',
    source: 'Time zone database asia file, Asia/Karachi and Asia/Dhaka comments',
  },
  {
    id: 'uk-double-summer',
    zones: ['Europe/London', 'Europe/Belfast', 'Europe/Guernsey', 'Europe/Jersey', 'Europe/Isle_of_Man'],
    from: '1941-04-01',
    to: '1947-11-03',
    severity: 'info',
    message:
      'Britain used British Double Summer Time (UTC+2) in parts of 1941–1945 and 1947, and summer time through the winters of 1940–1945. The database applies this; many older programs do not.',
    source: 'Time zone database europe file, GB-Eire rules',
  },
  {
    id: 'us-war-time',
    zones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix'],
    from: '1942-02-09',
    to: '1945-09-30',
    severity: 'info',
    message: 'The United States kept year-round War Time (one hour ahead) from February 1942 to September 1945.',
    source: 'Time zone database northamerica file, US rules',
  },
  {
    id: 'us-local-dst',
    zones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Detroit'],
    from: '1945-10-01',
    to: '1967-01-01',
    severity: 'warn',
    message:
      'Between 1945 and 1966 daylight saving time in the US was a local choice: neighbouring towns could be an hour apart. The database follows the zone’s main city. Check the birth record if the birth was elsewhere.',
    source: 'Time zone database northamerica file, comments on pre-1967 local DST',
  },
  {
    id: 'china-single-zone',
    zones: ['Asia/Shanghai'],
    from: '1949-10-01',
    to: '2100-01-01',
    region: [25.0, 73.0, 50.0, 98.0],
    severity: 'info',
    message:
      'China has used Beijing time officially since 1949, but in the far west local time (about UTC+6) is common in daily life. Check which one the birth time was recorded in.',
    candidates: [
      { label: 'Beijing time', utcOffsetMinutes: hm(8, 0) },
      { label: 'Xinjiang time', utcOffsetMinutes: hm(6, 0) },
    ],
    source: 'Time zone database asia file, Asia/Shanghai and Asia/Urumqi comments',
  },
]);

const inRegion = (r: TzHistoryEntry['region'], lat?: number, lon?: number) =>
  !r || (lat !== undefined && lon !== undefined && lat >= r[0] && lat <= r[2] && lon >= r[1] && lon <= r[3]);

/**
 * TZ_HISTORY entries matching a zone, a local date ("YYYY-MM-DD") and a place.
 * Entries with a region only match when the coordinates are given.
 */
export function historyFor(zone: string, localDate: string, latitude?: number, longitude?: number): TzHistoryEntry[] {
  const d = localDate.padStart(10, '0');
  return TZ_HISTORY.filter(
    (e) =>
      e.zones.includes(zone) &&
      d >= e.from &&
      d < e.to &&
      inRegion(e.region, latitude, longitude),
  );
}

/** The birthplace's own Local Mean Time offset: 4 minutes per degree east. */
export const lmtOffsetMinutes = (longitude: number) => longitude * 4;
