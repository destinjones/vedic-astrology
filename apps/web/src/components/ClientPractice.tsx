import { useMemo, useState } from 'react';
import type { Chart as EngineChart } from '@vedic/engine';
import { remedies as suggestRemedies } from '@vedic/remedies';
import {
  REMEDY_KINDS, REMEDY_KIND_LABEL, draftInvoice, invoiceTotals, money, newId, nextCheckIn, safeLink, scheduleCheckIns, today,
  type CheckInStatus, type Invoice, type InvoiceLine, type RemedyItem, type RemedyItemKind, type RemedyPlan,
} from '../lib/practice';
import { invoiceHtml, printHtml, remedyChecklistHtml } from '../lib/practicePrint';
import { usePractice } from '../lib/usePractice';
import type { Tab } from '../lib/tabs';
import './practice.css';

interface Props {
  tab: Tab;
  /** When the chart is worked out, its remedy suggestions can be added in one click. */
  chart?: EngineChart;
  onRemedies: (plan: RemedyPlan | undefined) => void;
  onInvoices: (list: Invoice[] | undefined) => void;
  onOpenPractice: () => void;
}

const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const STATUS_LABEL: Record<CheckInStatus, string> = { pending: 'Coming up', done: 'Kept up', missed: 'Missed' };

/** Remedy follow-up and invoices for one client. Private: hidden while presenting, never in share links. */
export function ClientPractice({ tab, chart, onRemedies, onInvoices, onOpenPractice }: Props) {
  return (
    <section className="card notes-card practice-card" id="client-practice">
      <div className="card-head">
        <h3>Remedies and billing</h3>
        <span className="muted">kept in this browser, hidden while presenting · <button type="button" className="link-btn" onClick={onOpenPractice}>packages, details and track record</button></span>
      </div>
      <div className="practice-grid">
        <RemedyPlanner tab={tab} chart={chart} onChange={onRemedies} />
        <Invoices tab={tab} onChange={onInvoices} onOpenPractice={onOpenPractice} />
      </div>
    </section>
  );
}

/* ---------- remedy follow-up ---------- */

