/**
 * Moving birth data in and out: CSV and JSON export of saved charts, a bulk
 * paste mode (one chart per line), and importers for the formats other
 * programs and sites give out:
 *
 *  - CSV with a header row (this app's own export, or a spreadsheet)
 *  - AAF, the Astrological Exchange Format (#A93 / #B93 record pairs), which
 *    Astrodienst (astro.com), Astrolog and many desktop programs read and write
 *  - Text copied from an Astro-Databank or astro.com chart page
 *    ("born on 2 October 1869 at 07:12 … Porbandar, India, 21n38, 69e36 … Rodden Rating AA")
 *  - Jagannatha Hora .jhd files (month, day, year, time as H.MMSS, then the
 *    zone, longitude and latitude in D.MM with east and the zone ahead of UTC negative)
 *  - Astrolog chart info files (.as, and .chtk before Astrolog 6): an @AI header,
 *    then /qb month day year time daylight zone longitude latitude, and /zi name place.
 *    Astrolog's zone is hours WEST of Greenwich, so +8:00 is UTC−8.
 *  - Astro-Databank XML (adb_entry records, as astro.com exports them)
 *  - iCalendar (.ics) events: DTSTART is the birth moment, SUMMARY the name,
 *    LOCATION the place and GEO the coordinates
 *
 * Every parser returns drafts; nothing is saved until the person confirms.
 */
import { julianCalendarToJdn, timezoneAt } from '@vedic/engine/time';
import type { BirthInput, RoddenRating, TimeConfidence } from '../types/chart';
import { sanitizeInput, type Profile } from './profiles';
import { RODDEN_RATINGS } from './birthQuality';

export interface ImportDraft {
  /** the line or record it came from, for the preview */
  source: string;
  input?: BirthInput;
  /** why this one could not be read */
  error?: string;
  /** a place name that still needs coordinates (bulk paste) */
  needsPlace?: string;
  /** something the person should know about this record, shown in the preview */
  note?: string;
}

export type PlaceResolver = (query: string) => Promise<{ name: string; latitude: number; longitude: number; timezone: string } | null>;

/* ---------- export ---------- */

