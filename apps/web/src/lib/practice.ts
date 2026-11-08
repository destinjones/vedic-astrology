/**
 * The astrologer's practice records, all kept in this browser:
 *  - remedy follow-up plans and invoices live on each client's tab (see tabs.ts),
 *    so they travel with backups and sync like the rest of a client's history;
 *  - packages and business details are practice-wide, under their own key.
 * Nothing here is sent anywhere.
 */
import type { LogEntry, Tab } from './tabs';

/* ---------- remedies ---------- */

export type RemedyItemKind = 'mantra' | 'practice' | 'charity' | 'fast' | 'gem' | 'other';
export const REMEDY_KINDS: RemedyItemKind[] = ['mantra', 'practice', 'charity', 'fast', 'gem', 'other'];
export const REMEDY_KIND_LABEL: Record<RemedyItemKind, string> = {
  mantra: 'Mantra', practice: 'Practice', charity: 'Charity', fast: 'Fast', gem: 'Gemstone', other: 'Other',
};

export interface RemedyItem {
  id: string;
  kind: RemedyItemKind;
  /** What to do, e.g. "Om Shum Shukraya Namah" */
  text: string;
  /** How often, in the astrologer's words, e.g. "108 times every Friday morning" */
  how: string;
}

export type CheckInStatus = 'pending' | 'done' | 'missed';
export interface CheckIn {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  status: CheckInStatus;
  note: string;
}

/** One remedy plan per client: what to do, from when, and when to check in. */
export interface RemedyPlan {
  /** YYYY-MM-DD the client starts */
  startedOn: string;
  items: RemedyItem[];
  checkIns: CheckIn[];
  /** A line for the top of the printed checklist */
  note: string;
}

/* ---------- invoices ---------- */

export interface InvoiceLine {
  description: string;
  qty: number;
  /** In the invoice currency, major units (e.g. 1500.50) */
  price: number;
}

export type InvoiceStatus = 'unpaid' | 'paid' | 'void';
export interface Invoice {
  id: string;
  /** e.g. INV-0007 */
  number: string;
  /** YYYY-MM-DD */
  issuedOn: string;
  currency: string;
  lines: InvoiceLine[];
  /** Tax as a percentage, 0 for none */
  taxRate: number;
  status: InvoiceStatus;
  /** YYYY-MM-DD */
  paidOn?: string;
  /** e.g. UPI, cash, bank transfer */
  method?: string;
  note: string;
  /** Link the client pays at, copied from the practice details when the invoice was made */
  paymentLink?: string;
}

export interface Package {
  id: string;
  name: string;
  description: string;
  price: number;
  /** Number of sessions included, 1 for a single reading */
  sessions: number;
}

export interface Business {
  name: string;
  /** Email, phone, website: free text, one per line */
  contact: string;
  address: string;
  /** ISO 4217 code, e.g. INR, USD */
  currency: string;
  /** e.g. a UPI, PayPal or Stripe link */
  paymentLink: string;
  /** Label for tax lines, e.g. GST or VAT */
  taxLabel: string;
  /** Default tax percentage */
  taxRate: number;
  /** Printed at the bottom of invoices */
  footer: string;
}

export interface Practice {
  business: Business;
  packages: Package[];
  /** The number the next invoice takes */
  nextInvoice: number;
}

export const PRACTICE_KEY = 'vedic.practice.v1';

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const blankPractice = (): Practice => ({
  business: { name: '', contact: '', address: '', currency: 'INR', paymentLink: '', taxLabel: 'Tax', taxRate: 0, footer: 'Thank you.' },
  packages: [],
  nextInvoice: 1,
});

/* ---------- validation ---------- */

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const num = (v: unknown, min: number, max: number, dflt: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};
const id = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 64) : newId());
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const list = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);
const currency = (v: unknown) => (typeof v === 'string' && /^[A-Za-z]{3}$/.test(v) ? v.toUpperCase() : 'INR');
/** Only web links: a pasted javascript: link must never end up on a printed invoice. */
export const safeLink = (v: unknown) => {
  const s = str(v, 500).trim();
  if (!s) return '';
  try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'upi:' ? u.href : ''; } catch { return ''; }
};

