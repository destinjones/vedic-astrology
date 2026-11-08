/**
 * One file with everything this browser keeps: open and closed tabs (charts,
 * notes, client history), saved charts and the family links between them. Restoring merges, so nothing already
 * here is lost and running a restore twice adds nothing new.
 */
import { loadLinks, mergeLinks, type FamilyLink } from './family';
import { importProfiles, sameBirth, sanitizeInput, type Profile } from './profiles';
import { mergeInvoices, mergePractice, mergeRemedies, parsePractice, type Practice } from './practice';
import { hasContent, MAX_ARCHIVED, MAX_TABS, parseTabs, type Tab, type Workspace } from './tabs';

export const BACKUP_VERSION = 2;

export function exportAll(ws: Workspace, profiles: Profile[], opts: { family?: FamilyLink[]; practice?: Practice } = {}): string {
  const family = opts.family ?? loadLinks();
  const practice = opts.practice;
  return JSON.stringify(
    { app: 'jyotisha-explorer', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), workspace: ws, profiles, family, ...(practice ? { practice } : {}) },
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
  /** Family links after the merge; write them with storeLinks(). */
  family: FamilyLink[];
  linksAdded: number;
  /** Packages and business details from the backup joined with these; undefined when the file has none. */
  practice?: Practice;
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
  const marked = new Map(there.log.filter((e) => e.outcome && e.outcome !== 'open').map((e) => [e.id, e]));
  const log = byId(here.log, there.log)
    .map((e) => {
      const o = marked.get(e.id);
      return e.outcome === 'open' && o ? { ...e, outcome: o.outcome, ...(o.markedAt ? { markedAt: o.markedAt } : {}) } : e;
    })
    .sort((a, b) => b.at.localeCompare(a.at));
  const events = byId(here.events, there.events).sort((a, b) => a.date.localeCompare(b.date));
  const a = here.notes.trim(), b = there.notes.trim();
  const notes = !b || a.includes(b) ? here.notes : !a || b.includes(a) ? there.notes : `${here.notes.trimEnd()}\n\n— from another device —\n${there.notes.trim()}`;
  const readings = here.readings || there.readings ? byId(here.readings ?? [], there.readings ?? []).sort((x, y) => y.date.localeCompare(x.date)) : undefined;
  // a follow-up set on either side is kept; when both have one, the sooner date wins
  const followUp = !here.followUp ? there.followUp : !there.followUp ? here.followUp : there.followUp.date < here.followUp.date ? there.followUp : here.followUp;
  const remedies = mergeRemedies(here.remedies, there.remedies);
  const invoices = mergeInvoices(here.invoices, there.invoices);
  return { ...here, log, events, notes, input: here.input ?? there.input, readings, followUp, ...(remedies ? { remedies } : {}), ...(invoices ? { invoices } : {}) };
}

/** Merges a backup into what is here. Accepts this format and the older saved-charts-only file. Throws on anything else. */
export function restoreAll(ws: Workspace, profiles: Profile[], text: string, opts: { mergeExisting?: boolean; family?: FamilyLink[]; practice?: Practice } = {}): RestoreResult {
  const data = JSON.parse(text) as { workspace?: { tabs?: unknown; archived?: unknown }; profiles?: unknown; family?: unknown; practice?: unknown };
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

  // Family links name saved charts by id. A chart that was already here under
  // another id keeps its id, so the backup's links are pointed at it.
  let family = opts.family ?? loadLinks();
  let linksAdded = 0;
  if (Array.isArray(data.family)) {
    const idMap = new Map<string, string>();
    for (const raw of Array.isArray(data.profiles) ? (data.profiles as Record<string, unknown>[]) : []) {
      const input = raw && typeof raw.id === 'string' ? sanitizeInput(raw.input) : null;
      const local = input && nextProfiles.find((p) => sameBirth(p.input, input));
      if (local) idMap.set(raw.id as string, local.id);
    }
    const remapped = (data.family as Record<string, unknown>[]).map((l) => (l && typeof l === 'object'
      ? { ...l, fromId: idMap.get(String(l.fromId)) ?? l.fromId, toId: idMap.get(String(l.toId)) ?? l.toId }
      : l));
    const known = new Set(nextProfiles.map((p) => p.id));
    const r = mergeLinks(family, remapped.filter((l) => l && known.has(String(l.fromId)) && known.has(String(l.toId))));
    family = r.list;
    linksAdded = r.added;
  }
  const practice = data.practice ? mergePractice(opts.practice ?? parsePractice(null), parsePractice(data.practice)) : undefined;
  return { ws: { tabs, activeId, archived }, profiles: nextProfiles, tabsAdded: incomingOpen.length + incomingClosed.length, chartsAdded, family, linksAdded, ...(practice ? { practice } : {}) };
}
