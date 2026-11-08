/**
 * Session prep for astrologers: the client snapshot, talking points by life
 * area and the question finder, all from @vedic/consult. Rule-based and
 * offline; nothing is sent anywhere.
 */
import { useMemo, useState } from 'react';
import {
  LIFE_AREAS,
  QUESTION_TOPICS,
  answerQuestion,
  areaTalkingPoints,
  clientSnapshot,
  consultContext,
  matchQuestion,
  talkingPoints,
  talkingPointsText,
  type AreaId,
  type ClientSnapshot,
  type ConsultContext,
  type Point,
  type TimingWindow,
} from '@vedic/consult';
import type { ChartInterpretation } from '@vedic/interpretations';
import type { Chart } from '../types/chart';
import './consult.css';

type View = 'snapshot' | 'points' | 'ask';

const month = (d: Date | string) => new Date(d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const day = (d: Date | string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

export default function SessionPrep({ chart, report }: { chart: Chart; report: ChartInterpretation }) {
  const { engine, chart: ec } = chart.engineContext!;
  const [view, setView] = useState<View>('snapshot');
  // one "now" per chart so the three views agree
  const ctx = useMemo(() => consultContext(engine, ec, report, new Date()), [engine, ec, report]);
  const name = chart.input.name || 'Client';
  return (
    <section className="card prep-card" id="session-prep" aria-labelledby="prep-h">
      <div className="card-head">
        <h3 id="prep-h">Session prep</h3>
        <div className="seg" role="tablist" aria-label="Session prep view">
          {([['snapshot', 'Client snapshot'], ['points', 'Talking points'], ['ask', 'Question finder']] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'is-active' : ''} onClick={() => setView(id)}>{label}</button>
          ))}
        </div>
      </div>
      {view === 'snapshot' && <SnapshotView ctx={ctx} name={name} />}
      {view === 'points' && <PointsView ctx={ctx} name={name} />}
      {view === 'ask' && <AskView ctx={ctx} />}
      <p className="muted prep-foot">Built from the chart's rules (dasha, gochara, ashtakavarga, yogas and doshas) with the sources shown. No AI service is used and nothing leaves this browser.</p>
    </section>
  );
}

// ---------------------------------------------------------------- snapshot

