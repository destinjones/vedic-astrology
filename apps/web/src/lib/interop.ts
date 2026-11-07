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
 *
 * Every parser returns drafts; nothing is saved until the person confirms.
 */
import { timezoneAt } from '@vedic/engine/time';
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

/** Picks the right reader for a file or pasted text. */
export async function parseAny(text: string, fileName: string, resolve: PlaceResolver): Promise<ImportDraft[]> {
  const t = text.trim();
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
