/**
 * Past life events per person, kept in this browser only.
 * Keyed by the birth details, so the same person's events come back whenever
 * their chart is opened again.
 */
import { EVENT_SIGNIFICATIONS, type DatePrecision, type LifeEvent, type LifeEventKind } from '@vedic/timing';
import type { BirthInput } from '../types/chart';

export const EVENTS_KEY = 'vedic.lifeEvents.v1';

export const birthKey = (i: Pick<BirthInput, 'date' | 'time' | 'latitude' | 'longitude' | 'timezone'>) =>
  `${i.date}|${i.time.length === 5 ? `${i.time}:00` : i.time}|${i.latitude.toFixed(4)}|${i.longitude.toFixed(4)}|${i.timezone}`;

const PRECISIONS: DatePrecision[] = ['day', 'month', 'year'];

/** Clean a stored or imported list: drops anything malformed, caps lengths. */
export function sanitizeEvents(raw: unknown): LifeEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: LifeEvent[] = [];
  for (const r of raw.slice(0, 500)) {
    if (!r || typeof r !== 'object') continue;
    const e = r as Record<string, unknown>;
    const kind = typeof e.kind === 'string' && e.kind in EVENT_SIGNIFICATIONS ? (e.kind as LifeEventKind) : null;
    const date = typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : null;
    if (!kind || !date || Number.isNaN(Date.parse(date))) continue;
    const precision = PRECISIONS.includes(e.precision as DatePrecision) ? (e.precision as DatePrecision) : 'day';
    out.push({
      id: typeof e.id === 'string' && e.id ? e.id.slice(0, 40) : newEventId(),
      kind,
      date,
      precision,
      title: typeof e.title === 'string' ? e.title.slice(0, 120) : undefined,
      note: typeof e.note === 'string' ? e.note.slice(0, 2000) : undefined,
    });
  }
  return sortEvents(out);
}

export const sortEvents = (list: LifeEvent[]) => [...list].sort((a, b) => a.date.localeCompare(b.date));

export const newEventId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function readAll(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

export function loadEvents(input: BirthInput): LifeEvent[] {
  return sanitizeEvents(readAll()[birthKey(input)]);
}

export function saveEvents(input: BirthInput, events: LifeEvent[]): void {
  try {
    const all = readAll();
    const key = birthKey(input);
    if (events.length) all[key] = sortEvents(events);
    else delete all[key];
    localStorage.setItem(EVENTS_KEY, JSON.stringify(all));
  } catch { /* storage full or blocked: events last for this visit only */ }
}
