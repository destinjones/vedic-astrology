import type { Chart, PlanetId } from '../types/chart';
import type { Selection } from '../types/ui';
import { NAK_SPAN, NAKSHATRAS, PLANET_BY_ID, SIGNS } from '../data/constants';

interface Props {
  chart: Chart;
  selection: Selection | null;
  onSelect: (s: Selection) => void;
  onHoverPlanet: (id: PlanetId | null) => void;
}

const R_OUT = 190, R_SIGN = 160, R_NAK = 118, R_PLANET = 95;

/** 0° sidereal Aries at 3 o'clock, longitude increasing counter-clockwise (project convention) */
const polar = (deg: number, r: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [200 + r * Math.cos(a), 200 - r * Math.sin(a)];
};

function arc(d0: number, d1: number, r0: number, r1: number) {
  const [x0, y0] = polar(d0, r1);
  const [x1, y1] = polar(d1, r1);
  const [x2, y2] = polar(d1, r0);
  const [x3, y3] = polar(d0, r0);
  const large = d1 - d0 > 180 ? 1 : 0;
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 0 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 1 ${x3},${y3} Z`;
}

export function NakshatraWheel({ chart, selection, onSelect, onHoverPlanet }: Props) {
  // spread planets that are close together onto different radii
  const sorted = [...chart.planets].sort((a, b) => a.longitude - b.longitude);
  const radius: Record<string, number> = {};
  let prev = -99, lane = 0;
  for (const p of sorted) {
    lane = p.longitude - prev < 9 ? Math.min(lane + 1, 3) : 0;
    radius[p.id] = R_PLANET - lane * 20;
    prev = p.longitude;
  }

  return (
    <svg viewBox="0 0 400 400" className="wheel-svg" role="img" aria-label="Nakshatra wheel">
      <defs>
        <radialGradient id="wheelGlow">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={200} cy={200} r={R_OUT} className="wheel-ring" />
      <circle cx={200} cy={200} r={R_NAK - 4} fill="url(#wheelGlow)" />
      {SIGNS.map((s, i) => {
        const [tx, ty] = polar(i * 30 + 15, (R_OUT + R_SIGN) / 2);
        return (
          <g key={s.num}>
            <path d={arc(i * 30, i * 30 + 30, R_SIGN, R_OUT)} className={`wheel-sign el-${s.element.toLowerCase()}`} />
            <text x={tx} y={ty + 6} textAnchor="middle" className="wheel-glyph">{s.glyph}<title>{s.name}</title></text>
          </g>
        );
      })}
      {NAKSHATRAS.map((n, i) => {
        const d0 = i * NAK_SPAN;
        const [tx, ty] = polar(d0 + NAK_SPAN / 2, (R_SIGN + R_NAK) / 2);
        const sel = selection?.kind === 'nakshatra' && selection.num === n.num;
        const hasPlanet = chart.planets.some((p) => p.nakshatra === n.num) || chart.ascendant.nakshatra === n.num;
        return (
          <g key={n.num} className="wheel-nak-g" onClick={() => onSelect({ kind: 'nakshatra', num: n.num })}>
            <path d={arc(d0, d0 + NAK_SPAN, R_NAK, R_SIGN)} className={`wheel-nak${sel ? ' is-selected' : ''}${hasPlanet ? ' is-occupied' : ''}`} />
            <text x={tx} y={ty + 4} textAnchor="middle" className="wheel-naknum">{n.num}<title>{n.name}</title></text>
          </g>
        );
      })}
      {(() => {
        const [x, y] = polar(chart.ascendant.longitude, R_OUT + 2);
        const [x2, y2] = polar(chart.ascendant.longitude, R_NAK - 8);
        return (
          <g className="wheel-asc" onClick={() => onSelect({ kind: 'asc' })}>
            <line x1={x} y1={y} x2={x2} y2={y2} />
            <text x={x2} y={y2} dy={4} textAnchor="middle">Asc</text>
          </g>
        );
      })()}
      {chart.planets.map((p) => {
        const info = PLANET_BY_ID[p.id];
        const r = radius[p.id];
        const [x, y] = polar(p.longitude, r);
        const [lx, ly] = polar(p.longitude, R_NAK - 2);
        const sel = selection?.kind === 'planet' && selection.id === p.id;
        return (
          <g key={p.id} className="wheel-planet"
            onMouseEnter={() => onHoverPlanet(p.id)} onMouseLeave={() => onHoverPlanet(null)}
            onClick={() => onSelect({ kind: 'planet', id: p.id })}>
            <line x1={x} y1={y} x2={lx} y2={ly} stroke={info.color} strokeOpacity={0.5} />
            <circle cx={x} cy={y} r={sel ? 12 : 10} fill="var(--surface)" stroke={info.color} strokeWidth={sel ? 2.5 : 1.5} />
            <text x={x} y={y + 4.5} textAnchor="middle" fill={info.color} className="wheel-planet-glyph">{info.glyph}</text>
            <title>{info.name}</title>
          </g>
        );
      })}
      <circle cx={200} cy={200} r={30} className="wheel-core" />
      <text x={200} y={204} textAnchor="middle" className="wheel-core-text">ॐ</text>
    </svg>
  );
}