function RemedyPlanner({ tab, chart, onChange }: { tab: Tab; chart?: EngineChart; onChange: Props['onRemedies'] }) {
  const [practice] = usePractice();
  const plan: RemedyPlan = tab.remedies ?? { startedOn: today(), items: [], checkIns: [], note: '' };
  const [kind, setKind] = useState<RemedyItemKind>('mantra');
  const [text, setText] = useState('');
  const [how, setHow] = useState('');
  const [every, setEvery] = useState(14);
  const [count, setCount] = useState(6);

  const save = (p: RemedyPlan) => onChange(p.items.length || p.checkIns.length || p.note.trim() ? p : undefined);

  const suggestions = useMemo(() => {
    if (!chart) return [];
    try {
      return suggestRemedies(chart).afflicted.slice(0, 3).map((g): RemedyItem => ({
        id: newId(),
        kind: 'mantra',
        text: `${g.set.name}: ${g.set.mantra.bija}`,
        how: `${g.set.mantra.count.toLocaleString()} japa over the period, or 108 a day`,
      }));
    } catch { return []; }
  }, [chart]);
  const fresh = suggestions.filter((s) => !plan.items.some((x) => x.text === s.text));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    save({ ...plan, items: [...plan.items, { id: newId(), kind, text: text.trim().slice(0, 500), how: how.trim().slice(0, 300) }] });
    setText('');
    setHow('');
  };
  const patchItem = (id: string, p: Partial<RemedyItem>) => save({ ...plan, items: plan.items.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const patchCheck = (id: string, p: Partial<RemedyPlan['checkIns'][number]>) => save({ ...plan, checkIns: plan.checkIns.map((c) => (c.id === id ? { ...c, ...p } : c)) });
  const next = nextCheckIn(plan);
  const now = today();
  const kept = plan.checkIns.filter((c) => c.status === 'done').length;
  const marked = plan.checkIns.filter((c) => c.status !== 'pending').length;

  return (
    <div className="practice-col" aria-labelledby="rp-title">
      <h4 id="rp-title">Remedy follow-up</h4>
      <p className="muted small">The mantras and practices you give {tab.label}, with dates to check how it is going. Print it as a checklist for them.</p>

      <div className="rp-dates">
        <label className="log-about"><span className="muted">Starts</span>
          <input type="date" value={plan.startedOn} onChange={(e) => e.target.value && save({ ...plan, startedOn: e.target.value })} />
        </label>
        <label className="log-about grow"><span className="muted">Note for the top of the sheet</span>
          <input type="text" value={plan.note} maxLength={1000} placeholder="e.g. Keep this up for 40 days, then we review" onChange={(e) => save({ ...plan, note: e.target.value })} />
        </label>
      </div>

      {plan.items.length > 0 && (
        <ol className="rp-items">
          {plan.items.map((x, i) => (
            <li key={x.id}>
              <span className="rp-n">{i + 1}</span>
              <select aria-label="Kind" value={x.kind} onChange={(e) => patchItem(x.id, { kind: e.target.value as RemedyItemKind })}>
                {REMEDY_KINDS.map((k) => <option key={k} value={k}>{REMEDY_KIND_LABEL[k]}</option>)}
              </select>
              <input aria-label="Remedy" value={x.text} maxLength={500} onChange={(e) => patchItem(x.id, { text: e.target.value })} />
              <input aria-label="How often" value={x.how} maxLength={300} placeholder="how often" onChange={(e) => patchItem(x.id, { how: e.target.value })} />
              <button type="button" className="tab-x" aria-label="Remove remedy" title="Remove" onClick={() => save({ ...plan, items: plan.items.filter((y) => y.id !== x.id) })}>✕</button>
            </li>
          ))}
        </ol>
      )}

      <form className="rp-add" onSubmit={add}>
        <select aria-label="Kind of remedy" value={kind} onChange={(e) => setKind(e.target.value as RemedyItemKind)}>
          {REMEDY_KINDS.map((k) => <option key={k} value={k}>{REMEDY_KIND_LABEL[k]}</option>)}
        </select>
        <input aria-label="Remedy to add" value={text} maxLength={500} placeholder="e.g. Om Shum Shukraya Namah" onChange={(e) => setText(e.target.value)} />
        <input aria-label="How often" value={how} maxLength={300} placeholder="e.g. 108 times each Friday" onChange={(e) => setHow(e.target.value)} />
        <button className="btn-ghost" disabled={!text.trim()}>Add</button>
      </form>
      {fresh.length > 0 && (
        <p className="small">
          From this chart's remedies:{' '}
          {fresh.map((s) => (
            <button key={s.text} type="button" className="chip chip-btn" onClick={() => save({ ...plan, items: [...plan.items, s] })}>+ {s.text}</button>
          ))}
        </p>
      )}

      <div className="rp-schedule">
        <span>Check in every</span>
        <input type="number" min={1} max={90} value={every} aria-label="Days between check-ins" onChange={(e) => setEvery(Math.max(1, Math.min(90, Number(e.target.value) || 1)))} />
        <span>days,</span>
        <input type="number" min={1} max={52} value={count} aria-label="Number of check-ins" onChange={(e) => setCount(Math.max(1, Math.min(52, Number(e.target.value) || 1)))} />
        <span>times</span>
        <button type="button" className="btn-ghost" onClick={() => save({ ...plan, checkIns: scheduleCheckIns(plan, every, count) })}>
          {plan.checkIns.length ? 'Reschedule' : 'Set dates'}
        </button>
      </div>

      {plan.checkIns.length > 0 && (
        <>
          <p className="small">
            {next ? <>Next check-in <b>{fmtDay(next.date)}</b>{next.date <= now && <span className="log-due">due</span>}</> : 'All check-ins done.'}
            {marked > 0 && <> · kept up at {kept} of {marked}</>}
          </p>
          <ol className="rp-checks">
            {plan.checkIns.map((c) => (
              <li key={c.id} className={`ci-${c.status}`}>
                <span className="rp-date">{fmtDay(c.date)}</span>
                <div className="seg seg-sm" role="radiogroup" aria-label={`Check-in on ${fmtDay(c.date)}`}>
                  {(Object.keys(STATUS_LABEL) as CheckInStatus[]).map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={c.status === s} className={c.status === s ? 'is-active' : ''} onClick={() => patchCheck(c.id, { status: s })}>{STATUS_LABEL[s]}</button>
                  ))}
                </div>
                <input aria-label="Check-in note" value={c.note} maxLength={1000} placeholder="how it went" onChange={(e) => patchCheck(c.id, { note: e.target.value })} />
                <button type="button" className="tab-x" aria-label="Remove check-in" title="Remove" onClick={() => save({ ...plan, checkIns: plan.checkIns.filter((y) => y.id !== c.id) })}>✕</button>
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="practice-actions">
        <button type="button" className="btn-primary" disabled={!plan.items.length} onClick={() => printHtml(remedyChecklistHtml(tab.label, plan, practice.business))}>Print checklist</button>
        {tab.remedies && <button type="button" className="link-btn" onClick={() => { if (confirm(`Clear ${tab.label}'s remedy plan?`)) onChange(undefined); }}>Clear plan</button>}
      </div>
    </div>
  );
}

/* ---------- invoices ---------- */

function Invoices({ tab, onChange, onOpenPractice }: { tab: Tab; onChange: Props['onInvoices']; onOpenPractice: () => void }) {
  const [practice, setPractice] = usePractice();
  const list = tab.invoices ?? [];
  const [editing, setEditing] = useState<string | null>(null);

  const save = (next: Invoice[]) => onChange(next.length ? next : undefined);
  const create = (pkgId: string) => {
    const pkg = practice.packages.find((p) => p.id === pkgId);
    const inv = draftInvoice(practice, pkg);
    setPractice({ ...practice, nextInvoice: practice.nextInvoice + 1 });
    save([inv, ...list]);
    setEditing(inv.id);
  };
  const patch = (id: string, p: Partial<Invoice>) => save(list.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const owed = list.filter((x) => x.status === 'unpaid');
  const owedBy = new Map<string, number>();
  for (const x of owed) owedBy.set(x.currency, (owedBy.get(x.currency) ?? 0) + invoiceTotals(x).total);

  return (
    <div className="practice-col" aria-labelledby="inv-title">
      <h4 id="inv-title">Invoices and receipts</h4>
      <p className="muted small">
        {owed.length ? <>Owed: <b>{[...owedBy].map(([c, n]) => money(n, c)).join(' + ')}</b> on {owed.length} invoice{owed.length === 1 ? '' : 's'}.</> : list.length ? 'Nothing owed.' : `Bill ${tab.label} for a reading or a package.`}
        {!practice.business.name && <> Add your name and payment link in <button type="button" className="link-btn" onClick={onOpenPractice}>your details</button>.</>}
      </p>

      <div className="inv-new">
        <select aria-label="New invoice from" defaultValue="" onChange={(e) => { create(e.target.value); e.target.value = ''; }}>
          <option value="" disabled>New invoice…</option>
          <option value="blank">Blank consultation</option>
          {practice.packages.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.price, practice.business.currency)}</option>)}
        </select>
      </div>

      <ol className="inv-list">
        {list.map((inv) => {
          const t = invoiceTotals(inv);
          const open = editing === inv.id;
          return (
            <li key={inv.id} className={`inv inv-${inv.status}`}>
              <div className="inv-row">
                <b>{inv.number}</b>
                <span className="muted">{fmtDay(inv.issuedOn)}</span>
                <span className="inv-total">{money(t.total, inv.currency)}</span>
                <span className={`chip ${inv.status === 'paid' ? 'chip-good' : inv.status === 'void' ? '' : 'chip-mid'}`}>{inv.status === 'paid' ? `paid${inv.paidOn ? ` ${fmtDay(inv.paidOn)}` : ''}` : inv.status}</span>
                <span className="inv-btns">
                  <button type="button" className="link-btn" aria-expanded={open} onClick={() => setEditing(open ? null : inv.id)}>{open ? 'Done' : 'Edit'}</button>
                  <button type="button" className="link-btn" onClick={() => printHtml(invoiceHtml(tab.label, inv, practice.business))}>Print {inv.status === 'paid' ? 'receipt' : 'invoice'}</button>
                </span>
              </div>
              {open && <InvoiceEditor inv={inv} onPatch={(p) => patch(inv.id, p)} onDelete={() => { if (confirm(`Delete ${inv.number}?`)) { save(list.filter((x) => x.id !== inv.id)); setEditing(null); } }} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function InvoiceEditor({ inv, onPatch, onDelete }: { inv: Invoice; onPatch: (p: Partial<Invoice>) => void; onDelete: () => void }) {
  const setLine = (i: number, p: Partial<InvoiceLine>) => onPatch({ lines: inv.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const t = invoiceTotals(inv);
  const [link, setLink] = useState(inv.paymentLink ?? '');
  return (
    <div className="inv-edit">
      <div className="inv-fields">
        <label className="log-about"><span className="muted">Number</span><input value={inv.number} maxLength={40} onChange={(e) => onPatch({ number: e.target.value })} /></label>
        <label className="log-about"><span className="muted">Issued</span><input type="date" value={inv.issuedOn} onChange={(e) => e.target.value && onPatch({ issuedOn: e.target.value })} /></label>
        <label className="log-about"><span className="muted">Currency</span><input value={inv.currency} maxLength={3} size={4} onChange={(e) => /^[A-Za-z]{0,3}$/.test(e.target.value) && onPatch({ currency: e.target.value.toUpperCase() })} /></label>
        <label className="log-about"><span className="muted">Tax %</span><input type="number" min={0} max={100} step="0.01" value={inv.taxRate} onChange={(e) => onPatch({ taxRate: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /></label>
      </div>
      <table className="inv-lines">
        <thead><tr><th>Description</th><th>Qty</th><th>Price</th><th /></tr></thead>
        <tbody>
          {inv.lines.map((l, i) => (
            <tr key={i}>
              <td><input aria-label="Description" value={l.description} maxLength={300} onChange={(e) => setLine(i, { description: e.target.value })} /></td>
              <td><input aria-label="Quantity" type="number" min={0} value={l.qty} onChange={(e) => setLine(i, { qty: Math.max(0, Number(e.target.value) || 0) })} /></td>
              <td><input aria-label="Price" type="number" min={0} step="0.01" value={l.price} onChange={(e) => setLine(i, { price: Math.max(0, Number(e.target.value) || 0) })} /></td>
              <td>{inv.lines.length > 1 && <button type="button" className="tab-x" aria-label="Remove line" onClick={() => onPatch({ lines: inv.lines.filter((_, j) => j !== i) })}>✕</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small">
        <button type="button" className="link-btn" onClick={() => onPatch({ lines: [...inv.lines, { description: 'Item', qty: 1, price: 0 }] })}>+ Add line</button>
        <span className="inv-sum">Subtotal {money(t.subtotal, inv.currency || 'INR')}{inv.taxRate ? ` · tax ${money(t.tax, inv.currency || 'INR')}` : ''} · <b>total {money(t.total, inv.currency || 'INR')}</b></span>
      </p>
      <label className="log-about grow"><span className="muted">Payment link</span>
        <input value={link} maxLength={500} placeholder="https://…" onChange={(e) => setLink(e.target.value)} onBlur={() => { const s = safeLink(link); setLink(s); onPatch({ paymentLink: s || undefined }); }} />
      </label>
      <label className="log-about grow"><span className="muted">Note</span>
        <input value={inv.note} maxLength={1000} placeholder="e.g. Includes a 30 minute follow-up call" onChange={(e) => onPatch({ note: e.target.value })} />
      </label>
      <div className="inv-pay">
        {inv.status !== 'paid' ? (
          <button type="button" className="btn-primary" onClick={() => onPatch({ status: 'paid', paidOn: today() })}>Mark paid today</button>
        ) : (
          <>
            <label className="log-about"><span className="muted">Paid on</span><input type="date" value={inv.paidOn ?? ''} onChange={(e) => onPatch({ paidOn: e.target.value || undefined })} /></label>
            <label className="log-about"><span className="muted">Paid by</span><input value={inv.method ?? ''} maxLength={60} placeholder="UPI, cash, card…" onChange={(e) => onPatch({ method: e.target.value || undefined })} /></label>
            <button type="button" className="link-btn" onClick={() => onPatch({ status: 'unpaid', paidOn: undefined })}>Mark unpaid</button>
          </>
        )}
        {inv.status !== 'void' ? <button type="button" className="link-btn" onClick={() => onPatch({ status: 'void', paidOn: undefined })}>Void</button> : <button type="button" className="link-btn" onClick={() => onPatch({ status: 'unpaid' })}>Restore</button>}
        <button type="button" className="link-btn danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}