const CSV_COLUMNS = ['label', 'name', 'date', 'time', 'place', 'latitude', 'longitude', 'timezone', 'utc_offset_minutes', 'calendar', 'ayanamsa', 'rodden', 'time_confidence'] as const;

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  // a leading = + - @ makes spreadsheets run the cell as a formula
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function profilesToCsv(list: Profile[]): string {
  const rows = list.map((p) => {
    const i = p.input;
    return [p.label, i.name ?? '', i.date, i.time, i.place, i.latitude, i.longitude, i.timezone, i.utcOffsetMinutes ?? '', i.calendar ?? '', i.ayanamsa, i.rodden ?? '', i.timeConfidence ?? ''];
  });
  return [CSV_COLUMNS.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n') + '\r\n';
}

/** Plain JSON: an array of birth records, the easiest shape for other tools to read. */
export function profilesToJson(list: Profile[]): string {
  return JSON.stringify(list.map((p) => ({ label: p.label, ...p.input })), null, 2);
}

/** AAF records (#A93 then #B93), readable by astro.com, Astrolog and most desktop software. */
export function profilesToAaf(list: Profile[]): string {
  const dm = (v: number, pos: string, neg: string) => {
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = Math.round((a - d) * 60);
    return `${m === 60 ? d + 1 : d}${v < 0 ? neg : pos}${String(m === 60 ? 0 : m).padStart(2, '0')}`;
  };
  return list.map((p) => {
    const i = p.input;
    const [y, mo, d] = i.date.split('-');
    const [first, ...rest] = (i.name || p.label).split(' ');
    const last = rest.join(' ') || '*';
    const place = i.place.split(',')[0].replace(/[,]/g, ' ').trim();
    const lines = [`#A93:${last},${first || '*'},*,${Number(d)}.${Number(mo)}.${y},${i.time.slice(0, 5)},${place},*`];
    lines.push(`#B93:*,${dm(i.latitude, 'n', 's')},${dm(i.longitude, 'e', 'w')},*,0`);
    return lines.join('\n');
  }).join('\n') + '\n';
}

/* ---------- small parsing helpers ---------- */

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const pad2 = (n: number) => String(n).padStart(2, '0');
const isoDate = (y: number, m: number, d: number) => `${y < 0 ? '-' : ''}${String(Math.abs(y)).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`;

/** "28n36" / "77e13" / "0w10" / "21N38'15" → signed decimal degrees */
export function parseDegMin(s: string): number | null {
  const m = /^\s*(\d{1,3})\s*°?\s*([nsewNSEW])\s*(\d{1,2})(?:['′:]?\s*(\d{1,2}(?:\.\d+)?))?/.exec(s);
  if (!m) return null;
  const v = Number(m[1]) + Number(m[3]) / 60 + (m[4] ? Number(m[4]) / 3600 : 0);
  return /[swSW]/.test(m[2]) ? -v : v;
}

/** Splits one CSV line, honouring quotes. */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const safeZone = (lat: number, lon: number) => { try { return timezoneAt(lat, lon); } catch { return 'UTC'; } };

function finish(source: string, raw: Record<string, unknown>): ImportDraft {
  const lat = Number(raw.latitude);
  const lon = Number(raw.longitude);
  if (raw.timezone === undefined || raw.timezone === '') {
    if (Number.isFinite(lat) && Number.isFinite(lon)) raw.timezone = safeZone(lat, lon);
  }
  const input = sanitizeInput({ ayanamsa: 'lahiri', ...raw });
  return input ? { source, input } : { source, error: 'Missing or invalid date, time or coordinates' };
}

/* ---------- CSV with a header ---------- */

const HEADER_ALIASES: Record<string, string> = {
  label: 'label', name: 'name', date: 'date', birth_date: 'date', time: 'time', birth_time: 'time', place: 'place', city: 'place',
  latitude: 'latitude', lat: 'latitude', longitude: 'longitude', lon: 'longitude', lng: 'longitude', long: 'longitude',
  timezone: 'timezone', tz: 'timezone', zone: 'timezone', utc_offset_minutes: 'utcOffsetMinutes', calendar: 'calendar',
  ayanamsa: 'ayanamsa', rodden: 'rodden', rodden_rating: 'rodden', time_confidence: 'timeConfidence',
};

export function parseCsv(text: string): ImportDraft[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const head = splitCsv(lines[0]).map((h) => HEADER_ALIASES[h.toLowerCase().replace(/[\s-]+/g, '_')] ?? '');
  return lines.slice(1).map((line) => {
    const cells = splitCsv(line);
    const raw: Record<string, unknown> = {};
    head.forEach((k, i) => { if (k && cells[i] !== undefined && cells[i] !== '') raw[k] = cells[i].replace(/^'(?=[=+\-@])/, ''); });
    if (!raw.name && raw.label) raw.name = raw.label;
    if (typeof raw.date === 'string') raw.date = normaliseDate(raw.date) ?? raw.date;
    return finish(line, raw);
  });
}

/** 15.08.1990, 15/08/1990 (day first), 1990-8-15 or 15 August 1990 → YYYY-MM-DD */
export function normaliseDate(s: string): string | null {
  let m = /^(-?\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[./](\d{1,2})[./](-?\d{3,4})$/.exec(s.trim());
  if (m) return isoDate(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})\s+([A-Za-z]{3,})\.?,?\s+(-?\d{3,4})$/.exec(s.trim());
  if (m) {
    const mo = MONTHS.findIndex((x) => x.startsWith(m![2].toLowerCase().slice(0, 3)));
    if (mo >= 0) return isoDate(Number(m[3]), mo + 1, Number(m[1]));
  }
  return null;
}

/** 6:30, 06:30:15, 6.30 pm, 18h30 → HH:mm[:ss] */
export function normaliseTime(s: string): string | null {
  const m = /^(\d{1,2})[:.h](\d{2})(?:[:.](\d{2}))?\s*([ap]\.?m\.?)?$/i.exec(s.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const ampm = m[4]?.toLowerCase().replace(/\./g, '');
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  if (h > 23 || Number(m[2]) > 59) return null;
  return `${pad2(h)}:${m[2]}${m[3] ? `:${m[3]}` : ''}`;
}

/* ---------- AAF ---------- */

export function parseAaf(text: string): ImportDraft[] {
  const out: ImportDraft[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  for (let i = 0; i < lines.length; i++) {
    if (!/^#A93:/i.test(lines[i])) continue;
    const a = lines[i].slice(5).split(',').map((s) => s.trim());
    const b = /^#B93:/i.test(lines[i + 1] ?? '') ? lines[i + 1].slice(5).split(',').map((s) => s.trim()) : [];
    const [last, first, , date, time, place, country] = a;
    const [dd, mm, yy] = (date ?? '').split('.').map(Number);
    const lat = b[1] ? parseDegMin(b[1]) : null;
    const lon = b[2] ? parseDegMin(b[2]) : null;
    const name = [first, last].filter((x) => x && x !== '*').join(' ');
    const raw: Record<string, unknown> = {
      name,
      date: dd && mm && Number.isFinite(yy) ? isoDate(yy, mm, dd) : '',
      time: normaliseTime(time ?? '') ?? '',
      place: [place, country].filter((x) => x && x !== '*').join(', '),
      latitude: lat ?? NaN,
      longitude: lon ?? NaN,
    };
    out.push(finish(lines[i] + (b.length ? `\n${lines[i + 1]}` : ''), raw));
  }
  return out;
}

/* ---------- Astro-Databank / astro.com page text ---------- */

export function parseAstroDatabank(text: string): ImportDraft[] {
  const t = text.replace(/\s+/g, ' ');
  const date = /born on (?:[A-Za-z]+,? )?(\d{1,2} [A-Za-z]+\.? -?\d{3,4})/i.exec(t)?.[1]
    ?? /\b(\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) -?\d{3,4})\b/i.exec(t)?.[1];
  const time = /\bat (\d{1,2}:\d{2}(?::\d{2})?(?: ?[ap]\.?m\.?)?)/i.exec(t)?.[1]
    ?? /\b(\d{1,2}:\d{2}(?::\d{2})?(?: ?[ap]\.?m\.?)?)\b/i.exec(t)?.[1];
  const coords = /(\d{1,2}[ns]\d{2})\s*,?\s*(\d{1,3}[ew]\d{2})/i.exec(t);
  if (!date || !coords) return [];
  const before = t.slice(0, coords.index);
  const place = /(?:Place|in)\s+([^,()]+(?:\([^)]*\))?(?:,\s*[^,()0-9]+)?),?\s*$/i.exec(before)?.[1]?.trim() ?? '';
  const name = /^\s*(?:Name\s+)?([^,]+?)(?:,|\s+born\b|\s+Gender\b)/i.exec(t)?.[1]?.trim() ?? '';
  const rr = /Rodden Rating\s*:?\s*(AA|A|B|C|DD|XX|X)\b/.exec(t)?.[1] as RoddenRating | undefined;
  const lmt = /\bLMT\b|local mean time/i.test(t);
  const lat = parseDegMin(coords[1])!;
  const lon = parseDegMin(coords[2])!;
  const raw: Record<string, unknown> = {
    name: /^name$/i.test(name) ? '' : name,
    date: normaliseDate(date) ?? '',
    time: normaliseTime(time ?? '') ?? '',
    place, latitude: lat, longitude: lon,
    ...(rr && RODDEN_RATINGS.includes(rr) ? { rodden: rr } : {}),
    ...(rr === 'X' || rr === 'XX' ? { timeConfidence: 'unknown' as TimeConfidence } : {}),
    // Astro-Databank quotes LMT births as the place's own mean time
    ...(lmt ? { utcOffsetMinutes: Math.round(lon * 4) } : {}),
  };
  return [finish(text.trim().slice(0, 200), raw)];
}

/* ---------- Jagannatha Hora .jhd ---------- */

/** D.MM or H.MMSS (as JHora writes them) → decimal */
const sexa = (s: string) => {
  const v = Number(s);
  if (!Number.isFinite(v)) return NaN;
  const a = Math.abs(v);
  const d = Math.floor(a + 1e-9);
  const frac = Math.round((a - d) * 10000);
  const mins = Math.floor(frac / 100);
  const secs = frac % 100;
  return Math.sign(v || 1) * (d + mins / 60 + secs / 3600);
};

export function parseJhd(text: string, fileName = ''): ImportDraft[] {
  const l = text.split(/\r?\n/).map((s) => s.trim());
  if (l.length < 7) return [{ source: fileName || text.slice(0, 80), error: 'Not a Jagannatha Hora file' }];
  const [month, day, year] = [Number(l[0]), Number(l[1]), Number(l[2])];
  const hours = sexa(l[3]);
  // JHora stores the zone and longitude with east of Greenwich negative
  const zone = -sexa(l[4]);
  const longitude = -sexa(l[5]);
  const latitude = sexa(l[6]);
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31) || !Number.isFinite(hours) || !Number.isFinite(latitude) || !Number.isFinite(longitude))
    return [{ source: fileName || text.slice(0, 80), error: 'Not a Jagannatha Hora file' }];
  const totalSec = Math.round(hours * 3600);
  const time = `${pad2(Math.floor(totalSec / 3600))}:${pad2(Math.floor((totalSec % 3600) / 60))}:${pad2(totalSec % 60)}`;
  // later lines (when present) carry the place and country names
  const words = l.slice(7).filter((s) => /[A-Za-z]/.test(s) && !/^-?\d/.test(s));
  return [finish(fileName || 'jhd', {
    name: fileName.replace(/\.jhd$/i, ''),
    date: isoDate(year, month, day),
    time,
    place: words.slice(0, 2).join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    latitude, longitude,
    utcOffsetMinutes: Math.round(zone * 60),
  })];
}

/* ---------- bulk paste: one chart per line ---------- */

const DATE_RE = /(-?\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./]\d{1,2}[./]-?\d{3,4}|\d{1,2}\s+[A-Za-z]{3,}\.?,?\s+-?\d{3,4})/;
const TIME_RE = /(\d{1,2}[:h]\d{2}(?::\d{2})?(?:\s*[ap]\.?m\.?)?)/i;

/**
 * "Asha, 1990-08-15, 06:30, New Delhi"
 * "Ravi; 3/11/1985; 11:45 pm; 19.076, 72.8777; Asia/Kolkata"
 * Name first, then the date and time in any common form, then a place name or
 * coordinates, then optionally an IANA zone. Places without coordinates are
 * looked up in the offline gazetteer.
 */
export async function parseBulk(text: string, resolve: PlaceResolver): Promise<ImportDraft[]> {
  const out: ImportDraft[] = [];
  for (const line of text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
    const dm = DATE_RE.exec(line);
    if (!dm) { out.push({ source: line, error: 'No date found' }); continue; }
    const afterDate = line.slice(dm.index + dm[0].length);
    const tm = TIME_RE.exec(afterDate);
    if (!tm) { out.push({ source: line, error: 'No time found' }); continue; }
    const name = line.slice(0, dm.index).replace(/[,;\t|]+\s*$/, '').trim();
    let rest = afterDate.slice(tm.index + tm[0].length).replace(/^[\s,;\t|]+/, '').trim();
    const zone = /([A-Za-z]+\/[A-Za-z_\-/]+)\s*$/.exec(rest)?.[1];
    if (zone) rest = rest.slice(0, rest.length - zone.length).replace(/[\s,;\t|]+$/, '');
    const raw: Record<string, unknown> = { name, date: normaliseDate(dm[0]) ?? '', time: normaliseTime(tm[0]) ?? '', ...(zone ? { timezone: zone } : {}) };
    const nums = /(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(rest);
    const dms = /(\d{1,2}\s*[ns]\s*\d{2})\s*[,;\s]\s*(\d{1,3}\s*[ew]\s*\d{2})/i.exec(rest);
    if (nums || dms) {
      raw.latitude = nums ? Number(nums[1]) : parseDegMin(dms![1].replace(/\s/g, ''));
      raw.longitude = nums ? Number(nums[2]) : parseDegMin(dms![2].replace(/\s/g, ''));
      raw.place = rest.slice(0, (nums ?? dms)!.index).replace(/[\s,;\t|]+$/, '') || undefined;
      out.push(finish(line, raw));
      continue;
    }
    const place = rest.replace(/[;\t|]/g, ',').trim();
    if (!place) { out.push({ source: line, error: 'No place or coordinates' }); continue; }
    const hit = await resolve(place);
    if (!hit) { out.push({ source: line, error: `Place "${place}" not found offline; add coordinates`, needsPlace: place }); continue; }
    out.push(finish(line, { ...raw, place: hit.name, latitude: hit.latitude, longitude: hit.longitude, timezone: zone ?? hit.timezone }));
  }
  return out;
}

/* ---------- Astrolog .as / .chtk ---------- */

/** "122:19:59W", "47:36:35N", "122W20", "-122.33" → signed degrees (east and north positive) */
function astrologAngle(s: string): number {
  const m = /^([+-]?\d+(?:\.\d+)?)(?::(\d+(?:\.\d+)?))?(?::(\d+(?:\.\d+)?))?([NSEW])?$/i.exec(s);
  const m2 = /^(\d+)([NSEW])(\d+(?:\.\d+)?)$/i.exec(s);
  if (m2) { const v = Number(m2[1]) + Number(m2[3]) / 60; return /[SW]/i.test(m2[2]) ? -v : v; }
  if (!m) return NaN;
  const v = Math.abs(Number(m[1])) + (m[2] ? Number(m[2]) / 60 : 0) + (m[3] ? Number(m[3]) / 3600 : 0);
  const neg = m[1].startsWith('-') !== /[SW]/i.test(m[4] ?? '');
  return neg ? -v : v;
}

/** Astrolog hours: "+8:00", "-5:30", "8", "5:30E" (east), "ST" = 0, "DT" = 1 */
function astrologHours(s: string): number {
  if (/^ST$/i.test(s)) return 0;
  if (/^DT$/i.test(s)) return 1;
  const m = /^([+-]?)(\d+(?:\.\d+)?)(?::(\d+))?(?::(\d+))?([EW])?$/i.exec(s);
  if (!m) return NaN;
  const v = Number(m[2]) + (m[3] ? Number(m[3]) / 60 : 0) + (m[4] ? Number(m[4]) / 3600 : 0);
  // a trailing E means east of Greenwich, which Astrolog writes as negative
  const neg = (m[1] === '-') !== /E/i.test(m[5] ?? '');
  return neg ? -v : v;
}

/** Splits a command line into words, keeping "quoted strings" whole. */
const words = (line: string) => [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]);

export function parseAstrolog(text: string, fileName = ''): ImportDraft[] {
  const lines = text.split(/\r?\n/);
  const src = fileName || 'Astrolog file';
  if (!/^@AI\d+/.test(lines[0]?.trim() ?? '')) return [{ source: src, error: 'Not an Astrolog chart file (no @AI header on the first line)' }];
  let qb: string[] | null = null;
  let zi: string[] = [];
  for (const raw of lines.slice(1)) {
    const line = raw.replace(/;.*$/, '').trim();
    if (/^[-/]qb\b/i.test(line)) qb = words(line).slice(1);
    else if (/^[-/]zi\b/i.test(line)) zi = words(line).slice(1);
  }
  if (!qb || qb.length < 8) return [{ source: src, error: 'No /qb line with eight fields' }];
  const [mon, day, yr, tm, dst, zone, lon, lat] = qb;
  const mo = /^\d+$/.test(mon) ? Number(mon) : MONTHS.findIndex((x) => x.startsWith(mon.toLowerCase().slice(0, 3))) + 1;
  const longitude = astrologAngle(lon);
  const latitude = astrologAngle(lat);
  const raw: Record<string, unknown> = {
    name: zi[0] ?? fileName.replace(/\.(as|chtk)$/i, ''),
    date: mo >= 1 ? isoDate(Number(yr), mo, Number(day)) : '',
    time: normaliseTime(tm) ?? '',
    place: zi[1] ?? '',
    latitude, longitude,
  };
  if (/^LMT$/i.test(zone)) raw.utcOffsetMinutes = Math.round(longitude * 4);
  else {
    const z = astrologHours(zone), d = astrologHours(dst);
    if (Number.isFinite(z) && Number.isFinite(d)) raw.utcOffsetMinutes = Math.round((-z + d) * 60);
  }
  return [finish(src, raw)];
}

/* ---------- Astro-Databank XML ---------- */

const attr = (tag: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag)?.[1];
const xmlText = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
const element = (xml: string, name: string) => new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)</${name}>|<${name}\\b([^>]*)/>`, 'i').exec(xml);
const ADB_RATING: Record<string, RoddenRating> = { 1: 'AA', 2: 'A', 3: 'B', 4: 'C', 5: 'DD', 6: 'X', 7: 'XX' };

/** "47n36", "122w20", "122w2030" (degrees, direction, minutes and optional seconds) */
function adbAngle(s: string | undefined): number {
  const m = /^(\d+)([nsew])(\d{2})(\d{2})?$/i.exec((s ?? '').trim());
  if (!m) return NaN;
  let v = Number(m[1]) + Number(m[3]) / 60 + (m[4] ? Number(m[4]) / 3600 : 0);
  if (/[sw]/i.test(m[2])) v = -v;
  if (v > 180) v -= 360;
  if (v < -180) v += 360;
  return v;
}

export function parseAdbXml(xml: string): ImportDraft[] {
  const out: ImportDraft[] = [];
  for (const m of xml.matchAll(/<adb_entry\b[^>]*>([\s\S]*?)<\/adb_entry>/gi)) {
    const entry = m[1];
    const pub = element(entry, 'public_data')?.[2] ?? entry;
    const name = xmlText(element(pub, 'name')?.[2] ?? '');
    const date = element(pub, 'sbdate');
    const dAttrs = date?.[1] ?? date?.[3] ?? '';
    const time = element(pub, 'sbtime');
    const tAttrs = time?.[1] ?? time?.[3] ?? '';
    const place = element(pub, 'place');
    const pAttrs = place?.[1] ?? place?.[3] ?? '';
    const country = xmlText(element(pub, 'country')?.[2] ?? '');
    const rr = ADB_RATING[attr(element(pub, 'roddenrating')?.[0] ?? '', 'rrc') ?? ''];
    const [y, mo, d] = [Number(attr(dAttrs, 'iyear')), Number(attr(dAttrs, 'imonth')), Number(attr(dAttrs, 'iday'))];
    const julian = /^j/i.test(attr(dAttrs, 'ccalendar') ?? '');
    const unknown = /^y/i.test(attr(tAttrs, 'time_unknown') ?? '');
    const hhmm = unknown ? '12:00' : normaliseTime(xmlText(time?.[2] ?? '')) ?? '';
    const latitude = adbAngle(attr(pAttrs, 'slati'));
    const longitude = adbAngle(attr(pAttrs, 'slong'));
    const raw: Record<string, unknown> = {
      name,
      date: Number.isFinite(y) && mo && d ? isoDate(y, mo, d) : '',
      time: hhmm,
      place: [xmlText(place?.[2] ?? ''), country].filter(Boolean).join(', '),
      latitude, longitude,
      ...(rr ? { rodden: rr } : {}),
      ...(unknown ? { timeConfidence: 'unknown' as TimeConfidence } : {}),
      ...(julian ? { calendar: 'julian' } : {}),
    };
    // the exact offset ADB used: local clock time minus the UT instant it records
    const jdUt = Number(attr(tAttrs, 'jd_ut'));
    const [hh, mm, ss = 0] = hhmm.split(':').map(Number);
    if (!unknown && Number.isFinite(jdUt) && jdUt > 0 && raw.date) {
      const jdLocal = calendarJdn(y, mo, d, julian) - 0.5 + (hh * 3600 + mm * 60 + ss) / 86400;
      let off = Math.round((jdLocal - jdUt) * 1440);
      if (off > 14 * 60) off -= 1440;
      if (off < -14 * 60) off += 1440;
      raw.utcOffsetMinutes = off;
    } else if (/^l/i.test(attr(tAttrs, 'ctimetype') ?? '') && Number.isFinite(longitude)) {
      raw.utcOffsetMinutes = Math.round(longitude * 4);
    }
    out.push(finish(name || 'adb_entry', raw));
  }
  return out;
}

/** Julian day number of a calendar date, in whichever calendar it was given. */
function calendarJdn(y: number, m: number, d: number, julian: boolean): number {
  if (julian) return julianCalendarToJdn(y, m, d);
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

/* ---------- iCalendar ---------- */

export async function parseIcs(text: string, resolve: PlaceResolver): Promise<ImportDraft[]> {
  // unfold continuation lines first (RFC 5545: a line starting with a space continues the previous one)
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const out: ImportDraft[] = [];
  let ev: Record<string, { params: string; value: string }> | null = null;
  const unescape = (v: string) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) { ev = {}; continue; }
    if (/^END:VEVENT/i.test(line) && ev) {
      const e = ev; ev = null;
      const dt = e.DTSTART;
      const name = unescape(e.SUMMARY?.value ?? '');
      if (!dt) { out.push({ source: name || 'event', error: 'No DTSTART' }); continue; }
      const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(dt.value.trim());
      if (!m) { out.push({ source: name || 'event', error: 'Unreadable DTSTART' }); continue; }
      const dateOnly = !m[4];
      const tzid = /TZID=([^;:]+)/i.exec(dt.params)?.[1]?.replace(/^"|"$/g, '');
      const raw: Record<string, unknown> = {
        name,
        date: `${m[1]}-${m[2]}-${m[3]}`,
        time: dateOnly ? '12:00' : `${m[4]}:${m[5]}${m[6] && m[6] !== '00' ? `:${m[6]}` : ''}`,
        ...(dateOnly ? { timeConfidence: 'unknown' as TimeConfidence } : {}),
        ...(m[7] ? { utcOffsetMinutes: 0 } : {}),
      };
      const geo = /^(-?\d+(?:\.\d+)?)[;,](-?\d+(?:\.\d+)?)$/.exec(e.GEO?.value.trim() ?? '');
      const location = unescape(e.LOCATION?.value ?? '');
      if (geo) Object.assign(raw, { latitude: Number(geo[1]), longitude: Number(geo[2]), place: location || undefined });
      else if (location) {
        const hit = await resolve(location);
        if (!hit) { out.push({ source: name || location, error: `Place "${location}" not found offline; add GEO coordinates`, needsPlace: location }); continue; }
        Object.assign(raw, { latitude: hit.latitude, longitude: hit.longitude, place: hit.name, timezone: hit.timezone });
      } else { out.push({ source: name || 'event', error: 'No LOCATION or GEO' }); continue; }
      // a TZID names the clock the time was read on; a UTC time is kept exact with offset 0
      if (tzid) raw.timezone = tzid;
      const draft = finish(name || 'event', raw);
      // a UTC time (…Z) becomes the place's own clock time, so the chart reads naturally
      if (m[7] && draft.input) {
        const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: draft.input.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
          .formatToParts(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)))).map((x) => [x.type, x.value]));
        const { utcOffsetMinutes: _drop, ...rest } = draft.input;
        draft.input = { ...rest, date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:${p.second}` };
      }
      out.push(draft);
      continue;
    }
    if (!ev) continue;
    const mm = /^([A-Z-]+)((?:;[^:]*)?):(.*)$/i.exec(line);
    if (mm) ev[mm[1].toUpperCase()] = { params: mm[2], value: mm[3] };
  }
  return out;
}

