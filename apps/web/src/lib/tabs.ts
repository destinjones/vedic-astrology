/**
 * Workspace tabs: one tab per person or client, kept in this browser so they
 * are all still open when the astrologer comes back.
 */
import type { BirthInput, VargaId } from '../types/chart';
import type { ChartStyle } from '../types/ui';
import type { LifeEvent } from '@vedic/timing';
import { sanitizeInput } from './profiles';
import { loadEvents, sanitizeEvents } from './lifeEvents';
import { parseAnnotations, type Annotation } from './annotations';

export type EntryKind = 'question' | 'prediction' | 'note';
export type Outcome = 'open' | 'came-true' | 'partly' | 'did-not';

/** One line in a client's history: a question they asked, a prediction you made, or a dated note. */
export interface LogEntry {
  id: string;
  kind: EntryKind;
  text: string;
  /** ISO date-time the entry was written */
  at: string;
  /** predictions: the date (YYYY-MM-DD) or start of the window it is about */
  about?: string;
  /** predictions: marked later */
  outcome?: Outcome;
}

/** A session held with the client, for the client list. */
export interface Reading {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  summary: string;
}

/** When to get back in touch, and why. */
export interface FollowUp {
  /** YYYY-MM-DD */
  date: string;
  note?: string;
}

export interface Tab {
  id: string;
  label: string;
  /** Set once a chart has been worked out in this tab. */
  input?: BirthInput;
  /** Private notes for this person. Never put in share links. */
  notes: string;
  /** Questions, predictions and dated notes, newest first. */
  log: LogEntry[];
  /** Past life events for the event checker, oldest first. */
  events: LifeEvent[];
  style?: ChartStyle;
  varga?: VargaId;
  /** true once the person renamed the tab, so later charts keep their label */
  named?: boolean;
  /** Notes pinned to houses and planets of this chart. */
  annotations?: Annotation[];
  /** Sessions held, newest first. */
  readings?: Reading[];
  /** Next time to contact this client. */
  followUp?: FollowUp;
}

export interface Workspace {
  /** Open tabs, in order. */
  tabs: Tab[];
  activeId: string;
  /** Closed tabs keep their chart, notes and history until deleted, newest first. */
  archived: Tab[];
}

export const MAX_ARCHIVED = 500;
/** A tab worth keeping when it is closed. */
export const hasContent = (t: Tab) =>
  !!t.input || !!t.notes.trim() || t.log.length > 0 || t.events.length > 0 || !!t.annotations?.length || !!t.readings?.length || !!t.followUp;

const KEY = 'vedic.tabs.v1';
export const MAX_TABS = 24;

export const newTabId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const blankTab = (n: number): Tab => ({ id: newTabId(), label: `Chart ${n}`, notes: '', log: [], events: [] });

const KINDS: EntryKind[] = ['question', 'prediction', 'note'];
const OUTCOMES: Outcome[] = ['open', 'came-true', 'partly', 'did-not'];

function parseLog(raw: unknown): LogEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: LogEntry[] = [];
  for (const e of raw.slice(0, 2000)) {
    if (!e || typeof e !== 'object') continue;
    const r = e as Record<string, unknown>;
    if (typeof r.text !== 'string' || !r.text.trim()) continue;
    const kind = KINDS.includes(r.kind as EntryKind) ? (r.kind as EntryKind) : 'note';
    out.push({
      id: typeof r.id === 'string' && r.id ? r.id.slice(0, 64) : newTabId(),
      kind,
      text: r.text.slice(0, 5000),
      at: typeof r.at === 'string' && !Number.isNaN(Date.parse(r.at)) ? r.at : new Date().toISOString(),
      about: typeof r.about === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.about) ? r.about : undefined,
      outcome: kind === 'prediction' ? (OUTCOMES.includes(r.outcome as Outcome) ? (r.outcome as Outcome) : 'open') : undefined,
    });
  }
  return out;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v: unknown): v is string => typeof v === 'string' && DAY_RE.test(v) && !Number.isNaN(Date.parse(v));

export function parseReadings(raw: unknown): Reading[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Reading[] = [];
  for (const e of raw.slice(0, 1000)) {
    if (!e || typeof e !== 'object') continue;
    const r = e as Record<string, unknown>;
    if (!isDay(r.date)) continue;
    out.push({
      id: typeof r.id === 'string' && r.id ? r.id.slice(0, 64) : newTabId(),
      date: r.date,
      summary: typeof r.summary === 'string' ? r.summary.slice(0, 5000) : '',
    });
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  return out.length ? out : undefined;
}

export function parseFollowUp(raw: unknown): FollowUp | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (!isDay(r.date)) return undefined;
  const note = typeof r.note === 'string' && r.note.trim() ? r.note.slice(0, 500) : undefined;
  return { date: r.date, ...(note ? { note } : {}) };
}

/** Reads one stored or imported tab; null when it is not a tab. */
export function parseTab(t: unknown, n: number): Tab | null {
  if (!t || typeof t !== 'object') return null;
  const r = t as Record<string, unknown>;
  const input = r.input ? sanitizeInput(r.input) ?? undefined : undefined;
  return {
    id: typeof r.id === 'string' && r.id ? r.id.slice(0, 64) : newTabId(),
    label: typeof r.label === 'string' && r.label.trim() ? r.label.slice(0, 60) : `Chart ${n}`,
    input,
    notes: typeof r.notes === 'string' ? r.notes.slice(0, 20000) : '',
    log: parseLog(r.log),
    // tabs saved before events moved here pick them up from the old per-birth store
    events: Array.isArray(r.events) ? sanitizeEvents(r.events) : input ? loadEvents(input) : [],
    style: r.style === 'south' ? 'south' : r.style === 'north' ? 'north' : undefined,
    varga: typeof r.varga === 'string' && /^D\d{1,2}$/.test(r.varga) ? (r.varga as VargaId) : undefined,
    named: r.named === true,
    annotations: Array.isArray(r.annotations) && r.annotations.length ? parseAnnotations(r.annotations) : undefined,
    readings: parseReadings(r.readings),
    followUp: parseFollowUp(r.followUp),
  };
}

export function parseTabs(raw: unknown, max: number): Tab[] {
  const out: Tab[] = [];
  for (const t of Array.isArray(raw) ? raw.slice(0, max) : []) {
    const tab = parseTab(t, out.length + 1);
    if (tab) out.push(tab);
  }
  return out;
}

/** The label a tab takes from its chart, unless the person named it. */
export const labelFor = (i: BirthInput) => i.name?.trim() || i.place.split(',')[0].trim() || 'Chart';

export function loadWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as { tabs?: unknown; activeId?: unknown; archived?: unknown };
      const archived = parseTabs(data.archived, MAX_ARCHIVED);
      const tabs = parseTabs(data.tabs, MAX_TABS);
      if (tabs.length) {
        const activeId = tabs.some((t) => t.id === data.activeId) ? (data.activeId as string) : tabs[0].id;
        return { tabs, activeId, archived };
      }
      if (archived.length) { const first = blankTab(1); return { tabs: [first], activeId: first.id, archived }; }
    }
  } catch { /* fall through to a fresh workspace */ }
  const first = blankTab(1);
  return { tabs: [first], activeId: first.id, archived: [] };
}

export function storeWorkspace(ws: Workspace): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(ws)); return true; } catch { return false; }
}
