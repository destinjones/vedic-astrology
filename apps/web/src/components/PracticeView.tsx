import { useMemo, useState } from 'react';
import {
  AREAS, AREA_LABEL, allPredictions, dueForCheck, invoiceTotals, invoicesCsv, money, newId, nextCheckIn, predictionsCsv, safeLink, score, today,
  type Business, type Invoice, type PredictionArea, type Score,
} from '../lib/practice';
import { downloadFile, printHtml, trackRecordHtml } from '../lib/practicePrint';
import { usePractice } from '../lib/usePractice';
import type { LogEntry, Outcome, Tab } from '../lib/tabs';
import './practice.css';

interface Props {
  tabs: Tab[];
  archived: Tab[];
  /** Changes a client's tab, open or closed. */
  onPatch: (tabId: string, patch: Partial<Tab>) => void;
  /** Brings a client's tab to the front. */
  onOpen: (tabId: string) => void;
  onClose: () => void;
}

type View = 'track' | 'money' | 'setup';
const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const OUTCOME_LABEL: Record<Outcome, string> = { open: 'Not yet known', 'came-true': 'Came true', partly: 'Partly', 'did-not': 'Did not happen' };
const pct = (s: Score) => (s.rate === null ? '–' : `${Math.round(s.rate * 100)}%`);

/** The practice at a glance: the prediction track record, money owed and paid, and packages and details. */
export function PracticeView({ tabs, archived, onPatch, onOpen, onClose }: Props) {
  const [view, setView] = useState<View>('track');
  return (
    <section className="card practice-view notes-card" id="practice">
      <div className="card-head">
        <h3>Your practice</h3>
        <div className="seg" role="tablist" aria-label="Practice view">
          {([['track', 'Track record'], ['money', 'Invoices'], ['setup', 'Packages and details']] as [View, string][]).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? 'is-active' : ''} onClick={() => setView(k)}>{label}</button>
          ))}
        </div>
        <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
      </div>
      <p className="muted small">Everything here stays in this browser and goes into your backup file. Nothing is sent anywhere.</p>
      {view === 'track' && <TrackRecord tabs={tabs} archived={archived} onPatch={onPatch} onOpen={onOpen} />}
      {view === 'money' && <Money tabs={tabs} archived={archived} onPatch={onPatch} onOpen={onOpen} />}
      {view === 'setup' && <Setup />}
    </section>
  );
}

/* ---------- prediction track record ---------- */

