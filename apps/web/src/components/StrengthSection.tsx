import { useState } from 'react';
import type { BhavaBalaEntry, ChartStrength, ShadbalaEntry, ShadbalaPlanet } from '@vedic/engine';
import { PLANET_BY_ID, signInfo } from '../data/constants';
import {
  BHAVA_INTRO,
  COMPONENTS,
  KALA_PARTS,
  PLANET_STRENGTH_MEANING,
  RELATION_LABEL,
  SHADBALA_INTRO,
  SIGN_TYPE_LABEL,
  STHANA_PARTS,
} from '../lib/strengthText';

const f1 = (x: number) => x.toFixed(1);
const f2 = (x: number) => x.toFixed(2);

/** Shadbala for the seven planets and Bhava Bala for the twelve houses, with what each part means. */
export function StrengthSection({ strength }: { strength: ChartStrength }) {
  const { shadbala, bhavaBala } = strength;
  const [sel, setSel] = useState<ShadbalaPlanet>(shadbala.order[0]);
  const rows = shadbala.order.map((g) => shadbala.planets[g]);
  const max = Math.ceil(Math.max(...rows.map((r) => Math.max(r.rupas, r.requiredRupas))) + 0.5);
  const strong = rows.filter((r) => r.strong).length;

  return (
    <section className="card" id="strength">
      <div className="card-head">
        <h3>Planet and house strength</h3>
        <span className="muted">Shadbala and Bhava Bala · {strong} of 7 planets reach their minimum</span>
      </div>
      <details className="sb-about">
        <summary>How Shadbala works</summary>
        <p>{SHADBALA_INTRO}</p>
        <dl className="sb-defs">
          {COMPONENTS.map((c) => (
            <div key={c.key}><dt>{c.name} <span className="muted">({c.english})</span></dt><dd>{c.text}</dd></div>
          ))}
        </dl>
      </details>

      <div className="sb-grid">
        <div>
          <h4 className="sb-title">Total strength in rupas</h4>
          <p className="sb-note muted">The bar is the planet's total. The white tick is the minimum Parashara asks of that planet. Click a planet for its breakdown.</p>
          <div className="sb-bars" role="list">
            {rows.map((r) => {
              const info = PLANET_BY_ID[r.planet];
              return (
                <button
                  key={r.planet}
                  role="listitem"
                  className={`sb-row ${sel === r.planet ? 'is-selected' : ''}`}
                  onClick={() => setSel(r.planet)}
                  aria-pressed={sel === r.planet}
                  title={`${info.name}: ${f2(r.rupas)} rupas, needs ${r.requiredRupas}`}
                >
                  <span className="sb-name"><span style={{ color: info.color }}>{info.glyph}</span> {info.name}</span>
                  <span className="sb-track">
                    <span className="sb-fill" style={{ width: `${(r.rupas / max) * 100}%`, background: info.color }} />
                    <span className="sb-tick" style={{ left: `${(r.requiredRupas / max) * 100}%` }} />
                  </span>
                  <span className="sb-val mono">
                    {f2(r.rupas)} <small className="muted">/ {r.requiredRupas}</small>
                    <span className={`sb-pct ${r.strong ? 'good' : 'bad'}`}>{r.strong ? '✓' : '✗'} {Math.round(r.ratio * 100)}%</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="sb-note muted">
            Born {shadbala.context.dayBirth ? 'by day' : 'by night'}. Lords of the moment: year {PLANET_BY_ID[shadbala.context.abdaLord].name},
            month {PLANET_BY_ID[shadbala.context.masaLord].name}, weekday {PLANET_BY_ID[shadbala.context.varaLord].name},
            hour {PLANET_BY_ID[shadbala.context.horaLord].name}.
          </p>
        </div>
        <PlanetBreakdown e={shadbala.planets[sel]} />
      </div>

      <BhavaChart houses={bhavaBala} />
    </section>
  );
}

function PlanetBreakdown({ e }: { e: ShadbalaEntry }) {
  const info = PLANET_BY_ID[e.planet];
  const vals = {
    sthana: e.sthana.total,
    dig: e.dig,
    kala: e.kala.total,
    cheshta: e.cheshta,
    naisargika: e.naisargika,
    drik: e.drik,
  };
  const lo = Math.min(0, ...Object.values(vals));
  const hi = Math.max(...Object.values(vals), 60);
  const span = hi - lo;
  const zero = (-lo / span) * 100;
  const mins = { sthana: e.componentMinimums.sthana, dig: e.componentMinimums.dig, kala: e.componentMinimums.kala, cheshta: e.componentMinimums.cheshta };

  return (
    <div className="sb-detail">
      <h4 className="sb-title"><span style={{ color: info.color }}>{info.glyph}</span> {info.name} · rank {e.rank} of 7</h4>
      <p className="sb-note">
        {f2(e.rupas)} rupas against a minimum of {e.requiredRupas}, so {info.name} is{' '}
        <b>{e.strong ? 'strong enough' : 'below the classical minimum'}</b> to deliver{' '}
        {PLANET_STRENGTH_MEANING[e.planet]}.
        {e.war && ` It is in a planetary war with ${PLANET_BY_ID[e.war.with].name} and ${e.war.won ? 'wins' : 'loses'}.`}
      </p>

      <div className="sb-comp" role="table" aria-label={`${info.name} Shadbala components in virupas`}>
        {COMPONENTS.map((c) => {
          const v = vals[c.key];
          const left = v >= 0 ? zero : zero - (-v / span) * 100;
          const width = (Math.abs(v) / span) * 100;
          const minOk = c.key in mins ? mins[c.key as keyof typeof mins] : undefined;
          const notCounted = c.key === 'cheshta' && !e.cheshtaCounted;
          return (
            <div key={c.key} className="sb-comp-row" role="row" title={c.text}>
              <span role="cell" className="sb-comp-name">{c.english}<small className="muted"> {c.name}</small></span>
              <span role="cell" className="sb-track thin">
                <span className={`sb-fill ${notCounted ? 'hatched' : ''}`} style={{ left: `${left}%`, width: `${width}%`, background: info.color }} />
                {lo < 0 && <span className="sb-zero" style={{ left: `${zero}%` }} />}
              </span>
              <span role="cell" className="sb-val mono">
                {f1(v)}
                {minOk !== undefined && !notCounted && <span className={`sb-pct ${minOk ? 'good' : 'bad'}`} title="Meets the BPHS minimum for this part">{minOk ? '✓' : '✗'}</span>}
                {notCounted && <small className="muted"> in Kala</small>}
              </span>
            </div>
          );
        })}
      </div>
      <p className="sb-note muted">Virupas. ✓ or ✗ marks whether that part reaches its own BPHS minimum. Hover a row for what it measures.</p>

      <div className="sb-tables">
        <table className="planet-table sb-table">
          <caption>Sthana Bala (position)</caption>
          <tbody>
            {STHANA_PARTS.map((p) => (
              <tr key={p.key} title={p.text}><td>{p.name}<div className="sb-sub">{p.text}</div></td><td className="mono">{f1(e.sthana[p.key])}<small className="muted"> / {p.max}</small></td></tr>
            ))}
          </tbody>
        </table>
        <table className="planet-table sb-table">
          <caption>Kala Bala (time)</caption>
          <tbody>
            {KALA_PARTS.filter((p) => p.key !== 'yuddha' || e.kala.yuddha !== 0).map((p) => (
              <tr key={p.key} title={p.text}><td>{p.name}<div className="sb-sub">{p.text}</div></td><td className="mono">{f1(e.kala[p.key])}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h5 className="sb-mini">Dignity in the seven vargas</h5>
      <div className="chips">
        {Object.entries(e.sthana.vargas).map(([v, x]) => (
          <span key={v} className={`chip ${x.virupas >= 22.5 ? 'chip-good' : x.virupas <= 3.75 ? 'chip-bad' : ''}`} title={`${f1(x.virupas)} virupas`}>
            {v} {signInfo(x.sign).glyph} {RELATION_LABEL[x.relation]}
          </span>
        ))}
      </div>

      <div className="sb-phala">
        <div><small>Ishta Phala</small><b className="mono">{f1(e.ishtaPhala)}</b><span className="muted">capacity for good, of 60</span></div>
        <div><small>Kashta Phala</small><b className="mono">{f1(e.kashtaPhala)}</b><span className="muted">capacity for trouble, of 60</span></div>
      </div>
    </div>
  );
}

function BhavaChart({ houses }: { houses: BhavaBalaEntry[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [sel, setSel] = useState<number>(houses.find((h) => h.rank === 1)!.house);
  const max = Math.ceil(Math.max(...houses.map((h) => h.rupas)) + 0.5);
  const mean = houses.reduce((a, h) => a + h.rupas, 0) / 12;
  const W = 600;
  const H = 220;
  const pad = { l: 30, r: 8, t: 12, b: 38 };
  const bw = (W - pad.l - pad.r) / 12;
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const ticks = Array.from({ length: Math.floor(max / 2) + 1 }, (_, i) => i * 2);
  const s = houses[sel - 1];
  const active = hover ?? sel;

  return (
    <div className="sb-bhava">
      <h4 className="sb-title">House strength (Bhava Bala)</h4>
      <p className="sb-note muted">{BHAVA_INTRO}</p>
      <div className="sb-bhava-grid">
        <svg viewBox={`0 0 ${W} ${H}`} className="sb-svg" role="img" aria-label="Bhava Bala of the twelve houses in rupas" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="sb-grid-line" />
              <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="sb-axis">{t}</text>
            </g>
          ))}
          {houses.map((h, i) => {
            const x = pad.l + i * bw;
            const on = active === h.house;
            return (
              <g key={h.house} onMouseEnter={() => setHover(h.house)} onClick={() => setSel(h.house)} style={{ cursor: 'pointer' }}>
                <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
                <path d={roundedTop(x + 4, y(h.rupas), bw - 8, y(0) - y(h.rupas), 4)} className={`sb-col ${on ? 'is-on' : ''}`} />
                <text x={x + bw / 2} y={y(h.rupas) - 5} textAnchor="middle" className={`sb-col-val ${on || h.rank <= 3 ? '' : 'faint'}`}>{f1(h.rupas)}</text>
                <text x={x + bw / 2} y={H - pad.b + 15} textAnchor="middle" className="sb-axis strong">{h.house}</text>
                <text x={x + bw / 2} y={H - pad.b + 30} textAnchor="middle" className="sb-axis">{signInfo(h.sign).glyph}</text>
              </g>
            );
          })}
          <line x1={pad.l} x2={W - pad.r} y1={y(mean)} y2={y(mean)} className="sb-mean" />
        </svg>
        <div className="sb-house">
          <h5 className="sb-mini">House {s.house} · {signInfo(s.sign).name} · rank {s.rank} of 12</h5>
          <table className="planet-table sb-table">
            <tbody>
              <tr><td>Lord's strength<div className="sb-sub">Shadbala of {PLANET_BY_ID[s.lord].name}, lord of {signInfo(s.sign).name}</div></td><td className="mono">{f1(s.adhipati)}</td></tr>
              <tr><td>Direction<div className="sb-sub">{SIGN_TYPE_LABEL[s.signType]}</div></td><td className="mono">{f1(s.dig)}<small className="muted"> / 60</small></td></tr>
              <tr><td>Aspects<div className="sb-sub">Gentle aspects add, harsh ones take away</div></td><td className="mono">{f1(s.drishti)}</td></tr>
              <tr><td><b>Total</b></td><td className="mono"><b>{f2(s.rupas)}</b> rupas</td></tr>
            </tbody>
          </table>
          <p className="sb-note muted">Rupas. The dashed line is this chart's average house, {f1(mean)}. Tap a column to see that house.</p>
        </div>
      </div>
    </div>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}
