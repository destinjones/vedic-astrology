import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { BirthInput, Chart, PlanetId, VargaId } from './types/chart';
import type { ChartStyle, Selection } from './types/ui';
import { computeChart } from './engine';
import { BirthForm } from './components/BirthForm';
import { NorthChart } from './components/NorthChart';
import { SouthChart } from './components/SouthChart';
import { DetailPanel } from './components/DetailPanel';
import { NakshatraWheel, type WheelMode } from './components/NakshatraWheel';
import { PlanetTable } from './components/PlanetTable';
import { DashaTimeline } from './components/DashaTimeline';
import { VargaSwitcher } from './components/VargaSwitcher';
import { NAKSHATRAS, PLANET_BY_ID, signInfo } from './data/constants';
import { getVarga } from './lib/astro';
import { ART } from './data/art';

const SkyView = lazy(() => import('./components/SkyView'));

/** Mounts children once the placeholder scrolls near the viewport. */
function WhenVisible({ children, minHeight }: { children: React.ReactNode; minHeight: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || !ref.current) return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) setSeen(true); }, { rootMargin: '200px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  return <div ref={ref} style={{ minHeight }}>{seen ? children : null}</div>;
}

const DEFAULT_INPUT: BirthInput = {
  name: '',
  date: '1990-08-15',
  time: '06:30',
  place: 'New Delhi, India',
  latitude: 28.6139,
  longitude: 77.209,
  timezone: 'Asia/Kolkata',
  ayanamsa: 'lahiri',
};

const STORE_KEY = 'vedic.lastInput';
const loadInput = (): BirthInput => {
  try { const s = localStorage.getItem(STORE_KEY); if (s) return { ...DEFAULT_INPUT, ...JSON.parse(s) }; } catch { /* ignore */ }
  return DEFAULT_INPUT;
};

