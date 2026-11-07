import { useEffect, useMemo, useState } from 'react';
import {
  EVENT_SIGNIFICATIONS, LIFE_EVENT_KINDS, recurringLords, signName,
  type ActivePeriod, type DatePrecision, type EventCheck, type LifeEvent, type LifeEventKind, type Relevance, type SystemAtEvent,
} from '@vedic/timing';
import { lifeEventContext } from '@vedic/timing/engine';
import type { BirthInput, Chart } from '../types/chart';
import { loadEvents, newEventId, saveEvents, sortEvents } from '../lib/lifeEvents';

type Ctx = ReturnType<typeof lifeEventContext>;

const GROUPS = ['Relationships', 'Career and money', 'Home and movement', 'Health and loss', 'Other'] as const;
const PRECISION_LABEL: Record<DatePrecision, string> = { day: 'Exact day', month: 'Month only', year: 'Year only' };
const REL_LABEL: Record<Relevance, string> = { strong: 'linked', supporting: 'partly linked', none: 'no link' };
const FIT_TEXT = { strong: 'Strong match', moderate: 'Moderate match', weak: 'Weak match', 'n/a': 'Not scored' } as const;

const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
const fmtEventDate = (e: LifeEvent) => {
  const d = new Date(`${e.date}T12:00:00Z`);
  if (e.precision === 'year') return e.date.slice(0, 4);
  if (e.precision === 'month') return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', timeZone: 'UTC' });
  return fmtDate(d);
};
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

interface Draft { kind: LifeEventKind; date: string; precision: DatePrecision; title: string; note: string }
const EMPTY: Draft = { kind: 'marriage', date: '', precision: 'day', title: '', note: '' };

/** Normalise what the date input holds for a precision into YYYY-MM-DD. */
function draftDate(d: Draft): string | null {
  if (d.precision === 'year') return /^\d{4}$/.test(d.date) ? `${d.date}-01-01` : null;
  if (d.precision === 'month') return /^\d{4}-\d{2}$/.test(d.date) ? `${d.date}-01` : null;
  return /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : null;
}
const toDraft = (e: LifeEvent): Draft => ({
  kind: e.kind, precision: e.precision ?? 'day', title: e.title ?? '', note: e.note ?? '',
  date: e.precision === 'year' ? e.date.slice(0, 4) : e.precision === 'month' ? e.date.slice(0, 7) : e.date,
});

