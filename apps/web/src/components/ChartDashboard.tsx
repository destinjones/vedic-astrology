import { useEffect, useMemo, useState, type DragEvent } from 'react';
import type { Chart, PlanetId } from '../types/chart';
import type { ChartStyle, Selection } from '../types/ui';
import { getVarga } from '../lib/astro';
import { PLANET_BY_ID, VARGAS } from '../data/constants';
import { useI18n } from '../i18n';
import { useDisplay } from '../lib/display';
import { NorthChart } from './NorthChart';
import { SouthChart } from './SouthChart';
import { ChartTable } from './ChartTable';
import { DashaTimeline } from './DashaTimeline';
import { PlanetTable } from './PlanetTable';
import {
  cleanLayout, dashaChain, DEFAULT_LAYOUT, loadLayout, loadSavedLayouts, MAX_PANELS, move, newId, PANEL_KINDS,
  PRESET_LAYOUTS, storeLayout, storeSavedLayouts, upsertLayout, vimshottariSubs,
  type DashboardLayout, type Panel, type PanelKind,
} from '../lib/session';
import './dashboard.css';

interface Props {
  chart: Chart;
  style: ChartStyle;
  onStyle: (s: ChartStyle) => void;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  onClose: () => void;
}

const isVargaKind = (k: PanelKind): k is (typeof VARGAS)[number]['id'] => VARGAS.some((v) => v.id === k);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

/**
 * Several charts on one screen, arranged the way the astrologer likes: by default the D1, D9 and
 * D10 with the running dasha. A click on a planet in any chart highlights it in all of them.
 * The arrangement is kept in this browser and applies to every client.
 */
