import { useEffect, useMemo, useState } from 'react';
import type { Engine, GrahaId, KpChart } from '@vedic/engine';
import { CITIES, type City } from '../data/cities';
import { readLastChart } from '../lib/lastChart';
import { NAKSHATRAS, PLANET_BY_ID, signInfo } from '../data/constants';
import { searchPlaces } from '../engine';

// ------------------------------------------------------------ engine

let enginePromise: Promise<Engine> | null = null;
/** The Swiss Ephemeris engine, loaded once on first use */
export function useEngine() {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enginePromise) {
      enginePromise = import('@vedic/engine').then((m) => m.createEngine());
      enginePromise.catch(() => { enginePromise = null; });
    }
    let live = true;
    enginePromise.then((e) => live && setEngine(e)).catch((e) => live && setError(String(e?.message ?? e)));
    return () => { live = false; };
  }, []);
  return { engine, error };
}

// ------------------------------------------------------------ places and saved birth

export interface Place extends City {}

export interface SavedBirth { name?: string; date: string; time: string; place: string; latitude: number; longitude: number; timezone: string }

/** The birth details last used in the chart explorer (same browser) */
export function loadSavedBirth(): SavedBirth | null {
  try {
    const v = readLastChart() as SavedBirth | null;
    if (typeof v?.date === 'string' && typeof v?.time === 'string' && Number.isFinite(v?.latitude)) return v;
  } catch { /* ignore */ }
  return null;
}

