import { useMemo, useState } from 'react';
import { computeKpChart, kpChartAt, type Engine, type KpChart } from '@vedic/engine';
import {
  KpCuspTable, KpHouseTable, KpPlanetTable, KpSignificationTable, KpWheel, PlaceField, RulingPlanets,
  fmtLocal, loadPlace, loadSavedBirth, savePlace, type Place,
} from './shared';

const DEFAULT = { date: '1990-08-15', time: '06:30' };

export function KpTool({ engine }: { engine: Engine }) {
  const saved = loadSavedBirth();
  const [date, setDate] = useState(saved?.date ?? DEFAULT.date);
  const [time, setTime] = useState(saved?.time ?? DEFAULT.time);
  const [name, setName] = useState(saved?.name ?? '');
  const [place, setPlace] = useState<Place>(() => (saved ? { name: saved.place, latitude: saved.latitude, longitude: saved.longitude, timezone: saved.timezone } : loadPlace()));
  const [chart, setChart] = useState<KpChart | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<'planets' | 'houses'>('planets');

  const run = () => {
    try {
      setErr(null);
      setChart(computeKpChart(engine, { date, time, place: { latitude: place.latitude, longitude: place.longitude, timezone: place.timezone } }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  // Ruling planets right now at the same place: KP uses them to confirm timing and to rectify
  const now = useMemo(() => (chart ? kpChartAt(engine, Date.now() / 86400000 + 2440587.5, place) : null), [chart, engine, place]);

  return (
    <div className="tools-grid">
      <section className="card tools-form">
        <h3>Birth details</h3>
        {saved && <p className="muted kp-note">Filled in from the chart you last opened in this browser.</p>}
        <form className="birth-form" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <label className="field span-2"><span>Name <small className="muted">(optional)</small></span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field"><span>Date</span><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field"><span>Time</span><input type="time" step={1} required value={time} onChange={(e) => setTime(e.target.value)} /></label>
          <div className="span-2"><PlaceField label="Place of birth" value={place} onChange={(p) => { setPlace(p); savePlace(p); }} /></div>
          {err && <p className="form-error span-2" role="alert">{err}</p>}
          <button className="btn-primary span-2">Cast KP chart</button>
        </form>
        <details className="kp-explain">
          <summary>How KP reads a chart</summary>
          <p>Every nakshatra (13°20′) is split into nine <b>subs</b> whose sizes follow the Vimshottari years, starting from the nakshatra's own lord. A planet gives the results of its <b>star lord</b>, and its <b>sub lord</b> decides whether those results are good or bad for a given matter.</p>
          <p>For any house, look at the <b>sub lord of its cusp</b>. If that planet signifies the houses that fulfil the matter (for marriage 2, 7 and 11), it is promised; if it signifies the houses that deny it (1, 6, 10), it is not.</p>
          <p>A planet signifies houses at four levels, strongest first: <b>A</b> the house its star lord occupies, <b>B</b> the house it occupies, <b>C</b> the houses its star lord owns, <b>D</b> the houses it owns. A planet owns a house when the cusp falls in its sign.</p>
        </details>
      </section>

      {chart && (
        <>
          <section className="card kp-wheel-card">
            <div className="card-head"><h3>{name ? `${name}: bhava chart` : 'Bhava chart'}</h3><span className="muted">Placidus, ascendant on the left</span></div>
            <KpWheel chart={chart} />
            <p className="muted kp-note">Krishnamurti ayanamsa {chart.ayanamsaValue.toFixed(4)}° · {chart.houseSystem === 'porphyry' ? 'Porphyry houses (Placidus is undefined this close to the pole)' : 'Placidus houses'} · {fmtLocal(chart.utc, place.timezone)}</p>
          </section>
          <section className="card span-all">
            <div className="card-head"><h3>Cusps</h3><span className="muted">the sub lord of each cusp is the judge of that house</span></div>
            <KpCuspTable chart={chart} />
          </section>
          <section className="card span-all">
            <div className="card-head"><h3>Planets</h3><span className="muted">each planet's bhava, star lord and sub lord</span></div>
            <KpPlanetTable chart={chart} />
          </section>
          <section className="card span-all">
            <div className="card-head">
              <h3>Significators</h3>
              <div className="seg" role="radiogroup" aria-label="Significator view">
                <button role="radio" aria-checked={view === 'planets'} className={view === 'planets' ? 'is-active' : ''} onClick={() => setView('planets')}>By planet</button>
                <button role="radio" aria-checked={view === 'houses'} className={view === 'houses' ? 'is-active' : ''} onClick={() => setView('houses')}>By house</button>
              </div>
            </div>
            {view === 'planets' ? <KpSignificationTable chart={chart} /> : <KpHouseTable chart={chart} />}
            <p className="muted kp-note">A is the strongest level and D the weakest. Rahu and Ketu also act for the lord of the sign they sit in, shown after the plus sign.</p>
          </section>
          <section className="card">
            <div className="card-head"><h3>Ruling planets at birth</h3></div>
            <RulingPlanets chart={chart} />
          </section>
          {now && (
            <section className="card">
              <div className="card-head"><h3>Ruling planets now</h3><span className="muted">{place.name}</span></div>
              <RulingPlanets chart={now} />
              <p className="muted kp-note">KP checks a judgment against the ruling planets of the moment you look at the chart. Significators that are also ruling planets are the ones that deliver the result.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