/* ---------- Solar Fire Quick*Chart (.qck): 100-column records ---------- */

const QCK_LINE = /^.{23}[A-Z]{3} [ \d]\d, -?\d{4}\d{2}:\d{2}:\d{2} [AP]M .{3}[+-]\d{2}:\d{2}\d{3}[EW]\d{2}'\d{2} \d{2}[NS]\d{2}'\d{2} /i;
const QCK_NOTE = 'Quick*Chart records carry no Rodden rating, source or notes.';

/** Astrolog's test: every line is 100 or 101 characters. A paste that lost its trailing spaces still matches the layout. */
export const looksLikeQuickChart = (text: string) => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return lines.length > 0 && QCK_LINE.test(lines[0]) && (lines.every((l) => l.length === 100 || l.length === 101) || lines.every((l) => QCK_LINE.test(l)));
};

export function parseQuickChart(text: string): ImportDraft[] {
  return text.split(/\r?\n/).filter((l) => l.trim()).map((line): ImportDraft => {
    const col = (from: number, to: number) => line.slice(from - 1, to);
    try {
      const rawName = col(1, 23).trim();
      const comma = rawName.indexOf(',');
      const name = comma >= 0 ? `${rawName.slice(comma + 1).trim()} ${rawName.slice(0, comma).trim()}`.trim() : rawName;
      const dm = /^([A-Z]{3}) ([ \d]\d), (-?\d{4})$/i.exec(col(24, 35));
      const mo = dm ? MONTHS.findIndex((x) => x.startsWith(dm[1].toLowerCase())) : -1;
      const time = normaliseTime(`${col(36, 43)} ${col(45, 46)}`);
      const off = /^([+-])(\d{2}):(\d{2})$/.exec(col(51, 56));
      const lon = /^(\d{3})([EW])(\d{2})'(\d{2})$/i.exec(col(57, 65));
      const lat = /^(\d{2})([NS])(\d{2})'(\d{2})$/i.exec(col(67, 74));
      if (!dm || mo < 0 || !time || !off || !lon || !lat) return { source: line.trimEnd(), error: 'Not a Quick*Chart record' };
      const deg = (d: string, m: string, sec: string, neg: boolean) => (neg ? -1 : 1) * (Number(d) + Number(m) / 60 + Number(sec) / 3600);
      const latitude = deg(lat[1], lat[3], lat[4], lat[2].toUpperCase() === 'S');
      const longitude = deg(lon[1], lon[3], lon[4], lon[2].toUpperCase() === 'W');
      // west-positive, like Astrolog: "CST +06:00" is UTC−6. The abbreviation is ignored.
      const utcOffsetMinutes = -(off[1] === '-' ? -1 : 1) * (Number(off[2]) * 60 + Number(off[3]));
      const place = col(76, 101).trim() || `${lat[0]} ${lon[0]}`;
      const draft = finish(line.trimEnd(), { name, date: isoDate(Number(dm[3]), mo + 1, Number(dm[2])), time, latitude, longitude, utcOffsetMinutes, place });
      return { ...draft, note: QCK_NOTE };
    } catch {
      return { source: line.trimEnd(), error: 'Could not read this record' };
    }
  });
}

