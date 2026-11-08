import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Chart, PlanetId, VargaId } from '../types/chart';
import type { ChartStyle, Selection } from '../types/ui';
import { getVarga } from '../lib/astro';
import { VARGAS } from '../data/constants';
import { useI18n } from '../i18n';
import { NorthChart } from './NorthChart';
import { SouthChart } from './SouthChart';
import { VargaSwitcher } from './VargaSwitcher';
import {
  draftPoint, loadPoints, loadSessionPrefs, move, newId, storePoints, storeSessionPrefs,
  type SessionPoint, type SessionPrefs,
} from '../lib/session';
import './session.css';

interface Props {
  chart: Chart;
  /** The client tab: talking points are kept per tab. */
  tabId: string;
  initialVarga: VargaId;
  style: ChartStyle;
  onStyle: (s: ChartStyle) => void;
  onClose: () => void;
}

type Live = 'off' | 'here' | 'window';

const isTyping = (e: KeyboardEvent) => !!(e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]');

/**
 * Session mode: a clean screen to share with a client on a video call.
 *
 * The astrologer lines up talking points on a private preparation screen, then either goes live
 * full screen in this window, or opens a separate client window and shares only that one while
 * keeping their cues on this screen. The client view draws the chart and the points, never the
 * tab's private notes, pinned annotations, history or the astrologer's cues.
 */
