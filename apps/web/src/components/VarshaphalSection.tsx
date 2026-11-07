import { useEffect, useMemo, useState } from 'react';
import {
  ageForYear,
  ASPECT_INFO,
  computeVarshaphal,
  MUDDA_TEXT,
  readVarshaphal,
  SAHAM_VERDICT_TEXT,
  type LifeArea,
  type MuddaPeriod,
  type ReadingText,
  type TajikaYoga,
  type Varshaphal,
} from '@vedic/tajika';
import type { Chart, PlanetId } from '../types/chart';
import type { ChartStyle, Selection } from '../types/ui';
import { fromEngine } from '../engine/adapter';
import { searchPlaces } from '../engine';
import { PLANET_BY_ID, signInfo } from '../data/constants';
import { NorthChart } from './NorthChart';
import { SouthChart } from './SouthChart';
import './varshaphal.css';

type Ctx = NonNullable<Chart['engineContext']>;
interface Place { name: string; latitude: number; longitude: number; timezone: string }

const pname = (p: PlanetId) => PLANET_BY_ID[p].name;
const dms = (deg: number) => {
  const s = Math.round(deg * 3600);
  return `${Math.floor(s / 3600)}°${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}′${String(s % 60).padStart(2, '0')}″`;
};
const offsetLabel = (min: number) => {
  const sign = min < 0 ? '−' : '+';
  const a = Math.abs(min);
  return `UTC${sign}${Math.floor(a / 60)}${a % 60 ? `:${String(Math.round(a % 60)).padStart(2, '0')}` : ''}`;
};
const longDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** Which year of life is running today */
function currentAge(ctx: Ctx) {
  const now = Date.now();
  let age = Math.max(0, ageForYear(ctx.chart, new Date().getUTCFullYear()));
  const v = computeVarshaphal(ctx.engine, ctx.chart, { age });
  if (+new Date(v.returnUtc) > now && age > 0) age -= 1;
  return age;
}

