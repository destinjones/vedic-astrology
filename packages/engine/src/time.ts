import { DateTime } from 'luxon';
import tzlookup from 'tz-lookup';
import { historyFor, lmtOffsetMinutes, type TimeWarning } from './timezoneHistory';

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
  /**
   * Everything about this birth time worth a second look: LMT used, a DST gap or
   * overlap, or a period where civil practice differed from the tz database
   * (see TZ_HISTORY). Empty for an ordinary modern birth.
   */
  warnings: TimeWarning[];
}

const fmtOffset = (min: number) => {
  const sign = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = Math.floor(a % 60);
  const s = Math.round((a * 60) % 60);
  return `UTC${sign}${h}:${String(m).padStart(2, '0')}${s ? ':' + String(s).padStart(2, '0') : ''}`;
};

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
  /** Birthplace latitude. Narrows TZ_HISTORY matches to their region */
  placeLatitude?: number,
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
    const warnings: TimeWarning[] = [
      { code: 'manual_offset', severity: 'info', message: `A fixed offset of ${fmtOffset(utcOffsetMinutes)} was used instead of the zone rules.` },
    ];
    return { utc, timezone, utcOffsetMinutes, shifted: false, localMeanTime: false, warnings };
  }
  const dt = DateTime.fromObject(
    { year, month, day, hour, minute, second, millisecond },
    { zone: timezone },
  );
  if (!dt.isValid) throw new Error(`Invalid date/time or zone: ${dt.invalidExplanation}`);
  const shifted = dt.hour !== hour || dt.minute !== minute;
  const warnings: TimeWarning[] = [];
  const lmt = placeLongitude !== undefined ? lmtOffsetMinutes(placeLongitude) : undefined;

  // Before standard time: the zone's offset is some city's mean time, so use the birthplace's own.
  if (lmt !== undefined && isMeanTimeOffset(dt.offset)) {
    const r = localToUtc(date, time, timezone, lmt);
    warnings.push({
      code: 'lmt_applied',
      severity: 'info',
      message: `The birth predates standard time in ${timezone}, so the birthplace's Local Mean Time (${fmtOffset(lmt)}) was used.`,
      candidates: [
        { label: 'Local Mean Time', utcOffsetMinutes: lmt },
        { label: `${timezone} city time`, utcOffsetMinutes: dt.offset },
      ],
    });
    return { ...r, localMeanTime: true, warnings };
  }

  if (shifted)
    warnings.push({
      code: 'dst_gap',
      severity: 'warn',
      message: `${time} did not exist on ${date} in ${timezone} (clocks went forward); it was read as ${dt.toFormat('HH:mm')}.`,
    });
  else {
    // An overlap: the same wall time also exists one hour later under the other offset.
    const wall = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
    const other = [dt.offset + 60, dt.offset - 60].find(
      (o) => DateTime.fromMillis(wall - o * 60000, { zone: timezone }).offset === o,
    );
    if (other !== undefined) {
      // the larger offset is the earlier instant (before the clocks went back)
      const [first, second] = dt.offset > other ? [dt.offset, other] : [other, dt.offset];
      const which = dt.offset === first ? 'first' : 'second';
      warnings.push({
        code: 'dst_ambiguous',
        severity: 'warn',
        message: `${time} happened twice on ${date} in ${timezone} (clocks went back). The ${which} one (${fmtOffset(dt.offset)}) was used.`,
        candidates: [
          { label: 'First', utcOffsetMinutes: first },
          { label: 'Second', utcOffsetMinutes: second },
        ],
      });
    }
  }

  // Before 1900 a zone could already be on a standard time that the birthplace's clocks never used.
  if (lmt !== undefined && year < 1900 && Math.abs(lmt - dt.offset) > 30)
    warnings.push({
      code: 'pre_1900_lmt_differs',
      severity: 'warn',
      message: `Before 1900 many towns still kept their own Local Mean Time (${fmtOffset(lmt)}), which differs from the zone's ${fmtOffset(dt.offset)} by ${Math.round(Math.abs(lmt - dt.offset))} minutes. The zone time was used; choose LMT if the town kept its own time.`,
      candidates: [
        { label: 'Zone time', utcOffsetMinutes: dt.offset },
        { label: 'Local Mean Time', utcOffsetMinutes: lmt },
      ],
    });

  const lat = placeLatitude;
  for (const e of historyFor(timezone, date, lat, placeLongitude))
    warnings.push({ code: 'zone_era', severity: e.severity, message: e.message, candidates: e.candidates, ref: e.id });

  if (year < 1970 && !warnings.some((w) => w.code === 'zone_era'))
    warnings.push({
      code: 'pre_1970',
      severity: 'info',
      message: `Before 1970 the time zone database is only sure of ${timezone}'s main city. Offset used: ${fmtOffset(dt.offset)}.`,
    });

  return { utc: dt.toJSDate(), timezone, utcOffsetMinutes: dt.offset, shifted, localMeanTime: false, warnings };
}
