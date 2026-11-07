/**
 * ChartRequest: the serialisable, versioned description of "which chart".
 *
 * Share links, the compare page, saved profiles and backups all carry one of
 * these. Links live for years in chats and bookmarks, so the wire format is
 * versioned and every old version keeps parsing:
 *
 *  - Every encoded payload starts with `v=<CHART_REQUEST_VERSION>`.
 *  - A payload with no `v` is version 0, the format shipped before versioning.
 *  - Decoding reads the version, runs each migration in MIGRATIONS from that
 *    version up to the current one, then validates. A payload from a newer app
 *    is refused with reason 'too_new' instead of being half-read.
 *
 * To change the format: bump CHART_REQUEST_VERSION, add a MIGRATIONS entry that
 * turns the previous version's params into the new ones, and add a frozen
 * example of the old payload to test/fixtures/share-links.json. Never edit or
 * delete an existing fixture: they are the links already out in the wild.
 *
 * This module has no ephemeris dependency, so a UI can import it from
 * '@vedic/engine/request' without loading the WASM.
 */
import { DEFAULT_AYANAMSA, isAyanamsaId } from './ayanamsa';
import type { AyanamsaId, BirthInput, ChartOptions } from './types';

/** The version `encodeChartRequest` writes. */
export const CHART_REQUEST_VERSION = 1 as const;

export interface ChartRequestPlace {
  /** Display name, e.g. "Chennai, India" */
  name?: string;
  /** Degrees, north positive */
  latitude: number;
  /** Degrees, east positive */
  longitude: number;
  /** IANA zone, e.g. "Asia/Kolkata" */
  timezone: string;
}

export interface ChartRequest {
  /** Format version. Always CHART_REQUEST_VERSION once decoded. */
  v: typeof CHART_REQUEST_VERSION;
  name?: string;
  /** Local civil date at the birthplace, "YYYY-MM-DD" (a leading "-" for BCE years) */
  date: string;
  /** Local civil time, "HH:mm" or "HH:mm:ss" */
  time: string;
  place: ChartRequestPlace;
  /** Manual UTC offset in minutes that overrides the zone's rules (war time, LMT) */
  utcOffsetMinutes?: number;
  ayanamsa: AyanamsaId;
}

export type DecodeFailure = 'not_a_chart' | 'too_new' | 'invalid';

export type DecodeResult =
  | {
      ok: true;
      request: ChartRequest;
      /** The version the payload was written in (0 = before versioning) */
      fromVersion: number;
      /** Non-fatal problems, e.g. an unknown ayanamsa replaced by the default */
      warnings: string[];
    }
  | { ok: false; reason: DecodeFailure; message: string; fromVersion?: number };

/** Raw string params, as read from a URL fragment. */
type Params = Record<string, string>;

/**
 * MIGRATIONS[n] turns a version-n payload into a version n+1 payload.
 * Each one is a pure function on the raw params, so it is easy to test alone.
 */
export const MIGRATIONS: Readonly<Record<number, (p: Params) => Params>> = Object.freeze({
  // v0 (unversioned): n d t p lat lon tz ay. The manual UTC offset was not carried.
  // v1 adds the explicit version and the optional `off` (minutes east of UTC).
  0: (p: Params): Params => ({ ...p, v: '1' }),
});

/* ------------------------------------------------------------ limits */

const MAX_NAME = 80;
const MAX_PLACE = 200;
const MAX_TZ = 64;
/** Earth's offsets run from -12:00 to +14:00; LMT can reach a little past. */
const MAX_OFFSET_MIN = 16 * 60;
/** Geographic coordinates keep 5 decimals (about a metre). */
const COORD_DECIMALS = 5;

const DATE_RE = /^-?\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

