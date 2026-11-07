/**
 * One file with everything this browser keeps: open and closed tabs (charts,
 * notes, client history) and saved charts. Restoring merges, so nothing already
 * here is lost and running a restore twice adds nothing new.
 */
import { importProfiles, type Profile } from './profiles';
import { MAX_ARCHIVED, MAX_TABS, parseTabs, type Tab, type Workspace } from './tabs';

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

/** Merges a backup into what is here. Accepts this format and the older saved-charts-only file. Throws on anything else. */
export function restoreAll(ws: Workspace, profiles: Profile[], text: string): RestoreResult {
  const data = JSON.parse(text) as { workspace?: { tabs?: unknown; archived?: unknown }; profiles?: unknown };
  if (!data || typeof data !== 'object' || (!data.workspace && !data.profiles)) throw new Error('not a backup');

  const known = new Set([...ws.tabs, ...ws.archived].map((t) => t.id));
  const fresh = (list: Tab[]) => list.filter((t) => !known.has(t.id) && (known.add(t.id), true));
  const incomingOpen = fresh(parseTabs(data.workspace?.tabs, MAX_ARCHIVED));
  const incomingClosed = fresh(parseTabs(data.workspace?.archived, MAX_ARCHIVED));

  // empty placeholder tabs here make way for restored ones
  const keep = ws.tabs.filter((t) => t.input || t.notes.trim() || t.log.length);
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
