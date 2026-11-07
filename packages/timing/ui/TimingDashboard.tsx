import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { Ephemeris, NatalChart, Planet, Reason, Tone } from '../src/types';
import { SEVEN, SIGNS } from '../src/types';
import { buildTimeline, type CombinedPoint, type Timeline, type Window as TWindow } from '../src/timeline';
import { activeDashas, type DashaPeriod, HOUSE_TOPICS } from '../src/dasha';
import { type RetrogradePeriod, retroStatusAt, RETRO_MEANING, RETRO_PLANETS } from '../src/retrograde';
import { type SadeSatiSpell, type SaturnPhase, SATURN_PHASE_TEXT, transitSnapshot } from '../src/transits';
import { BAV_TOTALS } from '../src/ashtakavarga';
import { addDays, ordinal, signName, signOf } from '../src/astro';
import { fmtDate, fmtMonth, fmtRange, GLYPH, PLANET_COLOR, scoreColor, seqColor, seqInk, signed, TONE_LABEL } from './scale';
import './timing.css';

// ---------------------------------------------------------------------------
// Selection model: anything clickable opens in the detail panel.
type Selection =
  | { kind: 'dasha'; period: DashaPeriod }
  | { kind: 'retro'; period: RetrogradePeriod }
  | { kind: 'sadesati'; spell: SadeSatiSpell }
  | { kind: 'saturn'; phase: SaturnPhase }
  | { kind: 'window'; window: TWindow }
  | null;

const RANGES = [
  { id: '1y', label: '1 yr', back: 0.25, fwd: 1 },
  { id: '3y', label: '3 yrs', back: 0.5, fwd: 3 },
  { id: '7y', label: '7 yrs', back: 1, fwd: 7 },
  { id: '20y', label: '20 yrs', back: 2, fwd: 20 },
  { id: 'life', label: 'Lifetime', back: -1, fwd: -1 },
] as const;

export interface TimingDashboardProps {
  chart: NatalChart;
  ephemeris: Ephemeris;
  /** Optional name for headings. */
  name?: string;
}

