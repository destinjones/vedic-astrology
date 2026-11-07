import { useEffect, useMemo, useState } from 'react';
import { chartRarity, sadeSatiCountdown, todayBrief } from '@vedic/personal';
import type { ChartInterpretation } from '@vedic/interpretations';
import type { Chart } from '../types/chart';

const time = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
const PHASE_COLOR: Record<string, string> = { 'sade-sati-rising': 'var(--accent-2)', 'sade-sati-peak': 'var(--bad, #ff6b6b)', 'sade-sati-setting': 'var(--accent)' };

/** "Today for you": tithi, the Moon's star, tara bala, Chandrashtama and one line for the Moon. */
export function TodayCard({ chart }: { chart: Chart }) {
  const { engine, chart: ec } = chart.engineContext!;
  const [now, setNow] = useState(() => new Date());
  // the Moon moves a degree every two hours; refresh every ten minutes while the page is open
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 600_000); return () => clearInterval(id); }, []);
  const b = useMemo(() => todayBrief(engine, ec, now), [engine, ec, now]);
  const paksha = b.tithi.paksha === 'shukla' ? 'Shukla' : 'Krishna';
  return (
    <section className={`card fy-card fy-today is-${b.overall}`} id="today" aria-labelledby="today-h">
      <div className="card-head">
        <h3 id="today-h">Today for {chart.input.name || 'you'}</h3>
        <span className="muted">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </div>
      <p className="fy-headline">{b.headline}</p>
      <dl className="fy-tiles">
        <div><dt>Tithi</dt><dd>{b.tithi.number === 15 || b.tithi.number === 30 ? b.tithi.name : `${paksha} ${b.tithi.name}`}</dd></div>
        <div><dt>Moon in</dt><dd>{b.moon.nakshatraName}</dd></div>
        <div className={`is-${b.tara.quality}`}><dt>Tara bala</dt><dd>{b.tara.name} {b.tara.quality === 'good' ? '✓' : b.tara.quality === 'hard' ? '✕' : '·'}</dd></div>
        <div className={b.chandrashtama.active ? 'is-hard' : 'is-good'}>
          <dt>Chandrashtama</dt>
          <dd>{b.chandrashtama.active ? 'Yes' : 'No'}</dd>
        </div>
      </dl>
      <p className="fy-moon">{b.moonLine}</p>
      <p className="muted fy-small">
        {b.tara.text}{' '}
        {b.chandrashtama.active
          ? `Chandrashtama lifts around ${time(b.chandrashtama.endsAt!)}.`
          : `Next Chandrashtama from around ${time(b.chandrashtama.nextAt!)}.`}
      </p>
    </section>
  );
}

/** Sade Sati countdown to the end date, or to the start of the next one. */
export function SadeSatiCard({ chart }: { chart: Chart }) {
  const { engine, chart: ec } = chart.engineContext!;
  const s = useMemo(() => sadeSatiCountdown(engine, ec), [engine, ec]);
  if (!s) return null;
  const start = Date.parse(s.spell.start);
  const span = Date.parse(s.spell.end) - start;
  return (
    <section className={`card fy-card fy-sadesati is-${s.state}`} id="sade-sati" aria-labelledby="ss-h">
      <div className="card-head"><h3 id="ss-h">Sade Sati</h3><span className="muted">Saturn's 7½ years over your Moon</span></div>
      <div className="fy-count">
        <b className="mono">{s.days.toLocaleString()}</b>
        <span>{s.state === 'in' ? 'days to go' : 'days until it begins'}</span>
      </div>
      <p className="fy-headline">{s.state === 'in' ? <>Ends <b>{day(s.spell.end)}</b></> : <>Begins <b>{day(s.spell.start)}</b>, ends {day(s.spell.end)}</>}</p>
      <div className="fy-bar" role="img" aria-label={`${Math.round(s.progress * 100)}% of this Sade Sati is behind you`}>
        {s.spell.phases.map((p) => (
          <span key={p.start} title={`${p.kind.replace('sade-sati-', '')}${p.reentry ? ' (re-entry)' : ''}: ${p.start.slice(0, 10)} to ${p.end.slice(0, 10)}`}
            style={{ left: `${((Date.parse(p.start) - start) / span) * 100}%`, width: `${((Date.parse(p.end) - Date.parse(p.start)) / span) * 100}%`, background: PHASE_COLOR[p.kind] }} />
        ))}
        {s.state === 'in' && <i style={{ left: `${s.progress * 100}%` }} />}
      </div>
      <p className="fy-legend" aria-hidden>
        <span><i style={{ background: PHASE_COLOR['sade-sati-rising'] }} />rising</span>
        <span><i style={{ background: PHASE_COLOR['sade-sati-peak'] }} />peak</span>
        <span><i style={{ background: PHASE_COLOR['sade-sati-setting'] }} />setting</span>
      </p>
      <p className="muted fy-small">
        {s.phase ? `${s.phase.label}, until ${day(s.phase.ends)}. ${s.phase.text}` : s.previousEnd ? `Your last one ended ${day(s.previousEnd)}.` : 'Saturn goes back and forth across sign lines, which is why a phase can return.'}
        {' '}Saturn has {s.spell.bindus.join(', ')} ashtakavarga points in the three signs{Math.min(...s.spell.bindus) >= 4 ? ', which softens it' : ''}.
      </p>
    </section>
  );
}

/** Rarity percentile from 10,000 random charts. */
export function RarityCard({ report }: { report: ChartInterpretation }) {
  const r = useMemo(() => chartRarity(report), [report]);
  return (
    <section className="card fy-card fy-rarity" id="rarity" aria-labelledby="rar-h">
      <div className="card-head"><h3 id="rar-h">How rare is your chart?</h3><span className="muted">against 10,000 random charts</span></div>
      <div className="fy-count">
        <b className="mono">{r.percentile}<small>th</small></b>
        <span>percentile</span>
      </div>
      <p className="fy-headline">{r.headline}</p>
      {r.rarest.length > 0 && (
        <ul className="fy-rarest">
          {r.rarest.map((y) => <li key={y.id}><b>{y.name}</b> <span className="muted">{y.rarity.label}</span></li>)}
        </ul>
      )}
      <p className="muted fy-small">Every yoga was counted in charts cast at random moments from 1930 to 2015, anywhere on Earth, with the same detectors that read yours.</p>
    </section>
  );
}