export function ChartDashboard({ chart, style, onStyle, selection, onSelect, onClose }: Props) {
  const [layout, setLayout] = useState<DashboardLayout>(loadLayout);
  const [saved, setSaved] = useState(loadSavedLayouts);
  const [arranging, setArranging] = useState(false);
  const [hover, setHover] = useState<PlanetId | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');

  useEffect(() => { storeLayout(layout); }, [layout]);
  useEffect(() => { storeSavedLayouts(saved); }, [saved]);

  const setPanels = (f: (p: Panel[]) => Panel[]) => setLayout((l) => ({ ...l, panels: f(l.panels) }));
  const patchPanel = (id: string, change: Partial<Panel>) => setPanels((ps) => ps.map((p) => (p.id === id ? { ...p, ...change } : p)));
  const shift = (i: number, d: number) => setPanels((ps) => move(ps, i, i + d));
  const used = new Set(layout.panels.map((p) => p.kind));
  const nextKind = (PANEL_KINDS.find((k) => !used.has(k.kind)) ?? PANEL_KINDS[0]).kind;
  const apply = (l: DashboardLayout) => setLayout(cleanLayout(JSON.parse(JSON.stringify(l))));

  const onDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    setPanels((ps) => move(ps, ps.findIndex((p) => p.id === dragId), ps.findIndex((p) => p.id === targetId)));
    setDragId(null);
  };

  return (
    <main className="explorer db" id="dashboard">
      <section className="card db-bar">
        <div className="db-bar-main">
          <h2>Chart dashboard{chart.input.name ? `: ${chart.input.name}` : ''}</h2>
          <div className="db-bar-tools">
            <div className="seg" role="radiogroup" aria-label="Chart style">
              <button role="radio" aria-checked={style === 'north'} className={style === 'north' ? 'is-active' : ''} onClick={() => onStyle('north')}>North</button>
              <button role="radio" aria-checked={style === 'south'} className={style === 'south' ? 'is-active' : ''} onClick={() => onStyle('south')}>South</button>
            </div>
            <button className="btn-ghost" aria-pressed={arranging} onClick={() => setArranging((a) => !a)}>{arranging ? '✓ Done arranging' : '⇄ Arrange'}</button>
            <button className="btn-ghost" onClick={onClose}>Back to the full chart</button>
          </div>
        </div>
        {arranging && (
          <div className="db-arrange" role="group" aria-label="Arrange the dashboard">
            <label>Columns{' '}
              <select value={layout.columns} onChange={(e) => setLayout({ ...layout, columns: Number(e.target.value) as DashboardLayout['columns'] })}>
                <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
              </select>
            </label>
            <button className="btn-ghost sm" disabled={layout.panels.length >= MAX_PANELS}
              onClick={() => setPanels((ps) => [...ps, { id: newId(), kind: nextKind }])}>+ Add a panel</button>
            <label>Layout{' '}
              <select value="" onChange={(e) => {
                const [src, i] = e.target.value.split(':');
                const pick = src === 'p' ? PRESET_LAYOUTS[Number(i)] : saved[Number(i)];
                if (pick) apply(pick.layout);
              }}>
                <option value="" disabled>Choose…</option>
                <optgroup label="Ready-made">
                  {PRESET_LAYOUTS.map((p, i) => <option key={p.name} value={`p:${i}`}>{p.name}</option>)}
                </optgroup>
                {saved.length > 0 && (
                  <optgroup label="Yours">
                    {saved.map((p, i) => <option key={p.name} value={`s:${i}`}>{p.name}</option>)}
                  </optgroup>
                )}
              </select>
            </label>
            <form className="db-save" onSubmit={(e) => { e.preventDefault(); if (saveName.trim()) { setSaved((s) => upsertLayout(s, saveName, layout)); setSaveName(''); } }}>
              <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Name this layout" aria-label="Layout name" maxLength={40} />
              <button className="btn-ghost sm" disabled={!saveName.trim()}>Save</button>
            </form>
            {saved.length > 0 && (
              <span className="db-saved">
                {saved.map((s) => (
                  <button key={s.name} className="chip" onClick={() => setSaved((list) => list.filter((x) => x.name !== s.name))} title={`Delete the layout “${s.name}”`}>{s.name} ✕</button>
                ))}
              </span>
            )}
            <button className="btn-ghost sm" onClick={() => apply(DEFAULT_LAYOUT)}>Reset</button>
            <p className="muted db-hint">Drag a panel by its title to move it, or use the arrows. Your layout is kept in this browser for every client.</p>
          </div>
        )}
      </section>

      <div className="db-grid" style={{ '--db-cols': layout.columns } as React.CSSProperties}>
        {layout.panels.map((p, i) => (
          <section
            key={p.id}
            className={`card db-panel ${p.wide ? 'is-wide' : ''} ${dragId === p.id ? 'is-dragging' : ''}`}
            onDragOver={arranging ? (e) => e.preventDefault() : undefined}
            onDrop={arranging ? (e) => onDrop(e, p.id) : undefined}
            aria-label={panelTitle(p.kind)}
          >
            <div className="db-panel-head" draggable={arranging} onDragStart={(e) => { setDragId(p.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id); }} onDragEnd={() => setDragId(null)}>
              {arranging ? (
                <>
                  <span className="db-grip" aria-hidden>⋮⋮</span>
                  <select value={p.kind} aria-label={`Panel ${i + 1} shows`} onChange={(e) => patchPanel(p.id, { kind: e.target.value as PanelKind })}>
                    {PANEL_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
                  </select>
                  <span className="db-panel-tools">
                    <button className="btn-ghost sm" onClick={() => shift(i, -1)} disabled={i === 0} aria-label={`Move panel ${i + 1} earlier`}>←</button>
                    <button className="btn-ghost sm" onClick={() => shift(i, 1)} disabled={i === layout.panels.length - 1} aria-label={`Move panel ${i + 1} later`}>→</button>
                    <button className="btn-ghost sm" aria-pressed={!!p.wide} onClick={() => patchPanel(p.id, { wide: !p.wide || undefined })} title="Take two columns">{p.wide ? '▭' : '▢'}</button>
                    <button className="btn-ghost sm" onClick={() => setPanels((ps) => ps.filter((x) => x.id !== p.id))} disabled={layout.panels.length <= 1} aria-label={`Remove panel ${i + 1}`}>✕</button>
                  </span>
                </>
              ) : (
                <PanelHeading kind={p.kind} />
              )}
            </div>
            <PanelBody kind={p.kind} chart={chart} style={style} selection={selection} hover={hover} onSelect={onSelect} onHover={setHover} />
          </section>
        ))}
      </div>
    </main>
  );
}

const panelTitle = (k: PanelKind) => PANEL_KINDS.find((x) => x.kind === k)?.label ?? k;