export function TimingDashboard({ chart, ephemeris, name }: TimingDashboardProps) {
  const [rangeId, setRangeId] = useState<(typeof RANGES)[number]['id']>('3y');
  const [selection, setSelection] = useState<Selection>(null);
  const [inspect, setInspect] = useState<Date>(() => new Date());

  const timeline = useMemo<Timeline>(() => {
    const r = RANGES.find((x) => x.id === rangeId)!;
    const now = new Date();
    const from = r.back < 0 ? chart.birth : addDays(now, -365.25 * r.back);
    const to = r.fwd < 0 ? addDays(chart.birth, 365.25 * 95) : addDays(now, 365.25 * r.fwd);
    const span = (to.getTime() - from.getTime()) / 864e5;
    return buildTimeline(ephemeris, chart, { from, to, stepDays: Math.max(3, Math.round(span / 420)) });
  }, [chart, ephemeris, rangeId]);

  return (
    <div className="vt-root">
      <div className="vt-grid">
        <div className="vt-stack">
          <NowHero timeline={timeline} name={name} onSelect={setSelection} />
          <section className="vt-card">
            <div className="vt-spread">
              <div>
                <h2>Life weather</h2>
                <p className="vt-sub">Combined favourability from your running dasha and planetary transits. Above the line is supportive, below is challenging. Click anywhere to inspect that date.</p>
              </div>
              <div className="vt-seg" role="group" aria-label="Time range">
                {RANGES.map((r) => (
                  <button key={r.id} aria-pressed={rangeId === r.id} onClick={() => setRangeId(r.id)}>{r.label}</button>
                ))}
              </div>
            </div>
            <WeatherChart timeline={timeline} inspect={inspect} onInspect={setInspect} onSelect={setSelection} selection={selection} />
          </section>
          <section className="vt-card">
            <h2>Dasha map</h2>
            <p className="vt-sub">Vimshottari periods colored by how well each lord works for your chart. Click a mahadasha to open its antardashas, then a pratyantar level.</p>
            <DashaExplorer timeline={timeline} chart={chart} selection={selection} onSelect={setSelection} />
          </section>
          <section className="vt-card">
            <h2>Transits on {fmtDate(inspect)}</h2>
            <p className="vt-sub">Gochara from your natal Moon in {signName(signOf(chart.planets.Moon.longitude))}, with vedha (obstruction), ashtakavarga bindus and contacts to natal points.</p>
            <TransitTable chart={chart} ephemeris={ephemeris} date={inspect} timeline={timeline} onDate={setInspect} />
          </section>
          <section className="vt-card">
            <h2>Ashtakavarga</h2>
            <p className="vt-sub">Bindus each planet receives in each sign. Higher numbers mean transits through that sign go better. The bottom row is the Sarvashtakavarga (28+ is strong).</p>
            <AshtakavargaGrid timeline={timeline} chart={chart} />
          </section>
        </div>
        <aside className="vt-stack">
          <DetailPanel selection={selection} chart={chart} onClose={() => setSelection(null)} />
          <WindowsCard timeline={timeline} selection={selection} onSelect={setSelection} />
          <RetroCard timeline={timeline} selection={selection} onSelect={setSelection} />
          <SaturnCard timeline={timeline} chart={chart} selection={selection} onSelect={setSelection} />
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function ToneBadge({ score, tone }: { score: number; tone: Tone }) {
  const t = TONE_LABEL[tone];
  return (
    <span className="vt-badge" title={`Score ${signed(score)} of ±100`}>
      <span className="sw" style={{ background: scoreColor(score) }} />
      <span aria-hidden>{t.icon}</span> {t.label} <span className="vt-score vt-muted">{signed(score)}</span>
    </span>
  );
}

function NowHero({ timeline, name, onSelect }: { timeline: Timeline; name?: string; onSelect: (s: Selection) => void }) {
  const now = new Date();
  const pt = nearestPoint(timeline.series, now);
  const chain = timeline.current;
  const nextGood = timeline.windows.find((w) => w.tone === 'favourable' && w.end > now);
  const nextHard = timeline.windows.find((w) => w.tone === 'challenging' && w.end > now);
  return (
    <section className="vt-card">
      <div className="vt-spread">
        <h2>{name ? `${name}: right now` : 'Right now'}</h2>
        <span className="vt-muted" style={{ fontSize: 12 }}>{fmtDate(now)}</span>
      </div>
      <div className="vt-hero" style={{ marginTop: 8 }}>
        <div>
          <div className="big" style={{ color: 'var(--text-primary)' }}>{pt ? signed(pt.combined) : '—'}</div>
          <div className="vt-muted" style={{ fontSize: 12 }}>overall, of ±100</div>
        </div>
        <div className="vt-stack" style={{ gap: 6 }}>
          {pt && <ToneBadge score={pt.combined} tone={pt.tone} />}
          <div className="vt-row" style={{ gap: 6 }}>
            {chain.map((d, i) => (
              <button key={i} className="vt-chip" style={{ border: 0, cursor: 'pointer' }} onClick={() => onSelect({ kind: 'dasha', period: d })}>
                {['Maha', 'Antar', 'Pratyantar', 'Sookshma', 'Prana'][i]}: {GLYPH[d.lord]} {d.lord} <span className="vt-score">({signed(d.score)})</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="vt-row" style={{ marginTop: 12, gap: 16, fontSize: 12.5 }}>
        {nextGood && <span>▲ Next favourable window: <b>{fmtRange(nextGood.start, nextGood.end)}</b></span>}
        {nextHard && <span>▼ Next care window: <b>{fmtRange(nextHard.start, nextHard.end)}</b></span>}
      </div>
    </section>
  );
}

function nearestPoint(series: CombinedPoint[], d: Date) {
  let best: CombinedPoint | undefined, bd = Infinity;
  for (const p of series) {
    const dd = Math.abs(p.date.getTime() - d.getTime());
    if (dd < bd) { bd = dd; best = p; }
  }
  return best;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

// ---------------------------------------------------------------------------
function WeatherChart({ timeline, inspect, onInspect, onSelect, selection }: {
  timeline: Timeline; inspect: Date; onInspect: (d: Date) => void; onSelect: (s: Selection) => void; selection: Selection;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ x: number; pt: CombinedPoint } | null>(null);
  const [showParts, setShowParts] = useState(false);
  const { series, range } = timeline;
  const left = 78, right = 8, top = 10, plotH = 180;
  const laneH = 16, laneGap = 6;
  const retroPlanets = RETRO_PLANETS.filter((p) => timeline.retrogrades.some((r) => r.planet === p));
  const lanes = ['Dasha', 'SaturnPhase', ...retroPlanets] as const;
  const lanesTop = top + plotH + 26;
  const height = lanesTop + lanes.length * (laneH + laneGap) + 22;
  const W = Math.max(320, width);
  const x0 = range.from.getTime(), x1 = range.to.getTime();
  const sx = (d: Date | number) => left + ((+d - x0) / (x1 - x0)) * (W - left - right);
  const sy = (v: number) => top + plotH / 2 - (v / 100) * (plotH / 2);
  const clampX = (d: Date | null, fallback: number) => Math.max(left, Math.min(W - right, d ? sx(d) : fallback));

  const areaPath = useMemo(() => {
    if (!series.length) return '';
    let d = `M${sx(series[0].date)},${sy(0)}`;
    for (const p of series) d += `L${sx(p.date)},${sy(p.combined)}`;
    return d + `L${sx(series[series.length - 1].date)},${sy(0)}Z`;
  }, [series, W]); // eslint-disable-line react-hooks/exhaustive-deps
  const line = (key: 'dasha' | 'relTransit') => series.map((p, i) => `${i ? 'L' : 'M'}${sx(p.date)},${sy(p[key])}`).join('');

  // Year ticks
  const ticks: Date[] = [];
  const spanYears = (x1 - x0) / (365.25 * 864e5);
  const every = spanYears > 40 ? 10 : spanYears > 15 ? 5 : spanYears > 6 ? 1 : spanYears > 2 ? 0.5 : 0.25;
  const startY = new Date(x0).getUTCFullYear();
  for (let y = startY; y <= new Date(x1).getUTCFullYear() + 1; y += Math.max(1, every)) {
    if (every < 1) for (let m = 0; m < 12; m += every * 12) ticks.push(new Date(Date.UTC(y, m, 1)));
    else ticks.push(new Date(Date.UTC(y, 0, 1)));
  }
  const visTicks = ticks.filter((t) => +t >= x0 && +t <= x1);

  const antars = timeline.dashas.flatMap((m) => (spanYears > 25 ? [m] : m.children ?? [m])).filter((p) => p.end.getTime() > x0 && p.start.getTime() < x1);
  const laneY = (i: number) => lanesTop + i * (laneH + laneGap);

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = x0 + ((x - left) / (W - left - right)) * (x1 - x0);
    const pt = nearestPoint(series, new Date(t));
    if (pt) setHover({ x: sx(pt.date), pt });
  };

  const isSel = (obj: unknown) => selection && Object.values(selection).includes(obj);
  const satLabel = (k: SaturnPhase['kind']) => ({ 'sade-sati-rising': 'Sade Sati ↑', 'sade-sati-peak': 'Sade Sati peak', 'sade-sati-setting': 'Sade Sati ↓', kantaka: 'Kantaka', ashtama: 'Ashtama' }[k]);

  return (
    <div className="vt-chart" ref={ref}>
      <svg width={W} height={height} role="img" aria-label="Favourability over time with dasha, Saturn and retrograde lanes">
        <defs>
          <clipPath id="vt-pos"><rect x={0} y={0} width={W} height={sy(0)} /></clipPath>
          <clipPath id="vt-neg"><rect x={0} y={sy(0)} width={W} height={plotH} /></clipPath>
          <pattern id="vt-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="currentColor" opacity="0.18" /><line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="2" opacity="0.55" />
          </pattern>
        </defs>
        {/* grid */}
        <g className="vt-axis">
          {[100, 50, 0, -50, -100].map((v) => (
            <g key={v}>
              <line x1={left} x2={W - right} y1={sy(v)} y2={sy(v)} stroke="var(--grid)" strokeWidth={v === 0 ? 1.5 : 1} />
              <text x={left - 8} y={sy(v) + 4} textAnchor="end">{v === 100 ? 'Supportive' : v === -100 ? 'Challenging' : signed(v)}</text>
            </g>
          ))}
          {visTicks.map((t) => (
            <g key={+t}>
              <line x1={sx(t)} x2={sx(t)} y1={top} y2={top + plotH} stroke="var(--grid)" />
              <text x={sx(t)} y={top + plotH + 15} textAnchor="middle">{every < 1 ? fmtMonth(t) : t.getUTCFullYear()}</text>
            </g>
          ))}
        </g>
        {/* windows as subtle bands */}
        {timeline.windows.map((w, i) => (
          <rect key={i} x={sx(w.start)} width={Math.max(2, sx(w.end) - sx(w.start))} y={w.tone === 'favourable' ? top : sy(0)} height={plotH / 2}
            fill={w.tone === 'favourable' ? 'var(--good)' : 'var(--bad)'} opacity={isSel(w) ? 0.16 : 0.06} />
        ))}
        <path d={areaPath} fill="var(--good)" opacity={0.85} clipPath="url(#vt-pos)" />
        <path d={areaPath} fill="var(--bad)" opacity={0.85} clipPath="url(#vt-neg)" />
        {showParts && (
          <>
            <path d={line('dasha')} fill="none" stroke="var(--accent)" strokeWidth={2} />
            <path d={line('relTransit')} fill="none" stroke="var(--gold)" strokeWidth={2} strokeDasharray="4 3" />
          </>
        )}
        {/* now + inspect markers */}
        <line x1={sx(new Date())} x2={sx(new Date())} y1={top - 6} y2={laneY(lanes.length - 1) + laneH} stroke="var(--text-primary)" strokeWidth={1.5} />
        <text x={sx(new Date()) + 4} y={top + 2} fontSize={10} fill="var(--text-secondary)">today</text>
        {+inspect >= x0 && +inspect <= x1 && (
          <line x1={sx(inspect)} x2={sx(inspect)} y1={top} y2={top + plotH} stroke="var(--accent)" strokeWidth={2} strokeDasharray="3 3" />
        )}

        {/* lanes */}
        {lanes.map((name, i) => (
          <text key={name} className="vt-lane-label" x={left - 8} y={laneY(i) + laneH - 4} textAnchor="end">{name === 'Dasha' ? (spanYears > 25 ? 'Mahadasha' : 'Antardasha') : name === 'SaturnPhase' ? 'Sade Sati' : `${GLYPH[name as Planet]} ${name} ℞`}</text>
        ))}
        {antars.map((p, i) => {
          const a = clampX(p.start, left), b = clampX(p.end, W - right);
          return (
            <g key={i} style={{ cursor: 'pointer' }} onClick={() => onSelect({ kind: 'dasha', period: p })}>
              <rect x={a + 1} width={Math.max(1, b - a - 2)} y={laneY(0)} height={laneH} rx={4} fill={scoreColor(p.score)} stroke={isSel(p) ? 'var(--text-primary)' : 'none'} strokeWidth={2}>
                <title>{`${p.path.join(' – ')}: ${fmtRange(p.start, p.end)} (${signed(p.score)})`}</title>
              </rect>
              {b - a > 46 && <text x={a + 5} y={laneY(0) + 12} fontSize={10.5} fill="var(--text-primary)" pointerEvents="none">{p.path.map((q) => q.slice(0, 2)).join('/')}</text>}
            </g>
          );
        })}
        {timeline.saturn.phases.filter((p) => p.end.getTime() > x0 && p.start.getTime() < x1).map((p, i) => {
          const a = clampX(p.start, left), b = clampX(p.end, W - right);
          const sade = p.kind.startsWith('sade');
          return (
            <g key={i} style={{ cursor: 'pointer', color: 'var(--bad)' }} onClick={() => onSelect({ kind: 'saturn', phase: p })}>
              <rect x={a + 1} width={Math.max(1, b - a - 2)} y={laneY(1)} height={laneH} rx={4} fill={sade ? 'var(--bad)' : 'url(#vt-hatch)'} opacity={p.kind === 'sade-sati-peak' ? 1 : 0.7} stroke={isSel(p) ? 'var(--text-primary)' : 'none'} strokeWidth={2}>
                <title>{`${satLabel(p.kind)}: ${fmtRange(p.start, p.end)}`}</title>
              </rect>
              {b - a > 70 && <text x={a + 5} y={laneY(1) + 12} fontSize={10.5} fill={sade ? '#fff' : 'var(--text-primary)'} pointerEvents="none">{satLabel(p.kind)}</text>}
            </g>
          );
        })}
        {retroPlanets.map((planet, li) => timeline.retrogrades.filter((r) => r.planet === planet).map((r, i) => {
          const y = laneY(2 + li);
          const pre = [clampX(r.preShadowStart, sx(r.stationRetrograde)), clampX(r.stationRetrograde, left)];
          const ret = [clampX(r.stationRetrograde, left), clampX(r.stationDirect, W - right)];
          const post = [clampX(r.stationDirect, W - right), clampX(r.postShadowEnd, W - right)];
          const color = PLANET_COLOR[planet];
          return (
            <g key={i} style={{ cursor: 'pointer' }} onClick={() => onSelect({ kind: 'retro', period: r })}>
              <rect x={pre[0]} width={Math.max(0, pre[1] - pre[0])} y={y + 4} height={laneH - 8} rx={3} fill={color} opacity={0.35} />
              <rect x={ret[0]} width={Math.max(2, ret[1] - ret[0])} y={y} height={laneH} rx={4} fill={color} stroke={isSel(r) ? 'var(--text-primary)' : 'var(--surface-1)'} strokeWidth={isSel(r) ? 2 : 1} />
              <rect x={post[0]} width={Math.max(0, post[1] - post[0])} y={y + 4} height={laneH - 8} rx={3} fill={color} opacity={0.35} />
              <title>{`${planet} retrograde ${fmtRange(r.stationRetrograde, r.stationDirect)} (shadow ${fmtRange(r.preShadowStart, r.postShadowEnd)})`}</title>
            </g>
          );
        }))}

        {/* hover layer over the plot */}
        <rect x={left} y={top} width={W - left - right} height={plotH} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)}
          onClick={() => hover && onInspect(hover.pt.date)} style={{ cursor: 'crosshair' }} />
        {hover && (
          <g pointerEvents="none">
            <line x1={hover.x} x2={hover.x} y1={top} y2={top + plotH} stroke="var(--text-secondary)" strokeWidth={1} />
            <circle cx={hover.x} cy={sy(hover.pt.combined)} r={5} fill={scoreColor(hover.pt.combined)} stroke="var(--surface-1)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover && <WeatherTip hover={hover} timeline={timeline} width={W} />}
      <div className="vt-spread" style={{ marginTop: 6 }}>
        <div className="vt-legend">
          <span><i style={{ background: 'var(--good)' }} />Supportive</span>
          <span><i style={{ background: 'var(--bad)' }} />Challenging</span>
          {showParts && <><span><i style={{ background: 'var(--accent)', height: 2 }} />Dasha part</span><span><i style={{ background: 'var(--gold)', height: 2 }} />Transit part</span></>}
          <span><i style={{ background: 'var(--text-muted)', opacity: 0.4, height: 4 }} />Shadow phase</span>
        </div>
        <label className="vt-check"><input type="checkbox" checked={showParts} onChange={(e) => setShowParts(e.target.checked)} /> Show dasha and transit parts</label>
      </div>
    </div>
  );
}

function WeatherTip({ hover, timeline, width }: { hover: { x: number; pt: CombinedPoint }; timeline: Timeline; width: number }) {
  const { pt } = hover;
  const retro = RETRO_PLANETS.map((p) => [p, retroStatusAt(timeline.retrogrades, p, pt.date)] as const).filter(([, s]) => s);
  const sat = timeline.saturn.phases.find((p) => p.start <= pt.date && pt.date < p.end);
  const top = Object.entries(pt.byPlanet).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3);
  const leftPx = hover.x > width - 300 ? hover.x - 290 : hover.x + 14;
  return (
    <div className="vt-tip" style={{ left: leftPx, top: 8 }}>
      <div className="vt-spread"><b>{fmtDate(pt.date)}</b><span className="vt-score">{signed(pt.combined)}</span></div>
      <div style={{ margin: '4px 0' }}><ToneBadge score={pt.combined} tone={pt.tone} /></div>
      <div><span className="k">Dasha </span>{pt.dashaPath.join(' – ')} <span className="vt-score">({signed(pt.dasha)})</span></div>
      <div><span className="k">Transits </span><span className="vt-score">{signed(pt.relTransit)}</span> <span className="k">vs your usual</span></div>
      <div><span className="k">Strongest </span>{top.map(([p, v]) => `${GLYPH[p as Planet]}${signed(v)}`).join('  ')}</div>
      {sat && <div><span className="k">Saturn </span>{sat.kind.replace(/-/g, ' ')}</div>}
      {retro.length > 0 && <div><span className="k">℞ </span>{retro.map(([p, s]) => `${p} ${s}`).join(', ')}</div>}
      <div className="k" style={{ marginTop: 4 }}>Click to inspect this date</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function DashaExplorer({ timeline, chart, selection, onSelect }: { timeline: Timeline; chart: NatalChart; selection: Selection; onSelect: (s: Selection) => void }) {
  const now = new Date();
  const [maha, setMaha] = useState<DashaPeriod | null>(() => timeline.current[0] ?? null);
  const [antar, setAntar] = useState<DashaPeriod | null>(() => timeline.current[1] ?? null);
  useEffect(() => { setMaha(timeline.current[0] ?? null); setAntar(timeline.current[1] ?? null); }, [timeline]);
  const life0 = chart.birth.getTime(), life1 = addDays(chart.birth, 365.25 * 100).getTime();
  const lifeMahas = timeline.dashas.filter((m) => m.end.getTime() > life0 && m.start.getTime() < life1);
  const sel = selection?.kind === 'dasha' ? selection.period : null;

  const Row = ({ periods, a, b, active, onPick, label }: { periods: DashaPeriod[]; a: number; b: number; active: DashaPeriod | null; onPick: (p: DashaPeriod) => void; label: string }) => (
    <div style={{ marginBottom: 12 }}>
      <div className="vt-spread" style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}><span>{label}</span><span>{fmtRange(new Date(a), new Date(b))}</span></div>
      <div className="vt-dasha-row">
        {periods.map((p, i) => {
          const s = Math.max(a, p.start.getTime()), e = Math.min(b, p.end.getTime());
          const share = (e - s) / (b - a);
          return (
            <button key={i} className="vt-dasha-seg" aria-pressed={sel === p || active === p}
              style={{ flexGrow: share, flexBasis: 0, background: scoreColor(p.score) }}
              title={`${p.path.join(' – ')}\n${fmtRange(p.start, p.end)}\n${TONE_LABEL[p.tone].label} (${signed(p.score)})`}
              onClick={() => { onPick(p); onSelect({ kind: 'dasha', period: p }); }}>
              {share > 0.045 ? `${GLYPH[p.lord]} ${share > 0.09 ? p.lord : ''}` : ''}
            </button>
          );
        })}
        {now.getTime() > a && now.getTime() < b && <span className="vt-now" style={{ left: `${((now.getTime() - a) / (b - a)) * 100}%` }} />}
      </div>
    </div>
  );

  return (
    <div>
      <Row label="Mahadashas across your life" periods={lifeMahas} a={life0} b={life1} active={maha} onPick={(p) => { setMaha(p); setAntar(p.children?.[0] ?? null); }} />
      {maha?.children && <Row label={`${maha.lord} mahadasha: antardashas`} periods={maha.children} a={maha.start.getTime()} b={maha.end.getTime()} active={antar} onPick={setAntar} />}
      {antar?.children && <Row label={`${antar.path.join(' – ')}: pratyantardashas`} periods={antar.children} a={antar.start.getTime()} b={antar.end.getTime()} active={null} onPick={() => {}} />}
      <div className="vt-legend">
        <span><i style={{ background: scoreColor(60) }} />Strong, supportive lord</span>
        <span><i style={{ background: scoreColor(0) }} />Mixed</span>
        <span><i style={{ background: scoreColor(-60) }} />Testing lord</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function TransitTable({ chart, ephemeris, date, timeline, onDate }: { chart: NatalChart; ephemeris: Ephemeris; date: Date; timeline: Timeline; onDate: (d: Date) => void }) {
  const snap = useMemo(() => transitSnapshot(chart, ephemeris.positions(date), date), [chart, ephemeris, date]);
  const chain = activeDashas(timeline.dashas, date);
  const iso = date.toISOString().slice(0, 10);
  return (
    <div>
      <div className="vt-row" style={{ marginBottom: 10 }}>
        <input type="date" value={iso} onChange={(e) => e.target.value && onDate(new Date(`${e.target.value}T12:00:00Z`))} />
        <button className="vt-chip" style={{ border: 0, cursor: 'pointer' }} onClick={() => onDate(new Date())}>Today</button>
        <ToneBadge score={snap.score} tone={snap.tone} />
        <span className="vt-muted" style={{ fontSize: 12 }}>Dasha: {chain.map((c) => c.lord).join(' – ')}</span>
      </div>
      <div className="vt-scroll">
        <table className="vt-table">
          <thead><tr><th>Planet</th><th>Sign</th><th>From Moon</th><th>From lagna</th><th>Gochara</th><th>Bindus</th><th>Notes</th><th style={{ minWidth: 90 }}>Effect</th></tr></thead>
          <tbody>
            {snap.planets.map((p) => (
              <tr key={p.planet}>
                <td><b>{GLYPH[p.planet]} {p.planet}</b>{p.retrograde ? ' ℞' : ''}</td>
                <td>{signName(p.sign)}</td>
                <td>{ordinal(p.houseFromMoon)}</td>
                <td title={HOUSE_TOPICS[p.houseFromLagna]}>{ordinal(p.houseFromLagna)}</td>
                <td>{p.favourable ? (p.obstructedBy ? `▲ blocked by ${p.obstructedBy}` : '▲ favourable') : '▼ unfavourable'}</td>
                <td>{p.bindus ?? '—'}</td>
                <td className="vt-muted">{[p.label, ...p.contacts.map((c) => `${c.kind === 'conjunction' ? '☌' : '☍'} natal ${c.natal} ${c.orb}°`)].filter(Boolean).join('; ')}</td>
                <td><ScoreBar score={p.score} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const w = Math.abs(score) / 2;
  return (
    <div className="vt-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
      <div className="vt-rbar" style={{ width: 70 }}>
        <i style={{ left: score >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, background: scoreColor(score >= 0 ? 60 : -60) }} />
        <i style={{ left: 'calc(50% - 1px)', width: 2, background: 'var(--text-muted)' }} />
      </div>
      <span className="vt-score" style={{ width: 30, textAlign: 'right' }}>{signed(score)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
function AshtakavargaGrid({ timeline, chart }: { timeline: Timeline; chart: NatalChart }) {
  const av = timeline.ashtakavarga;
  const moonS = signOf(chart.planets.Moon.longitude), ascS = signOf(chart.ascendant);
  const maxSav = Math.max(...av.sav), minSav = Math.min(...av.sav);
  return (
    <div className="vt-scroll">
      <table className="vt-table vt-av">
        <thead>
          <tr><th />{SIGNS.map((s, i) => <th key={s} className={i === moonS || i === ascS ? 'hl' : ''} title={`${s}${i === ascS ? ' (lagna)' : ''}${i === moonS ? ' (Moon)' : ''}`}>{s.slice(0, 3)}{i === ascS ? ' L' : ''}{i === moonS ? ' ☽' : ''}</th>)}<th>Total</th></tr>
        </thead>
        <tbody>
          {SEVEN.map((p) => (
            <tr key={p}>
              <th>{GLYPH[p]} {p}</th>
              {av.bav[p].map((v, s) => (
                <td key={s} style={{ background: seqColor(v / 8), color: seqInk(v / 8) }} title={`${p} in ${SIGNS[s]}: ${v} bindus from ${av.prastara[p][s].join(', ') || 'none'}`}>{v}</td>
              ))}
              <td className="vt-muted">{BAV_TOTALS[p]}</td>
            </tr>
          ))}
          <tr>
            <th>SAV</th>
            {av.sav.map((v, s) => {
              const t = (v - minSav) / Math.max(1, maxSav - minSav);
              return <td key={s} style={{ background: seqColor(t), color: seqInk(t), fontWeight: 700 }} title={`${SIGNS[s]}: ${v}. ${av.signs[s].quality}`}>{v}</td>;
            })}
            <td className="vt-muted">337</td>
          </tr>
        </tbody>
      </table>
      <p className="vt-sub" style={{ marginTop: 8 }}>
        Strongest signs: {[...av.signs].sort((a, b) => b.sav - a.sav).slice(0, 3).map((s) => `${s.name} (${s.sav}, your ${ordinal(((s.sign - ascS + 12) % 12) + 1)} house)`).join(', ')}.
        {' '}Weakest: {[...av.signs].sort((a, b) => a.sav - b.sav).slice(0, 2).map((s) => `${s.name} (${s.sav})`).join(', ')}.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
function WindowsCard({ timeline, selection, onSelect }: { timeline: Timeline; selection: Selection; onSelect: (s: Selection) => void }) {
  const now = new Date();
  const upcoming = timeline.windows.filter((w) => w.end > now);
  const good = upcoming.filter((w) => w.tone === 'favourable').slice(0, 4);
  const bad = upcoming.filter((w) => w.tone === 'challenging').slice(0, 4);
  const item = (w: TWindow, i: number) => (
    <button key={i} className="vt-item" aria-pressed={selection?.kind === 'window' && selection.window === w} onClick={() => onSelect({ kind: 'window', window: w })}>
      <div className="vt-spread"><span className="t">{fmtRange(w.start, w.end)}</span><span className="vt-score">{signed(w.average)}</span></div>
      <div className="d">{w.dashaPath.join(' – ')} dasha</div>
    </button>
  );
  return (
    <section className="vt-card">
      <h2>Upcoming windows</h2>
      <p className="vt-sub">Stretches that stand out in the selected range.</p>
      <h3>▲ Best times to push forward</h3>
      <div className="vt-list">{good.length ? good.map(item) : <span className="vt-muted">None stand out in this range. Try a longer range.</span>}</div>
      <h3>▼ Times to go carefully</h3>
      <div className="vt-list">{bad.length ? bad.map(item) : <span className="vt-muted">None stand out in this range.</span>}</div>
    </section>
  );
}

function RetroCard({ timeline, selection, onSelect }: { timeline: Timeline; selection: Selection; onSelect: (s: Selection) => void }) {
  const now = new Date();
  const list = timeline.retrogrades.filter((r) => (r.postShadowEnd ?? r.stationDirect ?? r.stationRetrograde) > now).slice(0, 8);
  return (
    <section className="vt-card">
      <h2>Retrogrades</h2>
      <p className="vt-sub">Each loop, where it lands in your chart, and the natal points it touches.</p>
      <div className="vt-list">
        {list.map((r, i) => (
          <button key={i} className="vt-item" aria-pressed={selection?.kind === 'retro' && selection.period === r} onClick={() => onSelect({ kind: 'retro', period: r })}>
            <div className="vt-spread">
              <span className="t"><span style={{ color: PLANET_COLOR[r.planet] }}>■</span> {GLYPH[r.planet]} {r.planet} ℞</span>
              <span className="vt-score vt-muted">{signed(r.score)}</span>
            </div>
            <div className="d">{fmtRange(r.stationRetrograde, r.stationDirect)}</div>
            <div className="d">Houses {r.natalHouses.map(ordinal).join(', ')}{r.contacts.length ? ` · touches ${r.contacts.map((c) => c.planet).join(', ')}` : ''}</div>
          </button>
        ))}
      </div>
    </section>
  );
}

function SaturnCard({ timeline, chart, selection, onSelect }: { timeline: Timeline; chart: NatalChart; selection: Selection; onSelect: (s: Selection) => void }) {
  const now = new Date();
  const active = timeline.saturn.phases.find((p) => p.start <= now && now < p.end);
  return (
    <section className="vt-card">
      <h2>Sade Sati and Saturn phases</h2>
      <p className="vt-sub">Saturn's 7½-year passage over your Moon in {signName(signOf(chart.planets.Moon.longitude))}, plus Kantaka (4th) and Ashtama (8th) Shani.</p>
      {active ? <p style={{ margin: '0 0 10px' }}><b>Now:</b> {SATURN_PHASE_TEXT[active.kind]} <span className="vt-muted">until {fmtDate(active.end)}</span></p> : <p style={{ margin: '0 0 10px' }}><b>Now:</b> no major Saturn phase is running.</p>}
      <div className="vt-list">
        {timeline.saturn.sadeSati.map((s, i) => (
          <button key={i} className="vt-item" aria-pressed={selection?.kind === 'sadesati' && selection.spell === s} onClick={() => onSelect({ kind: 'sadesati', spell: s })}>
            <div className="vt-spread"><span className="t">Sade Sati {i + 1}</span><ToneBadge score={s.severity.score} tone={s.severity.tone} /></div>
            <div className="d">{fmtRange(s.start, s.end)}{s.start <= now && now < s.end ? ' · running now' : ''}</div>
            <div className="d">Saturn bindus: {s.bindus.join(' / ')}</div>
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
function Reasons({ reasons }: { reasons: Reason[] }) {
  const max = Math.max(10, ...reasons.map((r) => Math.abs(r.weight)));
  return (
    <ul className="vt-reasons">
      {reasons.slice(0, 12).map((r, i) => {
        const w = (Math.abs(r.weight) / max) * 50;
        return (
          <li key={i}>
            <div className="vt-rbar" title={`${signed(Math.round(r.weight))}`}>
              <i style={{ left: r.weight >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, background: scoreColor(r.weight >= 0 ? 60 : -60) }} />
            </div>
            <span>{r.weight >= 0 ? '▲' : '▼'} {r.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

function DetailPanel({ selection, chart, onClose }: { selection: Selection; chart: NatalChart; onClose: () => void }) {
  if (!selection) {
    return (
      <section className="vt-card">
        <h2>Details</h2>
        <p className="vt-sub" style={{ margin: 0 }}>Click any dasha, window, retrograde or Saturn phase to see why it scores the way it does.</p>
      </section>
    );
  }
  const head = (title: string, sub: string, score?: number, tone?: Tone) => (
    <>
      <div className="vt-spread"><h2>{title}</h2><button className="vt-chip" style={{ border: 0, cursor: 'pointer' }} onClick={onClose} aria-label="Close details">✕</button></div>
      <p className="vt-sub" style={{ marginBottom: 8 }}>{sub}</p>
      {score !== undefined && tone && <div style={{ marginBottom: 10 }}><ToneBadge score={score} tone={tone} /></div>}
    </>
  );
  let body: ReactElement;
  if (selection.kind === 'dasha') {
    const p = selection.period;
    const lvl = ['Mahadasha', 'Antardasha', 'Pratyantardasha', 'Sookshma', 'Prana'][p.level - 1];
    body = (
      <>
        {head(`${p.path.join(' – ')} ${lvl}`, fmtRange(p.start, p.end), p.score, p.tone)}
        <h3>Life areas activated by {p.lord}</h3>
        <div className="vt-chips">{p.themes.map((t) => <span key={t.house} className="vt-chip">{t.via === 'occupies' ? 'In' : 'Rules'} {ordinal(t.house)}: {t.topic}</span>)}</div>
        <h3>Why</h3>
        <Reasons reasons={p.reasons} />
      </>
    );
  } else if (selection.kind === 'retro') {
    const r = selection.period;
    body = (
      <>
        {head(`${GLYPH[r.planet]} ${r.planet} retrograde`, r.summary, r.score, r.tone)}
        <table className="vt-table"><tbody>
          <tr><th>Pre-shadow</th><td>{fmtDate(r.preShadowStart)}</td></tr>
          <tr><th>Stations retrograde</th><td>{fmtDate(r.stationRetrograde)}</td></tr>
          <tr><th>Stations direct</th><td>{fmtDate(r.stationDirect)}</td></tr>
          <tr><th>Shadow clears</th><td>{fmtDate(r.postShadowEnd)}</td></tr>
        </tbody></table>
        <h3>Theme</h3><p style={{ margin: 0 }}>{RETRO_MEANING[r.planet]}.</p>
        <h3>In your chart</h3>
        <Reasons reasons={r.reasons} />
      </>
    );
  } else if (selection.kind === 'saturn') {
    const p = selection.phase;
    body = (<>{head(p.kind.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()), `${fmtRange(p.start, p.end)} · Saturn in ${signName(p.sign)}${p.reentry ? ' (retrograde re-entry)' : ''}`)}<p style={{ margin: 0 }}>{SATURN_PHASE_TEXT[p.kind]}</p></>);
  } else if (selection.kind === 'sadesati') {
    const s = selection.spell;
    body = (
      <>
        {head('Sade Sati', fmtRange(s.start, s.end), s.severity.score, s.severity.tone)}
        <div className="vt-list" style={{ marginBottom: 10 }}>
          {s.phases.map((p, i) => <div key={i} className="d" style={{ fontSize: 12.5 }}><b>{p.kind.replace('sade-sati-', '').replace(/^./, (c) => c.toUpperCase())}</b> in {signName(p.sign)}: {fmtRange(p.start, p.end)}{p.reentry ? ' (re-entry)' : ''}</div>)}
        </div>
        <Reasons reasons={s.severity.reasons} />
      </>
    );
  } else {
    const w = selection.window;
    body = (
      <>
        {head(w.tone === 'favourable' ? '▲ Favourable window' : '▼ Challenging window', fmtRange(w.start, w.end), w.average, w.tone === 'favourable' ? (w.average >= 45 ? 'excellent' : 'good') : w.average <= -45 ? 'difficult' : 'challenging')}
        <h3>Main drivers</h3>
        <ul className="vt-reasons">{w.drivers.map((d, i) => <li key={i} style={{ gridTemplateColumns: '1fr' }}>{d}</li>)}</ul>
        <p className="vt-sub" style={{ marginTop: 10 }}>{w.tone === 'favourable' ? 'Good for launches, applications, commitments and asking for what you want.' : 'Better for consolidation, health care, finishing old work and avoiding risky new commitments.'}</p>
      </>
    );
  }
  void chart;
  return <section className="vt-card">{body}</section>;
}

export default TimingDashboard;