export function SessionMode({ chart, tabId, initialVarga, style, onStyle, onClose }: Props) {
  const [points, setPoints] = useState<SessionPoint[]>(() => loadPoints(tabId));
  const [prefs, setPrefs] = useState<SessionPrefs>(loadSessionPrefs);
  const [live, setLive] = useState<Live>('off');
  const [idx, setIdx] = useState(0);
  const [blank, setBlank] = useState(false);
  // the preparation screen's own chart
  const [prepVarga, setPrepVarga] = useState<VargaId>(initialVarga);
  const [prepSel, setPrepSel] = useState<Selection | null>({ kind: 'asc' });
  const [prepHover, setPrepHover] = useState<PlanetId | null>(null);
  // a click on the client view moves the highlight until the next point
  const [liveSel, setLiveSel] = useState<Selection | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);

  useEffect(() => { storePoints(tabId, points); }, [tabId, points]);
  useEffect(() => { storeSessionPrefs(prefs); }, [prefs]);

  const count = points.length;
  const at = Math.min(idx, Math.max(count - 1, 0));

  const go = useCallback((n: number) => { setBlank(false); setLiveSel(null); setIdx(Math.max(0, Math.min(n, count - 1))); }, [count]);
  const next = useCallback(() => go(at + 1), [go, at]);
  const prev = useCallback(() => go(at - 1), [go, at]);

  /* ---------- live in this window: full screen ---------- */
  const enteredFs = useRef(false);
  const goLiveHere = () => {
    setLive('here');
    setBlank(false);
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().then(() => { enteredFs.current = true; }).catch(() => {});
  };
  const endLive = useCallback(() => {
    setLive('off');
    setBlank(false);
    if (enteredFs.current && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    enteredFs.current = false;
  }, []);
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement && enteredFs.current) { enteredFs.current = false; setLive((l) => (l === 'here' ? 'off' : l)); } };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  /* ---------- live in a separate client window ---------- */
  const popup = useClientWindow(live === 'window', chart.input.name, () => setLive('off'), () => { setPopupBlocked(true); setLive('off'); });

  /* ---------- keys: the same in this window and in the client window ---------- */
  const onKey = useCallback((e: KeyboardEvent) => {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (live === 'off') {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(count - 1); }
    else if (e.key === 'b' || e.key === 'B' || e.key === '.') { e.preventDefault(); setBlank((b) => !b); }
    else if (e.key === 'Escape' && live === 'here') { e.preventDefault(); endLive(); }
  }, [live, next, prev, go, count, endLive, onClose]);
  useEffect(() => {
    // capture, so the page's own Escape handlers behind the session never swallow it first
    window.addEventListener('keydown', onKey, true);
    const w = popup?.ownerDocument.defaultView;
    w?.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); w?.removeEventListener('keydown', onKey, true); };
  }, [onKey, popup]);

  // nothing behind the session scrolls while it is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);
  // leaving session mode closes the client window and full screen
  useEffect(() => () => { if (enteredFs.current && document.fullscreenElement) document.exitFullscreen().catch(() => {}); }, []);

  /* ---------- editing points ---------- */
  const prepVargaChart = useMemo(() => getVarga(chart, prepVarga), [chart, prepVarga]);
  const draft = useMemo(() => draftPoint(chart, prepVargaChart, prepSel), [chart, prepVargaChart, prepSel]);
  const addPoint = (p: Omit<SessionPoint, 'id'>) => setPoints((list) => [...list, { ...p, id: newId() }]);
  const patch = (id: string, change: Partial<SessionPoint>) => setPoints((list) => list.map((p) => (p.id === id ? { ...p, ...change } : p)));
  const remove = (id: string) => setPoints((list) => list.filter((p) => p.id !== id));
  const shift = (i: number, d: number) => {
    setPoints((list) => move(list, i, i + d));
    if (at === i) setIdx(i + d);
    else if (at === i + d) setIdx(i);
  };

  const clientView = (
    <ClientView
      chart={chart}
      points={points}
      at={at}
      prefs={prefs}
      style={style}
      blank={blank}
      fallbackVarga={prepVarga}
      selection={liveSel}
      onSelect={setLiveSel}
      controls={live === 'here' ? { prev, next, toggleBlank: () => setBlank((b) => !b), end: endLive } : null}
    />
  );

  if (live === 'here') return <div className="ss-overlay ss-live-host">{clientView}</div>;

  const name = chart.input.name || 'this client';
  return (
    <div className="ss-overlay ss-prep" role="dialog" aria-modal="true" aria-label="Session mode">
      {popup && createPortal(clientView, popup)}
      <header className="ss-prep-head">
        <div>
          <h2>Session with {name}</h2>
          <p className="ss-private"><span aria-hidden>🔒</span> Only you see this screen. Your notes, history and cues stay here.</p>
        </div>
        <div className="ss-prep-actions">
          {live === 'window' ? (
            <>
              <span className="ss-live-badge" role="status"><span className="ss-dot" aria-hidden /> Client window is live</span>
              <button className="btn-ghost" onClick={() => setBlank((b) => !b)} aria-pressed={blank}>{blank ? 'Show the chart again' : 'Blank the client screen'}</button>
              <button className="btn-ghost" onClick={() => setLive('off')}>Close client window</button>
            </>
          ) : (
            <>
              <button className="btn-primary" onClick={goLiveHere}>Go live here, full screen</button>
              <button className="btn-ghost" onClick={() => { setPopupBlocked(false); setLive('window'); }} title="Share only that window on the call, and keep this screen to yourself">Open client window</button>
            </>
          )}
          <button className="btn-ghost" onClick={onClose}>Close session</button>
        </div>
      </header>
      {popupBlocked && (
        <p className="ss-warn" role="alert">The browser blocked the client window. Allow pop-ups for this site, then try again, or go live in this window instead.</p>
      )}

      <div className="ss-prep-grid">
        <section className="card ss-prep-chart">
          <div className="card-head">
            <h3>Pick what to discuss</h3>
            <div className="seg" role="radiogroup" aria-label="Chart style">
              <button role="radio" aria-checked={style === 'north'} className={style === 'north' ? 'is-active' : ''} onClick={() => onStyle('north')}>North</button>
              <button role="radio" aria-checked={style === 'south'} className={style === 'south' ? 'is-active' : ''} onClick={() => onStyle('south')}>South</button>
            </div>
          </div>
          <VargaSwitcher value={prepVarga} onChange={setPrepVarga} />
          <div className="chart-stage ss-stage" onMouseLeave={() => setPrepHover(null)}>
            {style === 'north'
              ? <NorthChart chart={chart} varga={prepVargaChart} selection={prepSel} hoverPlanet={prepHover} onSelect={setPrepSel} onHoverPlanet={setPrepHover} />
              : <SouthChart chart={chart} varga={prepVargaChart} selection={prepSel} hoverPlanet={prepHover} onSelect={setPrepSel} onHoverPlanet={setPrepHover} />}
          </div>
          <div className="ss-add">
            <p className="muted">Click a planet, a house or the lagna, then add it.</p>
            <button className="btn-primary" onClick={() => addPoint(draft)}>+ Add “{draft.title}”</button>
            <button className="btn-ghost" onClick={() => addPoint({ title: 'New point', text: '', varga: prepVarga })}>+ Add a blank point</button>
          </div>
        </section>

        <section className="card ss-points" aria-label="Talking points">
          <div className="card-head">
            <h3>Talking points{count ? ` (${count})` : ''}</h3>
            {count > 0 && <button className="btn-ghost sm" onClick={() => { if (confirm(`Remove all ${count} talking points for ${name}?`)) { setPoints([]); setIdx(0); } }}>Clear all</button>}
          </div>
          {!count && <p className="muted">No points yet. The client screen shows the chart on its own until you add some.</p>}
          <ol className="ss-point-list">
            {points.map((p, i) => (
              <li key={p.id} className={`ss-point ${live !== 'off' && i === at ? 'is-current' : ''}`}>
                <div className="ss-point-top">
                  <span className="ss-point-num">{i + 1}</span>
                  <input className="ss-title-input" value={p.title} aria-label={`Point ${i + 1} title`} onChange={(e) => patch(p.id, { title: e.target.value })} />
                  <select value={p.varga} aria-label={`Point ${i + 1} chart`} onChange={(e) => patch(p.id, { varga: e.target.value as VargaId })}>
                    {VARGAS.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
                  </select>
                </div>
                <label className="ss-field">
                  <span>The client sees</span>
                  <textarea rows={2} value={p.text} placeholder="What you want them to read while you talk" onChange={(e) => patch(p.id, { text: e.target.value })} />
                </label>
                <label className="ss-field ss-cue">
                  <span>🔒 Your cue, never shown</span>
                  <textarea rows={1} value={p.cue ?? ''} placeholder="A reminder for you only" onChange={(e) => patch(p.id, { cue: e.target.value || undefined })} />
                </label>
                <div className="ss-point-actions">
                  <button className="btn-ghost sm" onClick={() => { go(i); if (live === 'off') goLiveHere(); }} title={live === 'window' ? 'Show this point in the client window' : 'Go live from this point'}>
                    {live === 'window' ? (i === at ? 'On screen' : 'Show now') : 'Start here'}
                  </button>
                  <button className="btn-ghost sm" onClick={() => shift(i, -1)} disabled={i === 0} aria-label={`Move point ${i + 1} up`}>↑</button>
                  <button className="btn-ghost sm" onClick={() => shift(i, 1)} disabled={i === count - 1} aria-label={`Move point ${i + 1} down`}>↓</button>
                  <button className="btn-ghost sm" onClick={() => remove(p.id)} aria-label={`Remove point ${i + 1}`}>Remove</button>
                </div>
              </li>
            ))}
          </ol>

          {live === 'window' && count > 0 && (
            <div className="ss-remote" role="group" aria-label="Client window controls">
              <button className="btn-ghost" onClick={prev} disabled={at === 0}>← Previous</button>
              <span className="mono">{at + 1} / {count}</span>
              <button className="btn-primary" onClick={next} disabled={at >= count - 1}>Next →</button>
            </div>
          )}

          <fieldset className="ss-prefs">
            <legend>On the client screen</legend>
            <label><input type="checkbox" checked={prefs.showName} onChange={(e) => setPrefs({ ...prefs, showName: e.target.checked })} /> Show the client’s name</label>
            <label><input type="checkbox" checked={prefs.showBirth} onChange={(e) => setPrefs({ ...prefs, showBirth: e.target.checked })} /> Show birth date, time and place</label>
            <label><input type="checkbox" checked={prefs.showAgenda} onChange={(e) => setPrefs({ ...prefs, showAgenda: e.target.checked })} /> Show the list of points</label>
          </fieldset>
          <p className="muted ss-keys">Live keys: <kbd>→</kbd> next, <kbd>←</kbd> back, <kbd>B</kbd> blank the screen, <kbd>Esc</kbd> end.</p>
        </section>
      </div>
    </div>
  );
}

