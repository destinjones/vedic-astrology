/**
 * The client list: one row per person the astrologer works with, built from
 * what this browser already keeps. A client is a workspace tab (open or
 * closed, holding notes, history, readings and a follow-up date), and any
 * saved chart that has no tab yet is listed too. Nothing here is stored
 * separately, so backup, restore and sync already carry it.
 */
import type { BirthInput } from '../types/chart';
import { sameBirth, type Profile } from './profiles';
import { hasContent, type LogEntry, type Reading, type Tab, type Workspace } from './tabs';

export interface ClientRow {
  /** tab id, or `profile:<id>` for a saved chart with no tab */
  key: string;
  label: string;
  input?: BirthInput;
  /** 'open' and 'closed' are tabs; 'saved' is a saved chart only */
  where: 'open' | 'closed' | 'saved';
  tab?: Tab;
  profile?: Profile;
  readings: Reading[];
  lastReading?: Reading;
  /** the newest prediction, for "what I said last time" */
  lastPrediction?: LogEntry;
  openPredictions: number;
  followUp?: Tab['followUp'];
  notes: string;
  /** newest activity date (YYYY-MM-DD), for sorting */
  lastActive?: string;
}

const dayOf = (iso: string) => iso.slice(0, 10);

function fromTab(t: Tab, where: 'open' | 'closed', profiles: Profile[]): ClientRow {
  const readings = t.readings ?? [];
  const preds = t.log.filter((e) => e.kind === 'prediction');
  const dates = [readings[0]?.date, t.log[0] ? dayOf(t.log[0].at) : undefined].filter(Boolean) as string[];
  return {
    key: t.id,
    label: t.label,
    input: t.input,
    where,
    tab: t,
    profile: t.input ? profiles.find((p) => sameBirth(p.input, t.input!)) : undefined,
    readings,
    lastReading: readings[0],
    lastPrediction: preds[0],
    openPredictions: preds.filter((e) => e.outcome === 'open').length,
    followUp: t.followUp,
    notes: t.notes,
    lastActive: dates.sort().at(-1),
  };
}

/** Every client in this browser: open tabs, then closed tabs, then saved charts with no tab. Same birth is listed once. */
export function buildClients(ws: Workspace, profiles: Profile[]): ClientRow[] {
  const rows: ClientRow[] = [];
  const taken = (i?: BirthInput) => !!i && rows.some((r) => r.input && sameBirth(r.input, i));
  for (const t of ws.tabs) if (hasContent(t) && !taken(t.input)) rows.push(fromTab(t, 'open', profiles));
  for (const t of ws.archived) if (!taken(t.input)) rows.push(fromTab(t, 'closed', profiles));
  for (const p of profiles) {
    if (taken(p.input)) continue;
    rows.push({ key: `profile:${p.id}`, label: p.label, input: p.input, where: 'saved', profile: p, readings: [], openPredictions: 0, notes: '', lastActive: dayOf(p.updatedAt) });
  }
  return rows;
}

export type ClientSort = 'follow-up' | 'name' | 'recent';

export function sortClients(rows: ClientRow[], by: ClientSort): ClientRow[] {
  const name = (a: ClientRow, b: ClientRow) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
  return [...rows].sort((a, b) => {
    if (by === 'name') return name(a, b);
    if (by === 'recent') return (b.lastActive ?? '').localeCompare(a.lastActive ?? '') || name(a, b);
    // soonest follow-up first, then clients with none, by name
    const fa = a.followUp?.date ?? '9999', fb = b.followUp?.date ?? '9999';
    return fa.localeCompare(fb) || name(a, b);
  });
}

export function matchesClient(r: ClientRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [r.label, r.input?.place, r.input?.date, r.notes, r.followUp?.note, ...r.readings.map((x) => x.summary)]
    .some((x) => x?.toLowerCase().includes(s));
}