export default function App() {
  const [input, setInput] = useState<BirthInput>(loadInput);
  const [chart, setChart] = useState<Chart | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(true);
  const [style, setStyle] = useState<ChartStyle>('north');
  const [vargaId, setVargaId] = useState<VargaId>('D1');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [hoverPlanet, setHoverPlanet] = useState<PlanetId | null>(null);
  const [wheelMode, setWheelMode] = useState<WheelMode>('art');

  const run = async (i: BirthInput) => {
    setBusy(true);
    try {
      const c = await computeChart(i);
      setInput(i);
      setChart(c);
      setEditing(false);
      setSelection({ kind: 'asc' });
      try { localStorage.setItem(STORE_KEY, JSON.stringify(i)); } catch { /* ignore */ }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelection(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const varga = chart ? getVarga(chart, vargaId) : null;
  const moon = chart?.planets.find((p) => p.id === 'moon');
  const sun = chart?.planets.find((p) => p.id === 'sun');

  return (
    <div className="app">
      <div
        className={`backdrop ${chart ? 'backdrop-cosmos' : 'backdrop-hero'}`}
        aria-hidden
        style={{
          '--bg-desktop': `url("${chart ? ART.cosmosDesktop : ART.heroDesktop}")`,
          '--bg-mobile': `url("${chart ? ART.cosmosMobile : ART.heroMobile}")`,
        } as React.CSSProperties}
      />
      <div className="starfield" aria-hidden />
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✦</span>
          <div>
            <h1>Jyotisha Explorer</h1>
            <p>Vedic birth chart, every placement, every varga</p>
          </div>
        </div>
        {chart && !editing && (
          <button className="btn-ghost" onClick={() => setEditing(true)}>Edit birth details</button>
        )}
      </header>

      {chart?.meta.source === 'mock' && (
        <div className="preview-banner" role="status">
          Preview positions. The UI is running on an approximate calculator until the Swiss Ephemeris engine is connected, so degrees can be off.
        </div>
      )}

      {(editing || !chart) && (
        <section className={`intake ${chart ? 'intake-compact' : ''}`}>
          {!chart && (
            <div className="intake-copy">
              <h2>Your sky at the moment you arrived</h2>
              <p>Enter your birth date, exact time and place. You get the rashi chart in North or South Indian style, all sixteen divisional charts, nakshatras, dignities, retrogrades and your dasha timeline, and every part of it is clickable.</p>
            </div>
          )}
          <div className="card form-card">
            <BirthForm initial={input} busy={busy} onSubmit={run} />
          </div>
        </section>
      )}

      {chart && varga && (
        <main className="explorer">
          <section className="summary-strip">
            <div className="summary-item">
              <small>Lagna</small>
              <b>{signInfo(chart.ascendant.sign).glyph} {signInfo(chart.ascendant.sign).name}</b>
            </div>
            <div className="summary-item">
              <small>Moon sign</small>
              <b>{signInfo(moon!.sign).glyph} {signInfo(moon!.sign).name}</b>
            </div>
            <div className="summary-item">
              <small>Janma nakshatra</small>
              <b>{NAKSHATRAS[moon!.nakshatra - 1].name} {moon!.pada}</b>
            </div>
            <div className="summary-item">
              <small>Sun sign</small>
              <b>{signInfo(sun!.sign).glyph} {signInfo(sun!.sign).name}</b>
            </div>
            <div className="summary-item">
              <small>Retrograde</small>
              <b>{chart.planets.filter((p) => p.retrograde && p.id !== 'rahu' && p.id !== 'ketu').map((p) => PLANET_BY_ID[p.id].abbr).join(', ') || 'None'}</b>
            </div>
            <div className="summary-item muted-item">
              <small>{chart.input.name || 'Birth'}</small>
              <b>{chart.input.date} · {chart.input.time} · {chart.input.place}</b>
            </div>
          </section>

          <div className="explorer-grid">
            <section className="card chart-card">
              <div className="card-head">
                <h3>Birth chart</h3>
                <div className="seg" role="radiogroup" aria-label="Chart style">
                  <button role="radio" aria-checked={style === 'north'} className={style === 'north' ? 'is-active' : ''} onClick={() => setStyle('north')}>North</button>
                  <button role="radio" aria-checked={style === 'south'} className={style === 'south' ? 'is-active' : ''} onClick={() => setStyle('south')}>South</button>
                </div>
              </div>
              <VargaSwitcher value={vargaId} onChange={setVargaId} />
              <div className="chart-stage" onMouseLeave={() => setHoverPlanet(null)}>
                {style === 'north' ? (
                  <NorthChart chart={chart} varga={varga} selection={selection} hoverPlanet={hoverPlanet} onSelect={setSelection} onHoverPlanet={setHoverPlanet} />
                ) : (
                  <SouthChart chart={chart} varga={varga} selection={selection} hoverPlanet={hoverPlanet} onSelect={setSelection} onHoverPlanet={setHoverPlanet} />
                )}
              </div>
              <p className="legend muted">R retrograde · c combust · highlighted houses show the aspects of the planet under your cursor</p>
            </section>

            <aside className="card detail-card" aria-live="polite">
              <DetailPanel chart={chart} varga={varga} selection={selection} onSelect={setSelection} />
            </aside>
          </div>

          <section className="card sky-card">
            <div className="card-head">
              <h3>Sky view</h3>
              <span className="muted">your grahas in 3D, placed by sidereal longitude</span>
            </div>
            <WhenVisible minHeight={520}>
              <Suspense fallback={<div className="sky-overlay static">Loading 3D view…</div>}>
                <SkyView chart={chart} selection={selection} onSelect={setSelection} />
              </Suspense>
            </WhenVisible>
          </section>

          <div className="explorer-grid lower">
            <section className="card wheel-card">
              <div className="card-head">
                <h3>Nakshatra wheel</h3>
                <div className="seg" role="radiogroup" aria-label="Wheel style">
                  <button role="radio" aria-checked={wheelMode === 'art'} className={wheelMode === 'art' ? 'is-active' : ''} onClick={() => setWheelMode('art')}>Artwork</button>
                  <button role="radio" aria-checked={wheelMode === 'diagram'} className={wheelMode === 'diagram' ? 'is-active' : ''} onClick={() => setWheelMode('diagram')}>Diagram</button>
                </div>
              </div>
              <NakshatraWheel mode={wheelMode} chart={chart} selection={selection} onSelect={setSelection} onHoverPlanet={setHoverPlanet} />
            </section>
            <section className="card">
              <div className="card-head"><h3>Planetary positions</h3></div>
              <PlanetTable chart={chart} selection={selection} onSelect={setSelection} />
            </section>
          </div>

          {chart.dasha && (
            <section className="card">
              <div className="card-head"><h3>Vimshottari dasha</h3><span className="muted">click a period to see its sub-periods</span></div>
              <DashaTimeline dasha={chart.dasha} />
            </section>
          )}
        </main>
      )}

      <footer className="foot muted">Sidereal zodiac · whole-sign houses · {input.ayanamsa} ayanamsa</footer>
    </div>
  );
}
