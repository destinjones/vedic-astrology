import { useI18n } from '../i18n';
import { addSigns, occupantsByHouse } from '../lib/astro';
import { aspectTargets, focusPlanet, PlanetGlyphs, type ChartViewProps } from './chartShared';

type Pt = [number, number];
const S = 400;
const M = S / 2;
const Q = S / 4;

const HOUSE_POLYS: Pt[][] = [
  [[M, 0], [M + Q, Q], [M, M], [Q, Q]],
  [[0, 0], [M, 0], [Q, Q]],
  [[0, 0], [Q, Q], [0, M]],
  [[0, M], [Q, Q], [M, M], [Q, M + Q]],
  [[0, M], [Q, M + Q], [0, S]],
  [[0, S], [Q, M + Q], [M, S]],
  [[M, S], [Q, M + Q], [M, M], [M + Q, M + Q]],
  [[M, S], [M + Q, M + Q], [S, S]],
  [[S, S], [M + Q, M + Q], [S, M]],
  [[S, M], [M + Q, M + Q], [M, M], [M + Q, Q]],
  [[S, M], [M + Q, Q], [S, 0]],
  [[S, 0], [M + Q, Q], [M, 0]],
];

const centroid = (pts: Pt[]): Pt => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];

/** vertex closest to the chart centre, nudged toward the centroid */
function signLabelPoint(pts: Pt[]): Pt {
  const c = centroid(pts);
  const inner = pts.reduce((best, p) => (Math.hypot(p[0] - M, p[1] - M) < Math.hypot(best[0] - M, best[1] - M) ? p : best));
  const dx = c[0] - inner[0];
  const dy = c[1] - inner[1];
  const len = Math.hypot(dx, dy) || 1;
  const k = pts.length === 4 ? 22 : 18;
  return [inner[0] + (dx / len) * k, inner[1] + (dy / len) * k + 4];
}

/** where planet labels go: centroid, pulled slightly outward for triangles */
function planetPoint(i: number, pts: Pt[]): Pt {
  const c = centroid(pts);
  if (pts.length === 4) return [c[0], c[1] + (i === 0 ? -8 : 0)];
  return c;
}

export function NorthChart(props: ChartViewProps) {
  const { varga, selection, hoverPlanet, onSelect } = props;
  const { t, v } = useI18n();
  const occ = occupantsByHouse(varga);
  const targets = aspectTargets(varga, focusPlanet(selection, hoverPlanet));

  return (
    <svg viewBox={`-6 -6 ${S + 12} ${S + 12}`} className="chart-svg" role="img" aria-label="North Indian chart">
      <defs>
        <linearGradient id="northBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--chart-bg-a)" />
          <stop offset="1" stopColor="var(--chart-bg-b)" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={S} height={S} fill="url(#northBg)" rx={6} />
      {HOUSE_POLYS.map((pts, i) => {
        const house = i + 1;
        const sign = addSigns(varga.ascSign, i);
        const selected = selection?.kind === 'house' && selection.num === house;
        const [lx, ly] = signLabelPoint(pts);
        const [px, py] = planetPoint(i, pts);
        return (
          <g key={house} className="chart-house" onClick={() => onSelect({ kind: 'house', num: house })}>
            <polygon
              points={pts.map((p) => p.join(',')).join(' ')}
              className={`house-poly${selected ? ' is-selected' : ''}${targets.has(house) ? ' is-aspected' : ''}${house === 1 ? ' is-lagna' : ''}`}
            />
            <text x={lx} y={ly} textAnchor="middle" className="chart-signnum">
              <title>{t('wheel.signHouse', { sign: v.signs[sign - 1], house })}</title>
              {sign}
            </text>
            <PlanetGlyphs {...props} ids={occ[house]} cx={px} cy={py} perCol={pts.length === 4 ? 4 : 3} showAsc={house === 1} extra={props.overlay?.houses[house]} />
          </g>
        );
      })}
      <g className="chart-lines" pointerEvents="none">
        <rect x={0} y={0} width={S} height={S} rx={6} fill="none" />
        <line x1={0} y1={0} x2={S} y2={S} />
        <line x1={S} y1={0} x2={0} y2={S} />
        <polygon points={`${M},0 ${S},${M} ${M},${S} 0,${M}`} fill="none" />
      </g>
    </svg>
  );
}
