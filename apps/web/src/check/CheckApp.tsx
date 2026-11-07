import { useEffect, useMemo, useState } from 'react';
import type { AyanamsaId, Chart, PlanetId } from '@vedic/engine';
import { ART } from '../data/art';
import { signInfo } from '../data/constants';
import { PlaceField, loadPlace, loadSavedBirth, useEngine, type Place } from '../tools/shared';
import { TrustFooter } from '../trust/TrustFooter';

type Body = 'asc' | PlanetId;
type Zodiac = 'sidereal' | 'tropical';
type Engine = NonNullable<ReturnType<typeof useEngine>['engine']>;
type Interop = Pick<typeof import('@vedic/engine'), 'parseLongitude' | 'parsePositionTable' | 'deltaArcminutes'>;

const BODIES: { id: Body; name: string }[] = [
  { id: 'asc', name: 'Ascendant' }, { id: 'sun', name: 'Sun' }, { id: 'moon', name: 'Moon' }, { id: 'mars', name: 'Mars' },
  { id: 'mercury', name: 'Mercury' }, { id: 'jupiter', name: 'Jupiter' }, { id: 'venus', name: 'Venus' }, { id: 'saturn', name: 'Saturn' },
  { id: 'rahu', name: 'Rahu (node)' }, { id: 'ketu', name: 'Ketu' }, { id: 'uranus', name: 'Uranus' }, { id: 'neptune', name: 'Neptune' }, { id: 'pluto', name: 'Pluto' },
];
const AYANAMSAS: { id: AyanamsaId; name: string }[] = [
  { id: 'lahiri', name: 'Lahiri (Chitrapaksha)' }, { id: 'true_chitra', name: 'True Chitra' }, { id: 'raman', name: 'B.V. Raman' },
  { id: 'krishnamurti', name: 'Krishnamurti (KP)' }, { id: 'fagan_bradley', name: 'Fagan-Bradley' }, { id: 'yukteshwar', name: 'Yukteshwar' },
];

const dms = (deg: number, places = 0) => {
  const f = 10 ** places;
  let s = Math.round(deg * 3600 * f) / f;
  const d = Math.floor(s / 3600); s -= d * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return `${d}°${String(m).padStart(2, '0')}′${s.toFixed(places).padStart(places ? 3 + places : 2, '0')}″`;
};
const signDms = (lon: number) => {
  const sign = Math.min(12, Math.floor(lon / 30) + 1);
  return `${dms(lon - (sign - 1) * 30)} ${signInfo(sign).short}`;
};

/** How close is close: the thresholds the page uses to colour a difference */
function verdict(arcmin: number, body: Body): { tone: 'good' | 'mid' | 'bad'; text: string } {
  const a = Math.abs(arcmin);
  if (a < 0.5) return { tone: 'good', text: 'Matches' };
  if (a < 2) return { tone: 'good', text: 'Rounding' };
  if (body === 'rahu' || body === 'ketu') if (a < 110) return { tone: 'mid', text: 'Mean vs true node?' };
  if (body === 'asc' || body === 'moon') if (a < 60) return { tone: 'mid', text: 'Birth time or place?' };
  if (a > 60 * 20 && a < 60 * 26) return { tone: 'bad', text: 'Tropical vs sidereal?' };
  return { tone: 'bad', text: 'Differs' };
}

