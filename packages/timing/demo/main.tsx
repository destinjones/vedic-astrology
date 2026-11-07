import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createEngine, geocode, type Chart, type Engine, type GeoResult } from '@vedic/engine';
import { TimingDashboard } from '../ui';
import { engineEphemeris, natalFromChart } from '../src/adapters/engine';
import { signName, signOf } from '../src';
import '../ui/timing.css';

const DEFAULT = { name: 'Sample chart', date: '1990-01-01', time: '12:00', place: { name: 'New York, New York, United States', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York' } as GeoResult };

function App() {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT);
  const [query, setQuery] = useState(DEFAULT.place.name);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [chart, setChart] = useState<Chart | null>(null);

  useEffect(() => { createEngine().then(setEngine).catch((e) => setErr(String(e))); }, []);
  useEffect(() => {
    if (query === form.place.name || query.length < 3) { setResults([]); return; }
    const ac = new AbortController();
    const t = setTimeout(() => geocode(query, { signal: ac.signal }).then(setResults).catch(() => {}), 300);
    return () => { clearTimeout(t); ac.abort(); };
  }, [query, form.place.name]);

  const compute = () => {
    if (!engine) return;
    try {
      setChart(engine.computeChart({ name: form.name, date: form.date, time: form.time, place: form.place }));
      setErr(null);
    } catch (e) { setErr(String(e)); }
  };
  useEffect(() => { if (engine && !chart) compute(); }, [engine]); // eslint-disable-line react-hooks/exhaustive-deps

  const natal = useMemo(() => (chart ? natalFromChart(chart) : null), [chart]);
  const eph = useMemo(() => (engine && chart ? engineEphemeris(engine, { ayanamsa: chart.meta.ayanamsa, nodeType: chart.meta.nodeType }) : null), [engine, chart]);

  return (
    <div className="vt-root" style={{ minHeight: '100vh', padding: '20px clamp(16px, 3vw, 32px)' }}>
      <header className="vt-spread" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Vedic Timing Explorer</h1>
          <p className="vt-sub" style={{ margin: '2px 0 0' }}>Dashas, transits, Sade Sati, retrogrades and ashtakavarga for any birth chart.</p>
        </div>
      </header>
      <form className="vt-card vt-row" style={{ marginBottom: 16, gap: 12, alignItems: 'end' }} onSubmit={(e) => { e.preventDefault(); compute(); }}>
        <label className="vt-stack" style={{ gap: 4 }}><span className="vt-muted">Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="vt-stack" style={{ gap: 4 }}><span className="vt-muted">Birth date</span><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
        <label className="vt-stack" style={{ gap: 4 }}><span className="vt-muted">Birth time (local)</span><input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
        <label className="vt-stack" style={{ gap: 4, position: 'relative', minWidth: 260, flex: 1 }}>
          <span className="vt-muted">Birth place</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="City, country" />
          {results.length > 0 && (
            <div className="vt-card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, padding: 4 }}>
              {results.map((r, i) => (
                <button type="button" key={i} className="vt-item" style={{ border: 0 }} onClick={() => { setForm({ ...form, place: r }); setQuery(r.name); setResults([]); }}>
                  {r.name} <span className="vt-muted">({r.latitude.toFixed(2)}, {r.longitude.toFixed(2)})</span>
                </button>
              ))}
            </div>
          )}
        </label>
        <button type="submit" className="vt-badge" style={{ border: 0, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }} disabled={!engine}>{engine ? 'Show my timing' : 'Loading ephemeris…'}</button>
        {chart && <span className="vt-muted" style={{ fontSize: 12 }}>{signName(signOf(chart.ascendant.longitude))} lagna · Moon in {chart.planets.moon.nakshatraName} · {chart.meta.timezone}</span>}
      </form>
      {err && <p style={{ color: 'var(--bad)' }}>{err}</p>}
      {natal && eph && <TimingDashboard key={chart!.meta.utc} chart={natal} ephemeris={eph} name={form.name} />}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
