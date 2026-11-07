import { useEffect, useState } from 'react';
import type { KootaResult, ManglikComparison, ManglikSide, MatchResult } from '@vedic/interpretations';
import type { BirthInput } from '../types/chart';
import { BirthForm } from '../components/BirthForm';
import { computeChart } from '../engine';
import { ART, grahaArt } from '../data/art';
import { TrustFooter } from '../trust/TrustFooter';

type Seat = 'a' | 'b';

const SAMPLE: Record<Seat, BirthInput> = {
  a: { name: 'Arjun', date: '1990-08-15', time: '06:30', place: 'New Delhi, India', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata', ayanamsa: 'lahiri' },
  b: { name: 'Meera', date: '1992-03-02', time: '18:10', place: 'Mumbai, India', latitude: 19.076, longitude: 72.8777, timezone: 'Asia/Kolkata', ayanamsa: 'lahiri' },
};
const BLANK: BirthInput = { name: '', date: '', time: '', place: '', latitude: NaN, longitude: NaN, timezone: '', ayanamsa: 'lahiri' };

const STORE_KEY = 'vedic.match';
const LAST_CHART_KEY = 'vedic.lastInput';

function loadPeople(): Record<Seat, BirthInput | null> {
  try {
    const s = localStorage.getItem(STORE_KEY);
    if (s) { const v = JSON.parse(s); return { a: v.a ?? null, b: v.b ?? null }; }
    const last = localStorage.getItem(LAST_CHART_KEY);
    if (last) return { a: JSON.parse(last), b: null };
  } catch { /* storage unavailable */ }
  return { a: null, b: null };
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const label = (p: BirthInput | null, seat: Seat) => p?.name?.trim() || (seat === 'a' ? 'Partner 1' : 'Partner 2');

export default function MatchApp() {
  const [people, setPeople] = useState(loadPeople);
  const [editing, setEditing] = useState<Seat | null>(() => (loadPeople().a ? (loadPeople().b ? null : 'b') : 'a'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(people)); } catch { /* ignore */ }
  }, [people]);

  const match = async (p: Record<Seat, BirthInput | null>) => {
    if (!p.a || !p.b) return;
    setBusy(true);
    setError(null);
    try {
      const [ca, cb, lib] = await Promise.all([computeChart(p.a), computeChart(p.b), import('@vedic/interpretations')]);
      if (!ca.engineContext || !cb.engineContext) throw new Error('The ephemeris engine did not load, so the Moon positions are not exact enough to match. Please reload and try again.');
      setResult(lib.matchCharts(lib.fromEngineChart(ca.engineContext.chart), lib.fromEngineChart(cb.engineContext.chart)));
      requestAnimationFrame(() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  // /match/#sample runs the sample couple straight away
  useEffect(() => {
    if (location.hash === '#sample') { setPeople(SAMPLE); setEditing(null); void match(SAMPLE); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = (seat: Seat, input: BirthInput) => {
    const next = { ...people, [seat]: input };
    setPeople(next);
    setResult(null);
    const other: Seat = seat === 'a' ? 'b' : 'a';
    if (!next[other]) setEditing(other);
    else { setEditing(null); void match(next); }
  };
  const swap = () => {
    const next = { a: people.b, b: people.a };
    setPeople(next);
    setEditing(null);
    if (result) void match(next);
  };
  const sample = () => { setPeople(SAMPLE); setEditing(null); void match(SAMPLE); };

  return (
    <div className="app match-app">
      <div className="backdrop backdrop-cosmos" aria-hidden style={{ '--bg-desktop': `url("${ART.cosmosDesktop}")`, '--bg-mobile': `url("${ART.cosmosMobile}")` } as React.CSSProperties} />
      <div className="starfield" aria-hidden />
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <span className="brand-mark">✦</span>
          <div>
            <p className="brand-title">Jyotisha Explorer</p>
            <p>Kundali matching, the classical way</p>
          </div>
        </a>
        <a className="btn-ghost" href={`${import.meta.env.BASE_URL}app/`}>Your birth chart</a>
      </header>

      <section className="match-intro">
        <p className="eyebrow">Ashtakoota guna milan</p>
        <h1>Kundali matching: two Moons, eight kootas, thirty-six gunas.</h1>
        <p className="muted">
          Enter both birth details. The match reads each person’s natal Moon (its sign, nakshatra and degree) through the eight
          classical kootas, explains every score, and then compares Mars in both charts for Manglik dosha with its cancellations.
        </p>
      </section>

      <section className="match-people">
        {(['a', 'b'] as Seat[]).map((seat) => (
          <div key={seat} className={`card person-card ${editing === seat ? 'is-editing' : ''}`}>
            <div className="card-head">
              <h3>{label(people[seat], seat)}</h3>
              <span className="seat-tag">{seat === 'a' ? 'groom’s seat' : 'bride’s seat'}</span>
            </div>
            {editing === seat ? (
              <BirthForm
                key={seat + (people[seat]?.date ?? '')}
                initial={people[seat] ?? BLANK}
                busy={busy}
                submitLabel={people[seat === 'a' ? 'b' : 'a'] ? 'Save and match' : `Save ${seat === 'a' ? 'partner 1' : 'partner 2'}`}
                onSubmit={(i) => save(seat, i)}
              />
            ) : people[seat] ? (
              <div className="person-summary">
                <p><b>{people[seat]!.date}</b> at <b>{people[seat]!.time}</b></p>
                <p className="muted">{people[seat]!.place || `${people[seat]!.latitude}, ${people[seat]!.longitude}`}</p>
                {result && <PersonMoon r={result} seat={seat} />}
                <button className="btn-ghost" onClick={() => setEditing(seat)}>Edit</button>
              </div>
            ) : (
              <div className="person-summary">
                <p className="muted">No birth details yet.</p>
                <button className="btn-ghost" onClick={() => setEditing(seat)}>Add birth details</button>
              </div>
            )}
          </div>
        ))}
      </section>

      <div className="match-actions">
        <button className="btn-primary" disabled={busy || !people.a || !people.b} onClick={() => match(people)}>
          {busy ? 'Matching…' : 'Match these charts'}
        </button>
        <button className="btn-ghost" disabled={busy || !people.a || !people.b} onClick={swap} title="The classical tables seat one person as groom and one as bride">Swap seats</button>
        <button className="btn-ghost" disabled={busy} onClick={sample}>Try a sample couple</button>
      </div>
      {error && <p className="form-error match-error" role="alert">{error}</p>}

      {result && <Result r={result} names={{ a: label(people.a, 'a'), b: label(people.b, 'b') }} />}

      <footer className="foot muted">
        <p>Sidereal zodiac · {people.a?.ayanamsa ?? 'lahiri'} ayanamsa · North Indian Ashtakoota tables</p>
        <p>Matching is a traditional practice, not a science, and a score cannot tell you whether a relationship will work. Use it for reflection and conversation, never as the only reason for a decision.</p>
        <p>Both sets of birth details stay in this browser. Free software under <a href="https://github.com/destinjones/vedic-astrology/blob/main/LICENSE">AGPL-3.0</a>: <a href="https://github.com/destinjones/vedic-astrology">get the source</a>.</p>
        <TrustFooter />
      </footer>
    </div>
  );
}

function PersonMoon({ r, seat }: { r: MatchResult; seat: Seat }) {
  const p = r[seat];
  return (
    <dl className="moon-facts">
      <div><dt>Moon sign</dt><dd>{p.moonSignName}</dd></div>
      <div><dt>Nakshatra</dt><dd>{p.nakshatraName} {p.pada}</dd></div>
      <div><dt>Gana</dt><dd>{p.gana}</dd></div>
      <div><dt>Nadi</dt><dd>{p.nadi}</dd></div>
      <div><dt>Yoni</dt><dd>{p.yoni}</dd></div>
      <div><dt>Varna</dt><dd>{p.varna}</dd></div>
    </dl>
  );
}

const BAND_TONE: Record<MatchResult['band'], string> = { excellent: 'good', very_good: 'good', acceptable: 'mid', not_recommended: 'bad' };

function Result({ r, names }: { r: MatchResult; names: Record<Seat, string> }) {
  const tone = BAND_TONE[r.band];
  return (
    <main id="result" className="match-result">
      <section className={`card score-card tone-${tone}`}>
        <ScoreDial total={r.total} adjusted={r.adjustedTotal} tone={tone} />
        <div className="score-copy">
          <p className="eyebrow">{names.a} and {names.b}</p>
          <h2>{r.bandLabel}</h2>
          <p>{r.summary}</p>
          <div className="band-scale" aria-hidden>
            {[['0–17', 'bad', r.total < 18], ['18–24', 'mid', r.total >= 18 && r.total < 25], ['25–32', 'good', r.total >= 25 && r.total < 33], ['33–36', 'good', r.total >= 33]].map(([t, c, on]) => (
              <span key={t as string} className={`band-step tone-${c} ${on ? 'is-on' : ''}`}>{t as string}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>The eight kootas</h3>
          <span className="muted">click any koota for what it means and why you scored it</span>
        </div>
        <div className="koota-list">
          {r.kootas.map((k, i) => <KootaRow key={k.id} k={k} n={i + 1} names={names} />)}
        </div>
      </section>

      {r.doshas.length > 0 && (
        <section className="card">
          <div className="card-head"><h3>Koota doshas</h3><span className="muted">and the classical exceptions</span></div>
          <div className="dosha-grid">
            {r.doshas.map((d) => (
              <article key={d.id} className={`dosha-card ${d.cancelled ? 'is-cancelled' : 'is-active'}`}>
                <header>
                  <h4>{d.name}</h4>
                  <span className={`chip ${d.cancelled ? 'chip-good' : 'chip-bad'}`}>{d.cancelled ? 'cancelled' : 'active'}</span>
                </header>
                {d.cancellations.length > 0 ? (
                  <ul>{d.cancellations.map((c) => <li key={c}>{c[0].toUpperCase() + c.slice(1)}.</li>)}</ul>
                ) : (
                  <p className="muted">None of the classical exceptions apply to this pair.</p>
                )}
                <p className="dosha-note">{d.note}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <ManglikPanel m={r.manglik} names={names} />

      <section className="card notes-card">
        <h3>Reading the score wisely</h3>
        <ul>{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      </section>
    </main>
  );
}

function ScoreDial({ total, adjusted, tone }: { total: number; adjusted: number; tone: string }) {
  const R = 78, C = 2 * Math.PI * R;
  const frac = total / 36;
  const adj = adjusted / 36;
  return (
    <div className="score-dial">
      <svg viewBox="0 0 200 200" role="img" aria-label={`${fmt(total)} of 36 gunas`}>
        <defs>
          <linearGradient id="dial-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f6d48f" />
            <stop offset="1" stopColor={`var(--${tone})`} />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={R} className="dial-track" />
        {adjusted > total && (
          <circle cx="100" cy="100" r={R} className="dial-adjusted" strokeDasharray={`${C * adj} ${C}`} transform="rotate(-90 100 100)" />
        )}
        <circle cx="100" cy="100" r={R} className="dial-fill" stroke="url(#dial-grad)" strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 100 100)" />
        {Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * 2 * Math.PI - Math.PI / 2;
          const r1 = R + 12, r2 = R + (i % 9 === 0 ? 20 : 16);
          return <line key={i} x1={100 + r1 * Math.cos(a)} y1={100 + r1 * Math.sin(a)} x2={100 + r2 * Math.cos(a)} y2={100 + r2 * Math.sin(a)} className={i < total ? 'dial-tick on' : 'dial-tick'} />;
        })}
        <text x="100" y="98" className="dial-num">{fmt(total)}</text>
        <text x="100" y="124" className="dial-sub">of 36 gunas</text>
      </svg>
      {adjusted > total && <p className="dial-adj">{fmt(adjusted)} with cancellations counted</p>}
    </div>
  );
}

function KootaRow({ k, n, names }: { k: KootaResult; n: number; names: Record<Seat, string> }) {
  const pct = (k.points / k.max) * 100;
  const tone = k.quality === 'full' || k.quality === 'good' ? 'good' : k.quality === 'partial' ? 'mid' : 'bad';
  return (
    <details className={`koota tone-${tone}`}>
      <summary>
        <span className="koota-n">{n}</span>
        <span className="koota-name">
          <b>{k.name}</b>
          <small>{k.gloss}</small>
        </span>
        <span className="koota-bar" aria-hidden>
          {Array.from({ length: k.max }, (_, i) => (
            <span key={i} className="koota-seg" style={{ '--fill': `${Math.max(0, Math.min(1, k.points - i)) * 100}%` } as React.CSSProperties} />
          ))}
        </span>
        <span className="koota-pts mono" aria-label={`${fmt(k.points)} of ${k.max}`}>
          <b>{fmt(k.points)}</b>/{k.max}
        </span>
        <span className="sr-only">{Math.round(pct)}%</span>
      </summary>
      <div className="koota-body">
        <div className="koota-values">
          <div><small>{names.a}</small><b>{k.values.a}</b></div>
          <span aria-hidden>⟷</span>
          <div><small>{names.b}</small><b>{k.values.b}</b></div>
        </div>
        <p className="koota-explain">{k.explanation}</p>
        {k.dosha && (
          <p className={`koota-dosha ${k.dosha.cancelled ? 'is-cancelled' : ''}`}>
            <b>{k.dosha.name}</b> {k.dosha.cancelled ? `is cancelled: ${k.dosha.cancellations.join('; ')}.` : 'is active, with no classical exception for this pair.'}
          </p>
        )}
        <h4>About {k.name}</h4>
        <p className="muted">{k.about}</p>
        <p className="koota-area">Governs {k.area}.</p>
      </div>
    </details>
  );
}

const STATUS_TONE: Record<ManglikComparison['status'], string> = { neither: 'good', both: 'good', balanced: 'mid', mismatch: 'bad' };

function ManglikPanel({ m, names }: { m: ManglikComparison; names: Record<Seat, string> }) {
  const tone = STATUS_TONE[m.status];
  return (
    <section className="card manglik-card">
      <div className="card-head">
        <h3>Manglik comparison</h3>
        <span className={`chip chip-${tone}`}>{m.status === 'neither' ? 'no dosha' : m.status === 'both' ? 'matched' : m.status}</span>
      </div>
      <div className="manglik-head">
        <img src={grahaArt('mars').image} alt="Mangala, Mars, as a rust-red sphere" className="manglik-art" loading="lazy" />
        <div>
          <h4>{m.headline}</h4>
          <p>{m.summary}</p>
        </div>
      </div>
      <div className="manglik-sides">
        <ManglikColumn side={m.a} name={names.a} />
        <ManglikColumn side={m.b} name={names.b} />
      </div>
      <p className="muted manglik-rule">Manglik houses are the 1st, 2nd, 4th, 7th, 8th and 12th, counted from the ascendant, the Moon and Venus. A malefic (Mars, Saturn, Rahu or Ketu) in the same houses of the partner’s chart balances the dosha.</p>
    </section>
  );
}

function ManglikColumn({ side, name }: { side: ManglikSide; name: string }) {
  const H = [1, 2, 4, 7, 8, 12];
  const cell = (label: string, h: number) => (
    <div className={`mars-from ${H.includes(h) ? 'is-hit' : ''}`}>
      <small>from {label}</small>
      <b>{h}</b>
    </div>
  );
  const verdict = side.manglik ? (side.dosha.severity === 'high' ? 'Manglik (strong)' : side.dosha.severity === 'moderate' ? 'Manglik' : 'Mildly Manglik') : side.marsInManglikHouse ? 'Cancelled in own chart' : 'Not Manglik';
  return (
    <div className="manglik-col">
      <header>
        <b>{name}</b>
        <span className={`chip ${side.manglik ? 'chip-bad' : side.marsInManglikHouse ? 'chip-mid' : 'chip-good'}`}>{verdict}</span>
      </header>
      <p className="muted small">Mars’ house</p>
      <div className="mars-grid">
        {cell('lagna', side.marsFrom.ascendant)}
        {cell('Moon', side.marsFrom.moon)}
        {cell('Venus', side.marsFrom.venus)}
      </div>
      <p className="small">{side.dosha.reason}</p>
      {side.dosha.cancellations.length > 0 && (
        <>
          <p className="muted small">Cancellations in this chart</p>
          <ul className="small">{side.dosha.cancellations.map((c) => <li key={c}>{c}</li>)}</ul>
        </>
      )}
      {side.balancingMalefics.length > 0 && (
        <>
          <p className="muted small">Malefics that can balance a Manglik partner</p>
          <ul className="small">{side.balancingMalefics.map((c) => <li key={c}>{c}</li>)}</ul>
        </>
      )}
    </div>
  );
}
