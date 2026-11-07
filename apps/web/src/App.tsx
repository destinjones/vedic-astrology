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
import { signInfo } from './data/constants';
import { getVarga } from './lib/astro';
import { ART } from './data/art';

import { YogaDoshaCard } from './components/YogaDoshaCard';
import { loadKnowledge, type Knowledge } from './lib/readings';
import { useI18n } from './i18n';
import { LOCALE_BY_CODE } from '@vedic/i18n';
import { LanguageSwitcher } from './components/LanguageSwitcher';

const SkyView = lazy(() => import('./components/SkyView'));
const TimingSection = lazy(() => import('./components/TimingSection'));

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
  const [knowledge, setKnowledge] = useState<Knowledge | null>(null);
  const { t, rich, v, locale } = useI18n();

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

  // Readings are a separate chunk, so the first chart appears before the text arrives.
  useEffect(() => {
    setKnowledge(null);
    if (!chart?.engineContext) return;
    let live = true;
    loadKnowledge(chart.engineContext.chart, locale).then((k) => { if (live) setKnowledge(k); }).catch((e) => console.error('Readings unavailable', e));
    return () => { live = false; };
  }, [chart, locale]);

  // /app/#sample opens the sample chart straight away (the landing page links here).
  useEffect(() => {
    if (location.hash === '#sample') void run(DEFAULT_INPUT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <a className="brand" href={import.meta.env.BASE_URL}>
          <span className="brand-mark">✦</span>
          <div>
            <h1>{t('app.title')}</h1>
            <p>{t('app.tagline')}</p>
          </div>
        </a>
        <div className="topbar-actions">
          <LanguageSwitcher />
          {chart && !editing && (
            <button className="btn-ghost" onClick={() => setEditing(true)}>{t('app.editBirth')}</button>
          )}
        </div>
      </header>

      {chart?.meta.source === 'mock' && (
        <div className="preview-banner" role="status">
          {t('app.previewBanner')}
        </div>
      )}

      {(editing || !chart) && (
        <section className={`intake ${chart ? 'intake-compact' : ''}`}>
          {!chart && (
            <div className="intake-copy">
              <h2>{t('app.introTitle')}</h2>
              <p>{t('app.introBody')}</p>
            </div>
          )}
          <div className="card form-card">
            <BirthForm initial={input} busy={busy} onSubmit={run} onSample={() => run(DEFAULT_INPUT)} />
          </div>
        </section>
      )}

      {chart && varga && (
        <main className="explorer">
          <section className="summary-strip">
            <div className="summary-item">
              <small>{t('summary.lagna')}</small>
              <b>{signInfo(chart.ascendant.sign).glyph} {v.signs[chart.ascendant.sign - 1]}</b>
            </div>
            <div className="summary-item">
              <small>{t('summary.moonSign')}</small>
              <b>{signInfo(moon!.sign).glyph} {v.signs[moon!.sign - 1]}</b>
            </div>
            <div className="summary-item">
              <small>{t('summary.janmaNakshatra')}</small>
              <b>{v.nakshatras[moon!.nakshatra - 1]} {moon!.pada}</b>
            </div>
            <div className="summary-item">
              <small>{t('summary.sunSign')}</small>
              <b>{signInfo(sun!.sign).glyph} {v.signs[sun!.sign - 1]}</b>
            </div>
            <div className="summary-item">
              <small>{t('summary.retrograde')}</small>
              <b>{chart.planets.filter((p) => p.retrograde && p.id !== 'rahu' && p.id !== 'ketu').map((p) => v.planets[p.id].short).join(', ') || t('summary.none')}</b>
            </div>
            <div className="summary-item muted-item">
              <small>{chart.input.name || t('summary.birth')}</small>
              <b>{chart.input.date} · {chart.input.time} · {chart.input.place}</b>
            </div>
          </section>

          <div className="explorer-grid">
            <section className="card chart-card">
              <div className="card-head">
                <h3>{t('chart.birthChart')}</h3>
                <div className="seg" role="radiogroup" aria-label={t('chart.style')}>
                  <button role="radio" aria-checked={style === 'north'} className={style === 'north' ? 'is-active' : ''} onClick={() => setStyle('north')}>{t('chart.north')}</button>
                  <button role="radio" aria-checked={style === 'south'} className={style === 'south' ? 'is-active' : ''} onClick={() => setStyle('south')}>{t('chart.south')}</button>
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
              <p className="legend muted">{t('chart.legend')}</p>
            </section>

            <aside className="card detail-card" aria-live="polite">
              {knowledge && knowledge.locale !== locale && <p className="reading-note">{t('app.readingsLanguageNote', { language: LOCALE_BY_CODE[locale].native })}</p>}
              <DetailPanel chart={chart} varga={varga} selection={selection} onSelect={setSelection} knowledge={knowledge} />
            </aside>
          </div>

          {knowledge && <YogaDoshaCard report={knowledge.report} />}

          <section className="card sky-card">
            <div className="card-head">
              <h3>{t('sections.sky')}</h3>
              <span className="muted">{t('sections.skySub')}</span>
            </div>
            <WhenVisible minHeight={520}>
              <Suspense fallback={<div className="sky-overlay static">{t('sections.skyLoading')}</div>}>
                <SkyView chart={chart} selection={selection} onSelect={setSelection} />
              </Suspense>
            </WhenVisible>
          </section>

          <div className="explorer-grid lower">
            <section className="card wheel-card">
              <div className="card-head">
                <h3>{t('sections.wheel')}</h3>
                <div className="seg" role="radiogroup" aria-label={t('sections.wheelStyle')}>
                  <button role="radio" aria-checked={wheelMode === 'art'} className={wheelMode === 'art' ? 'is-active' : ''} onClick={() => setWheelMode('art')}>{t('sections.artwork')}</button>
                  <button role="radio" aria-checked={wheelMode === 'diagram'} className={wheelMode === 'diagram' ? 'is-active' : ''} onClick={() => setWheelMode('diagram')}>{t('sections.diagram')}</button>
                </div>
              </div>
              <NakshatraWheel mode={wheelMode} chart={chart} selection={selection} onSelect={setSelection} onHoverPlanet={setHoverPlanet} />
            </section>
            <section className="card">
              <div className="card-head"><h3>{t('sections.positions')}</h3></div>
              <PlanetTable chart={chart} selection={selection} onSelect={setSelection} />
            </section>
          </div>

          {chart.dasha && (
            <section className="card">
              <div className="card-head"><h3>{t('sections.dasha')}</h3><span className="muted">{t('sections.dashaSub')}</span></div>
              <DashaTimeline dasha={chart.dasha} />
            </section>
          )}

          {chart.engineContext && (
            <section className="card timing-host" id="timing">
              <div className="card-head"><h3>{t('sections.timing')}</h3><span className="muted">{t('sections.timingSub')}</span></div>
              <WhenVisible minHeight={600}>
                <Suspense fallback={<div className="sky-overlay static">{t('sections.timingLoading')}</div>}>
                  <TimingSection key={chart.engineContext.chart.meta.utc} context={chart.engineContext} name={chart.input.name} />
                </Suspense>
              </WhenVisible>
            </section>
          )}
        </main>
      )}

      <footer className="foot muted">
        <p>{t('footer.system', { ayanamsa: input.ayanamsa })}</p>
        <p>{t('footer.disclaimer')}</p>
        <p>{rich('footer.privacy', {
          openMeteo: <a href="https://open-meteo.com/en/docs/geocoding-api">Open-Meteo</a>,
          geonames: <a href="https://www.geonames.org/">GeoNames</a>,
          ccby: <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>,
          swisseph: <a href="https://www.astro.com/swisseph/">Swiss Ephemeris</a>,
          agpl: <a href="https://github.com/destinjones/vedic-astrology/blob/main/LICENSE">AGPL-3.0</a>,
          source: <a href="https://github.com/destinjones/vedic-astrology">{t('footer.getSource')}</a>,
        })}</p>
      </footer>
    </div>
  );
}
