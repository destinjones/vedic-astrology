/**
 * Where the compare page gets its charts: saved profiles, the chart last
 * opened in the explorer, the famous charts library, share links, and the
 * compare page's own URL. Everything stays in the browser.
 */
import type { Ayanamsa, BirthInput, Chart, PlanetId } from '../types/chart';
import type { ChartInput, SignNumber } from '@vedic/interpretations';

const AYANAMSAS: readonly Ayanamsa[] = ['lahiri', 'true_chitra', 'raman', 'krishnamurti'];

const isTimeZone = (tz: string): boolean => {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
};

/** A clean BirthInput, or null when anything is missing or out of range. */
export function cleanInput(raw: unknown): BirthInput | null {
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
  if (!/^-?\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return null;
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;
  if (!timezone || !isTimeZone(timezone)) return null;
  return {
    name: str(r.name, 80),
    date, time,
    place: str(r.place) || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    latitude, longitude, timezone, ayanamsa,
  };
}

const fullTime = (t: string) => (t.length === 5 ? `${t}:00` : t);
export const sameBirth = (a: BirthInput, b: BirthInput): boolean =>
  a.date === b.date && fullTime(a.time) === fullTime(b.time) &&
  Math.abs(a.latitude - b.latitude) < 1e-4 && Math.abs(a.longitude - b.longitude) < 1e-4 &&
  a.timezone === b.timezone && a.ayanamsa === b.ayanamsa;

/* ---------- saved charts ---------- */

export interface SourceChart {
  id: string;
  label: string;
  /** Second line in the picker, e.g. "Actor · USA". */
  sub?: string;
  input: BirthInput;
  /** Grouping in the famous list, e.g. 'IN'. */
  group?: string;
}

/** Saved profiles (written by the explorer) plus the chart last opened there. */
export function savedCharts(): SourceChart[] {
  const out: SourceChart[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem('vedic.profiles.v1') ?? '[]') as unknown;
    const list = Array.isArray(raw) ? raw : (raw as { profiles?: unknown[] })?.profiles ?? [];
    for (const p of list as Record<string, unknown>[]) {
      const input = cleanInput(p?.input);
      if (!input) continue;
      const label = typeof p.label === 'string' && p.label.trim() ? p.label.trim().slice(0, 80) : input.name || 'Unnamed';
      out.push({ id: `saved:${String(p.id ?? out.length)}`, label, sub: `${input.date} · ${input.place}`, input: { ...input, name: input.name || label } });
    }
  } catch { /* nothing saved, or storage blocked */ }
  try {
    const last = cleanInput(JSON.parse(localStorage.getItem('vedic.lastInput') ?? 'null'));
    if (last && !out.some((s) => sameBirth(s.input, last))) {
      out.push({ id: 'last', label: last.name || 'Chart open in the explorer', sub: `${last.date} · ${last.place}`, input: last });
    }
  } catch { /* ignore */ }
  return out;
}

/* ---------- famous charts (optional module) ---------- */

interface FamousChartLike {
  id: string;
  label: string;
  country?: string;
  field?: string;
  input: BirthInput;
  rodden?: string;
}

const famousModules = import.meta.glob<{ FAMOUS_CHARTS?: FamousChartLike[] }>('../data/famousCharts.ts');

export const COUNTRY_NAMES: Record<string, string> = { IN: 'India', US: 'United States', GB: 'Britain' };

/** The famous charts library, when it is part of this build. Empty otherwise. */
export async function famousCharts(): Promise<SourceChart[]> {
  const load = Object.values(famousModules)[0];
  if (!load) return [];
  const mod = await load();
  return (mod.FAMOUS_CHARTS ?? []).flatMap((f) => {
    const input = cleanInput(f.input);
    if (!input) return [];
    const sub = [f.field, f.country && COUNTRY_NAMES[f.country], f.rodden && `Rodden ${f.rodden}`].filter(Boolean).join(' · ');
    return [{ id: `famous:${f.id}`, label: f.label, sub, input: { ...input, name: input.name || f.label }, group: f.country }];
  });
}

/* ---------- links ---------- */

/** Birth details as readable URL params, the same format as the explorer's share links. */
export function birthParams(input: BirthInput): string {
  const q = new URLSearchParams();
  if (input.name?.trim()) q.set('n', input.name.trim());
  q.set('d', input.date);
  q.set('t', input.time);
  q.set('p', input.place);
  q.set('lat', String(+input.latitude.toFixed(5)));
  q.set('lon', String(+input.longitude.toFixed(5)));
  q.set('tz', input.timezone);
  if (input.ayanamsa !== 'lahiri') q.set('ay', input.ayanamsa);
  return q.toString();
}

function fromParams(q: URLSearchParams): BirthInput | null {
  if (!q.has('d') || !q.has('t') || !q.has('lat') || !q.has('lon') || !q.has('tz')) return null;
  return cleanInput({
    name: q.get('n') ?? '', date: q.get('d'), time: q.get('t'), place: q.get('p') ?? '',
    latitude: q.get('lat'), longitude: q.get('lon'), timezone: q.get('tz'), ayanamsa: q.get('ay') ?? 'lahiri',
  });
}

/** Compare page hash: one `c=` per chart, each holding that chart's share params. */
export function compareHash(inputs: BirthInput[]): string {
  return inputs.length ? '#' + inputs.map((i) => 'c=' + encodeURIComponent(birthParams(i))).join('&') : '';
}

export interface ParsedHash {
  inputs: BirthInput[];
  /** famous chart ids from `#famous=<id>` or `f=<id>` entries */
  famous: string[];
}

export function parseCompareHash(hash: string): ParsedHash {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const inputs = q.getAll('c').map((c) => fromParams(new URLSearchParams(c))).filter((x): x is BirthInput => !!x);
  // A plain explorer share link (#n=…&d=…) adds that one chart.
  const single = fromParams(q);
  if (single) inputs.push(single);
  return { inputs, famous: [...q.getAll('f'), ...q.getAll('famous')].filter(Boolean) };
}

/** Reads a pasted share link or compare link. */
export function parsePastedLink(text: string): ParsedHash {
  const t = text.trim();
  const i = t.indexOf('#');
  return parseCompareHash(i >= 0 ? t.slice(i) : t);
}

/* ---------- interpretation input ---------- */

const IDS: PlanetId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];

/** The UI chart in the shape the interpretation package reads (works for preview charts too). */
export function toChartInput(c: Chart): ChartInput {
  const planets = {} as ChartInput['planets'];
  for (const id of IDS) {
    const p = c.planets.find((x) => x.id === id)!;
    planets[id] = {
      sign: p.sign as SignNumber, house: p.house as SignNumber, longitude: p.longitude,
      retrograde: p.retrograde, combust: p.combust, nakshatra: p.nakshatra, pada: p.pada as 1 | 2 | 3 | 4, speed: p.speed,
    };
  }
  return { ascendantSign: c.ascendant.sign as SignNumber, ascendantLongitude: c.ascendant.longitude, planets };
}