export default function VarshaphalSection({ context, chart, style }: { context: Ctx; chart: Chart; style: ChartStyle }) {
  const [age, setAge] = useState(() => currentAge(context));
  const [place, setPlace] = useState<Place | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [hover, setHover] = useState<PlanetId | null>(null);
  const [view, setView] = useState<ChartStyle>(style);
  useEffect(() => setView(style), [style]);

  const result = useMemo(() => {
    try {
      const v = computeVarshaphal(context.engine, context.chart, { age, place: place ?? undefined });
      return { v, error: null as string | null };
    } catch (e) {
      return { v: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [context, age, place]);
  const v = result.v;
  const reading = useMemo(() => (v ? readVarshaphal(v) : null), [v]);
  const uiChart = useMemo(() => (v ? fromEngine({ ...chart.input, place: place?.name ?? chart.input.place }, v.chart) : null), [v, chart.input, place]);

  const birthYear = Number(chart.input.date.slice(0, 4));
  const ages = Array.from({ length: 111 }, (_, i) => i);

  return (
    <div className="vp">
      <div className="vp-controls">
        <div className="vp-year">
          <button className="btn-ghost sm" aria-label="Previous year" disabled={age <= 0} onClick={() => setAge((a) => Math.max(0, a - 1))}>‹</button>
          <label>
            <span className="sr-only">Year of life</span>
            <select value={age} onChange={(e) => setAge(Number(e.target.value))}>
              {ages.map((a) => <option key={a} value={a}>{birthYear + a} · age {a}{a === 0 ? ' (birth year)' : ''}</option>)}
            </select>
          </label>
          <button className="btn-ghost sm" aria-label="Next year" disabled={age >= 110} onClick={() => setAge((a) => a + 1)}>›</button>
          <button className="btn-ghost sm" onClick={() => setAge(currentAge(context))}>This year</button>
        </div>
        <PlacePicker place={place} birthPlace={chart.input.place} onChange={setPlace} />
      </div>

      {result.error && <p className="form-error" role="alert">{result.error}</p>}

      {v && reading && uiChart && (
        <>
          <div className={`vp-hero tone-${reading.tone}`}>
            <div>
              <small>Year {v.age + 1} of life · {v.isDayChart ? 'day' : 'night'} chart</small>
              <h4>{reading.headline}</h4>
              {reading.overview.map((t) => <p key={t}>{t}</p>)}
            </div>
            <div className="vp-score" title="A synthesis of the Muntha, the year lord, Ikkavala or Induvara and the key Ithasalas">
              <b>{v.score > 0 ? '+' : ''}{v.score}</b>
              <small>year score</small>
            </div>
          </div>

          <dl className="vp-moment">
            <div>
              <dt>Sun returns to</dt>
              <dd>{dms(v.natalSunLongitude % 30)} {signInfo(Math.floor(v.natalSunLongitude / 30) + 1).name}</dd>
            </div>
            <div>
              <dt>Year begins</dt>
              <dd>{longDate(v.returnLocal.date)}, <b>{v.returnLocal.time}</b> <span className="muted">{offsetLabel(v.returnLocal.utcOffsetMinutes)}</span></dd>
            </div>
            <div>
              <dt>In UTC</dt>
              <dd>{v.returnUtc.slice(0, 10)} {v.returnUtc.slice(11, 19)}</dd>
            </div>
            <div>
              <dt>Year ends</dt>
              <dd>{new Date(v.nextReturnUtc).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: v.place.timezone })}</dd>
            </div>
            <div>
              <dt>Cast for</dt>
              <dd>{place?.name ?? chart.input.place} <span className="muted">{v.place.latitude.toFixed(2)}, {v.place.longitude.toFixed(2)}</span></dd>
            </div>
          </dl>

          <div className="vp-grid">
            <section className="vp-panel">
              <div className="vp-head">
                <h4>Annual chart</h4>
                <div className="seg" role="radiogroup" aria-label="Annual chart style">
                  <button role="radio" aria-checked={view === 'north'} className={view === 'north' ? 'is-active' : ''} onClick={() => setView('north')}>North</button>
                  <button role="radio" aria-checked={view === 'south'} className={view === 'south' ? 'is-active' : ''} onClick={() => setView('south')}>South</button>
                </div>
              </div>
              <div className="chart-stage" onMouseLeave={() => setHover(null)}>
                {view === 'north'
                  ? <NorthChart chart={uiChart} varga={uiChart.vargas.D1!} selection={selection} hoverPlanet={hover} onSelect={setSelection} onHoverPlanet={setHover} />
                  : <SouthChart chart={uiChart} varga={uiChart.vargas.D1!} selection={selection} hoverPlanet={hover} onSelect={setSelection} onHoverPlanet={setHover} />}
              </div>
              <p className="vp-legend muted">
                Lagna {signInfo(v.lagna.sign).glyph} {signInfo(v.lagna.sign).name} {dms(v.lagna.degreeInSign)} · Muntha {signInfo(v.muntha.sign).glyph} {signInfo(v.muntha.sign).name}, house {v.muntha.house}
              </p>
              {selection?.kind === 'planet' && <PlanetNote v={v} id={selection.id} />}
            </section>

            <section className="vp-panel vp-readings">
              <Reading r={reading.yearLord} open />
              <Reading r={reading.muntha} open />
              <Reading r={reading.lagna} />
              {reading.currentMudda && (
                <p className="vp-now"><span className="vp-chip">Now</span> {reading.currentMudda.text}</p>
              )}
            </section>
          </div>

          <section className="vp-panel">
            <div className="vp-head"><h4>The five office-bearers</h4><span className="muted">the strongest one that sees the annual lagna rules the year</span></div>
            <div className="vp-table-wrap">
              <table className="vp-table">
                <thead><tr><th>Office</th><th>Planet</th><th>Strength (of 20)</th><th>Sees lagna</th></tr></thead>
                <tbody>
                  {v.officeBearers.map((b) => (
                    <tr key={b.role} className={b.planet === v.yearLord.planet ? 'is-lord' : ''}>
                      <td>{b.label}</td>
                      <td><span style={{ color: PLANET_BY_ID[b.planet].color }}>{PLANET_BY_ID[b.planet].glyph}</span> {pname(b.planet)}{b.planet === v.yearLord.planet && <span className="vp-chip">Year lord</span>}</td>
                      <td><Bar value={b.strength} /></td>
                      <td>{b.aspectsLagna ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="vp-more">
              <summary>Pancha-vargiya bala for all seven planets</summary>
              <div className="vp-table-wrap">
                <table className="vp-table num">
                  <thead><tr><th>Planet</th><th>Sign (30)</th><th>Exaltation (20)</th><th>Hadda (15)</th><th>Drekkana (10)</th><th>Navamsa (5)</th><th>Total (20)</th></tr></thead>
                  <tbody>
                    {Object.values(v.strengths).map((s) => (
                      <tr key={s.planet}>
                        <td>{pname(s.planet)}</td><td>{s.kshetra.toFixed(2)}</td><td>{s.uchcha.toFixed(2)}</td>
                        <td>{s.hadda.toFixed(2)} <small className="muted">{pname(s.haddaLord)}</small></td>
                        <td>{s.drekkana.toFixed(2)}</td><td>{s.navamsa.toFixed(2)}</td><td><b>{s.total.toFixed(2)}</b> <small className="muted">{s.grade}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted vp-note">Each part counts in full for the planet's own sign, half for a friend's, a quarter for a neutral's and an eighth for an enemy's (natural friendships). Exaltation strength falls off evenly to nothing at the debilitation point.</p>
            </details>
          </section>

          <section className="vp-panel">
            <div className="vp-head"><h4>Mudda dasha</h4><span className="muted">the 120 Vimshottari years compressed into this one year</span></div>
            <MuddaBar periods={v.mudda} />
          </section>

          <div className="vp-grid">
            <section className="vp-panel">
              <div className="vp-head"><h4>Life areas this year</h4><span className="muted">lagna lord and each house lord</span></div>
              <ul className="vp-areas">{v.areas.map((a) => <AreaRow key={a.id} a={a} />)}</ul>
            </section>
            <section className="vp-panel">
              <div className="vp-head"><h4>Tajika yogas</h4><span className="muted">{v.yogas.length} found</span></div>
              {v.yogas.length === 0 && <p className="muted">No Tajika yogas form between the key planets this year.</p>}
              {v.yogas.map((y, i) => <YogaRow key={y.id + i} y={y} />)}
            </section>
          </div>

          <section className="vp-panel">
            <div className="vp-head"><h4>Sahams</h4><span className="muted">sensitive points for each matter of the year</span></div>
            <div className="vp-table-wrap">
              <table className="vp-table">
                <thead><tr><th>Saham</th><th>Formula ({v.isDayChart ? 'day' : 'night'})</th><th>Position</th><th>House</th><th>Lord</th><th>Outlook</th></tr></thead>
                <tbody>
                  {v.sahams.map((s) => (
                    <tr key={s.id} title={`${s.signifies}. ${SAHAM_VERDICT_TEXT[s.verdict]}`}>
                      <td><b>{s.name}</b> <small className="muted">{s.sanskrit}</small><div className="vp-sub">{s.signifies}</div></td>
                      <td className="muted">{s.formula}{s.addedSign && ' + 30°'}</td>
                      <td>{signInfo(s.sign).glyph} {dms(s.degreeInSign)}</td>
                      <td>{s.house}</td>
                      <td>{pname(s.lord)} <small className="muted">{s.lordStrength.toFixed(1)}</small></td>
                      <td><span className={`vp-verdict v-${s.verdict}`}>{s.verdict}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted vp-note">A Saham is A − B + C. When C does not fall between B and A, a sign (30°) is added, and most formulas swap A and B in a night chart. A Saham does well when its lord is strong and sees it, and less well in the 6th, 8th or 12th.</p>
          </section>

          <details className="vp-panel vp-more">
            <summary>All Tajika aspects between the seven planets</summary>
            <div className="vp-table-wrap">
              <table className="vp-table">
                <thead><tr><th>Planets</th><th>Aspect</th><th>Gap / orb</th><th>Relation</th></tr></thead>
                <tbody>
                  {v.aspects.map((a) => (
                    <tr key={a.a + a.b}>
                      <td>{pname(a.faster)} → {pname(a.faster === a.a ? a.b : a.a)}</td>
                      <td title={ASPECT_INFO[a.kind].text}>{ASPECT_INFO[a.kind].name}</td>
                      <td>{a.gap.toFixed(2)}° / {a.orb.toFixed(1)}°</td>
                      <td>{a.relation === 'none' ? <span className="muted">out of orb</span> : a.relation === 'ithasala' ? `Ithasala${a.phase === 'purna' ? ' (exact)' : a.phase === 'bhavishyat' ? ' (coming)' : ''}` : 'Ishrafa'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted vp-note">Tajika aspects count signs: 3rd and 11th, 5th and 9th are friendly, 1st, 4th, 7th and 10th are inimical, and 2nd, 6th, 8th and 12th see nothing. Each planet throws an orb (deeptamsa) of light, Sun 15°, Moon 12°, Jupiter and Saturn 9°, Mars 8°, Mercury and Venus 7°, and two planets are within orb when their gap is no more than half the sum.</p>
          </details>

          <p className="muted vp-note">Rules follow Tajika Neelakanthi as most teachers apply it. Where schools differ, this page says which choice it makes: the Moon does not rule the year, the annual chart uses whole sign houses, and the Mudda dasha starts with the natal dasha balance. Astrology is a traditional practice, for reflection, not prediction.</p>
        </>
      )}
    </div>
  );
}

function Reading({ r, open }: { r: ReadingText; open?: boolean }) {
  return (
    <details className={`reading-block tone-${r.tone === 'good' ? 'benefic' : r.tone === 'hard' ? 'challenging' : 'mixed'}`} open={open}>
      <summary><span className="tone-dot" aria-hidden />{r.title}</summary>
      <div className="reading-body">{r.text.map((t) => <p key={t}>{t}</p>)}</div>
    </details>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <span className="vp-bar" aria-label={`${value.toFixed(1)} of 20`}>
      <span style={{ width: `${(value / 20) * 100}%` }} />
      <b>{value.toFixed(1)}</b>
    </span>
  );
}

function AreaRow({ a }: { a: LifeArea }) {
  return (
    <li>
      <div className="vp-area-top">
        <b>{a.name}</b> <small className="muted">house {a.house}, lord {pname(a.karyesha)}</small>
        <span className={`vp-verdict v-${a.verdict}`}>{a.verdict}</span>
      </div>
      <p>{a.why}</p>
    </li>
  );
}

function YogaRow({ y }: { y: TajikaYoga }) {
  return (
    <details className={`reading-block tone-${y.tone === 'good' ? 'benefic' : y.tone === 'hard' ? 'challenging' : 'mixed'}`}>
      <summary><span className="tone-dot" aria-hidden />{y.name}<small className="muted vp-yoga-planets">{y.planets.map(pname).join(', ')}</small></summary>
      <div className="reading-body">
        <p className="lead">{y.meaning}</p>
        <p className="muted">{y.why}</p>
      </div>
    </details>
  );
}

function PlanetNote({ v, id }: { v: Varshaphal; id: PlanetId }) {
  const p = v.chart.planets[id];
  const s = id in v.strengths ? v.strengths[id as keyof Varshaphal['strengths']] : null;
  const offices = v.officeBearers.filter((b) => b.planet === id).map((b) => b.label.toLowerCase());
  return (
    <p className="vp-planet-note">
      <b style={{ color: PLANET_BY_ID[id].color }}>{pname(id)}</b> at {dms(p.degreeInSign)} {signInfo(p.sign).name}, {ordinal(p.house)} house
      {p.retrograde && id !== 'rahu' && id !== 'ketu' ? ', retrograde' : ''}{p.combust ? ', combust' : ''}.
      {s ? ` Tajika strength ${s.total.toFixed(1)} of 20 (${s.grade}).` : ' The nodes hold no office in Tajika.'}
      {offices.length ? ` Office: ${offices.join(', ')}.` : ''}
    </p>
  );
}

function MuddaBar({ periods }: { periods: MuddaPeriod[] }) {
  const now = Date.now();
  const t0 = +new Date(periods[0].start);
  const t1 = +new Date(periods[periods.length - 1].end);
  const nowIdx = periods.findIndex((p) => +new Date(p.start) <= now && now < +new Date(p.end));
  const [open, setOpen] = useState(nowIdx >= 0 ? nowIdx : 0);
  useEffect(() => setOpen(nowIdx >= 0 ? nowIdx : 0), [periods, nowIdx]);
  const active = periods[Math.min(open, periods.length - 1)];
  const pct = (t: number) => ((t - t0) / (t1 - t0)) * 100;
  return (
    <div className="dasha">
      <div className="dasha-bar">
        {periods.map((p, i) => {
          const info = PLANET_BY_ID[p.lord];
          return (
            <button key={i} className={`dasha-seg${i === open ? ' is-open' : ''}${i === nowIdx ? ' is-now' : ''}`}
              style={{ width: `${pct(+new Date(p.end)) - pct(+new Date(p.start))}%`, '--c': info.color } as React.CSSProperties}
              onClick={() => setOpen(i)} title={`${info.name} · ${shortDate(p.start)} – ${shortDate(p.end)} · ${p.days.toFixed(0)} days`}>
              <span>{info.abbr}</span>
            </button>
          );
        })}
        {now > t0 && now < t1 && <div className="dasha-now" style={{ left: `${pct(now)}%` }}><span>Now</span></div>}
      </div>
      <div className="dasha-detail">
        <h4>
          <span style={{ color: PLANET_BY_ID[active.lord].color }}>{PLANET_BY_ID[active.lord].glyph}</span>{' '}
          {pname(active.lord)} period <span className="muted">{shortDate(active.start)} – {shortDate(active.end)} · {active.days.toFixed(1)} days</span>
        </h4>
        <p className="vp-mudda-text">{MUDDA_TEXT[active.lord]}</p>
        <div className="antar-grid">
          {active.children?.map((s, i) => {
            const isNow = +new Date(s.start) <= now && now < +new Date(s.end);
            const info = PLANET_BY_ID[s.lord];
            return (
              <div key={i} className={`antar${isNow ? ' is-now' : ''}`} style={{ '--c': info.color } as React.CSSProperties}>
                <b>{PLANET_BY_ID[active.lord].abbr}–{info.abbr}</b>
                <small>{shortDate(s.start)} → {shortDate(s.end)}</small>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PlacePicker({ place, birthPlace, onChange }: { place: Place | null; birthPlace: string; onChange: (p: Place | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Place[]>([]);
  useEffect(() => {
    if (!editing || q.trim().length < 3) { setHits([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      searchPlaces(q.trim(), ctl.signal)
        .then((r) => setHits(r.map((g) => ({ name: [g.name, g.admin1, g.country].filter(Boolean).join(', '), latitude: g.latitude, longitude: g.longitude, timezone: g.timezone }))))
        .catch(() => {});
    }, 400);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, editing]);

  if (!editing) {
    return (
      <div className="vp-place">
        <span className="muted">Cast for</span> <b>{place?.name ?? `${birthPlace} (birthplace)`}</b>
        <button className="btn-ghost sm" onClick={() => setEditing(true)}>Where you live</button>
        {place && <button className="btn-ghost sm" onClick={() => onChange(null)}>Use birthplace</button>}
      </div>
    );
  }
  return (
    <div className="vp-place place-field">
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="City where you are on your birthday" aria-label="Place for the annual chart" />
      <button className="btn-ghost sm" onClick={() => { setEditing(false); setQ(''); }}>Cancel</button>
      {hits.length > 0 && (
        <ul className="suggest">
          {hits.map((h) => (
            <li key={h.name + h.latitude}>
              <button type="button" onClick={() => { onChange(h); setEditing(false); setQ(''); }}>{h.name} <small className="muted">{h.timezone}</small></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
