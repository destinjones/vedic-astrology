import { useMemo, useState } from 'react';
import { chartPoints, eclipseHits, findEclipses, localDateTime, localView, sankrantis, solarPath, type Eclipse } from '@vedic/sky';
import { LAND } from '@vedic/sky/land';
import type { Chart as EngineChart, Engine } from '@vedic/engine';
import type { BirthInput } from '../types/chart';
import type { Profile } from '../lib/profiles';
import { useI18n } from '../i18n';

interface Props {
  context: { engine: Engine; chart: EngineChart };
  input: BirthInput;
  profiles: Profile[];
  /** Opens a chart (an ingress moment) in a tab */
  onOpen: (input: BirthInput) => void;
}

type Mode = 'coming' | 'life' | 'sankranti';

const dm = (lon: number) => {
  const d = lon % 30;
  return `${Math.floor(d)}°${String(Math.floor((d % 1) * 60)).padStart(2, '0')}′`;
};
const TYPE: Record<string, string> = { total: 'Total', annular: 'Annular', partial: 'Partial', penumbral: 'Penumbral' };

/** Eclipses, with the chart points they fall on, and the twelve Sankranti ingress charts of a year. */
export default function SkyEvents({ context, input, profiles, onOpen }: Props) {
  const { engine, chart } = context;
  const { v } = useI18n();
  const [mode, setMode] = useState<Mode>('coming');
  const [picked, setPicked] = useState<string | null>(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const tz = chart.meta.timezone;
  const ay = chart.meta.ayanamsa;
  const points = useMemo(() => chartPoints(chart), [chart]);

  const eclipses = useMemo(() => {
    const now = new Date();
    if (mode === 'coming') return findEclipses(engine, now, new Date(now.getFullYear() + 5, now.getMonth(), now.getDate()), ay);
    if (mode === 'life') {
      const born = new Date(chart.meta.utc);
      return findEclipses(engine, born, now, ay).filter((e) => eclipseHits(e, points, 1.5).length > 0);
    }
    return [];
  }, [engine, mode, ay, chart.meta.utc, points]);

  const sel = eclipses.find((e) => e.peak === picked) ?? eclipses[0] ?? null;
  const path = useMemo(() => (sel?.kind === 'solar' ? solarPath(sel) : []), [sel]);
  const here = useMemo(() => (sel ? localView(sel, input.latitude, input.longitude) : null), [sel, input.latitude, input.longitude]);

  // the same eclipse checked against every saved chart
  const savedHits = useMemo(() => {
    if (!sel) return [];
    return profiles.flatMap((p) => {
      try {
        const c = engine.computeChart(
          { date: p.input.date, time: p.input.time, place: { latitude: p.input.latitude, longitude: p.input.longitude, timezone: p.input.timezone }, utcOffsetMinutes: p.input.utcOffsetMinutes, calendar: p.input.calendar },
          { ayanamsa: p.input.ayanamsa, dashaLevels: 1, strength: false, vargas: ['D1'] },
        );
        const hits = eclipseHits(sel, chartPoints(c));
        return hits.length ? [{ p, hits }] : [];
      } catch { return []; }
    });
  }, [sel, profiles, engine]);

  const ingress = useMemo(() => (mode === 'sankranti' ? sankrantis(engine, year, ay) : []), [mode, year, engine, ay]);

  const when = (iso: string) => {
    const { date, time } = localDateTime(iso, tz);
    return `${date} ${time.slice(0, 5)}`;
  };
  const where = (e: Eclipse) => `${v.signs[e.sign - 1]} ${dm(e.longitude)} · ${v.nakshatras[e.nakshatra - 1]}`;
  const pathD = path.length > 1 ? path.reduce((d, p, i) => {
    const x = p.longitude + 180, y = 90 - p.latitude;
    // break the line where it wraps across the date line
    const jump = i > 0 && Math.abs(p.longitude - path[i - 1].longitude) > 180;
    return `${d}${i === 0 || jump ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }, '') : '';

  return (
    <div className="sky-events">
      <div className="seg" role="radiogroup" aria-label="What to show">
        {([['coming', 'Coming eclipses'], ['life', 'Eclipses on this chart'], ['sankranti', 'Sankranti charts']] as const).map(([m, label]) => (
          <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'is-active' : ''} onClick={() => { setMode(m); setPicked(null); }}>{label}</button>
        ))}
      </div>

      {mode !== 'sankranti' && (
        <div className="eclipse-grid">
          <div>
            <p className="muted">
              {mode === 'coming'
                ? `Every solar and lunar eclipse of the next five years, the sidereal degree it falls on, and whether it touches this chart's lagna, Midheaven, Sun, Moon, Rahu or lagna lord (within 3°). Times are for ${tz}.`
                : 'Eclipses since birth that fell within 1.5° of this chart\'s axes, lights, nodes or lagna lord: the ones tradition watches as triggers.'}
            </p>
            {eclipses.length === 0 && <p className="muted">None found.</p>}
            <ul className="eclipse-list">
              {eclipses.map((e) => {
                const hits = eclipseHits(e, points);
                return (
                  <li key={e.peak}>
                    <button type="button" className={sel?.peak === e.peak ? 'is-active' : ''} onClick={() => setPicked(e.peak)}>
                      <span className={`eclipse-dot ${e.kind}`} aria-hidden />
                      <span>
                        <b>{TYPE[e.type]} {e.kind} eclipse</b> <small className="muted">{when(e.peak)}</small><br />
                        <small>{where(e)} · near {e.node === 'rahu' ? 'Rahu' : 'Ketu'}</small>
                        {hits.length > 0 && <small className="eclipse-hits"> · on {hits.map((h) => `${h.aspect === 'opposite' ? 'opposite ' : ''}${h.point.label} (${h.orb.toFixed(1)}°)`).join(', ')}</small>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          {sel && (
            <div className="eclipse-detail">
              <svg viewBox="0 0 360 180" className="eclipse-map" role="img" aria-label={sel.kind === 'solar' ? 'World map with the path of the Moon\'s shadow' : 'World map with the chart\'s place'}>
                <rect width="360" height="180" className="sea" />
                {[-60, -30, 0, 30, 60].map((lat) => <line key={lat} x1="0" x2="360" y1={90 - lat} y2={90 - lat} className="grat" />)}
                {[-120, -60, 0, 60, 120].map((lon) => <line key={lon} y1="0" y2="180" x1={lon + 180} x2={lon + 180} className="grat" />)}
                <path d={LAND.d} className="land" />
                {pathD && <path d={pathD} className="shadow" />}
                {sel.greatest && <circle cx={sel.greatest.longitude + 180} cy={90 - sel.greatest.latitude} r="2.6" className="greatest" />}
                <circle cx={input.longitude + 180} cy={90 - input.latitude} r="2.2" className="place" />
              </svg>
              <p className="muted map-key"><span className="key shadow" /> centre of the shadow <span className="key greatest" /> greatest eclipse <span className="key place" /> {input.place}</p>
              {here && (
                <p>
                  {here.visible
                    ? <>Seen from {input.place}: <b>{TYPE[here.type ?? sel.type]}</b>{here.obscuration ? `, ${Math.round(here.obscuration * 100)}% of the ${sel.kind === 'solar' ? 'Sun covered' : 'Moon in shadow'}` : ''}
                        {here.begins && here.ends ? `, from ${when(here.begins).slice(11)} to ${when(here.ends).slice(11)}` : ''}{here.altitude <= 0 ? ' (partly below the horizon)' : ''}.</>
                    : <>Not visible from {input.place}{sel.kind === 'lunar' ? ': the Moon is below the horizon there' : ''}.</>}
                  {sel.totalMinutes ? ` Totality lasts ${sel.totalMinutes} minutes.` : ''}
                </p>
              )}
              {profiles.length > 0 && (
                <>
                  <h4>On your saved charts</h4>
                  {savedHits.length === 0
                    ? <p className="muted">It touches none of your {profiles.length} saved charts' key points.</p>
                    : <ul className="eclipse-saved">{savedHits.map(({ p, hits }) => (
                        <li key={p.id}><b>{p.label}</b>: {hits.map((h) => `${h.aspect === 'opposite' ? 'opposite ' : ''}${h.point.label} ${h.orb.toFixed(1)}°`).join(', ')}</li>
                      ))}</ul>}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'sankranti' && (
        <div>
          <p className="muted">
            The moment the Sun enters each sidereal sign. Mesha Sankranti is the classical chart of the year for a country or city; the others rule
            their months. Each opens as a chart cast for {input.place}.
          </p>
          <label className="field inline-field">
            <span>Year</span>
            <input type="number" min={-3000} max={3000} value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())} />
          </label>
          <table className="batch-table">
            <thead><tr><th>Sankranti</th><th>Local time at {input.place.split(',')[0]}</th><th /></tr></thead>
            <tbody>
              {ingress.map((s) => {
                const { date, time } = localDateTime(s.utc, input.timezone);
                return (
                  <tr key={s.sign}>
                    <td><b>{s.name}</b> <small className="muted">Sun into {v.signs[s.sign - 1]}</small></td>
                    <td>{date} {time}</td>
                    <td><button type="button" className="btn-ghost sm" onClick={() => onOpen({
                      name: `${s.name} ${year}, ${input.place.split(',')[0]}`, date, time, place: input.place, latitude: input.latitude, longitude: input.longitude,
                      timezone: input.timezone, ayanamsa: input.ayanamsa, rodden: 'AA', timeConfidence: 'exact',
                    })}>Open chart</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