/* ---------- Solar Fire text export (charts.txt): name, time, place, blank ---------- */

const SF_TIME = /^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(-?\d{1,4})\s+(\d{1,2}:\d{2}(?::\d{2})?\s*[ap]\.?m\.?)\s*(\S+)?\s*$/i;

const blocks = (text: string) => text.split(/\r?\n(?:[ \t]*\r?\n)+/).map((b) => b.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)).filter((b) => b.length);

export const looksLikeSolarFireText = (text: string) => {
  const b = blocks(text);
  return b.length > 0 && b.every((x) => x.length >= 3 && SF_TIME.test(x[1]));
};

/** UTC offset of a zone on a date with daylight saving taken out: the smaller of its January and July offsets. */
function standardOffset(zone: string, y: number): number | null {
  const at = (mo: number) => {
    try {
      const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(new Date(Date.UTC(y, mo, 1, 12)))
        .find((p) => p.type === 'timeZoneName')?.value ?? '';
      const m = /GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?/.exec(name);
      return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)) : null;
    } catch { return null; }
  };
  const a = at(0), b = at(6);
  return a === null || b === null ? null : Math.min(a, b);
}

export async function parseSolarFireText(text: string, resolve: PlaceResolver): Promise<ImportDraft[]> {
  const out: ImportDraft[] = [];
  for (const b of blocks(text)) {
    // anything past three lines is comments
    const [name, timeLine, location] = b;
    const source = `${name} · ${timeLine} · ${location}`;
    const m = SF_TIME.exec(timeLine);
    const mo = m ? MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3))) : -1;
    const time = m ? normaliseTime(m[4]) : null;
    if (!m || mo < 0 || !time) { out.push({ source, error: 'Unreadable date or time line' }); continue; }
    const year = Number(m[3]);
    const zone = (m[5] ?? '').toUpperCase();
    const explicit = /^([+-])(\d{1,2}):(\d{2})$/.exec(zone);
    if (!explicit && !['ST', 'DT', 'LT', 'LMT'].includes(zone)) { out.push({ source, error: `Zone "${m[5] ?? 'none'}" not understood; expected ST, DT, LMT or ±HH:MM` }); continue; }
    const hit = (await resolve(location)) ?? (location.includes(',') ? await resolve(location.split(',')[0]) : null);
    if (!hit) { out.push({ source, error: `Place "${location}" not found offline`, needsPlace: location }); continue; }
    let utcOffsetMinutes: number | undefined;
    if (explicit) utcOffsetMinutes = -(explicit[1] === '-' ? -1 : 1) * (Number(explicit[2]) * 60 + Number(explicit[3])); // west-positive
    else if (zone === 'LT' || zone === 'LMT') utcOffsetMinutes = Math.round(hit.longitude * 4);
    else {
      const std = standardOffset(hit.timezone, year);
      if (std === null) { out.push({ source, error: `No standard time known for ${hit.timezone}` }); continue; }
      utcOffsetMinutes = std + (zone === 'DT' ? 60 : 0);
    }
    out.push(finish(source, {
      name, date: isoDate(year, mo + 1, Number(m[2])), time, latitude: hit.latitude, longitude: hit.longitude,
      timezone: hit.timezone, place: location, utcOffsetMinutes,
    }));
  }
  return out;
}

