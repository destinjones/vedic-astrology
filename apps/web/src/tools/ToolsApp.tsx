import { useEffect, useState } from 'react';
import { ART } from '../data/art';
import { useEngine } from './shared';
import { KpTool } from './KpTool';
import { PrashnaTool } from './PrashnaTool';
import { MuhurtaTool } from './MuhurtaTool';
import { EventChartTool } from './EventChartTool';
import { CalendarTool } from './CalendarTool';
import { SarvatobhadraTool } from './SarvatobhadraTool';
import { TrustFooter } from '../trust/TrustFooter';

type Tab = 'kp' | 'prashna' | 'muhurta' | 'calendar' | 'sbc' | 'event';
const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: 'kp', label: 'KP chart', blurb: 'Krishnamurti Paddhati: Placidus cusps, star, sub and sub-sub lords, and the four-level significators' },
  { id: 'prashna', label: 'Prashna', blurb: 'Ask a question and read the horary chart for that moment, or use the KP 1–249 number method' },
  { id: 'muhurta', label: 'Muhurta', blurb: 'Find good times to begin something, from the panchanga, Tara bala, Chandra bala and the rising sign' },
  { id: 'calendar', label: 'Panchanga calendar', blurb: 'A month of tithis and nakshatras, with Rahu kalam, Yamaganda, Gulika kalam, Abhijit, the horas and sunrise and sunset for any day' },
  { id: 'sbc', label: 'Sarvatobhadra', blurb: 'The 9 × 9 transit board: which stars, signs, letters and tithis each graha strikes, and what that means for your birth chart' },
  { id: 'event', label: 'Event chart', blurb: 'Cast a chart for the moment something happened, and read it against a saved birth chart' },
];
const tabFromHash = (): Tab => {
  const h = location.hash.replace('#', '');
  return (TABS.find((t) => t.id === h)?.id ?? 'kp');
};

export default function ToolsApp() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const { engine, error } = useEngine();
  useEffect(() => {
    const on = () => setTab(tabFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (t: Tab) => { history.replaceState(null, '', `#${t}`); setTab(t); };
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="app tools-app">
      <div
        className="backdrop backdrop-cosmos"
        aria-hidden
        style={{ '--bg-desktop': `url("${ART.cosmosDesktop}")`, '--bg-mobile': `url("${ART.cosmosMobile}")` } as React.CSSProperties}
      />
      <div className="starfield" aria-hidden />
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <span className="brand-mark">✦</span>
          <div>
            <h1>Jyotisha Explorer</h1>
            <p>KP, Prashna, Muhurta, event charts and the panchanga</p>
          </div>
        </a>
        <a className="btn-ghost" href={`${import.meta.env.BASE_URL}app/`}>Birth chart</a>
      </header>

      <nav className="tools-tabs" role="tablist" aria-label="Tools">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-active' : ''} onClick={() => go(t.id)}>{t.label}</button>
        ))}
      </nav>
      <p className="muted tools-blurb">{current.blurb}</p>

      {error && <div className="preview-banner" role="alert">The ephemeris could not load ({error}). These tools need it, so please reload the page.</div>}
      {!engine && !error && <div className="card tools-loading">Loading the Swiss Ephemeris…</div>}
      {engine && (
        <main>
          {tab === 'kp' && <KpTool engine={engine} />}
          {tab === 'prashna' && <PrashnaTool engine={engine} />}
          {tab === 'muhurta' && <MuhurtaTool engine={engine} />}
          {tab === 'calendar' && <CalendarTool engine={engine} />}
          {tab === 'sbc' && <SarvatobhadraTool engine={engine} />}
          {tab === 'event' && <EventChartTool engine={engine} />}
        </main>
      )}

      <footer className="foot muted">
        <p>KP uses the Krishnamurti ayanamsa and Placidus houses (Porphyry above the polar circles). Muhurta uses Lahiri, like most printed panchangas.</p>
        <p>Astrology is a traditional practice, not a science. These tools are for reflection and for learning the methods, and nothing here is medical, legal or financial advice. Everything is calculated in your browser.</p>
        <TrustFooter />
      </footer>
    </div>
  );
}
