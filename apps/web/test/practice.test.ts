import { describe, expect, it } from 'vitest';
import { exportAll, mergeTab, restoreAll } from '../src/lib/backup';
import { parseTab, type Tab, type Workspace } from '../src/lib/tabs';
import {
  allPredictions, dueForCheck, draftInvoice, invoiceTotals, parseInvoices, parsePractice, parseRemedies, predictionsCsv, safeLink, scheduleCheckIns, score,
  blankPractice, type RemedyPlan,
} from '../src/lib/practice';
import { invoiceHtml, remedyChecklistHtml } from '../src/lib/practicePrint';

const tab = (patch: Partial<Tab>): Tab => ({ id: 't1', label: 'Asha', notes: '', log: [], events: [], ...patch });
const plan = (patch: Partial<RemedyPlan> = {}): RemedyPlan => ({ startedOn: '2026-01-01', items: [{ id: 'r1', kind: 'mantra', text: 'Om Shum Shukraya Namah', how: '108 each Friday' }], checkIns: [], note: '', ...patch });

describe('prediction track record', () => {
  const t1 = tab({ log: [
    { id: 'a', kind: 'prediction', text: 'New job', at: '2026-01-01T00:00:00Z', about: '2026-03-01', outcome: 'came-true', area: 'career' },
    { id: 'b', kind: 'prediction', text: 'Move', at: '2026-01-02T00:00:00Z', about: '2026-02-01', outcome: 'open' },
    { id: 'c', kind: 'question', text: 'Will I?', at: '2026-01-02T00:00:00Z' },
  ] });
  const t2 = tab({ id: 't2', label: 'Ravi', log: [{ id: 'd', kind: 'prediction', text: 'Marriage', at: '2026-01-03T00:00:00Z', about: '2027-01-01', outcome: 'partly' }] });
  it('collects predictions across open and closed tabs and scores them', () => {
    const all = allPredictions([t1], [t2]);
    expect(all.map((p) => p.entry.id)).toEqual(['d', 'b', 'a']);
    expect(all.find((p) => p.entry.id === 'd')?.open).toBe(false);
    const s = score(all.map((p) => p.entry));
    expect(s).toMatchObject({ total: 3, checked: 2, hits: 1, partly: 1 });
    expect(s.rate).toBe(0.75);
    expect(dueForCheck(all, '2026-06-01').map((p) => p.entry.id)).toEqual(['b']);
  });
  it('keeps area and markedAt through storage, and drops bad ones', () => {
    const t = parseTab({ ...t1, log: [{ ...t1.log[0], markedAt: '2026-03-02T00:00:00Z' }, { ...t1.log[1], area: 'nonsense' }] }, 1)!;
    expect(t.log[0].area).toBe('career');
    expect(t.log[0].markedAt).toBe('2026-03-02T00:00:00Z');
    expect(t.log[1].area).toBeUndefined();
  });
  it('escapes formulas in the CSV', () => {
    const csv = predictionsCsv(allPredictions([tab({ label: '=HYPERLINK("x")', log: [t1.log[0]] })], []));
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('remedy follow-up', () => {
  it('schedules check-ins from the start date and keeps marked ones', () => {
    const p = plan();
    const c = scheduleCheckIns(p, 14, 3);
    expect(c.map((x) => x.date)).toEqual(['2026-01-15', '2026-01-29', '2026-02-12']);
    const marked = { ...p, checkIns: [{ ...c[0], status: 'done' as const }, ...c.slice(1)] };
    const again = scheduleCheckIns(marked, 7, 2);
    expect(again.map((x) => `${x.date}:${x.status}`)).toEqual(['2026-01-08:pending', '2026-01-15:done']);
  });
  it('parses stored plans and drops empty ones', () => {
    expect(parseRemedies({ items: [], checkIns: [] })).toBeUndefined();
    const p = parseRemedies({ startedOn: 'bad', items: [{ text: 'x', kind: 'weird' }], checkIns: [{ date: '2026-02-01', status: 'done' }, { date: 'nope' }] })!;
    expect(p.items[0].kind).toBe('other');
    expect(p.checkIns).toHaveLength(1);
  });
  it('escapes client text on the printed checklist', () => {
    const html = remedyChecklistHtml('<script>x</script>', plan(), blankPractice().business);
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('invoices and packages', () => {
  it('drafts from a package with the practice counter, tax and link', () => {
    const p = { ...blankPractice(), nextInvoice: 7, business: { ...blankPractice().business, currency: 'USD', taxRate: 10, paymentLink: 'https://pay.example/me' } };
    const inv = draftInvoice(p, { id: 'k', name: 'Career reading', description: '60 min', price: 120, sessions: 1 });
    expect(inv.number).toBe('INV-0007');
    expect(inv.currency).toBe('USD');
    expect(invoiceTotals(inv)).toEqual({ subtotal: 120, tax: 12, total: 132 });
    expect(inv.paymentLink).toBe('https://pay.example/me');
  });
  it('refuses script links', () => {
    expect(safeLink('javascript:alert(1)')).toBe('');
    expect(parsePractice({ business: { paymentLink: 'javascript:alert(1)' } }).business.paymentLink).toBe('');
    expect(parseInvoices([{ lines: [{ description: 'x', qty: 1, price: 5 }], paymentLink: 'javascript:alert(1)' }])![0].paymentLink).toBeUndefined();
  });
  it('prints a receipt once paid', () => {
    const inv = { ...draftInvoice(blankPractice()), status: 'paid' as const, paidOn: '2026-02-02', method: 'UPI' };
    const html = invoiceHtml('Asha', inv, blankPractice().business);
    expect(html).toContain('Receipt');
    expect(html).toContain('Paid by UPI');
  });
});

describe('backup and sync', () => {
  it('carries remedies, invoices and the practice through a backup', () => {
    const inv = draftInvoice(blankPractice());
    const ws: Workspace = { tabs: [tab({ remedies: plan(), invoices: [inv] })], activeId: 't1', archived: [] };
    const practice = { ...blankPractice(), nextInvoice: 5, packages: [{ id: 'k', name: 'Reading', description: '', price: 50, sessions: 1 }] };
    const text = exportAll(ws, [], practice);
    const empty: Workspace = { tabs: [tab({ id: 'other' })], activeId: 'other', archived: [] };
    const r = restoreAll(empty, [], text, { practice: blankPractice() });
    const back = [...r.ws.tabs, ...r.ws.archived].find((t) => t.id === 't1')!;
    expect(back.remedies?.items[0].text).toBe('Om Shum Shukraya Namah');
    expect(back.invoices?.[0].number).toBe(inv.number);
    expect(r.practice?.nextInvoice).toBe(5);
    expect(r.practice?.packages).toHaveLength(1);
  });
  it('sync keeps a paid mark and a kept-up check-in from either device', () => {
    const inv = draftInvoice(blankPractice());
    const c = scheduleCheckIns(plan(), 7, 2);
    const here = tab({ invoices: [inv], remedies: plan({ checkIns: c }) });
    const there = tab({ invoices: [{ ...inv, status: 'paid', paidOn: '2026-02-01' }], remedies: plan({ checkIns: [{ ...c[0], status: 'done', note: 'daily' }, c[1]] }) });
    const m = mergeTab(here, there);
    expect(m.invoices?.[0].status).toBe('paid');
    expect(m.remedies?.checkIns[0]).toMatchObject({ status: 'done', note: 'daily' });
    expect(mergeTab(m, there).remedies?.checkIns).toHaveLength(2);
  });
});