export function parseRemedies(raw: unknown): RemedyPlan | undefined {
  const r = obj(raw);
  if (!r) return undefined;
  const items: RemedyItem[] = [];
  for (const x of list(r.items, 50)) {
    const o = obj(x);
    if (!o || !str(o.text, 500).trim()) continue;
    items.push({
      id: id(o.id),
      kind: REMEDY_KINDS.includes(o.kind as RemedyItemKind) ? (o.kind as RemedyItemKind) : 'other',
      text: str(o.text, 500),
      how: str(o.how, 300),
    });
  }
  const checkIns: CheckIn[] = [];
  for (const x of list(r.checkIns, 100)) {
    const o = obj(x);
    const d = o && day(o.date);
    if (!o || !d) continue;
    checkIns.push({ id: id(o.id), date: d, status: o.status === 'done' || o.status === 'missed' ? o.status : 'pending', note: str(o.note, 1000) });
  }
  checkIns.sort((a, b) => a.date.localeCompare(b.date));
  if (!items.length && !checkIns.length) return undefined;
  return { startedOn: day(r.startedOn) ?? today(), items, checkIns, note: str(r.note, 1000) };
}

export function parseInvoices(raw: unknown): Invoice[] | undefined {
  const out: Invoice[] = [];
  for (const x of list(raw, 1000)) {
    const o = obj(x);
    if (!o) continue;
    const lines: InvoiceLine[] = [];
    for (const l of list(o.lines, 50)) {
      const q = obj(l);
      if (!q || !str(q.description, 300).trim()) continue;
      lines.push({ description: str(q.description, 300), qty: num(q.qty, 0, 1000, 1), price: num(q.price, 0, 1e9, 0) });
    }
    if (!lines.length) continue;
    const status: InvoiceStatus = o.status === 'paid' || o.status === 'void' ? o.status : 'unpaid';
    const link = safeLink(o.paymentLink);
    out.push({
      id: id(o.id),
      number: str(o.number, 40) || 'INV',
      issuedOn: day(o.issuedOn) ?? today(),
      currency: currency(o.currency),
      lines,
      taxRate: num(o.taxRate, 0, 100, 0),
      status,
      ...(status === 'paid' && day(o.paidOn) ? { paidOn: day(o.paidOn) } : {}),
      ...(str(o.method, 60) ? { method: str(o.method, 60) } : {}),
      note: str(o.note, 1000),
      ...(link ? { paymentLink: link } : {}),
    });
  }
  out.sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || b.number.localeCompare(a.number));
  return out.length ? out : undefined;
}

export function parsePractice(raw: unknown): Practice {
  const r = obj(raw);
  const base = blankPractice();
  if (!r) return base;
  const b = obj(r.business) ?? {};
  const packages: Package[] = [];
  for (const x of list(r.packages, 100)) {
    const o = obj(x);
    if (!o || !str(o.name, 120).trim()) continue;
    packages.push({ id: id(o.id), name: str(o.name, 120), description: str(o.description, 500), price: num(o.price, 0, 1e9, 0), sessions: Math.round(num(o.sessions, 1, 100, 1)) });
  }
  return {
    business: {
      name: str(b.name, 120),
      contact: str(b.contact, 500),
      address: str(b.address, 500),
      currency: typeof b.currency === 'string' ? currency(b.currency) : base.business.currency,
      paymentLink: safeLink(b.paymentLink),
      taxLabel: str(b.taxLabel, 20) || base.business.taxLabel,
      taxRate: num(b.taxRate, 0, 100, 0),
      footer: typeof b.footer === 'string' ? str(b.footer, 500) : base.business.footer,
    },
    packages,
    nextInvoice: Math.round(num(r.nextInvoice, 1, 1e7, 1)),
  };
}

export function loadPractice(): Practice {
  try { const raw = localStorage.getItem(PRACTICE_KEY); return parsePractice(raw ? JSON.parse(raw) : null); } catch { return blankPractice(); }
}
export function storePractice(p: Practice): boolean {
  try { localStorage.setItem(PRACTICE_KEY, JSON.stringify(p)); return true; } catch { return false; }
}