export default function EventChecker({ context, input }: { context: NonNullable<Chart['engineContext']>; input: BirthInput }) {
  const [events, setEvents] = useState<LifeEvent[]>(() => loadEvents(input));
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<Ctx | null>(null);

  // Building the lifetime baseline takes a moment, so let the card paint first.
  useEffect(() => {
    setCtx(null);
    const t = setTimeout(() => setCtx(lifeEventContext(context.engine, context.chart)), 30);
    return () => clearTimeout(t);
  }, [context]);

  const checks = useMemo(() => (ctx ? events.map(ctx.check) : []), [ctx, events]);
  const patterns = useMemo(() => recurringLords(checks), [checks]);
  const birthDate = input.date;
  const today = new Date().toISOString().slice(0, 10);

  const commit = (list: LifeEvent[]) => { const s = sortEvents(list); setEvents(s); saveEvents(input, s); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const date = draftDate(draft);
    if (!date || Number.isNaN(Date.parse(date))) { setError('Enter the date of the event.'); return; }
    const cut = draft.precision === 'year' ? 4 : draft.precision === 'month' ? 7 : 10;
    if (date.slice(0, cut) < birthDate.slice(0, cut)) { setError('That date is before the birth date.'); return; }
    if (date > today) { setError('The checker is for past events. For the future, use the timeline above.'); return; }
    setError(null);
    const ev: LifeEvent = { id: editing ?? newEventId(), kind: draft.kind, date, precision: draft.precision, title: draft.title.trim() || undefined, note: draft.note.trim() || undefined };
    commit(editing ? events.map((x) => (x.id === editing ? ev : x)) : [...events, ev]);
    setOpen(ev.id);
    setEditing(null);
    setDraft({ ...EMPTY, kind: draft.kind });
  };

  const remove = (id: string) => {
    commit(events.filter((x) => x.id !== id));
    if (editing === id) { setEditing(null); setDraft(EMPTY); }
  };

  return (
    <div className="ev-root">
      <form className="ev-form" onSubmit={submit} autoComplete="off">
        <label className="field">
          <span>What happened</span>
          <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as LifeEventKind })}>
            {GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {LIFE_EVENT_KINDS.filter((k) => EVENT_SIGNIFICATIONS[k].group === g).map((k) => <option key={k} value={k}>{EVENT_SIGNIFICATIONS[k].label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field">
          <span>How sure of the date</span>
          <select value={draft.precision} onChange={(e) => setDraft({ ...draft, precision: e.target.value as DatePrecision, date: '' })}>
            {(Object.keys(PRECISION_LABEL) as DatePrecision[]).map((p) => <option key={p} value={p}>{PRECISION_LABEL[p]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>When</span>
          {draft.precision === 'day' && <input type="date" value={draft.date} min={birthDate} max={today} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />}
          {draft.precision === 'month' && <input type="month" value={draft.date} min={birthDate.slice(0, 7)} max={today.slice(0, 7)} placeholder="YYYY-MM" onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />}
          {draft.precision === 'year' && <input type="number" inputMode="numeric" value={draft.date} min={birthDate.slice(0, 4)} max={today.slice(0, 4)} placeholder="YYYY" onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />}
        </label>
        <label className="field ev-title">
          <span>Label <small className="muted">(optional)</small></span>
          <input value={draft.title} maxLength={120} placeholder="e.g. Married Priya" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </label>
        <div className="ev-actions">
          <button className="btn-primary">{editing ? 'Save changes' : 'Check this event'}</button>
          {editing && <button type="button" className="btn-ghost" onClick={() => { setEditing(null); setDraft(EMPTY); setError(null); }}>Cancel</button>}
        </div>
        {error && <p className="form-error ev-wide" role="alert">{error}</p>}
      </form>

      {!events.length && (
        <p className="muted ev-empty">Add something that already happened: a marriage, a new job, a move, a loss. You will see which dasha periods (in every system the chart has), transits, Sade Sati phases and retrogrades were running, and which of them the tradition links to that kind of event. Events are saved in this browser with this chart.</p>
      )}

      {events.length > 0 && !ctx && <p className="muted">Working out the periods and transits…</p>}

      {ctx && checks.length > 0 && (
        <>
          {patterns.length > 0 && (
            <div className="ev-patterns">
              <b>Recurring across your events:</b>{' '}
              {patterns.slice(0, 4).map((p, i) => (
                <span key={p.planet}>{i > 0 && ' · '}{p.planet} as a linked period lord in {p.events} events ({p.kinds.map((k) => EVENT_SIGNIFICATIONS[k].label.toLowerCase()).join(', ')})</span>
              ))}
            </div>
          )}
          <ul className="ev-list">
            {checks.map((c) => (
              <EventRow
                key={c.event.id}
                check={c}
                open={open === c.event.id}
                onToggle={() => setOpen(open === c.event.id ? null : c.event.id)}
                onEdit={() => { setEditing(c.event.id); setDraft(toDraft(c.event)); setError(null); }}
                onRemove={() => remove(c.event.id)}
              />
            ))}
          </ul>
          <p className="muted ev-foot">"Linked" means the planet rules, occupies, aspects or signifies the houses of that event, directly or through its nakshatra lord (and for Rahu and Ketu, their sign lord). The match compares this date with every month of the person's life so far, so a strong match is rarer than it looks. It is a traditional reading, not proof.</p>
        </>
      )}
    </div>
  );
}

function EventRow({ check: c, open, onToggle, onEdit, onRemove }: { check: EventCheck; open: boolean; onToggle: () => void; onEdit: () => void; onRemove: () => void }) {
  const vim = c.dashas[0];
  return (
    <li className={`ev-item ${open ? 'is-open' : ''}`}>
      <button className="ev-head" onClick={onToggle} aria-expanded={open}>
        <span className="ev-date mono">{fmtEventDate(c.event)}</span>
        <span className="ev-name">
          <b>{c.event.title || c.signification.label}</b>
          {c.event.title && <small className="muted"> · {c.signification.label}</small>}
          <small className="muted"> · age {Math.floor(c.age)}</small>
        </span>
        <span className="ev-chain muted">{vim?.chain.slice(0, 3).map((p) => p.name).join(' – ')}</span>
        <span className={`ev-fit fit-${c.fitLabel}`} title={c.percentile !== null ? `Lines up better than ${c.percentile}% of the months in this life` : undefined}>
          {FIT_TEXT[c.fitLabel]}{c.percentile !== null && c.fitLabel !== 'weak' && <small> · top {Math.max(1, 100 - c.percentile)}%</small>}
        </span>
      </button>
      {open && (
        <div className="ev-body">
          <p className="ev-rule muted"><b>Classical indications:</b> {c.signification.rule}.</p>
          {c.highlights.length > 0 && (
            <ul className="ev-highlights">
              {c.highlights.slice(0, 8).map((h) => <li key={h}>{h}</li>)}
            </ul>
          )}

          <h4>Dashas running</h4>
          <div className="ev-systems">
            {c.dashas.map((d) => <SystemBlock key={d.system} sys={d} precise={c.event.precision === 'day' || !c.event.precision} />)}
          </div>

          <h4>Transits</h4>
          {c.doubleTransit && (
            <p className={`ev-dt ${c.doubleTransit.active ? 'is-on' : ''}`}>
              <b>Double transit on the {ordinal(c.doubleTransit.house)} house: {c.doubleTransit.active ? 'yes' : 'no'}.</b>{' '}
              Jupiter {c.doubleTransit.jupiter.join(', ') || 'does not touch it'}; Saturn {c.doubleTransit.saturn.join(', ') || 'does not touch it'}.
            </p>
          )}
          <div className="ev-table-wrap">
            <table className="ev-table">
              <thead><tr><th>Planet</th><th>Sign</th><th>From lagna</th><th>From Moon</th><th>Bindus</th><th>Link to the event</th></tr></thead>
              <tbody>
                {c.transits.map((t) => (
                  <tr key={t.planet} className={`rel-${t.check.relevance}`}>
                    <td><b>{t.planet}</b>{t.retrograde && <sup title="retrograde"> R</sup>}</td>
                    <td>{signName(t.sign)}</td>
                    <td>{ordinal(t.houseFromLagna)}</td>
                    <td>{ordinal(t.houseFromMoon)}{t.favourableFromMoon ? <span className="good" title="favourable from the Moon (gochara)"> ✓</span> : ''}</td>
                    <td className="mono">{t.bindus ?? '–'}</td>
                    <td>{t.check.links.join('; ') || <span className="muted">–</span>}{t.label && <div className="muted small">{t.label}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ev-two">
            <div>
              <h4>Saturn</h4>
              {c.saturn.phase
                ? <p><b>{c.saturn.phase.kind.startsWith('sade-sati') ? 'Sade Sati' : c.saturn.phase.kind === 'kantaka' ? 'Kantaka Shani' : 'Ashtama Shani'}</b> in {signName(c.saturn.phase.sign)}, {fmtDate(c.saturn.phase.start)} to {fmtDate(c.saturn.phase.end)}{c.saturn.phase.reentry ? ' (retrograde re-entry)' : ''}. <span className="muted">{c.saturn.text}</span></p>
                : <p className="muted">No Sade Sati, Kantaka or Ashtama Shani at this time.</p>}
            </div>
            <div>
              <h4>Retrogrades</h4>
              {c.retrogrades.length
                ? <ul className="ev-plain">{c.retrogrades.map((r) => <li key={r.planet} className={r.relevant ? 'is-rel' : ''}><b>{r.planet}</b> {r.status === 'retrograde' ? 'retrograde' : r.status}{r.relevant ? ' (a significator of this event)' : ''}: <span className="muted">{r.meaning}</span></li>)}</ul>
                : <p className="muted">Mercury to Saturn were all direct and out of shadow.</p>}
            </div>
          </div>

          {c.event.note && <p className="ev-note"><b>Note:</b> {c.event.note}</p>}
          <div className="ev-row-actions">
            <button className="btn-ghost sm" onClick={onEdit}>Edit</button>
            <button className="btn-ghost sm" onClick={() => { if (confirm('Remove this event?')) onRemove(); }}>Remove</button>
          </div>
        </div>
      )}
    </li>
  );
}

function PeriodChip({ p }: { p: ActivePeriod }) {
  return (
    <div className={`ev-period rel-${p.check.relevance}`}>
      <small>{p.levelName}</small>
      <b>{p.name}{p.sign !== undefined && p.name !== signName(p.sign) ? ` (${signName(p.sign)})` : ''}{p.name !== p.lord && p.sign === undefined ? ` · ${p.lord}` : ''}</b>
      <span className="ev-rel">{REL_LABEL[p.check.relevance]}</span>
      {p.check.links.length > 0 && <span className="ev-why">{p.check.links.slice(0, 2).join('; ')}</span>}
      <span className="ev-span muted">{fmtDate(p.start)} – {fmtDate(p.end)}</span>
    </div>
  );
}

function SystemBlock({ sys, precise }: { sys: SystemAtEvent; precise: boolean }) {
  const shownAntars = !precise && sys.overlapping.length > 1;
  return (
    <div className="ev-system">
      <div className="ev-system-head"><b>{sys.label}</b> <span className={`ev-rel-badge rel-${sys.relevance}`}>{REL_LABEL[sys.relevance]}</span></div>
      {sys.note && <p className="muted small">{sys.note}</p>}
      <div className="ev-periods">{sys.chain.map((p) => <PeriodChip key={p.level} p={p} />)}</div>
      {shownAntars && (
        <p className="small muted">The date range spans several antardashas: {sys.overlapping.map((p) => `${p.name} (${REL_LABEL[p.check.relevance]})`).join(', ')}.</p>
      )}
    </div>
  );
}