export default function CheckApp() {
  const { engine, error } = useEngine();
  const [interop, setInterop] = useState<Interop | null>(null);
  useEffect(() => { void import('@vedic/engine').then((m) => setInterop(m)); }, []);

  const saved = useMemo(() => loadSavedBirth(), []);
  const [date, setDate] = useState(saved?.date ?? '1990-08-15');
  const [time, setTime] = useState(saved?.time ?? '06:30');
  const [place, setPlace] = useState<Place>(() => (saved ? { name: saved.place, latitude: saved.latitude, longitude: saved.longitude, timezone: saved.timezone } : loadPlace()));
  const [zodiac, setZodiac] = useState<Zodiac>('sidereal');
  const [ayanamsa, setAyanamsa] = useState<AyanamsaId>('lahiri');
  const [node, setNode] = useState<'mean' | 'true'>('mean');
  const [theirs, setTheirs] = useState<Partial<Record<Body, string>>>({});
  const [paste, setPaste] = useState('');
  const [pasteNote, setPasteNote] = useState('');
  const [focus, setFocus] = useState<Body>('sun');

  const result = useMemo(() => compute(engine, date, time, place, ayanamsa, node), [engine, date, time, place, ayanamsa, node]);

  const ours = (b: Body): number | null => {
    if (!result) return null;
    const { chart } = result;
    if (b === 'asc') return zodiac === 'sidereal' ? chart.ascendant.longitude : (chart.ascendant.longitude + result.trueAyanamsa) % 360;
    const p = chart.planets[b];
    if (!p) return null;
    return zodiac === 'sidereal' ? p.longitude : p.tropicalLongitude;
  };

  const applyPaste = () => {
    if (!interop) return;
    const rows = interop.parsePositionTable(paste);
    if (!rows.length) { setPasteNote('No lines were read. Put one body per line, its name first, like "Sun 22°Cn12′03″".'); return; }
    const next = { ...theirs };
    for (const r of rows) next[r.body as Body] = r.text;
    setTheirs(next);
    const nodeHint = rows.find((r) => r.node)?.node;
    if (nodeHint) setNode(nodeHint);
    setPasteNote(`Read ${rows.length} line${rows.length === 1 ? '' : 's'}${nodeHint ? `; the paste says ${nodeHint} node, so the node setting now matches` : ''}.`);
  };

  const step = result ? pipeline(result, focus, zodiac) : null;

  return (
    <div className="app tools-app check-app">
      <div className="backdrop backdrop-cosmos" aria-hidden style={{ '--bg-desktop': `url("${ART.cosmosDesktop}")`, '--bg-mobile': `url("${ART.cosmosMobile}")` } as React.CSSProperties} />
      <div className="starfield" aria-hidden />
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <span className="brand-mark">✦</span>
          <div><h1>Jyotisha Explorer</h1><p>Check us against another program</p></div>
        </a>
        <a className="btn-ghost" href={`${import.meta.env.BASE_URL}app/`}>Birth chart</a>
      </header>

      <main className="check-main">
        <section className="card">
          <h2 className="check-title">Don't take our word for it.</h2>
          <p className="check-lede">
            Cast the same birth in Astro.com, Jagannatha Hora, Parashara's Light or any program you trust. Paste its positions here and
            see how far ours are from theirs, in arc minutes (a sixtieth of a degree). Below the table, every step of our arithmetic is
            shown for one planet, so you can redo it by hand.
          </p>
        </section>

        <div className="tools-grid">
          <section className="card tools-form">
            <h3>The birth</h3>
            <label className="field"><span>Date of birth</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="field"><span>Time of birth (local clock)</span><input type="time" step={1} value={time} onChange={(e) => setTime(e.target.value)} /></label>
            <PlaceField label="Place of birth" value={place} onChange={setPlace} />
            <label className="field">
              <span>The other program shows</span>
              <select value={zodiac} onChange={(e) => setZodiac(e.target.value as Zodiac)}>
                <option value="sidereal">Sidereal (Vedic) positions</option>
                <option value="tropical">Tropical (Western) positions, Astro.com's default</option>
              </select>
            </label>
            <label className="field">
              <span>Ayanamsa</span>
              <select value={ayanamsa} onChange={(e) => setAyanamsa(e.target.value as AyanamsaId)}>
                {AYANAMSAS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Rahu and Ketu</span>
              <select value={node} onChange={(e) => setNode(e.target.value as 'mean' | 'true')}>
                <option value="mean">Mean node (our default)</option>
                <option value="true">True node (Astro.com's default)</option>
              </select>
            </label>
            <p className="muted kp-note">
              Use the very same time, place and settings in both programs. On Astro.com, sidereal Lahiri is under
              Extended chart selection, then Zodiac and Options.
            </p>
          </section>

          <section className="card">
            <h3>Paste from the other program</h3>
            <label className="field">
              <span>One body per line, name first</span>
              <textarea rows={7} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Sun        22°Cn12\'03"\nMoon       5 Sc 01\' 10"\nAscendant  Virgo 12°00\'\nTrue Node  4°Ge30\''} />
            </label>
            <button type="button" className="btn-primary" onClick={applyPaste} disabled={!interop || !paste.trim()}>Read these positions</button>
            {pasteNote && <p className="muted kp-note" role="status">{pasteNote}</p>}
            <p className="muted kp-note">
              Decimal degrees (123.4567), 3°Le27′12″, 3 Le 27′ 12″, Leo 3°27′12″ and Sanskrit sign names all work. Or type into the table one at a time.
            </p>
          </section>
        </div>

        <section className="card span-all">
          <h3>Ours against theirs</h3>
          {error && <p className="muted">The ephemeris did not load: {error}</p>}
          {!engine && !error && <p className="muted">Loading the Swiss Ephemeris…</p>}
          {result && (
            <>
              <p className="muted check-meta">
                {zodiac === 'sidereal' ? `Sidereal, ${AYANAMSAS.find((a) => a.id === ayanamsa)?.name} ayanamsa ${dms(result.chart.meta.ayanamsaValue, 2)}` : 'Tropical'}
                {' · '}{node} node · UTC {result.chart.meta.utc.replace('T', ' ').replace(/\.\d+Z$/, 'Z')}
                {result.chart.meta.localMeanTime && ' · local mean time (before standard time)'}
              </p>
              <div className="table-wrap">
                <table className="kp-table check-table">
                  <thead><tr><th>Body</th><th>Ours</th><th>Ours, decimal</th><th>Theirs (paste or type)</th><th>Difference</th><th /></tr></thead>
                  <tbody>
                    {BODIES.map(({ id, name }) => {
                      const o = ours(id);
                      if (o === null) return null;
                      const raw = theirs[id] ?? '';
                      const t = raw.trim() && interop ? interop.parseLongitude(raw) : null;
                      const d = t !== null && interop ? interop.deltaArcminutes(o, t) : null;
                      const v = d !== null ? verdict(d, id) : null;
                      return (
                        <tr key={id} className={focus === id ? 'is-hl' : ''}>
                          <td><button type="button" className="text-link" onClick={() => setFocus(id)} title="Show every step for this body">{name}</button></td>
                          <td className="mono">{signDms(o)}</td>
                          <td className="mono">{o.toFixed(4)}°</td>
                          <td>
                            <input className="check-input mono" value={raw} aria-label={`${name}, the other program's position`} placeholder="e.g. 3°Le27′12″"
                              onChange={(e) => setTheirs({ ...theirs, [id]: e.target.value })} />
                            {raw.trim() && t === null && <small className="check-bad"> can't read this</small>}
                          </td>
                          <td className="mono">{d !== null ? `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2)}′` : ''}</td>
                          <td>{v && <span className={`chip chip-${v.tone}`}>{v.text}</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <details className="kp-explain">
                <summary>What size of difference is normal?</summary>
                <p><b>Under half an arc minute</b> means the two programs agree; both use modern ephemerides. <b>Up to two</b> is rounding, because many programs print whole minutes.</p>
                <p><b>The Moon and the Ascendant</b> move fast: the Moon about half an arc minute per minute of clock time, the Ascendant about fifteen. A one-minute difference in the time you typed, or a town a few kilometres away, shows up there first.</p>
                <p><b>Rahu and Ketu</b> differ by up to about 1°45′ between the mean node and the true node. Set the node option to whatever the other program uses.</p>
                <p><b>About 24°</b> on every body means one program is tropical and the other sidereal. <b>A constant few arc minutes</b> on every body means the ayanamsas differ, for example Lahiri against Raman or KP.</p>
              </details>
            </>
          )}
        </section>

        {step && (
          <section className="card span-all">
            <h3>Every step for the {BODIES.find((b) => b.id === focus)?.name}</h3>
            <p className="muted">Click a body's name in the table to see its steps instead. Nothing here is rounded until the last line.</p>
            <ol className="check-steps">
              {step.map((s, i) => (
                <li key={i}><b>{s.label}</b><span className="mono">{s.value}</span>{s.note && <small className="muted">{s.note}</small>}</li>
              ))}
            </ol>
            <p className="muted kp-note">
              The whole pipeline is written up on <a href={`${import.meta.env.BASE_URL}how-it-works/`}>How it works</a>.
            </p>
          </section>
        )}
      </main>

      <footer className="foot muted">
        <p>Everything on this page is calculated in your browser. The place box sends what you type to Open-Meteo to find the town; nothing else leaves.</p>
        <TrustFooter />
      </footer>
    </div>
  );
}

/**
 * meta.ayanamsaValue is the mean ayanamsa. Swiss Ephemeris measures tropical
 * longitudes from the true equinox of date, so a sidereal position is the
 * tropical one minus (mean ayanamsa + nutation in longitude).
 */
interface Result { engine: Engine; chart: Chart; nutation: number; trueAyanamsa: number }

function compute(engine: Engine | null, date: string, time: string, place: Place, ayanamsa: AyanamsaId, nodeType: 'mean' | 'true'): Result | null {
  if (!engine || !date || !time) return null;
  try {
    const chart = engine.computeChart(
      { date, time, place: { name: place.name, latitude: place.latitude, longitude: place.longitude, timezone: place.timezone || undefined } },
      { ayanamsa, nodeType, includeOuterPlanets: true, dashaLevels: 1, strength: false, vargas: ['D1'] },
    );
    const jd = chart.meta.jdUt;
    engine.ayanamsaAt(jd, ayanamsa); // selects the sidereal mode
    const flag = chart.meta.ephemeris === 'swiss' ? 2 : 4; // SEFLG_SWIEPH or SEFLG_MOSEPH
    const nutation = engine.swe.calc_ut(jd, -1, flag)[2]; // SE_ECL_NUT: [2] is nutation in longitude
    const trueAyanamsa = engine.swe.get_ayanamsa_ex_ut(jd, flag) ?? chart.meta.ayanamsaValue + nutation;
    return { engine, chart, nutation, trueAyanamsa };
  } catch {
    return null;
  }
}

function pipeline({ chart, nutation, trueAyanamsa }: Result, body: Body, zodiac: Zodiac): { label: string; value: string; note?: string }[] {
  const m = chart.meta;
  const offset = m.utcOffsetMinutes;
  const off = `${offset >= 0 ? '+' : '−'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;
  const ayan = trueAyanamsa;
  const isAsc = body === 'asc';
  const p = isAsc ? null : chart.planets[body];
  const sid = isAsc ? chart.ascendant.longitude : p!.longitude;
  const trop = isAsc ? (sid + ayan) % 360 : p!.tropicalLongitude;
  const z = isAsc ? chart.ascendant : p!;
  const steps: { label: string; value: string; note?: string }[] = [
    { label: 'Local clock time', value: `${m.input.date} ${m.input.time}`, note: m.input.place.name },
    {
      label: 'Offset from UTC',
      value: off,
      note: m.localMeanTime
        ? 'Local mean time: before the town kept standard time, its clocks followed the Sun at its own longitude.'
        : `From the ${m.timezone} rules in force on that date, daylight saving included.`,
    },
    { label: 'Universal Time', value: m.utc.replace('T', ' ').replace(/\.\d+Z$/, ' UT') },
    { label: 'Julian Day (UT)', value: m.jdUt.toFixed(6), note: 'Days since noon, 1 January 4713 BC. Every ephemeris is indexed by it.' },
    { label: 'ΔT, Terrestrial minus Universal Time', value: `${((m.jdEt - m.jdUt) * 86400).toFixed(1)} s`, note: "Earth's rotation is irregular; planets move on the steady clock." },
    {
      label: isAsc ? 'Tropical Ascendant' : 'Tropical (Western) longitude',
      value: `${trop.toFixed(6)}°`,
      note: isAsc
        ? 'The degree of the ecliptic rising on the eastern horizon at this latitude and longitude, from swe_houses_ex.'
        : `From swe_calc_ut, ${m.ephemeris === 'swiss' ? 'Swiss Ephemeris files (1800 to 2399)' : 'the Moshier analytic ephemeris (outside 1800 to 2399)'}, measured from the spring equinox.`,
    },
    { label: `${m.ayanamsaName} ayanamsa (mean)`, value: `${m.ayanamsaValue.toFixed(6)}°`, note: 'How far the equinox has slid back against the stars since the two zodiacs coincided. It grows about 50″ a year.' },
    { label: 'Plus nutation in longitude', value: `+ ${nutation.toFixed(6)}°`, note: `The Earth's axis nods by up to ±17″ on an 18.6-year cycle. The tropical figure above is measured from the true (nodding) equinox, so the same nod is added here: ${(nutation * 3600).toFixed(1)}″.` },
    { label: 'Subtract the true ayanamsa', value: `− ${ayan.toFixed(6)}°`, note: `${m.ayanamsaValue.toFixed(6)} + ${nutation.toFixed(6)}. Programs that print only the mean ayanamsa are still subtracting this.` },
    { label: 'Sidereal (Vedic) longitude', value: `= ${sid.toFixed(6)}°`, note: `${trop.toFixed(6)} − ${ayan.toFixed(6)}, wrapped into 0 to 360.` },
    { label: 'Sign and degree', value: `${signInfo(z.sign).name}, ${dms(z.degreeInSign, 1)}`, note: `Sign ${z.sign} = floor(${sid.toFixed(4)} ÷ 30) + 1; the rest is the degree within it.` },
    { label: 'Nakshatra and pada', value: `${z.nakshatraName}, pada ${z.pada}`, note: `Each nakshatra spans 13°20′, each pada 3°20′. ${sid.toFixed(4)} ÷ 13.3333 = ${(sid / (40 / 3)).toFixed(4)}.` },
  ];
  if (zodiac === 'tropical') steps.push({ label: 'Compared above against', value: 'the tropical line', note: 'You chose a tropical program, so the table uses the tropical figure and skips the subtraction.' });
  return steps;
}
