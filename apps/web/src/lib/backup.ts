/**
 * One file with everything this browser keeps: open and closed tabs (charts,
 * notes, client history) and saved charts. Restoring merges, so nothing already
 * here is lost and running a restore twice adds nothing new.
 */
import { importProfiles, type Profile } from './profiles';
import { hasContent, MAX_ARCHIVED, MAX_TABS, parseTabs, type Tab, type Workspace } from './tabs';

export const BACKUP_VERSION = 2;

export function exportAll(ws: Workspace, profiles: Profile[]): string {
  return JSON.stringify(
    { app: 'jyotisha-explorer', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), workspace: ws, profiles },
    null,
    2,
  );
}

export function backupFileName() {
  return `jyotisha-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export function downloadText(text: string, name: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export interface RestoreResult {
  ws: Workspace;
  profiles: Profile[];
  tabsAdded: number;
  chartsAdded: number;
}

const byId = <T extends { id: string }>(a: T[], b: T[]) => {
  const seen = new Set(a.map((x) => x.id));
  return [...a, ...b.filter((x) => !seen.has(x.id))];
};

/**
 * Folds another device's copy of a tab into this one: history entries and life
 * events are joined by id, a prediction marked on either side keeps its mark,
 * and notes written on both sides are kept, one after the other.
 */
export function mergeTab(here: Tab, there: Tab): Tab {
  const marked = new Map(there.log.filter((e) => e.outcome && e.outcome !== 'open').map((e) => [e.id, e.outcome]));
  const log = byId(here.log, there.log)
    .map((e) => (e.outcome === 'open' && marked.has(e.id) ? { ...e, outcome: marked.get(e.id) } : e))
    .sort((a, b) => b.at.localeCompare(a.at));
  const events = byId(here.events, there.events).sort((a, b) => a.date.localeCompare(b.date));
  const a = here.notes.trim(), b = there.notes.trim();
  const notes = !b || a.includes(b) ? here.notes : !a || b.includes(a) ? there.notes : `${here.notes.trimEnd()}\n\n— from another device —\n${there.notes.trim()}`;
  const readings = here.readings || there.readings ? byId(here.readings ?? [], there.readings ?? []).sort((x, y) => y.date.localeCompare(x.date)) : undefined;
  // a follow-up set on either side is kept; when both have one, the sooner date wins
  const followUp = !here.followUp ? there.followUp : !there.followUp ? here.followUp : there.followUp.date < here.followUp.date ? there.followUp : here.followUp;
  return { ...here, log, events, notes, input: here.input ?? there.input, readings, followUp };
}

/** Merges a backup into what is here. Accepts this format and the older saved-charts-only file. Throws on anything else. */
export function restoreAll(ws: Workspace, profiles: Profile[], text: string, opts: { mergeExisting?: boolean } = {}): RestoreResult {
  const data = JSON.parse(text) as { workspace?: { tabs?: unknown; archived?: unknown }; profiles?: unknown };
  if (!data || typeof data !== 'object' || (!data.workspace && !data.profiles)) throw new Error('not a backup');

  if (opts.mergeExisting) {
    // sync: the same tab on both devices is joined rather than skipped
    const theirs = new Map([...parseTabs(data.workspace?.tabs, MAX_ARCHIVED), ...parseTabs(data.workspace?.archived, MAX_ARCHIVED)].map((t) => [t.id, t]));
    const fold = (t: Tab) => (theirs.has(t.id) ? mergeTab(t, theirs.get(t.id)!) : t);
    ws = { ...ws, tabs: ws.tabs.map(fold), archived: ws.archived.map(fold) };
    // a saved chart edited on the other device (label, rating) takes the newer edit
    const incoming = Array.isArray(data.profiles) ? (data.profiles as Profile[]) : [];
    profiles = profiles.map((p) => {
      const q = incoming.find((x) => x && x.id === p.id && typeof x.updatedAt === 'string' && x.updatedAt > p.updatedAt);
      const clean = q ? importProfiles([], JSON.stringify([q])).list[0] : undefined;
      return clean ? { ...clean, id: p.id } : p;
    });
  }

  const known = new Set([...ws.tabs, ...ws.archived].map((t) => t.id));
  const fresh = (list: Tab[]) => list.filter((t) => !known.has(t.id) && (known.add(t.id), true));
  const incomingOpen = fresh(parseTabs(data.workspace?.tabs, MAX_ARCHIVED));
  const incomingClosed = fresh(parseTabs(data.workspace?.archived, MAX_ARCHIVED));

  // empty placeholder tabs here make way for restored ones
  const keep = ws.tabs.filter(hasContent);
  const room = Math.max(0, MAX_TABS - keep.length);
  const open = [...keep, ...incomingOpen.slice(0, room)];
  const archived = [...incomingOpen.slice(room), ...incomingClosed, ...ws.archived].slice(0, MAX_ARCHIVED);
  const tabs = open.length ? open : ws.tabs;
  const activeId = tabs.some((t) => t.id === ws.activeId) ? ws.activeId : tabs[0].id;

  let chartsAdded = 0;
  let nextProfiles = profiles;
  if (data.profiles) {
    const r = importProfiles(profiles, JSON.stringify(data.profiles));
    nextProfiles = r.list;
    chartsAdded = r.added;
  }
  return { ws: { tabs, activeId, archived }, profiles: nextProfiles, tabsAdded: incomingOpen.length + incomingClosed.length, chartsAdded };
}