function PanelHeading({ kind }: { kind: PanelKind }) {
  const { v } = useI18n();
  if (isVargaKind(kind)) {
    const info = VARGAS.find((x) => x.id === kind)!;
    return <h3><b>{kind}</b> {v.vargas[kind]} <small className="muted">{info.area}</small></h3>;
  }
  return <h3>{panelTitle(kind)}</h3>;
}

interface BodyProps {
  kind: PanelKind;
  chart: Chart;
  style: ChartStyle;
  selection: Selection | null;
  hover: PlanetId | null;
  onSelect: (s: Selection) => void;
  onHover: (id: PlanetId | null) => void;
}

function PanelBody({ kind, chart, style, selection, hover, onSelect, onHover }: BodyProps) {
  const display = useDisplay();
  const varga = useMemo(() => (isVargaKind(kind) ? getVarga(chart, kind) : null), [chart, kind]);
  if (varga) {
    if (display.chartTable) return <ChartTable chart={chart} varga={varga} selection={selection} onSelect={onSelect} />;
    // a house number means a different house in each chart, so only planets and the lagna carry across
    const sel = selection?.kind === 'house' && varga.id !== 'D1' ? null : selection;
    return (
      <div className="db-chart" onMouseLeave={() => onHover(null)}>
        {style === 'north'
          ? <NorthChart chart={chart} varga={varga} selection={sel} hoverPlanet={hover} onSelect={onSelect} onHoverPlanet={onHover} />
          : <SouthChart chart={chart} varga={varga} selection={sel} hoverPlanet={hover} onSelect={onSelect} onHoverPlanet={onHover} />}
      </div>
    );
  }
  if (kind === 'dasha-now') return <DashaNow chart={chart} onSelect={onSelect} />;
  if (kind === 'dasha') return chart.dasha?.length ? <DashaTimeline dasha={chart.dasha} system="vimshottari" /> : <p className="muted">No dasha for this chart.</p>;
  return <div className="db-table"><PlanetTable chart={chart} selection={selection} onSelect={onSelect} /></div>;
}

const LEVELS = ['Mahadasha', 'Antardasha', 'Pratyantardasha'];

/** The Vimshottari periods running today, and the antardashas that follow. */
function DashaNow({ chart, onSelect }: { chart: Chart; onSelect: (s: Selection) => void }) {
  const { v } = useI18n();
  const [now] = useState(() => Date.now());
  const chain = dashaChain(chart.dasha, now);
  if (!chain.length) return <p className="muted">No dasha is running for this chart today.</p>;
  const maha = chain[0];
  const antars = vimshottariSubs(maha);
  const ai = antars.findIndex((a) => a === chain[1] || (a.start === chain[1]?.start && a.lord === chain[1]?.lord));
  const upcoming = antars.slice(ai + 1, ai + 5);
  return (
    <div className="db-dasha">
      <ol className="db-chain">
        {chain.map((p, i) => {
          const a = Date.parse(p.start), b = Date.parse(p.end);
          const pct = Math.max(0, Math.min(100, ((now - a) / (b - a)) * 100));
          const info = PLANET_BY_ID[p.lord];
          return (
            <li key={i}>
              <button className="db-lord" onClick={() => onSelect({ kind: 'planet', id: p.lord })} style={{ '--lord': info.color } as React.CSSProperties}>
                <span aria-hidden>{info.glyph}</span> {v.planets[p.lord].name}
              </button>
              <span className="db-level muted">{LEVELS[i]}</span>
              <span className="db-dates mono">{fmtDate(p.start)} to {fmtDate(p.end)}</span>
              <span className="db-meter" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${LEVELS[i]} ${Math.round(pct)}% through`}><span style={{ width: `${pct}%` }} /></span>
            </li>
          );
        })}
      </ol>
      {upcoming.length > 0 && (
        <>
          <p className="db-next-head muted">Next antardashas in {v.planets[maha.lord].name}</p>
          <ul className="db-next">
            {upcoming.map((p) => (
              <li key={p.start}><span style={{ color: PLANET_BY_ID[p.lord].color }} aria-hidden>{PLANET_BY_ID[p.lord].glyph}</span> {v.planets[p.lord].name} <span className="mono muted">from {fmtDate(p.start)}</span></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
