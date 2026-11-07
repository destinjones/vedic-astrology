import { describe, expect, it } from 'vitest';
import { exportAll, mergeTab, restoreAll } from '../src/lib/backup';
import type { Tab, Workspace } from '../src/lib/tabs';

const input = { name: 'Asha', date: '1990-08-15', time: '06:30', place: 'New Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata', ayanamsa: 'lahiri' as const };
const tab = (patch: Partial<Tab>): Tab => ({ id: 't1', label: 'Asha', input, notes: '', log: [], events: [], ...patch });

describe('sync merge', () => {
  it('joins history, keeps outcomes marked on either side, and keeps both notes', () => {
    const here = tab({ notes: 'Calm in session.', log: [{ id: 'p1', kind: 'prediction', text: 'Move abroad', at: '2026-01-01T00:00:00Z', outcome: 'open' }] });
    const there = tab({ notes: 'Asked about work.', log: [
      { id: 'p1', kind: 'prediction', text: 'Move abroad', at: '2026-01-01T00:00:00Z', outcome: 'came-true' },
      { id: 'q2', kind: 'question', text: 'Job change?', at: '2026-02-01T00:00:00Z' },
    ] });
    const m = mergeTab(here, there);
    expect(m.log.map((e) => e.id)).toEqual(['q2', 'p1']);
    expect(m.log[1].outcome).toBe('came-true');
    expect(m.notes).toContain('Calm in session.');
    expect(m.notes).toContain('Asked about work.');
    expect(mergeTab(m, there).notes).toBe(m.notes); // running sync twice adds nothing
  });
  it('a sync restore joins the same tab instead of skipping it', () => {
    const ws: Workspace = { tabs: [tab({ notes: 'A' })], activeId: 't1', archived: [] };
    const other: Workspace = { tabs: [tab({ notes: 'A\nB' })], activeId: 't1', archived: [] };
    const text = exportAll(other, []);
    expect(restoreAll(ws, [], text).ws.tabs[0].notes).toBe('A');
    expect(restoreAll(ws, [], text, { mergeExisting: true }).ws.tabs[0].notes).toBe('A\nB');
  });
});