const isTimeZone = (tz: string): boolean => {
  if (!tz || tz.length > MAX_TZ) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const roundCoord = (x: number) => {
  const f = 10 ** COORD_DECIMALS;
  const r = Math.round(x * f) / f;
  return r === 0 ? 0 : r;
};

const validDate = (d: string): boolean => {
  if (!DATE_RE.test(d)) return false;
  const [, mo, da] = /(\d{2})-(\d{2})$/.exec(d)!;
  return +mo >= 1 && +mo <= 12 && +da >= 1 && +da <= 31;
};

const validTime = (t: string): boolean => {
  if (!TIME_RE.test(t)) return false;
  const [h, m, s = '0'] = t.split(':');
  return +h <= 23 && +m <= 59 && +s <= 59;
};

/* ------------------------------------------------------------ validation */

/**
 * Checks a ChartRequest-shaped object and returns a clean copy, or a list of
 * problems. Used by both the URL and the JSON decoders.
 */
export function validateChartRequest(raw: {
  name?: unknown;
  date?: unknown;
  time?: unknown;
  place?: { name?: unknown; latitude?: unknown; longitude?: unknown; timezone?: unknown };
  utcOffsetMinutes?: unknown;
  ayanamsa?: unknown;
}): { request: ChartRequest; warnings: string[] } | { errors: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const num = (v: unknown) =>
    typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;

  const date = str(raw.date);
  const time = str(raw.time);
  const latitude = num(raw.place?.latitude);
  const longitude = num(raw.place?.longitude);
  const timezone = str(raw.place?.timezone);
  if (!validDate(date)) errors.push(`date ${JSON.stringify(date)} is not YYYY-MM-DD`);
  if (!validTime(time)) errors.push(`time ${JSON.stringify(time)} is not HH:mm or HH:mm:ss`);
  if (!(Number.isFinite(latitude) && Math.abs(latitude) <= 90)) errors.push('latitude must be between -90 and 90');
  if (!(Number.isFinite(longitude) && Math.abs(longitude) <= 180)) errors.push('longitude must be between -180 and 180');
  if (!isTimeZone(timezone)) errors.push(`timezone ${JSON.stringify(timezone)} is not a known IANA zone`);

  let utcOffsetMinutes: number | undefined;
  if (raw.utcOffsetMinutes !== undefined && raw.utcOffsetMinutes !== '' && raw.utcOffsetMinutes !== null) {
    const off = num(raw.utcOffsetMinutes);
    if (Number.isFinite(off) && Math.abs(off) <= MAX_OFFSET_MIN) utcOffsetMinutes = off;
    else errors.push(`utc offset ${JSON.stringify(raw.utcOffsetMinutes)} is out of range`);
  }

  let ayanamsa: AyanamsaId = DEFAULT_AYANAMSA;
  const ay = str(raw.ayanamsa).toLowerCase();
  if (ay) {
    if (isAyanamsaId(ay)) ayanamsa = ay;
    else warnings.push(`unknown ayanamsa ${JSON.stringify(ay)}, using ${DEFAULT_AYANAMSA}`);
  }

  if (errors.length) return { errors };
  const name = str(raw.name).slice(0, MAX_NAME);
  const placeName = str(raw.place?.name).slice(0, MAX_PLACE);
  const request: ChartRequest = {
    v: CHART_REQUEST_VERSION,
    ...(name ? { name } : {}),
    date,
    time,
    place: {
      ...(placeName ? { name: placeName } : {}),
      latitude: roundCoord(latitude),
      longitude: roundCoord(longitude),
      timezone,
    },
    ...(utcOffsetMinutes !== undefined ? { utcOffsetMinutes } : {}),
    ayanamsa,
  };
  return { request, warnings };
}

/* ------------------------------------------------------------ URL codec */

/**
 * Encodes as readable URL params, version first:
 * `v=1&n=Asha&d=1990-08-15&t=06:30&p=New+Delhi&lat=28.6139&lon=77.209&tz=Asia%2FKolkata`
 * The default ayanamsa and an absent offset are left out to keep links short.
 */
export function encodeChartRequest(req: ChartRequest, opts: { includeName?: boolean } = {}): string {
  const q = new URLSearchParams();
  q.set('v', String(CHART_REQUEST_VERSION));
  if ((opts.includeName ?? true) && req.name?.trim()) q.set('n', req.name.trim());
  q.set('d', req.date);
  q.set('t', req.time);
  if (req.place.name) q.set('p', req.place.name);
  q.set('lat', String(roundCoord(req.place.latitude)));
  q.set('lon', String(roundCoord(req.place.longitude)));
  q.set('tz', req.place.timezone);
  if (req.utcOffsetMinutes !== undefined) q.set('off', String(req.utcOffsetMinutes));
  if (req.ayanamsa !== DEFAULT_AYANAMSA) q.set('ay', req.ayanamsa);
  return q.toString();
}

const toParams = (input: string | URLSearchParams): Params => {
  const q = typeof input === 'string' ? new URLSearchParams(input.replace(/^[#?]/, '')) : input;
  const p: Params = Object.create(null);
  // first value wins, like URLSearchParams.get
  q.forEach((v, k) => {
    if (!Object.prototype.hasOwnProperty.call(p, k)) p[k] = v;
  });
  return p;
};

/** Reads the version of a raw payload: 0 when absent, NaN when malformed. */
const versionOf = (p: Params): number => {
  if (p.v === undefined) return 0;
  return /^\d{1,4}$/.test(p.v) ? Number(p.v) : NaN;
};

/**
 * Decodes a URL fragment, query string or URLSearchParams. A fragment that is
 * not a chart at all (#sample, #famous=x) gives reason 'not_a_chart', so a
 * caller can fall through to its other hash routes.
 */
export function decodeChartRequest(input: string | URLSearchParams): DecodeResult {
  let p = toParams(input);
  const fromVersion = versionOf(p);
  if (p.v === undefined && (p.d === undefined || p.t === undefined))
    return { ok: false, reason: 'not_a_chart', message: 'no chart in this link' };
  if (!Number.isFinite(fromVersion))
    return { ok: false, reason: 'invalid', message: `bad version ${JSON.stringify(p.v)}` };
  if (fromVersion > CHART_REQUEST_VERSION)
    return {
      ok: false,
      reason: 'too_new',
      fromVersion,
      message: `this link was made by a newer version (format ${fromVersion}); this app reads up to ${CHART_REQUEST_VERSION}`,
    };
  for (let v = fromVersion; v < CHART_REQUEST_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) return { ok: false, reason: 'invalid', fromVersion, message: `no migration from format ${v}` };
    p = step(p);
  }
  const r = validateChartRequest({
    name: p.n,
    date: p.d,
    time: p.t,
    place: { name: p.p, latitude: p.lat, longitude: p.lon, timezone: p.tz },
    utcOffsetMinutes: p.off,
    ayanamsa: p.ay,
  });
  if ('errors' in r) return { ok: false, reason: 'invalid', fromVersion, message: r.errors.join('; ') };
  return { ok: true, request: r.request, fromVersion, warnings: r.warnings };
}

/* ------------------------------------------------------------ JSON codec */

/** A plain object for JSON files and storage; same shape as ChartRequest. */
export const chartRequestToJson = (req: ChartRequest): ChartRequest => JSON.parse(JSON.stringify(req));

/**
 * Reads a ChartRequest from parsed JSON. Objects without `v` are treated as
 * version 0, whose shape is the same as version 1 minus `v`.
 */
export function chartRequestFromJson(data: unknown): DecodeResult {
  if (!data || typeof data !== 'object') return { ok: false, reason: 'not_a_chart', message: 'not an object' };
  const o = data as Record<string, unknown>;
  const fromVersion = o.v === undefined ? 0 : typeof o.v === 'number' && Number.isInteger(o.v) && o.v >= 0 ? o.v : NaN;
  if (!Number.isFinite(fromVersion)) return { ok: false, reason: 'invalid', message: `bad version ${JSON.stringify(o.v)}` };
  if (fromVersion > CHART_REQUEST_VERSION)
    return { ok: false, reason: 'too_new', fromVersion, message: `format ${fromVersion} is newer than ${CHART_REQUEST_VERSION}` };
  const place = (o.place && typeof o.place === 'object' ? o.place : {}) as Record<string, unknown>;
  const r = validateChartRequest({ ...o, place });
  if ('errors' in r) return { ok: false, reason: 'invalid', fromVersion, message: r.errors.join('; ') };
  return { ok: true, request: r.request, fromVersion, warnings: r.warnings };
}

/* ------------------------------------------------------------ engine bridge */

/** The engine's computeChart arguments for a request. */
export function chartRequestToEngine(req: ChartRequest): { input: BirthInput; options: Pick<ChartOptions, 'ayanamsa'> } {
  return {
    input: {
      date: req.date,
      time: req.time,
      ...(req.name ? { name: req.name } : {}),
      place: { ...req.place },
      ...(req.utcOffsetMinutes !== undefined ? { utcOffsetMinutes: req.utcOffsetMinutes } : {}),
    },
    options: { ayanamsa: req.ayanamsa },
  };
}
