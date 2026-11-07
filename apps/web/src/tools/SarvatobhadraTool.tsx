import { useMemo, useState } from 'react';
import { localToUtc, sarvatobhadra, type Engine, type GrahaId, type SbcInput } from '@vedic/engine';
import { PLANET_BY_ID } from '../data/constants';
import { loadPlace, loadSavedBirth, localParts } from './shared';

const ORDER: GrahaId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];
const LINE_LABEL = { forward: 'forward diagonal', opposite: 'straight across', backward: 'backward diagonal' } as const;

export function SarvatobhadraTool({ engine }: { engine: Engine }) {
  const saved = loadSavedBirth();
  const tz = loadPlace().timezone;
  const now = localParts(new Date(), tz);
  const [date, setDate] = useState(now.date);
  const [time, setTime] = useState(now.time);
  const [useNatal, setUseNatal] = useState(!!saved);
  const [name, setName] = useState(saved?.name ?? '');
  const [focus, setFocus] = useState<GrahaId | null>('saturn');

  const natal = useMemo<SbcInput['natal'] | undefined>(() => {
    if (!saved || !useNatal) return undefined;
    try {
      const c = engine.computeChart({ date: saved.date, time: saved.time, place: { latitude: saved.latitude, longitude: saved.longitude, timezone: saved.timezone } }, { vargas: ['D1'], dashaLevels: 1 });
      return { moonNakshatra: c.planets.moon.nakshatra, moonSign: c.planets.moon.sign, lagnaSign: c.ascendant.sign, tithi: c.panchanga.tithi, weekday: c.panchanga.vara, nameLetter: name || undefined };
    } catch { return undefined; }
  }, [engine, saved?.date, saved?.time, useNatal, name]); // eslint-disable-line react-hooks/exhaustive-deps

  const { sbc, err } = useMemo(() => {
    try {
      const when = localToUtc(date, time, tz).utc;
      const snap = engine.positionsAt(when, { ayanamsa: 'lahiri' });
      const planets = {} as SbcInput['planets'];
      for (const g of ORDER) planets[g] = { longitude: snap.planets[g].longitude, speed: snap.planets[g].speed };
      const elong = ((snap.planets.moon.longitude - snap.planets.sun.longitude) % 360 + 360) % 360;
      return { sbc: sarvatobhadra({ planets, moonWaxing: elong < 180, natal }), err: null };
    } catch (e) {
      return { sbc: null, err: e instanceof Error ? e.message : String(e) };
    }
  }, [engine, date, time, tz, natal]);

  const hot = useMemo(() => {
    const m = new Map<string, 'primary' | 'other'>();
    if (!sbc || !focus) return m;
    for (const v of sbc.vedhas.filter((x) => x.planet === focus)) for (const c of v.cells) {
      const k = `${c.row},${c.col}`;
      if (v.primary) m.set(k, 'primary');
      else if (!m.has(k)) m.set(k, 'other');
    }
    return m;
  }, [sbc, focus]);
  const natalCells = useMemo(() => new Set(sbc?.natal.flatMap((p) => p.cells.map((c) => `${c.row},${c.col}`)) ?? []), [sbc]);

  return (
    <div className="tools-grid">
      <section className="card tools-form">
        <h3>Sarvatobhadra chakra</h3>
        <div className="birth-form">
          <label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field"><span>Time ({tz})</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          {saved && (
            <label className="field span-2 check">
              <input type="checkbox" checked={useNatal} onChange={(e) => setUseNatal(e.target.checked)} />
              <span>Mark the natal points of {saved.name || 'my saved chart'}</span>
            </label>
          )}
          {useNatal && saved && (
            <label className="field span-2"><span>Name (its first sound is a natal point)</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ravi" /></label>
          )}
        </div>
        {err && <p className="form-error" role="alert">{err}</p>}
        <div className="field">
          <span>Show the vedha lines of</span>
          <div className="seg sbc-planets" role="radiogroup" aria-label="Planet">
            {ORDER.map((g) => (
              <button key={g} type="button" role="radio" aria-checked={focus === g} className={focus === g ? 'is-active' : ''} onClick={() => setFocus(focus === g ? null : g)} style={{ color: PLANET_BY_ID[g].color }}>
                {PLANET_BY_ID[g].glyph}
              </button>
            ))}
          </div>
        </div>
        <details className="kp-explain">
          <summary>How to read the board</summary>
          <p>The outer ring holds the 28 nakshatras, Abhijit included, running clockwise from Krittika in the east (top). Inside are the 20 Avakahada name letters, then the 12 signs, then the five tithi groups with their weekdays around Purna in the centre. Vowels sit in the corners.</p>
          <p>Each graha strikes (vedha) every cell along three lines from its star: straight across the board and the two diagonals. Direct motion stresses the forward diagonal, retrograde motion (always for Rahu and Ketu) the backward one, and a graha near its station the straight line. A struck birth star, Moon sign, lagna, name letter, birth tithi or weekday is helped by a benefic and harmed by a malefic.</p>
          <p>Printed versions differ on the vowels in the inner corners; the stars, letters, signs and tithi cells are the standard ones.</p>
        </details>
      </section>

      {sbc && (
        <section className="card sbc-card">
          <div className="sbc-grid" role="grid" aria-label="Sarvatobhadra chakra">
            {sbc.cells.flat().map((c) => {
              const k = `${c.row},${c.col}`;
              const here = sbc.planets.filter((p) => p.row === c.row && p.col === c.col);
              const h = hot.get(k);
              return (
                <div key={k} role="gridcell" className={`sbc-cell k-${c.kind} ${h ? `vedha-${h}` : ''} ${natalCells.has(k) ? 'is-natal' : ''}`} title={c.latin ? `${c.label} (${c.latin})` : c.label}>
                  <span className="sbc-label">{c.kind === 'nakshatra' ? c.label.replace('Purva ', 'P.').replace('Uttara ', 'U.') : c.label}</span>
                  {c.kind === 'tithi' && <small className="sbc-wd">{c.weekdays!.map((w) => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][w]).join(' ')}</small>}
                  {here.length > 0 && (
                    <span className="sbc-pl">
                      {here.map((p) => <b key={p.planet} style={{ color: PLANET_BY_ID[p.planet].color }} title={`${PLANET_BY_ID[p.planet].name}, ${p.motion}`}>{PLANET_BY_ID[p.planet].glyph}{p.motion === 'retrograde' && p.planet !== 'rahu' && p.planet !== 'ketu' ? 'ᴿ' : ''}</b>)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="muted small">Highlighted: {focus ? `${PLANET_BY_ID[focus].name}'s vedha lines (the stronger one darker)` : 'pick a planet'}. Outlined: natal points.</p>
        </section>
      )}

      {sbc && (
        <section className="card span-all">
          <div className="card-head"><h3>Strikes on natal points</h3><span className="muted">{sbc.summary.benefic} benefic · {sbc.summary.malefic} malefic</span></div>
          <p>{sbc.summary.text}</p>
          {sbc.hits.length > 0 && (
            <ul className="sbc-hits">
              {sbc.hits.map((h, i) => (
                <li key={i} className={h.benefic ? 'good' : 'bad'}>
                  <b>{h.pointLabel}</b>: {PLANET_BY_ID[h.planet].name} ({h.benefic ? 'benefic' : 'malefic'}), {LINE_LABEL[h.line]}{h.primary ? ', the line its motion stresses' : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