function SnapshotView({ ctx, name }: { ctx: ConsultContext; name: string }) {
  const s = useMemo(() => clientSnapshot(ctx, name), [ctx, name]);
  return (
    <div className="prep-snap">
      <div className="prep-actions">
        <span className="muted">Prepared {day(s.at)}</span>
        <button className="btn-ghost sm" onClick={() => printSnapshot(s)}>Print one page</button>
      </div>
      <dl className="prep-big3">
        <div><dt>Lagna</dt><dd>{s.bigThree.lagna}</dd></div>
        <div><dt>Moon</dt><dd>{s.bigThree.moon}</dd></div>
        <div><dt>Birth star</dt><dd>{s.bigThree.nakshatra}</dd></div>
        <div><dt>Running</dt><dd>{s.dasha.maha ? `${s.dasha.maha.lord}${s.dasha.antar ? `–${s.dasha.antar.lord}` : ''}` : '—'}</dd></div>
      </dl>
      {s.flags.length > 0 && (
        <ul className="prep-flags" aria-label="Flags">
          {s.flags.map((f) => (
            <li key={f.id} className={`is-${f.level}`}><b>{f.label}</b> {f.text}{f.source && <cite> {f.source}</cite>}</li>
          ))}
        </ul>
      )}
      <div className="prep-two">
        <div>
          <h4>Top strengths</h4>
          <ol className="prep-list is-good">{s.strengths.map((x) => <li key={x.title}><b>{x.title}.</b> {x.text}{x.source && <cite> {x.source}</cite>}</li>)}</ol>
        </div>
        <div>
          <h4>Top challenges</h4>
          {s.challenges.length
            ? <ol className="prep-list is-hard">{s.challenges.map((x) => <li key={x.title}><b>{x.title}.</b> {x.text}{x.source && <cite> {x.source}</cite>}</li>)}</ol>
            : <p className="muted">No dosha or difficult placement stands out.</p>}
        </div>
      </div>
      <h4>The current dasha</h4>
      <p>{s.dasha.maha && <>{s.dasha.maha.lord} mahadasha to {month(s.dasha.maha.end)}{s.dasha.antar && <>, {s.dasha.antar.lord} antardasha to {month(s.dasha.antar.end)}</>}{s.dasha.pratyantar && <>, {s.dasha.pratyantar.lord} pratyantar to {day(s.dasha.pratyantar.end)}</>}. </>}{s.dasha.theme}</p>
      {s.dasha.reasons.length > 0 && <ul className="prep-why">{s.dasha.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
      <h4>Transits now</h4>
      <ul className="prep-points">
        {s.transits.map((t) => <li key={t.planet} className={`is-${t.tone}`}>{t.text}{t.until && <span className="muted"> Changes sign {day(t.until)}.</span>}</li>)}
      </ul>
    </div>
  );
}

const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Opens a plain, printable one-page version in a new window and calls print. */
function printSnapshot(s: ClientSnapshot) {
  const li = (items: { title: string; text: string; source?: string }[]) => items.map((x) => `<li><b>${esc(x.title)}.</b> ${esc(x.text)}${x.source ? ` <i>${esc(x.source)}</i>` : ''}</li>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(s.name)}: client snapshot</title><style>
    @page { size: A4; margin: 14mm; }
    body { font: 10.5px/1.4 Georgia, serif; color: #1d1a16; margin: 0; }
    h1 { font-size: 20px; margin: 0 0 2px; } h2 { font: 600 11px/1.2 system-ui, sans-serif; text-transform: uppercase; letter-spacing: .08em; color: #8a6418; margin: 12px 0 4px; }
    .sub { color: #6b6457; margin: 0 0 8px; } .big { display: flex; gap: 18px; margin: 6px 0; } .big b { display: block; font-size: 13px; } .big span { font: 9px system-ui; text-transform: uppercase; color: #6b6457; }
    ul, ol { margin: 0; padding-left: 16px; } li { margin: 0 0 3px; } i { color: #6b6457; } .two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .high { color: #a3221a; } .watch { color: #8a5a00; } .info { color: #444; }
  </style></head><body>
    <h1>${esc(s.name)}</h1><p class="sub">Client snapshot, prepared ${esc(day(s.at))}</p>
    <div class="big"><div><span>Lagna</span><b>${esc(s.bigThree.lagna)}</b></div><div><span>Moon</span><b>${esc(s.bigThree.moon)}</b></div><div><span>Birth star</span><b>${esc(s.bigThree.nakshatra)}</b></div><div><span>Running</span><b>${esc(s.dasha.maha ? `${s.dasha.maha.lord}${s.dasha.antar ? `–${s.dasha.antar.lord}` : ''}` : '—')}</b></div></div>
    ${s.flags.length ? `<h2>Flags</h2><ul>${s.flags.map((f) => `<li class="${f.level}"><b>${esc(f.label)}:</b> ${esc(f.text)}</li>`).join('')}</ul>` : ''}
    <div class="two"><div><h2>Top strengths</h2><ol>${li(s.strengths)}</ol></div><div><h2>Top challenges</h2><ol>${li(s.challenges)}</ol></div></div>
    <h2>Current dasha</h2><p>${esc(s.dasha.maha ? `${s.dasha.maha.lord} mahadasha to ${month(s.dasha.maha.end)}${s.dasha.antar ? `, ${s.dasha.antar.lord} antardasha to ${month(s.dasha.antar.end)}` : ''}. ` : '')}${esc(s.dasha.theme)}</p>
    <h2>Transits now</h2><ul>${s.transits.map((t) => `<li>${esc(t.text)}${t.until ? ` Changes sign ${esc(day(t.until))}.` : ''}</li>`).join('')}</ul>
  </body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

// ---------------------------------------------------------------- talking points

function Points({ items }: { items: Point[] }) {
  return <ul className="prep-points">{items.map((p) => <li key={p.text} className={`is-${p.tone}`}>{p.text}{p.source && <cite> {p.source}</cite>}</li>)}</ul>;
}

function PointsView({ ctx, name }: { ctx: ConsultContext; name: string }) {
  const [area, setArea] = useState<AreaId>('career');
  const [copied, setCopied] = useState(false);
  const a = useMemo(() => areaTalkingPoints(ctx, area), [ctx, area]);
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(talkingPointsText(name, talkingPoints(ctx)));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked: nothing to do */ }
  };
  return (
    <div className="prep-tp">
      <div className="prep-actions">
        <div className="prep-chips" role="radiogroup" aria-label="Life area">
          {LIFE_AREAS.map((x) => <button key={x.id} role="radio" aria-checked={area === x.id} className={`chip ${area === x.id ? 'is-on' : ''}`} onClick={() => setArea(x.id)}>{x.label}</button>)}
        </div>
        <button className="btn-ghost sm" onClick={copyAll}>{copied ? 'Copied' : 'Copy all areas as text'}</button>
      </div>
      <p className="prep-headline">{a.headline}</p>
      {a.caution && <p className="prep-caution">{a.caution}</p>}
      <h4>What the chart promises</h4>
      <Points items={a.promise} />
      <h4>Right now</h4>
      <Points items={a.now} />
      <h4>{a.watch ? 'Periods to watch' : 'Best windows ahead'}</h4>
      <Points items={a.next} />
    </div>
  );
}

// ---------------------------------------------------------------- question finder

function WindowRow({ w }: { w: TimingWindow }) {
  return (
    <li className={`prep-window is-${w.strength}`}>
      <div><b>{month(w.start)} – {month(w.end)}</b> <span className="chip">{w.strength}</span> <span className="muted">{w.path.join('–')}{w.doubleTransit ? ' · double transit' : ''}</span></div>
      <ul className="prep-why">{w.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
    </li>
  );
}

function AskView({ ctx }: { ctx: ConsultContext }) {
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState('');
  const [topicId, setTopicId] = useState<string | undefined>();
  const [years, setYears] = useState(10);
  const answer = useMemo(() => (asked || topicId ? answerQuestion(ctx, asked, { topicId, years }) : null), [ctx, asked, topicId, years]);
  const ask = (text: string) => { setQ(text); setAsked(text); setTopicId(matchQuestion(text).length ? undefined : topicId); };
  const unmatched = asked && !answer;
  return (
    <div className="prep-ask">
      <form className="prep-form" onSubmit={(e) => { e.preventDefault(); ask(q.trim()); }}>
        <label className="sr-only" htmlFor="prep-q">The client's question</label>
        <input id="prep-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type the client's question, e.g. When will I get married?" maxLength={200} />
        <select aria-label="Years ahead" value={years} onChange={(e) => setYears(Number(e.target.value))}>
          {[3, 5, 10, 15, 20].map((y) => <option key={y} value={y}>next {y} years</option>)}
        </select>
        <button className="btn-ghost" type="submit">Find</button>
      </form>
      <div className="prep-chips" aria-label="Example questions">
        {QUESTION_TOPICS.slice(0, 8).map((t) => <button key={t.id} type="button" className="chip" onClick={() => { setTopicId(undefined); ask(t.example); }}>{t.example}</button>)}
      </div>
      {unmatched && (
        <div className="prep-caution">
          <p>No topic matched those words. Pick the closest:</p>
          <div className="prep-chips">{QUESTION_TOPICS.map((t) => <button key={t.id} type="button" className="chip" onClick={() => setTopicId(t.id)}>{t.label}</button>)}</div>
        </div>
      )}
      {answer && (
        <div className="prep-answer">
          <p className="prep-headline">
            {answer.topic.label}
            {answer.matched.length > 0 && <span className="muted"> (matched “{answer.matched.join('”, “')}”)</span>}
          </p>
          {answer.alsoMatched.length > 0 && (
            <p className="muted">Also about: {answer.alsoMatched.map((t) => <button key={t.id} type="button" className="link-btn" onClick={() => setTopicId(t.id)}>{t.label}</button>)}</p>
          )}
          <p className="muted">{answer.rule[0].toUpperCase() + answer.rule.slice(1)}.</p>
          <div className="prep-houses">
            {answer.houses.map((h) => (
              <div key={h.house}>
                <b>{ord(h.house)} house</b> <span className="muted">{h.signName}</span>
                <small>{h.topic}</small>
                <small>Lord {h.lord} in the {ord(h.lordHouse)}{h.occupants.length ? ` · holds ${h.occupants.join(', ')}` : ''} · {h.sav} SAV</small>
              </div>
            ))}
          </div>
          {answer.karakas.length > 0 && <p><b>Karakas:</b> {answer.karakas.map((k) => k.text).join('; ')}.</p>}
          <h4>Natal promise</h4>
          <Points items={answer.promise} />
          <h4>Now</h4>
          <p>{answer.now}</p>
          <h4>{answer.watch ? 'Periods to watch' : 'Timing windows'} in the next {years} years</h4>
          {answer.windows.length
            ? <ol className="prep-windows">{answer.windows.map((w) => <WindowRow key={w.start.toISOString() + w.path.join()} w={w} />)}</ol>
            : <p className="muted">No antardasha in this range has lords linked to the topic. Try a longer range.</p>}
          <p className="muted prep-small">A window is strong when both dasha lords are linked to the topic and Jupiter and Saturn together touch the main house or its lord (double transit). Supporting means one of those holds. Confirm with the divisional chart and the client's history before you give a date.</p>
        </div>
      )}
    </div>
  );
}