interface ClientViewProps {
  chart: Chart;
  points: SessionPoint[];
  at: number;
  prefs: SessionPrefs;
  style: ChartStyle;
  blank: boolean;
  fallbackVarga: VargaId;
  selection: Selection | null;
  onSelect: (s: Selection) => void;
  controls: { prev: () => void; next: () => void; toggleBlank: () => void; end: () => void } | null;
}

/** What the client sees: the chart, the point being discussed and, if wanted, what comes next. */
export function ClientView({ chart, points, at, prefs, style, blank, fallbackVarga, selection, onSelect, controls }: ClientViewProps) {
  const { v } = useI18n();
  const [hover, setHover] = useState<PlanetId | null>(null);
  const current = points[at] ?? null;
  const vargaId = current?.varga ?? fallbackVarga;
  const varga = useMemo(() => getVarga(chart, vargaId), [chart, vargaId]);
  const sel = selection ?? current?.select ?? null;
  const idle = useIdle(2500);
  const info = VARGAS.find((x) => x.id === vargaId)!;

  if (blank) {
    return (
      <div className="ss-client ss-blank" aria-live="polite">
        <span className="brand-mark" aria-hidden>✦</span>
        <p>Back in a moment</p>
        {controls && <button className="btn-ghost" onClick={controls.toggleBlank}>Show the chart</button>}
      </div>
    );
  }

  return (
    <div className={`ss-client ${prefs.showAgenda && points.length ? '' : 'no-agenda'} ${current ? '' : 'no-point'}`}>
      <header className="ss-client-head">
        {prefs.showName && chart.input.name && <h1>{chart.input.name}</h1>}
        {prefs.showBirth && <p className="muted">{chart.input.date} · {chart.input.time} · {chart.input.place}</p>}
        <p className="ss-varga"><b>{vargaId} {v.vargas[vargaId]}</b>{vargaId !== 'D1' && <span className="muted"> · {info.area}</span>}</p>
      </header>
      <div className="ss-client-chart" onMouseLeave={() => setHover(null)}>
        {style === 'north'
          ? <NorthChart chart={chart} varga={varga} selection={sel} hoverPlanet={hover} onSelect={onSelect} onHoverPlanet={setHover} />
          : <SouthChart chart={chart} varga={varga} selection={sel} hoverPlanet={hover} onSelect={onSelect} onHoverPlanet={setHover} />}
      </div>
      {current && (
        <aside className="ss-client-point" aria-live="polite">
          <small className="muted">{at + 1} of {points.length}</small>
          <h2>{current.title}</h2>
          {current.text && <p>{current.text}</p>}
          {prefs.showAgenda && points.length > 1 && (
            <ol className="ss-agenda">
              {points.map((p, i) => (
                <li key={p.id} className={i === at ? 'is-current' : i < at ? 'is-done' : ''} aria-current={i === at ? 'step' : undefined}>{p.title}</li>
              ))}
            </ol>
          )}
        </aside>
      )}
      {controls && (
        <div className={`ss-controls ${idle ? 'is-idle' : ''}`} role="toolbar" aria-label="Session controls">
          <button className="btn-ghost" onClick={controls.prev} disabled={at === 0 || !points.length} aria-label="Previous point">←</button>
          <span className="mono">{points.length ? `${at + 1} / ${points.length}` : 'No points'}</span>
          <button className="btn-ghost" onClick={controls.next} disabled={at >= points.length - 1} aria-label="Next point">→</button>
          <button className="btn-ghost" onClick={controls.toggleBlank} title="Hide the chart for a moment (B)">Blank</button>
          <button className="btn-ghost" onClick={controls.end} title="Back to your preparation screen (Esc)">End</button>
        </div>
      )}
    </div>
  );
}