/** Picks the right reader for a file or pasted text. */
export async function parseAny(text: string, fileName: string, resolve: PlaceResolver): Promise<ImportDraft[]> {
  const t = text.trim();
  if (/^@AI\d+/.test(t)) return parseAstrolog(t, fileName.split(/[\\/]/).pop());
  if (/<adb_entry\b/i.test(t)) return parseAdbXml(t);
  if (looksLikeQuickChart(text)) return parseQuickChart(text);
  if (looksLikeSolarFireText(t)) return parseSolarFireText(t, resolve);
  if (/^BEGIN:VCALENDAR/i.test(t) || /\bBEGIN:VEVENT\b/i.test(t)) return parseIcs(t, resolve);
  if (/\.jhd$/i.test(fileName)) return parseJhd(text, fileName.split(/[\\/]/).pop());
  if (/^#A93:/im.test(t)) return parseAaf(t);
  if (/^[[{]/.test(t)) return parseJsonRecords(t);
  if (/born on|Rodden Rating|Astro-Databank/i.test(t)) return parseAstroDatabank(t);
  const first = t.split(/\r?\n/)[0].toLowerCase();
  if (/(^|,)\s*"?(date|birth_date)"?\s*(,|$)/.test(first)) return parseCsv(t);
  // seven bare numbers in a row is a Jagannatha Hora file pasted as text
  if (/^(-?\d+(\.\d+)?\s*\n){6}-?\d+(\.\d+)?/.test(t)) return parseJhd(t);
  return parseBulk(t, resolve);
}

/** This app's JSON (plain array, or a backup / saved-charts file). */
export function parseJsonRecords(text: string): ImportDraft[] {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return [{ source: text.slice(0, 80), error: 'Not valid JSON' }]; }
  const d = data as { profiles?: unknown[] };
  const list: unknown[] = Array.isArray(data) ? data : Array.isArray(d.profiles) ? d.profiles : [];
  return list.map((item) => {
    const r = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const raw = (r.input && typeof r.input === 'object' ? { ...(r.input as object), name: (r.input as { name?: string }).name || r.label } : r) as Record<string, unknown>;
    return finish(String(r.label ?? raw.name ?? 'record'), { ...raw });
  });
}