/** Joins two copies of the practice: packages by id, the higher invoice counter, and filled-in details win over blank ones. */
export function mergePractice(here: Practice, there: Practice): Practice {
  const seen = new Set(here.packages.map((p) => p.id));
  const business = { ...here.business };
  for (const k of Object.keys(business) as (keyof Business)[]) {
    if (!business[k] && there.business[k]) (business as Record<string, unknown>)[k] = there.business[k];
  }
  return {
    business,
    packages: [...here.packages, ...there.packages.filter((p) => !seen.has(p.id))],
    nextInvoice: Math.max(here.nextInvoice, there.nextInvoice),
  };
}

/* ---------- merge helpers for sync (used by backup.mergeTab) ---------- */

const CHECK_RANK: Record<CheckInStatus, number> = { pending: 0, missed: 1, done: 2 };
export function mergeRemedies(a?: RemedyPlan, b?: RemedyPlan): RemedyPlan | undefined {
  if (!a || !b) return a ?? b;
  const items = [...a.items, ...b.items.filter((x) => !a.items.some((y) => y.id === x.id))];
  const other = new Map(b.checkIns.map((c) => [c.id, c]));
  const checkIns = a.checkIns.map((c) => {
    const o = other.get(c.id);
    if (!o) return c;
    other.delete(c.id);
    // a check-in marked on either device keeps its mark; notes from both are kept
    const status = CHECK_RANK[o.status] > CHECK_RANK[c.status] ? o.status : c.status;
    const note = !o.note || c.note.includes(o.note) ? c.note : !c.note ? o.note : `${c.note}\n${o.note}`;
    return { ...c, status, note };
  });
  return { ...a, items, checkIns: [...checkIns, ...other.values()].sort((x, y) => x.date.localeCompare(y.date)), note: a.note || b.note };
}

const INV_RANK: Record<InvoiceStatus, number> = { unpaid: 0, paid: 1, void: 2 };
export function mergeInvoices(a?: Invoice[], b?: Invoice[]): Invoice[] | undefined {
  if (!a || !b) return a ?? b;
  const theirs = new Map(b.map((x) => [x.id, x]));
  const out = a.map((x) => {
    const o = theirs.get(x.id);
    theirs.delete(x.id);
    return o && INV_RANK[o.status] > INV_RANK[x.status] ? { ...x, status: o.status, paidOn: o.paidOn, method: o.method ?? x.method } : x;
  });
  return [...out, ...theirs.values()].sort((x, y) => y.issuedOn.localeCompare(x.issuedOn) || y.number.localeCompare(x.number));
}

/* ---------- remedy schedule ---------- */

const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

/** Check-in dates every `everyDays` from the start, `count` of them. Existing marked check-ins stay. */
export function scheduleCheckIns(plan: RemedyPlan, everyDays: number, count: number): CheckIn[] {
  const kept = plan.checkIns.filter((c) => c.status !== 'pending' || c.note.trim());
  const have = new Set(kept.map((c) => c.date));
  const fresh: CheckIn[] = [];
  for (let i = 1; i <= Math.min(52, Math.max(1, count)); i++) {
    const date = addDays(plan.startedOn, i * Math.max(1, everyDays));
    if (!have.has(date)) fresh.push({ id: newId(), date, status: 'pending', note: '' });
  }
  return [...kept, ...fresh].sort((a, b) => a.date.localeCompare(b.date));
}

/** The next check-in that has not happened yet, if any. */
export const nextCheckIn = (plan?: RemedyPlan) => plan?.checkIns.find((c) => c.status === 'pending');

/* ---------- money ---------- */

export function invoiceTotals(inv: Pick<Invoice, 'lines' | 'taxRate'>) {
  const round = (n: number) => Math.round(n * 100) / 100;
  const subtotal = round(inv.lines.reduce((s, l) => s + l.qty * l.price, 0));
  const tax = round((subtotal * inv.taxRate) / 100);
  return { subtotal, tax, total: round(subtotal + tax) };
}

export function money(n: number, cur: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(n); } catch { return `${cur} ${n.toFixed(2)}`; }
}

export const invoiceNumber = (n: number) => `INV-${String(n).padStart(4, '0')}`;