/** True after `ms` without the mouse moving, so the controls fade out of the shared screen. */
function useIdle(ms: number) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t = setTimeout(() => setIdle(true), ms);
    const wake = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), ms); };
    window.addEventListener('mousemove', wake);
    window.addEventListener('keydown', wake);
    window.addEventListener('touchstart', wake);
    return () => { clearTimeout(t); window.removeEventListener('mousemove', wake); window.removeEventListener('keydown', wake); window.removeEventListener('touchstart', wake); };
  }, [ms]);
  return idle;
}

/**
 * A second browser window that React renders into, so the astrologer can share only that window.
 * It takes this page's stylesheets and display settings (theme, text size, fonts) with it.
 */
function useClientWindow(open: boolean, name: string, onClosed: () => void, onBlocked: () => void): HTMLElement | null {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const closed = useRef(onClosed);
  const blocked = useRef(onBlocked);
  useEffect(() => { closed.current = onClosed; blocked.current = onBlocked; });

  useEffect(() => {
    if (!open) return;
    const w = window.open('', 'jyotisha-session', 'popup,width=1280,height=800');
    if (!w) { blocked.current(); return; }
    const d = w.document;
    d.title = name ? `${name}: chart session` : 'Chart session';
    d.head.replaceChildren();
    d.body.replaceChildren();
    const meta = d.createElement('meta');
    meta.setAttribute('charset', 'utf-8');
    d.head.appendChild(meta);
    for (const a of Array.from(document.documentElement.attributes)) d.documentElement.setAttribute(a.name, a.value);
    for (const n of Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))) {
      const c = n.cloneNode(true) as HTMLElement;
      // about:blank has no address of its own, so stylesheet links need their full address
      if (c.tagName === 'LINK') (c as HTMLLinkElement).href = (n as HTMLLinkElement).href;
      d.head.appendChild(c);
    }
    d.body.className = 'ss-window';
    const host = d.createElement('div');
    d.body.appendChild(host);
    setRoot(host);
    let done = false;
    const gone = () => { if (!done) { done = true; setRoot(null); closed.current(); } };
    w.addEventListener('pagehide', gone);
    // a pagehide can be missed if the window is closed while the tab is in the background
    const poll = setInterval(() => { if (w.closed) gone(); }, 800);
    w.focus();
    return () => { done = true; clearInterval(poll); setRoot(null); if (!w.closed) w.close(); };
  }, [open, name]);

  return root;
}
