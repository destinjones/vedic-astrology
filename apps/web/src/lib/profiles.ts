/**
 * Saved profiles and share links. Everything here is browser-only:
 * profiles live in localStorage, and share links carry the birth details in
 * the URL fragment (#...), which browsers never send to the server.
 */
import type { Ayanamsa, BirthInput, CalendarSystem, RoddenRating, TimeConfidence } from '../types/chart';
import { RODDEN_RATINGS, TIME_CONFIDENCES } from './birthQuality';
import { CHART_REQUEST_VERSION, decodeChartRequest, encodeChartRequest, type ChartRequest } from '@vedic/engine/request';

export interface Profile {
  id: string;
  /** Label shown in the list, e.g. "Mum" or "Priya". */
  label: string;
  input: BirthInput;
  savedAt: string;
  updatedAt: string;
}

const PROFILES_KEY = 'vedic.profiles.v1';
const AYANAMSAS: readonly Ayanamsa[] = ['lahiri', 'true_chitra', 'raman', 'krishnamurti'];

/* ---------- validation ---------- */

const isTimeZone = (tz: string): boolean => {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
};

/** Returns a clean BirthInput, or null when anything is missing or out of range. */
export function sanitizeInput(raw: unknown): BirthInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  const date = str(r.date, 10);
  const time = str(r.time, 8);
  const latitude = num(r.latitude);
  const longitude = num(r.longitude);
  const timezone = str(r.timezone, 64);
  const ayanamsa = (AYANAMSAS as readonly string[]).includes(str(r.ayanamsa)) ? (r.ayanamsa as Ayanamsa) : 'lahiri';
  const offset = num(r.utcOffsetMinutes);
  if (!/^-?\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return null;
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) return null;
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;
  if (!timezone || !isTimeZone(timezone)) return null;
  const calendar = (['auto', 'gregorian', 'julian'] as const).find((c) => c === r.calendar) as CalendarSystem | undefined;
  const rodden = (RODDEN_RATINGS as readonly string[]).includes(str(r.rodden, 2)) ? (r.rodden as RoddenRating) : undefined;
  const timeConfidence = (TIME_CONFIDENCES as readonly string[]).includes(str(r.timeConfidence, 12)) ? (r.timeConfidence as TimeConfidence) : undefined;
  return {
    ...(Number.isFinite(offset) && Math.abs(offset) <= 16 * 60 ? { utcOffsetMinutes: offset } : {}),
    ...(calendar && calendar !== 'auto' ? { calendar } : {}),
    ...(rodden ? { rodden } : {}),
    ...(timeConfidence ? { timeConfidence } : {}),
    name: str(r.name, 80),
    date,
    time,
    place: str(r.place) || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    latitude,
    longitude,
    timezone,
    ayanamsa,
    // a manual offset (war time, LMT) changes the chart, so it must survive storage and links
    ...(Number.isFinite(offset) && Math.abs(offset) <= 16 * 60 ? { utcOffsetMinutes: offset } : {}),
  };
}

/** Same person, same moment, same place: used to spot a chart that is already saved. */
const fullTime = (t: string) => (t.length === 5 ? `${t}:00` : t);
export const sameBirth = (a: BirthInput, b: BirthInput): boolean =>
  a.date === b.date &&
  fullTime(a.time) === fullTime(b.time) &&
  Math.abs(a.latitude - b.latitude) < 1e-4 &&
  Math.abs(a.longitude - b.longitude) < 1e-4 &&
  a.timezone === b.timezone &&
  (a.utcOffsetMinutes ?? null) === (b.utcOffsetMinutes ?? null) &&
  (a.calendar ?? 'auto') === (b.calendar ?? 'auto');

/* ---------- profile storage ---------- */

export function loadProfiles(): Profile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    return parseProfiles(JSON.parse(raw));
  } catch {
    return [];
  }
}

function parseProfiles(data: unknown): Profile[] {
  const list = Array.isArray(data) ? data : data && typeof data === 'object' && Array.isArray((data as { profiles?: unknown }).profiles) ? (data as { profiles: unknown[] }).profiles : [];
  const out: Profile[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    const input = sanitizeInput(p.input);
    if (!input) continue;
    const now = new Date().toISOString();
    out.push({
      id: typeof p.id === 'string' && p.id ? p.id.slice(0, 64) : newId(),
      label: (typeof p.label === 'string' && p.label.trim() ? p.label.trim() : input.name || 'Unnamed').slice(0, 80),
      input,
      savedAt: typeof p.savedAt === 'string' ? p.savedAt : now,
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : now,
    });
  }
  return out;
}

