import { useEffect, useMemo, useState } from 'react';
import type { Ayanamsa, BirthInput } from '../types/chart';
import { CITIES, type City } from '../data/cities';
import { searchPlaces } from '../engine';

interface Props {
  initial: BirthInput;
  busy: boolean;
  onSubmit: (input: BirthInput) => void;
  onSample?: () => void;
}

const ZONES: string[] = (() => {
  try { return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone'); } catch { return []; }
})();

export function BirthForm({ initial, busy, onSubmit, onSample }: Props) {
  const [f, setF] = useState<BirthInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof BirthInput>(k: K, v: BirthInput[K]) => setF((s) => ({ ...s, [k]: v }));

  const [showMatches, setShowMatches] = useState(false);
  const [remote, setRemote] = useState<City[]>([]);
  const offline = useMemo(() => {
    const q = f.place.trim().toLowerCase();
    if (q.length < 2) return [];
    return CITIES.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 4);
  }, [f.place]);

  // online place search (Open-Meteo via the engine), debounced to stay well inside its limits
  useEffect(() => {
    const q = f.place.trim();
    if (!showMatches || q.length < 3) { setRemote([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      searchPlaces(q, ctl.signal)
        .then((r) => setRemote(r.map((g) => ({ name: g.name, latitude: g.latitude, longitude: g.longitude, timezone: g.timezone }))))
        .catch(() => {});
    }, 400);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [f.place, showMatches]);

  const matches = useMemo(() => {
    const seen = new Set<string>();
    return [...remote, ...offline].filter((c) => (seen.has(c.name) ? false : (seen.add(c.name), true))).slice(0, 7);
  }, [remote, offline]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.date || !f.time) return setError('Date and time of birth are required.');
    if (!Number.isFinite(f.latitude) || Math.abs(f.latitude) > 90) return setError('Latitude must be between -90 and 90.');
    if (!Number.isFinite(f.longitude) || Math.abs(f.longitude) > 180) return setError('Longitude must be between -180 and 180.');
    setError(null);
    onSubmit(f);
  };

  return (
    <form className="birth-form" onSubmit={submit} autoComplete="off">
      <label className="field span-2">
        <span>Name <small className="muted">(optional)</small></span>
        <input value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="Your name" />
      </label>
      <label className="field">
        <span>Date of birth</span>
        <input type="date" required value={f.date} onChange={(e) => set('date', e.target.value)} />
      </label>
      <label className="field">
        <span>Time of birth</span>
        <input type="time" step={1} required value={f.time} onChange={(e) => set('time', e.target.value)} />
      </label>
      <label className="field span-2 place-field">
        <span>Place of birth</span>
        <input
          value={f.place}
          onChange={(e) => { set('place', e.target.value); setShowMatches(true); }}
          onFocus={() => setShowMatches(true)}
          onBlur={() => setTimeout(() => setShowMatches(false), 150)}
          placeholder="Start typing a city…"
        />
        {showMatches && matches.length > 0 && (
          <ul className="suggest">
            {matches.map((c) => (
              <li key={c.name}>
                <button type="button" onMouseDown={() => {
                  setF((s) => ({ ...s, place: c.name, latitude: c.latitude, longitude: c.longitude, timezone: c.timezone }));
                  setShowMatches(false);
                }}>
                  {c.name} <small className="muted">{c.timezone}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </label>
      <label className="field">
        <span>Latitude</span>
        <input type="number" step="0.0001" value={f.latitude} onChange={(e) => set('latitude', parseFloat(e.target.value))} />
      </label>
      <label className="field">
        <span>Longitude</span>
        <input type="number" step="0.0001" value={f.longitude} onChange={(e) => set('longitude', parseFloat(e.target.value))} />
      </label>
      <label className="field">
        <span>Time zone</span>
        <input list="zones" value={f.timezone} onChange={(e) => set('timezone', e.target.value)} />
        <datalist id="zones">{ZONES.map((z) => <option key={z} value={z} />)}</datalist>
      </label>
      <label className="field">
        <span>Ayanamsa</span>
        <select value={f.ayanamsa} onChange={(e) => set('ayanamsa', e.target.value as Ayanamsa)}>
          <option value="lahiri">Lahiri (Chitrapaksha)</option>
          <option value="true_chitra">True Chitra</option>
          <option value="raman">B.V. Raman</option>
          <option value="krishnamurti">Krishnamurti (KP)</option>
        </select>
      </label>
      {error && <p className="form-error span-2" role="alert">{error}</p>}
      <button className="btn-primary span-2" disabled={busy}>{busy ? 'Calculating…' : 'Reveal my chart'}</button>
      {onSample && <button type="button" className="btn-ghost span-2" disabled={busy} onClick={onSample}>Or try a sample chart</button>}
      <p className="muted span-2 form-note">Can't find your town? Try its current official name, or type the coordinates and time zone by hand. Birth details stay in this browser.</p>
    </form>
  );
}