/** A new invoice for a package or a blank line, numbered from the practice counter. */
export function draftInvoice(p: Practice, pkg?: Package): Invoice {
  return {
    id: newId(),
    number: invoiceNumber(p.nextInvoice),
    issuedOn: today(),
    currency: p.business.currency,
    lines: [pkg ? { description: pkg.description ? `${pkg.name}: ${pkg.description}` : pkg.name, qty: 1, price: pkg.price } : { description: 'Consultation', qty: 1, price: 0 }],
    taxRate: p.business.taxRate,
    status: 'unpaid',
    note: '',
    ...(p.business.paymentLink ? { paymentLink: p.business.paymentLink } : {}),
  };
}

/* ---------- prediction track record ---------- */

export type PredictionArea = 'career' | 'money' | 'relationships' | 'health' | 'family' | 'travel' | 'other';
export const AREAS: PredictionArea[] = ['career', 'money', 'relationships', 'health', 'family', 'travel', 'other'];
export const AREA_LABEL: Record<PredictionArea, string> = {
  career: 'Career', money: 'Money', relationships: 'Relationships', health: 'Health', family: 'Family', travel: 'Travel and moves', other: 'Other',
};

export interface TrackedPrediction {
  entry: LogEntry;
  tabId: string;
  client: string;
  /** false when the client's tab is closed */
  open: boolean;
}

/** Every prediction across all clients, open and closed tabs, newest first. */
export function allPredictions(tabs: Tab[], archived: Tab[]): TrackedPrediction[] {
  const out: TrackedPrediction[] = [];
  const add = (t: Tab, open: boolean) => {
    for (const e of t.log) if (e.kind === 'prediction') out.push({ entry: e, tabId: t.id, client: t.label, open });
  };
  tabs.forEach((t) => add(t, true));
  archived.forEach((t) => add(t, false));
  return out.sort((a, b) => b.entry.at.localeCompare(a.entry.at));
}

export interface Score {
  total: number;
  checked: number;
  hits: number;
  partly: number;
  misses: number;
  /** came true counts 1, partly counts ½; null until something is checked */
  rate: number | null;
}

export function score(entries: LogEntry[]): Score {
  const preds = entries.filter((e) => e.kind === 'prediction');
  const hits = preds.filter((e) => e.outcome === 'came-true').length;
  const partly = preds.filter((e) => e.outcome === 'partly').length;
  const misses = preds.filter((e) => e.outcome === 'did-not').length;
  const checked = hits + partly + misses;
  return { total: preds.length, checked, hits, partly, misses, rate: checked ? (hits + partly / 2) / checked : null };
}

/** Predictions whose date has come and that are not marked yet: the ones to ask the client about. */
export const dueForCheck = (list: TrackedPrediction[], on = today()) =>
  list.filter((p) => (p.entry.outcome ?? 'open') === 'open' && p.entry.about && p.entry.about <= on).sort((a, b) => (a.entry.about ?? '').localeCompare(b.entry.about ?? ''));

const csvCell = (v: string | number) => {
  let s = String(v);
  // a leading = + - @ would run as a formula in a spreadsheet
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\n');

export function predictionsCsv(list: TrackedPrediction[]) {
  return toCsv([
    ['Client', 'Made on', 'About', 'Area', 'Prediction', 'Outcome', 'Checked on'],
    ...list.map((p) => [p.client, p.entry.at.slice(0, 10), p.entry.about ?? '', p.entry.area ? AREA_LABEL[p.entry.area] : '', p.entry.text, p.entry.outcome ?? 'open', p.entry.markedAt?.slice(0, 10) ?? '']),
  ]);
}

export function invoicesCsv(rows: { client: string; inv: Invoice }[]) {
  return toCsv([
    ['Number', 'Client', 'Issued', 'Currency', 'Subtotal', 'Tax', 'Total', 'Status', 'Paid on', 'Method'],
    ...rows.map(({ client, inv }) => {
      const t = invoiceTotals(inv);
      return [inv.number, client, inv.issuedOn, inv.currency, t.subtotal, t.tax, t.total, inv.status, inv.paidOn ?? '', inv.method ?? ''];
    }),
  ]);
}

/* ---------- shared store, so every panel sees the same packages and details ---------- */

let current: Practice | null = null;
const listeners = new Set<() => void>();
export const practiceStore = {
  get(): Practice { return (current ??= loadPractice()); },
  set(p: Practice) { current = p; storePractice(p); listeners.forEach((l) => l()); },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};