function TrackRecord({ tabs, archived, onPatch, onOpen }: Omit<Props, 'onClose'>) {
  const [practice] = usePractice();
  const all = useMemo(() => allPredictions(tabs, archived), [tabs, archived]);
  const [area, setArea] = useState<PredictionArea | 'all'>('all');
  const [show, setShow] = useState<'due' | 'all' | Outcome>('due');
  const [names, setNames] = useState(false);
  const due = dueForCheck(all);
  const inArea = area === 'all' ? all : all.filter((p) => p.entry.area === area);
  const s = score(inArea.map((p) => p.entry));
  const byArea = AREAS.map((a) => ({ a, s: score(all.filter((p) => p.entry.area === a).map((p) => p.entry)) })).filter((x) => x.s.total);
  const list = show === 'due' ? dueForCheck(inArea) : show === 'all' ? inArea : inArea.filter((p) => (p.entry.outcome ?? 'open') === show);
  const allTabs = [...tabs, ...archived];

  const mark = (tabId: string, entryId: string, outcome: Outcome) => {
    const t = allTabs.find((x) => x.id === tabId);
    if (!t) return;
    const log: LogEntry[] = t.log.map((e) => (e.id === entryId ? { ...e, outcome, markedAt: outcome === 'open' ? undefined : new Date().toISOString() } : e));
    onPatch(tabId, { log });
  };

  // remedy check-ins that are due, across clients
  const checkIns = allTabs
    .map((t) => ({ t, c: nextCheckIn(t.remedies) }))
    .filter((x): x is { t: Tab; c: NonNullable<typeof x.c> } => !!x.c && x.c.date <= today())
    .sort((a, b) => a.c.date.localeCompare(b.c.date));

  if (!all.length) {
    return <p className="muted">No predictions yet. Log them in a client's notes and history, with the date they are about, and they show up here to check when the time comes.</p>;
  }

  return (
    <div className="track">
      <div className="track-stats">
        <div className="summary-item"><small className="muted">Score</small><b className="big">{pct(s)}</b><small className="muted">partly counts as half</small></div>
        <div className="summary-item"><small className="muted">Logged</small><b className="big">{s.total}</b><small className="muted">{s.checked} checked</small></div>
        <div className="summary-item"><small className="muted">Came true</small><b className="big">{s.hits}</b><small className="muted">{s.partly} partly · {s.misses} did not</small></div>
        <div className="summary-item"><small className="muted">To check now</small><b className="big">{due.length}</b><small className="muted">their date has come</small></div>
      </div>

      {byArea.length > 1 && (
        <table className="track-areas">
          <thead><tr><th>Area</th><th>Logged</th><th>Checked</th><th>Score</th></tr></thead>
          <tbody>{byArea.map(({ a, s: x }) => <tr key={a}><td>{AREA_LABEL[a]}</td><td>{x.total}</td><td>{x.checked}</td><td>{pct(x)}</td></tr>)}</tbody>
        </table>
      )}

      {checkIns.length > 0 && (
        <p className="small">
          Remedy check-ins due:{' '}
          {checkIns.map(({ t, c }) => <button key={t.id} type="button" className="chip chip-btn" onClick={() => onOpen(t.id)}>{t.label} · {fmtDay(c.date)}</button>)}
        </p>
      )}

      <div className="track-filters">
        <label className="log-about"><span className="muted">Area</span>
          <select value={area} onChange={(e) => setArea(e.target.value as PredictionArea | 'all')}>
            <option value="all">All areas</option>
            {AREAS.map((a) => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}
          </select>
        </label>
        <label className="log-about"><span className="muted">Show</span>
          <select value={show} onChange={(e) => setShow(e.target.value as typeof show)}>
            <option value="due">To check now</option>
            <option value="all">All</option>
            {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
          </select>
        </label>
        <span className="grow" />
        <label className="small"><input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} /> Client names on the printout</label>
        <button type="button" className="btn-ghost" onClick={() => printHtml(trackRecordHtml(inArea, s, practice.business, { names }))}>Print track record</button>
        <button type="button" className="btn-ghost" onClick={() => downloadFile(predictionsCsv(inArea), `predictions-${today()}.csv`, 'text/csv')}>CSV</button>
      </div>

      <ol className="log-list track-list">
        {list.map(({ entry: x, tabId, client, open }) => (
          <li key={`${tabId}:${x.id}`} className={`log-item kind-prediction out-${x.outcome ?? 'open'}`}>
            <div className="log-meta">
              <button type="button" className="link-btn" onClick={() => onOpen(tabId)} title={open ? 'Go to this client' : 'Reopen this client'}><b>{client}</b></button>
              <span className="muted">{fmtDay(x.at.slice(0, 10))}</span>
              {x.about && <span className="muted">· about {fmtDay(x.about)}</span>}
              {x.area && <span className="muted">· {AREA_LABEL[x.area]}</span>}
              {!open && <span className="muted">· closed tab</span>}
            </div>
            <p>{x.text}</p>
            <div className="log-outcome" role="radiogroup" aria-label="Did it come true?">
              {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => (
                <button key={o} type="button" role="radio" aria-checked={(x.outcome ?? 'open') === o} className={`chip ${(x.outcome ?? 'open') === o ? 'is-active' : ''} o-${o}`} onClick={() => mark(tabId, x.id, o)}>{OUTCOME_LABEL[o]}</button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {!list.length && <p className="muted">{show === 'due' ? 'Nothing to check right now.' : 'No predictions match.'}</p>}
    </div>
  );
}

/* ---------- all invoices ---------- */

function Money({ tabs, archived, onPatch, onOpen }: Omit<Props, 'onClose'>) {
  const [filter, setFilter] = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  const allTabs = [...tabs, ...archived];
  const rows = allTabs
    .flatMap((t) => (t.invoices ?? []).map((inv) => ({ t, client: t.label, inv })))
    .sort((a, b) => b.inv.issuedOn.localeCompare(a.inv.issuedOn));
  const sum = (list: typeof rows) => {
    const m = new Map<string, number>();
    for (const r of list) m.set(r.inv.currency, (m.get(r.inv.currency) ?? 0) + invoiceTotals(r.inv).total);
    return m.size ? [...m].map(([c, n]) => money(n, c)).join(' + ') : money(0, 'INR');
  };
  const year = today().slice(0, 4);
  const owed = rows.filter((r) => r.inv.status === 'unpaid');
  const paidYear = rows.filter((r) => r.inv.status === 'paid' && (r.inv.paidOn ?? r.inv.issuedOn).startsWith(year));
  const shown = filter === 'all' ? rows : rows.filter((r) => r.inv.status === filter);
  const setStatus = (t: Tab, inv: Invoice, p: Partial<Invoice>) => onPatch(t.id, { invoices: (t.invoices ?? []).map((x) => (x.id === inv.id ? { ...x, ...p } : x)) });

  if (!rows.length) return <p className="muted">No invoices yet. Make one from a client's "Remedies and billing" card, from a package or as a blank consultation.</p>;
  return (
    <div className="track">
      <div className="track-stats">
        <div className="summary-item"><small className="muted">Owed</small><b className="big">{sum(owed)}</b><small className="muted">{owed.length} unpaid</small></div>
        <div className="summary-item"><small className="muted">Paid in {year}</small><b className="big">{sum(paidYear)}</b><small className="muted">{paidYear.length} invoices</small></div>
      </div>
      <div className="track-filters">
        <div className="seg seg-sm" role="radiogroup" aria-label="Which invoices">
          {(['unpaid', 'paid', 'all'] as const).map((f) => <button key={f} type="button" role="radio" aria-checked={filter === f} className={filter === f ? 'is-active' : ''} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}
        </div>
        <span className="grow" />
        <button type="button" className="btn-ghost" onClick={() => downloadFile(invoicesCsv(rows), `invoices-${today()}.csv`, 'text/csv')}>CSV for your accounts</button>
      </div>
      <table className="inv-table">
        <thead><tr><th>Number</th><th>Client</th><th>Issued</th><th className="num">Total</th><th>Status</th><th /></tr></thead>
        <tbody>
          {shown.map(({ t, client, inv }) => (
            <tr key={inv.id} className={`inv-${inv.status}`}>
              <td>{inv.number}</td>
              <td><button type="button" className="link-btn" onClick={() => onOpen(t.id)}>{client}</button></td>
              <td>{fmtDay(inv.issuedOn)}</td>
              <td className="num">{money(invoiceTotals(inv).total, inv.currency)}</td>
              <td>{inv.status}{inv.paidOn ? ` ${fmtDay(inv.paidOn)}` : ''}</td>
              <td>{inv.status === 'unpaid' && <button type="button" className="link-btn" onClick={() => setStatus(t, inv, { status: 'paid', paidOn: today() })}>Mark paid</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!shown.length && <p className="muted">None.</p>}
    </div>
  );
}

/* ---------- packages and business details ---------- */

function Setup() {
  const [practice, setPractice] = usePractice();
  const b = practice.business;
  const [link, setLink] = useState(b.paymentLink);
  const setB = (p: Partial<Business>) => setPractice({ ...practice, business: { ...b, ...p } });
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [desc, setDesc] = useState('');
  const [sessions, setSessions] = useState(1);
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setPractice({ ...practice, packages: [...practice.packages, { id: newId(), name: name.trim().slice(0, 120), description: desc.trim().slice(0, 500), price: Math.max(0, Number(price) || 0), sessions }] });
    setName(''); setPrice(''); setDesc(''); setSessions(1);
  };
  const patchPkg = (id: string, p: Partial<(typeof practice.packages)[number]>) => setPractice({ ...practice, packages: practice.packages.map((x) => (x.id === id ? { ...x, ...p } : x)) });

  return (
    <div className="practice-grid setup-grid">
      <div className="practice-col">
        <h4>Packages</h4>
        <p className="muted small">Your standard prices. Pick one when you make an invoice.</p>
        {practice.packages.length > 0 && (
          <table className="inv-lines pkg-table">
            <thead><tr><th>Name</th><th>What's included</th><th>Sessions</th><th>Price ({b.currency})</th><th /></tr></thead>
            <tbody>
              {practice.packages.map((p) => (
                <tr key={p.id}>
                  <td><input aria-label="Package name" value={p.name} maxLength={120} onChange={(e) => patchPkg(p.id, { name: e.target.value })} /></td>
                  <td><input aria-label="Included" value={p.description} maxLength={500} onChange={(e) => patchPkg(p.id, { description: e.target.value })} /></td>
                  <td><input aria-label="Sessions" type="number" min={1} max={100} value={p.sessions} onChange={(e) => patchPkg(p.id, { sessions: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} /></td>
                  <td><input aria-label="Price" type="number" min={0} step="0.01" value={p.price} onChange={(e) => patchPkg(p.id, { price: Math.max(0, Number(e.target.value) || 0) })} /></td>
                  <td><button type="button" className="tab-x" aria-label={`Delete ${p.name}`} onClick={() => setPractice({ ...practice, packages: practice.packages.filter((x) => x.id !== p.id) })}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form className="pkg-add" onSubmit={add}>
          <input aria-label="New package name" value={name} maxLength={120} placeholder="e.g. Career reading" onChange={(e) => setName(e.target.value)} />
          <input aria-label="What's included" value={desc} maxLength={500} placeholder="60 min call + written summary" onChange={(e) => setDesc(e.target.value)} />
          <input aria-label="Sessions" type="number" min={1} max={100} value={sessions} onChange={(e) => setSessions(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
          <input aria-label="Price" type="number" min={0} step="0.01" value={price} placeholder="price" onChange={(e) => setPrice(e.target.value)} />
          <button className="btn-ghost" disabled={!name.trim()}>Add package</button>
        </form>
      </div>

      <div className="practice-col">
        <h4>Your details</h4>
        <p className="muted small">Printed at the top of invoices, receipts, remedy checklists and the track record.</p>
        <div className="setup-fields">
          <label className="field"><span>Name or business</span><input value={b.name} maxLength={120} onChange={(e) => setB({ name: e.target.value })} /></label>
          <label className="field"><span>Contact</span><textarea className="notes-input" rows={2} value={b.contact} maxLength={500} placeholder="email, phone, website" onChange={(e) => setB({ contact: e.target.value })} /></label>
          <label className="field"><span>Address</span><textarea className="notes-input" rows={2} value={b.address} maxLength={500} onChange={(e) => setB({ address: e.target.value })} /></label>
          <div className="setup-row">
            <label className="field"><span>Currency</span><input value={b.currency} maxLength={3} onChange={(e) => /^[A-Za-z]{0,3}$/.test(e.target.value) && setB({ currency: e.target.value.toUpperCase() })} /></label>
            <label className="field"><span>Tax name</span><input value={b.taxLabel} maxLength={20} placeholder="GST" onChange={(e) => setB({ taxLabel: e.target.value })} /></label>
            <label className="field"><span>Tax %</span><input type="number" min={0} max={100} step="0.01" value={b.taxRate} onChange={(e) => setB({ taxRate: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /></label>
          </div>
          <label className="field"><span>Payment link</span>
            <input value={link} maxLength={500} placeholder="https://… or upi://…" onChange={(e) => setLink(e.target.value)} onBlur={() => { const s = safeLink(link); setLink(s); setB({ paymentLink: s }); }} />
          </label>
          <label className="field"><span>Invoice footer</span><input value={b.footer} maxLength={500} onChange={(e) => setB({ footer: e.target.value })} /></label>
          <label className="field"><span>Next invoice number</span>
            <input type="number" min={1} value={practice.nextInvoice} onChange={(e) => setPractice({ ...practice, nextInvoice: Math.max(1, Math.round(Number(e.target.value) || 1)) })} />
          </label>
        </div>
      </div>
    </div>
  );
}
