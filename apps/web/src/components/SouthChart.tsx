import { signInfo } from '../data/constants';
import { houseOf, occupantsByHouse } from '../lib/astro';
import { VARGAS } from '../data/constants';
import { aspectTargets, focusPlanet, PlanetGlyphs, type ChartViewProps } from './chartShared';

const C = 100;
/** grid [col,row] of each sign (Pisces top-left, clockwise) */
const SIGN_CELL: Record<number, [number, number]> = {
  12: [0, 0], 1: [1, 0], 2: [2, 0], 3: [3, 0],
  4: [3, 1], 5: [3, 2], 6: [3, 3], 7: [2, 3],
  8: [1, 3], 9: [0, 3], 10: [0, 2], 11: [0, 1],
};

export function SouthChart(props: ChartViewProps) {
  const { varga, selection, hoverPlanet, onSelect, chart } = props;
  const occ = occupantsByHouse(varga);
  const targets = aspectTargets(varga, focusPlanet(selection, hoverPlanet));
  const vinfo = VARGAS.find((v) => v.id === varga.id)!;

  return (
    <svg viewBox="-6 -6 412 412" className="chart-svg" role="img" aria-label="South Indian chart">
      <defs>
        <linearGradient id="southBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--chart-bg-a)" />
          <stop offset="1" stopColor="var(--chart-bg-b)" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={400} height={400} fill="url(#southBg)" rx={6} />
      {Object.entries(SIGN_CELL).map(([s, [col, row]]) => {
        const sign = Number(s);
        const house = houseOf(sign, varga.ascSign);
        const x = col * C;
        const y = row * C;
        const selected = selection?.kind === 'house' && selection.num === house;
        return (
          <g key={sign} className="chart-house" onClick={() => onSelect({ kind: 'house', num: house })}>
            <rect x={x} y={y} width={C} height={C}
              className={`house-poly${selected ? ' is-selected' : ''}${targets.has(house) ? ' is-aspected' : ''}${house === 1 ? ' is-lagna' : ''}`} />
            {house === 1 && <line x1={x} y1={y + 22} x2={x + 22} y2={y} className="lagna-mark" />}
            <text x={x + C - 6} y={y + 14} textAnchor="end" className="chart-signname">{signInfo(sign).short}</text>
            <text x={x + 6} y={y + C - 7} className="chart-housenum">{house}</text>
            <PlanetGlyphs {...props} ids={occ[house]} cx={x + C / 2} cy={y + C / 2 + 4} perCol={4} showAsc={house === 1} extra={props.overlay?.houses[house]} />
          </g>
        );
      })}
      <g pointerEvents="none">
        <text x={200} y={186} textAnchor="middle" className="chart-center-title">{varga.id} · {vinfo.name}</text>
        <text x={200} y={208} textAnchor="middle" className="chart-center-sub">{chart.input.name || 'Birth chart'}</text>
        <text x={200} y={226} textAnchor="middle" className="chart-center-sub">{chart.input.date} · {chart.input.time}</text>
      </g>
      <g className="chart-lines" pointerEvents="none">
        <rect x={0} y={0} width={400} height={400} rx={6} fill="none" />
        <rect x={C} y={C} width={2 * C} height={2 * C} fill="none" />
        {[1, 2, 3].map((i) => <line key={`v${i}`} x1={i * C} y1={0} x2={i * C} y2={i === 2 ? C : 400} />)}
        <line x1={2 * C} y1={3 * C} x2={2 * C} y2={400} />
        {[1, 2, 3].map((i) => <line key={`h${i}`} x1={0} y1={i * C} x2={i === 2 ? C : 400} y2={i * C} />)}
        <line x1={3 * C} y1={2 * C} x2={400} y2={2 * C} />
      </g>
    </svg>
  );
}