const PLACE_KEY = 'vedic.tools.place';
export function loadPlace(): Place {
  try { const s = localStorage.getItem(PLACE_KEY); if (s) return JSON.parse(s); } catch { /* ignore */ }
  const b = loadSavedBirth();
  if (b) return { name: b.place, latitude: b.latitude, longitude: b.longitude, timezone: b.timezone };
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return CITIES.find((c) => c.timezone === zone) ?? CITIES[0];
}
export function savePlace(p: Place) {
  try { localStorage.setItem(PLACE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

/** City search box: offline list first, Open-Meteo search as you type */
export function PlaceField({ label, value, onChange }: { label: string; value: Place; onChange: (p: Place) => void }) {
  const [text, setText] = useState(value.name);
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<City[]>([]);
  useEffect(() => setText(value.name), [value.name]);
  const offline = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (q.length < 2) return [];
    return CITIES.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 4);
  }, [text]);
  useEffect(() => {
    const q = text.trim();
    if (!open || q.length < 3 || q === value.name) { setRemote([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      searchPlaces(q, ctl.signal)
        .then((r) => setRemote(r.map((g) => ({ name: g.name, latitude: g.latitude, longitude: g.longitude, timezone: g.timezone }))))
        .catch(() => {});
    }, 400);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [text, open, value.name]);
  const matches = useMemo(() => {
    const seen = new Set<string>();
    return [...remote, ...offline].filter((c) => (seen.has(c.name) ? false : (seen.add(c.name), true))).slice(0, 7);
  }, [remote, offline]);
  return (
    <label className="field place-field">
      <span>{label}</span>
      <input
        value={text}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Start typing a city…"
      />
      {open && matches.length > 0 && (
        <ul className="suggest">
          {matches.map((c) => (
            <li key={c.name}>
              <button type="button" onMouseDown={() => { onChange(c); setText(c.name); setOpen(false); }}>
                {c.name} <small className="muted">{c.timezone}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <small className="muted">{value.latitude.toFixed(3)}°, {value.longitude.toFixed(3)}° · {value.timezone}</small>
    </label>
  );
}

// ------------------------------------------------------------ formatting

export const pname = (g: GrahaId) => PLANET_BY_ID[g].name;
export function Planet({ id, short }: { id: GrahaId; short?: boolean }) {
  const p = PLANET_BY_ID[id];
  return <span className="kp-planet" style={{ '--c': p.color } as React.CSSProperties} title={p.name}><span className="kp-glyph">{p.glyph}</span>{short ? p.abbr : p.name}</span>;
}
export const dms = (deg: number) => {
  let s = Math.round(deg * 3600);
  const d = Math.floor(s / 3600); s -= d * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″`;
};
export const signDeg = (lon: number) => {
  const sign = Math.floor(lon / 30) + 1;
  return `${signInfo(sign).glyph} ${signInfo(sign).short} ${dms(lon - (sign - 1) * 30)}`;
};
export const nakName = (n: number) => NAKSHATRAS[n - 1].name;

export function fmtLocal(iso: string, tz: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) {
  try { return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: tz }).format(new Date(iso)); } catch { return iso; }
}
/** "YYYY-MM-DD" and "HH:mm" for an instant in a zone */
export function localParts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

// ------------------------------------------------------------ KP tables, used by KP and Prashna

export function KpCuspTable({ chart, highlight }: { chart: KpChart; highlight?: number }) {
  return (
    <div className="table-wrap">
      <table className="kp-table">
        <thead><tr><th>Cusp</th><th>Position</th><th>Sign lord</th><th>Star lord</th><th>Sub lord</th><th>Sub-sub</th><th title="KP horary number">No.</th></tr></thead>
        <tbody>
          {chart.cusps.map((c) => (
            <tr key={c.house} className={highlight === c.house ? 'is-hl' : ''}>
              <td><b>{c.house}</b></td>
              <td className="mono">{signDeg(c.longitude)}</td>
              <td><Planet id={c.lords.sign} short /></td>
              <td><Planet id={c.lords.star} short /></td>
              <td className="kp-sub"><Planet id={c.lords.sub} short /></td>
              <td><Planet id={c.lords.subSub} short /></td>
              <td className="mono muted">{c.kpNumber}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ORDER: GrahaId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];

export function KpPlanetTable({ chart }: { chart: KpChart }) {
  return (
    <div className="table-wrap">
      <table className="kp-table">
        <thead><tr><th>Planet</th><th>Position</th><th>Bhava</th><th>Nakshatra</th><th>Star lord</th><th>Sub lord</th><th>Sub-sub</th></tr></thead>
        <tbody>
          {ORDER.map((g) => {
            const p = chart.planets[g];
            return (
              <tr key={g}>
                <td><Planet id={g} />{p.retrograde && g !== 'rahu' && g !== 'ketu' && <small className="kp-retro"> R</small>}</td>
                <td className="mono">{signDeg(p.longitude)}</td>
                <td>{p.house}</td>
                <td>{nakName(p.nakshatra)}</td>
                <td><Planet id={p.lords.star} short /></td>
                <td className="kp-sub"><Planet id={p.lords.sub} short /></td>
                <td><Planet id={p.lords.subSub} short /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const hs = (xs: number[]) => (xs.length ? xs.join(', ') : '–');

export function KpSignificationTable({ chart, mark }: { chart: KpChart; mark?: { good: number[]; bad: number[] } }) {
  const cell = (xs: number[]) => (
    <span className="kp-houses">
      {xs.length ? xs.map((h) => <span key={h} className={mark?.good.includes(h) ? 'h-good' : mark?.bad.includes(h) ? 'h-bad' : ''}>{h}</span>) : '–'}
    </span>
  );
  return (
    <div className="table-wrap">
      <table className="kp-table">
        <thead>
          <tr>
            <th>Planet</th>
            <th title="Houses occupied by the planet's star lord">A · star lord's bhava</th>
            <th title="House the planet occupies">B · own bhava</th>
            <th title="Houses owned by the star lord">C · star lord owns</th>
            <th title="Houses the planet owns">D · owns</th>
            <th>All</th>
          </tr>
        </thead>
        <tbody>
          {ORDER.map((g) => {
            const s = chart.significations[g];
            return (
              <tr key={g}>
                <td><Planet id={g} /></td>
                <td>{cell(s.levelA)}</td>
                <td>{cell(s.levelB)}</td>
                <td>{cell(s.levelC)}</td>
                <td>{cell(s.levelD)}{s.agent.length > 0 && <small className="muted" title="Nodes act for their sign lord"> +{hs(s.agent)}</small>}</td>
                <td>{cell(s.houses)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function KpHouseTable({ chart }: { chart: KpChart }) {
  const ps = (xs: GrahaId[]) => (xs.length ? <span className="kp-plist">{xs.map((g) => <Planet key={g} id={g} short />)}</span> : <span className="muted">–</span>);
  return (
    <div className="table-wrap">
      <table className="kp-table">
        <thead><tr><th>House</th><th>A · in star of occupants</th><th>B · occupants</th><th>C · in star of owner</th><th>D · owner</th></tr></thead>
        <tbody>
          {chart.houseSignificators.map((h) => (
            <tr key={h.house}>
              <td><b>{h.house}</b></td>
              <td>{ps(h.levelA)}</td>
              <td>{ps(h.levelB)}</td>
              <td>{ps(h.levelC)}</td>
              <td>{ps(h.levelD)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RulingPlanets({ chart }: { chart: KpChart }) {
  const r = chart.ruling;
  const rows: [string, GrahaId][] = [
    ['Lagna sub lord', r.lagnaSubLord],
    ['Lagna star lord', r.lagnaStarLord],
    ['Lagna sign lord', r.lagnaSignLord],
    ['Moon star lord', r.moonStarLord],
    ['Moon sign lord', r.moonSignLord],
    ['Day lord', r.dayLord],
  ];
  return (
    <div>
      <div className="kp-rp">
        {rows.map(([k, g]) => (
          <div key={k} className="kp-rp-item"><small className="muted">{k}</small><Planet id={g} /></div>
        ))}
      </div>
      <p className="muted kp-note">Ruling planets, strongest first: {r.planets.map(pname).join(', ')}.</p>
    </div>
  );
}

/** A simple Placidus wheel: unequal houses drawn from the real cusps, ascendant on the left */
export function KpWheel({ chart, highlight }: { chart: KpChart; highlight?: number }) {
  const size = 360, c = size / 2, R = 170, r1 = 132, r0 = 58;
  const asc = chart.cusps[0].longitude;
  // ascendant at 9 o'clock, zodiac counter-clockwise
  const ang = (lon: number) => Math.PI - ((lon - asc) * Math.PI) / 180;
  const pt = (lon: number, r: number) => [c + r * Math.cos(ang(lon)), c - r * Math.sin(ang(lon))] as const;
  const arc = (a: number, b: number, ro: number, ri: number) => {
    const span = ((b - a) % 360 + 360) % 360;
    const large = span > 180 ? 1 : 0;
    const [x1, y1] = pt(a, ro), [x2, y2] = pt(b, ro), [x3, y3] = pt(b, ri), [x4, y4] = pt(a, ri);
    return `M${x1},${y1} A${ro},${ro} 0 ${large} 0 ${x2},${y2} L${x3},${y3} A${ri},${ri} 0 ${large} 1 ${x4},${y4} Z`;
  };
  // spread planets that sit close together
  const placed = ORDER.map((g) => ({ g, lon: chart.planets[g].longitude })).sort((a, b) => a.lon - b.lon);
  const rad: Record<string, number> = {};
  placed.forEach((p, i) => {
    const prev = placed[i - 1];
    const close = prev && Math.abs(p.lon - prev.lon) < 7;
    rad[p.g] = close && rad[prev.g] === 112 ? 90 : 112;
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="kp-wheel" role="img" aria-label="KP bhava wheel">
      <circle cx={c} cy={c} r={R} className="kp-wheel-ring" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = chart.cusps[i].longitude, b = chart.cusps[(i + 1) % 12].longitude;
        const span = ((b - a) % 360 + 360) % 360;
        const [lx, ly] = pt(a + span / 2, (R + r1) / 2);
        return (
          <g key={i}>
            <path d={arc(a, b, R, r0)} className={`kp-wheel-house ${highlight === i + 1 ? 'is-hl' : ''}`} />
            <text x={lx} y={ly} className="kp-wheel-num" textAnchor="middle" dominantBaseline="middle">{i + 1}</text>
          </g>
        );
      })}
      {chart.cusps.map((cu) => {
        const [x1, y1] = pt(cu.longitude, r0), [x2, y2] = pt(cu.longitude, R + 6);
        return <line key={cu.house} x1={x1} y1={y1} x2={x2} y2={y2} className={cu.house % 3 === 1 ? 'kp-wheel-angle' : 'kp-wheel-cusp'} />;
      })}
      {ORDER.map((g) => {
        const [x, y] = pt(chart.planets[g].longitude, rad[g]);
        const p = PLANET_BY_ID[g];
        return <text key={g} x={x} y={y} className="kp-wheel-planet" fill={p.color} textAnchor="middle" dominantBaseline="middle"><title>{p.name} {signDeg(chart.planets[g].longitude)}</title>{p.abbr}</text>;
      })}
      <circle cx={c} cy={c} r={r0} className="kp-wheel-core" />
      <text x={c} y={c - 6} textAnchor="middle" className="kp-wheel-title">KP</text>
      <text x={c} y={c + 12} textAnchor="middle" className="kp-wheel-sub">{chart.houseSystem}</text>
    </svg>
  );
}