/** Writes the list; returns false when the browser refuses (private mode, storage full). */
export function storeProfiles(list: Profile[]): boolean {
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(list)); return true; } catch { return false; }
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Adds a profile, or updates the existing one for the same birth. */
export function upsertProfile(list: Profile[], label: string, input: BirthInput): Profile[] {
  const now = new Date().toISOString();
  const clean = label.trim().slice(0, 80) || input.name || 'Unnamed';
  const hit = list.find((p) => sameBirth(p.input, input));
  if (hit) return list.map((p) => (p === hit ? { ...p, label: clean, input: { ...input, name: input.name || clean }, updatedAt: now } : p));
  return [{ id: newId(), label: clean, input: { ...input, name: input.name || clean }, savedAt: now, updatedAt: now }, ...list];
}

/** A small JSON file people can keep as a backup or move to another browser. */
export function exportProfiles(list: Profile[]): string {
  return JSON.stringify({ app: 'jyotisha-explorer', version: 1, exportedAt: new Date().toISOString(), profiles: list }, null, 2);
}

/** Merges an exported file into the list. Charts already saved are kept, not duplicated. */
export function importProfiles(list: Profile[], text: string): { list: Profile[]; added: number } {
  const incoming = parseProfiles(JSON.parse(text));
  let added = 0;
  const next = [...list];
  for (const p of incoming) {
    if (next.some((q) => sameBirth(q.input, p.input))) continue;
    next.push({ ...p, id: next.some((q) => q.id === p.id) ? newId() : p.id });
    added++;
  }
  return { list: next, added };
}

/* ---------- share links ---------- */

/** The UI's birth details as the engine's versioned, serialisable ChartRequest. */
export function toChartRequest(input: BirthInput): ChartRequest {
  return {
    v: CHART_REQUEST_VERSION,
    ...(input.name?.trim() ? { name: input.name.trim() } : {}),
    date: input.date,
    time: input.time,
    place: { ...(input.place ? { name: input.place } : {}), latitude: input.latitude, longitude: input.longitude, timezone: input.timezone },
    ...(input.utcOffsetMinutes !== undefined ? { utcOffsetMinutes: input.utcOffsetMinutes } : {}),
    ayanamsa: input.ayanamsa,
    ...(input.calendar && input.calendar !== 'auto' ? { calendar: input.calendar } : {}),
    ...(input.rodden ? { rodden: input.rodden } : {}),
    ...(input.timeConfidence ? { timeConfidence: input.timeConfidence } : {}),
  };
}

/** A decoded ChartRequest as UI birth details (null if the UI cannot use it). */
export function fromChartRequest(r: ChartRequest): BirthInput | null {
  return sanitizeInput({
    name: r.name ?? '',
    date: r.date,
    time: r.time,
    place: r.place.name ?? '',
    latitude: r.place.latitude,
    longitude: r.place.longitude,
    timezone: r.place.timezone,
    ayanamsa: r.ayanamsa,
    utcOffsetMinutes: r.utcOffsetMinutes,
    calendar: r.calendar,
    rodden: r.rodden,
    timeConfidence: r.timeConfidence,
  });
}

/**
 * Encodes the birth details as readable, versioned URL-fragment params, e.g.
 * #v=1&n=Asha&d=1990-08-15&t=06%3A30&p=New+Delhi%2C+India&lat=28.6139&lon=77.209&tz=Asia%2FKolkata
 * The format lives in @vedic/engine/request, which keeps every older link readable.
 */
export function shareHash(input: BirthInput, includeName = true): string {
  return '#' + encodeChartRequest(toChartRequest(input), { includeName });
}

export function shareUrl(input: BirthInput, includeName = true, base = location.origin + location.pathname): string {
  return base + shareHash(input, includeName);
}

/** Reads a share link fragment, any format version. Returns null for any other hash (like #sample or #timing). */
export function parseShareHash(hash: string): BirthInput | null {
  const r = decodeChartRequest(hash);
  if ('reason' in r) {
    if (r.reason !== 'not_a_chart') console.warn(`Share link not opened: ${r.message}`);
    return null;
  }
  for (const w of r.warnings) console.warn(`Share link: ${w}`);
  return fromChartRequest(r.request);
}
