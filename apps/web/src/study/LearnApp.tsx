import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ART } from '../data/art';
import { DisplaySettings } from '../components/DisplaySettings';
import { GlossaryList } from './GlossaryList';

const Primer = lazy(() => import('./Primer').then((m) => ({ default: m.Primer })));
const Quiz = lazy(() => import('./Quiz').then((m) => ({ default: m.Quiz })));
const RuleBuilder = lazy(() => import('./RuleBuilder').then((m) => ({ default: m.RuleBuilder })));

type Tab = 'primer' | 'glossary' | 'quiz' | 'builder';
const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: 'primer', label: 'Primer', blurb: 'Read a chart in the order an astrologer does: the lagna, the houses, the Moon, the grahas, the yogas and the dashas.' },
  { id: 'glossary', label: 'Glossary', blurb: 'Every Sanskrit term the readings use, with IAST and Devanagari spellings.' },
  { id: 'quiz', label: 'Spot the yoga', blurb: 'A real chart and four yogas. Find the one that forms, then see why.' },
  { id: 'builder', label: 'Rule builder', blurb: 'Write your own yoga as conditions, test it on charts and export it as TypeScript.' },
];
const tabFromHash = (): Tab => {
  const h = location.hash.replace('#', '').split('&')[0];
  return TABS.find((t) => t.id === h)?.id ?? 'primer';
};

export default function LearnApp() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const on = () => setTab(tabFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (t: Tab) => { history.replaceState(null, '', `#${t}`); setTab(t); };
  const current = TABS.find((t) => t.id === tab)!;

  // tablist keyboard pattern: arrows move between tabs
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = TABS[(i + d + TABS.length) % TABS.length];
    go(next.id);
    requestAnimationFrame(() => document.getElementById(`learn-tab-${next.id}`)?.focus());
  };

  return (
    <div className="app learn-app">
      <a className="skip-link" href="#learn-main">Skip to the lesson</a>
      <div className="backdrop backdrop-cosmos" aria-hidden
        style={{ '--bg-desktop': `url("${ART.cosmosDesktop}")`, '--bg-mobile': `url("${ART.cosmosMobile}")` } as React.CSSProperties} />
      <div className="starfield" aria-hidden />
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <span className="brand-mark" aria-hidden>✦</span>
          <div>
            <h1>Jyotisha Explorer</h1>
            <p>Learn to read a Vedic chart</p>
          </div>
        </a>
        <div className="topbar-actions">
          <DisplaySettings showChartTable />
          <a className="btn-ghost" href={`${import.meta.env.BASE_URL}app/`}>Birth chart</a>
        </div>
      </header>

      <nav className="tools-tabs" role="tablist" aria-label="Lessons">
        {TABS.map((t, i) => (
          <button key={t.id} id={`learn-tab-${t.id}`} role="tab" aria-selected={tab === t.id} aria-controls="learn-main" tabIndex={tab === t.id ? 0 : -1}
            className={tab === t.id ? 'is-active' : ''} onClick={() => go(t.id)} onKeyDown={(e) => onTabKey(e, i)}>{t.label}</button>
        ))}
      </nav>
      <p className="muted tools-blurb">{current.blurb}</p>

      <main id="learn-main" ref={main} role="tabpanel" aria-labelledby={`learn-tab-${tab}`} tabIndex={-1}>
        <Suspense fallback={<div className="card tools-loading">Loading…</div>}>
          {tab === 'primer' && <Primer />}
          {tab === 'glossary' && <GlossaryList />}
          {tab === 'quiz' && <Quiz />}
          {tab === 'builder' && <RuleBuilder />}
        </Suspense>
      </main>

      <footer className="foot muted">
        <p>Astrology is a traditional practice, not a science. These lessons teach how the classical method works; nothing here is medical, legal or financial advice. Everything is calculated in your browser.</p>
      </footer>
    </div>
  );
}
