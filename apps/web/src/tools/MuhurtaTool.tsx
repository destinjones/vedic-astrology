import { useMemo, useState } from 'react';
import {
  MUHURTA_ACTIVITIES, findMuhurtas, localToUtc,
  type Direction, type Engine, type MuhurtaActivity, type MuhurtaNatal, type MuhurtaResult, type MuhurtaWindow,
} from '@vedic/engine';
import { NAKSHATRAS, SIGNS } from '../data/constants';
import { MUHURTA_CAVEAT } from '../lib/muhurtaCaveat';
import { PlaceField, fmtLocal, loadPlace, loadSavedBirth, localParts, savePlace, type Place } from './shared';

type NatalMode = 'none' | 'saved' | 'manual';
const GRADE_LABEL: Record<MuhurtaWindow['grade'], string> = { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Weak', avoid: 'Avoid' };

export function MuhurtaTool({ engine }: { engine: Engine }) {
  const saved = loadSavedBirth();
  const [place, setPlace] = useState<Place>(loadPlace);
  const [activity, setActivity] = useState<MuhurtaActivity>('marriage');
  const [from, setFrom] = useState(() => localParts(new Date(), place.timezone).date);
  const [days, setDays] = useState(30);
  const [daytimeOnly, setDaytimeOnly] = useState(false);
  const [direction, setDirection] = useState<Direction | ''>('');
  const [natalMode, setNatalMode] = useState<NatalMode>(saved ? 'saved' : 'none');
  const [manNak, setManNak] = useState(1);
  const [manSign, setManSign] = useState(1);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<MuhurtaResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const def = MUHURTA_ACTIVITIES.find((a) => a.id === activity)!;

  const savedNatal = useMemo<MuhurtaNatal | null>(() => {
    if (!saved) return null;
    try {
      const c = engine.computeChart({ date: saved.date, time: saved.time, place: { latitude: saved.latitude, longitude: saved.longitude, timezone: saved.timezone } }, { vargas: ['D1'], dashaLevels: 1 });
      return { moonNakshatra: c.planets.moon.nakshatra, moonSign: c.planets.moon.sign, lagnaSign: c.ascendant.sign };
    } catch { return null; }
  }, [engine, saved?.date, saved?.time, saved?.latitude, saved?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const search = () => {
    setErr(null);
    setBusy(true);
    setTimeout(() => {
      try {
        const start = localToUtc(from, '00:00', place.timezone).utc;
        const end = new Date(start.getTime() + days * 86400000);
        const natal = natalMode === 'saved' ? savedNatal ?? undefined : natalMode === 'manual' ? { moonNakshatra: manNak, moonSign: manSign } : undefined;
        const r = findMuhurtas(engine, { activity, start, end, latitude: place.latitude, longitude: place.longitude, timezone: place.timezone, natal, daytimeOnly, limit: 15, direction: activity === 'travel' && direction ? direction : undefined });
        setRes(r);
        setDay(r.days.findIndex((d) => d.bestIndex >= 0 && r.best[0] && r.windows[d.bestIndex] === r.best[0]));
        setOpen(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }, 20);
  };

  return (
    <div className="tools-grid">
      <section className="card tools-form">
        <h3>What are you planning?</h3>
        <form className="birth-form" onSubmit={(e) => { e.preventDefault(); search(); }}>
          <label className="field span-2">
            <span>Activity</span>
            <select value={activity} onChange={(e) => setActivity(e.target.value as MuhurtaActivity)}>
              {MUHURTA_ACTIVITIES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
            <small className="muted">{def.description}</small>
          </label>
          <label className="field"><span>From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field">
            <span>Search</span>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </label>
          <div className="span-2"><PlaceField label="Where it will happen" value={place} onChange={(p) => { setPlace(p); savePlace(p); }} /></div>
          <div className="field span-2">
            <span>Personalise with your birth Moon (Tara and Chandra bala)</span>
            <div className="seg" role="radiogroup" aria-label="Birth Moon">
              <button type="button" role="radio" aria-checked={natalMode === 'none'} className={natalMode === 'none' ? 'is-active' : ''} onClick={() => setNatalMode('none')}>General</button>
              {saved && <button type="button" role="radio" aria-checked={natalMode === 'saved'} className={natalMode === 'saved' ? 'is-active' : ''} onClick={() => setNatalMode('saved')}>My saved chart</button>}
              <button type="button" role="radio" aria-checked={natalMode === 'manual'} className={natalMode === 'manual' ? 'is-active' : ''} onClick={() => setNatalMode('manual')}>Enter it</button>
            </div>
            {natalMode === 'saved' && savedNatal && (
              <small className="muted">{saved?.name || 'Saved chart'}: Moon in {NAKSHATRAS[savedNatal.moonNakshatra - 1].name}, {SIGNS[savedNatal.moonSign - 1].name}; {SIGNS[(savedNatal.lagnaSign ?? 1) - 1].name} rising.</small>
            )}
          </div>
          {natalMode === 'manual' && (
            <>
              <label className="field"><span>Birth nakshatra</span>
                <select value={manNak} onChange={(e) => setManNak(Number(e.target.value))}>{NAKSHATRAS.map((n, i) => <option key={i} value={i + 1}>{n.name}</option>)}</select>
              </label>
              <label className="field"><span>Moon sign</span>
                <select value={manSign} onChange={(e) => setManSign(Number(e.target.value))}>{SIGNS.map((s) => <option key={s.num} value={s.num}>{s.name}</option>)}</select>
              </label>
            </>
          )}
          {activity === 'travel' && (
            <label className="field span-2"><span>Direction of travel (for disha shoola)</span>
              <select value={direction} onChange={(e) => setDirection(e.target.value as Direction | '')}>
                <option value="">Not set</option>
                {(['east', 'south', 'west', 'north'] as Direction[]).map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
              </select>
            </label>
          )}
          <label className="field span-2 check">
            <input type="checkbox" checked={daytimeOnly} onChange={(e) => setDaytimeOnly(e.target.checked)} />
            <span>Daytime only (sunrise to sunset)</span>
          </label>
          {err && <p className="form-error span-2" role="alert">{err}</p>}
          <button className="btn-primary span-2" disabled={busy}>{busy ? 'Searching…' : 'Find good times'}</button>
        </form>
        <details className="kp-explain">
          <summary>What is checked</summary>
          <p><b>Panchanga:</b> the tithi (Rikta and new Moon tithis are avoided), weekday, nakshatra (each activity has its own list), yoga (Vyatipata and Vaidhriti are rejected) and karana (Vishti, also called Bhadra, is rejected).</p>
          <p><b>Muhurta classes:</b> each star faces up (Urdhva mukha, for building and raising), down (Adho mukha, for digging and surgery) or sideways (Tiryak mukha, for travel and vehicles). Dhanishta panchaka, the days the Moon spends in Aquarius and Pisces, is avoided for building, house-warming and journeys, and the panchaka rahita remainder of tithi, weekday, star and lagna is checked for every window. Bhadra is weighed by where she dwells, from the Moon’s sign. For travel, the weekday and star that spear your direction (disha shoola) are rejected. Weddings and house-warmings also wait while Jupiter or Venus is combust and during Kharmas.</p>
          <p><b>Rising sign:</b> fixed signs for lasting things, movable signs for travel. Benefics in angles and trines help; the 8th house should be empty.</p>
          <p><b>Day periods:</b> Rahu kalam and Yamaganda are rejected, Gulika is marked down, and Abhijit muhurta around local noon gets a bonus.</p>
          <p><b>Your Moon:</b> Tara bala counts from your birth star to the day's star in groups of nine; the 3rd, 5th and 7th are harmful. Chandra bala counts from your Moon sign; the 8th (Chandrashtama) is rejected.</p>
          <p>The scores are this site's own weighting of these rules. A family priest or astrologer may weigh them differently and look at more, such as the couple's own charts for a wedding.</p>
        </details>
      </section>

      {res && <MuhurtaResults res={res} day={day} setDay={setDay} open={open} setOpen={setOpen} />}
    </div>
  );
}

const scoreColor = (s: number, grade: MuhurtaWindow['grade']) =>
  grade === 'avoid' ? 'var(--bad)' : s >= 80 ? 'var(--good)' : s >= 65 ? 'color-mix(in srgb, var(--good) 60%, var(--mid))' : s >= 50 ? 'var(--mid)' : 'color-mix(in srgb, var(--mid) 40%, var(--bad))';

function WindowCard({ w, tz, open, onToggle }: { w: MuhurtaWindow; tz: string; open: boolean; onToggle: () => void }) {
  const s = w.state;
  return (
    <li className={`mw mw-${w.grade}`}>
      <button className="mw-head" onClick={onToggle} aria-expanded={open}>
        <span className="mw-score" style={{ '--c': scoreColor(w.score, w.grade) } as React.CSSProperties}>{w.score}</span>
        <span className="mw-when">
          <b>{fmtLocal(w.start, tz, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
          <span>{fmtLocal(w.start, tz, { timeStyle: 'short' })} to {fmtLocal(w.end, tz, { timeStyle: 'short' })} <small className="muted">({w.minutes} min)</small></span>
        </span>
        <span className="mw-tags">
          <span className="chip">{s.nakshatraName}</span>
          <span className="chip">{s.paksha === 'shukla' ? 'Shukla' : 'Krishna'} {s.tithiName}</span>
          <span className="chip">{s.lagnaName} lagna</span>
          <span className={`chip ${w.grade === 'avoid' ? 'chip-bad' : w.grade === 'excellent' || w.grade === 'good' ? 'chip-good' : 'chip-mid'}`}>{GRADE_LABEL[w.grade]}</span>
        </span>
      </button>
      {open && (
        <ul className="factor-list">
          {w.factors.map((f) => (
            <li key={f.key} className={`factor ${f.blocker ? 'f-negative f-block' : f.points > 0 ? 'f-positive' : f.points < 0 ? 'f-negative' : 'f-neutral'}`}>
              <b>{f.label} <small className="mono">{f.points > 0 ? `+${f.points}` : f.points}</small></b>
              <span>{f.detail}</span>
            </li>
          ))}
          <li className="factor f-neutral"><b>Also</b><span>{s.weekdayName}, {s.yogaName} yoga, {s.karanaName} karana{s.tara ? `, ${s.tara.name} tara` : ''}{s.chandra ? `, Moon ${s.chandra} from birth Moon` : ''}.</span></li>
        </ul>
      )}
    </li>
  );
}

function MuhurtaResults({ res, day, setDay, open, setOpen }: { res: MuhurtaResult; day: number | null; setDay: (d: number) => void; open: number | null; setOpen: (i: number | null) => void }) {
  const tz = res.timezone;
  const d = day !== null && day >= 0 ? res.days[day] : null;
  const dayWindows = useMemo(() => {
    if (!d) return [];
    const a = new Date(d.sunrise!).getTime();
    const next = res.days[(day ?? 0) + 1]?.sunrise;
    const b = next ? new Date(next).getTime() : a + 86400000;
    return res.windows.map((w, i) => ({ w, i })).filter(({ w }) => {
      const m = (new Date(w.start).getTime() + new Date(w.end).getTime()) / 2;
      return m >= a && m < b;
    });
  }, [d, day, res]);

  return (
    <>
      <p className="muhurta-caveat span-all" role="note">{MUHURTA_CAVEAT}</p>
      <section className="card span-all">
        <div className="card-head"><h3>Best times for {res.activity.label.toLowerCase()}</h3><span className="muted">times are local to the place ({tz})</span></div>
        {res.best.length === 0 ? (
          <p>No window in this range passes every rule. Try a longer range, or turn off "daytime only".</p>
        ) : (
          <ul className="mw-list">
            {res.best.map((w) => {
              const i = res.windows.indexOf(w);
              return <WindowCard key={i} w={w} tz={tz} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />;
            })}
          </ul>
        )}
      </section>

      <section className="card span-all">
        <div className="card-head"><h3>Day by day</h3><span className="muted">each day runs sunrise to sunrise; colour shows its best window</span></div>
        <div className="mday-grid">
          {res.days.map((x, i) => (
            <button key={x.date} className={`mday ${day === i ? 'is-active' : ''}`} onClick={() => setDay(i)} style={{ '--c': x.bestIndex >= 0 ? scoreColor(x.best, 'good') : 'var(--line-soft)' } as React.CSSProperties} title={`Best ${x.best}`}>
              <small>{fmtLocal(x.sunrise ?? x.date, tz, { weekday: 'short' })}</small>
              <b>{Number(x.date.slice(8))}</b>
              <span className="mday-score">{x.bestIndex >= 0 ? x.best : '–'}</span>
            </button>
          ))}
        </div>
        {d && (
          <div className="mday-detail">
            <h4>{fmtLocal(d.sunrise!, tz, { dateStyle: 'full' })}</h4>
            <p className="muted kp-note">Sunrise {fmtLocal(d.sunrise!, tz, { timeStyle: 'short' })}{d.sunset ? ` · sunset ${fmtLocal(d.sunset, tz, { timeStyle: 'short' })}` : ''}</p>
            <div className="mday-bar">
              {dayWindows.map(({ w, i }) => (
                <button key={i} className="mday-seg" style={{ flexGrow: w.endJd - w.startJd, '--c': scoreColor(w.score, w.grade) } as React.CSSProperties}
                  title={`${fmtLocal(w.start, tz, { timeStyle: 'short' })}–${fmtLocal(w.end, tz, { timeStyle: 'short' })}: ${w.score} ${GRADE_LABEL[w.grade]}`}
                  onClick={() => setOpen(open === i ? null : i)} />
              ))}
            </div>
            <ul className="mw-list compact">
              {dayWindows.map(({ w, i }) => <WindowCard key={i} w={w} tz={tz} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />)}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}
