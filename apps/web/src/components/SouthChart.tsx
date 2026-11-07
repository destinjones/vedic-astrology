import { signInfo } from '../data/constants';
import { houseOf, occupantsByHouse } from '../lib/astro';
import { useI18n } from '../i18n';
import { aspectTargets, focusPlanet, houseLabel, PlanetGlyphs, useChartNav, type ChartViewProps } from './chartShared';

const C = 100;
/** grid [col,row] of each sign (Pisces top-left, clockwise) */
const SIGN_CELL: Record<number, [number, number]> = {
  12: [0, 0], 1: [1, 0], 2: [2, 0], 3: [3, 0],
  4: [3, 1], 5: [3, 2], 6: [3, 3], 7: [2, 3],
  8: [1, 3], 9: [0, 3], 10: [0, 2], 11: [0, 1],
};

const CENTERS: Record<number, [number, number]> = Object.fromEntries(Object.entries(SIGN_CELL).map(([s, [c, r]]) => [Number(s), [c * C + C / 2, r * C + C / 2]]));

export function SouthChart(props: ChartViewProps) {
  const { varga, selection, hoverPlanet, onSelect, chart } = props;
  const occ = occupantsByHouse(varga);
  const targets = aspectTargets(varga, focusPlanet(selection, hoverPlanet));
  const { t, v, locale, terms } = useI18n();
  const short = (n: number) => (locale === 'en' && terms === 'local' ? signInfo(n).short : v.signs[n - 1].length > 5 ? v.signs[n - 1].slice(0, 3) : v.signs[n - 1]);
  // the cells are fixed by sign, so arrow keys work on house numbers through each house's sign cell
  const centers = Object.fromEntries(Object.entries(CENTERS).map(([s, c]) => [houseOf(Number(s), varga.ascSign), c]));
  const nav = useChartNav(centers, selection, onSelect);
  const names = { sign: (n: number) => v.signs[n - 1], planet: (id: keyof typeof v.planets) => v.planets[id].name, lagna: t('summary.lagna'), empty: '—', house: t('table.house') };

  return (
    <svg viewBox="-6 -6 412 412" className="chart-svg" role="group"
      aria-label={`${t('chart.south')}, ${varga.id} ${v.vargas[varga.id]}. Arrow keys move between houses, Enter opens one, Tab reaches its planets.`}>
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
          <g key={sign} className="chart-house" onClick={() => onSelect({ kind: 'house', num: house })}
            {...nav.houseProps(house, houseLabel(house, varga, names, props.overlay && { label: props.overlay.label, ids: props.overlay.houses[house] ?? [] }))}>
            <rect x={x} y={y} width={C} height={C}
              className={`house-poly${selected ? ' is-selected' : ''}${targets.has(house) ? ' is-aspected' : ''}${house === 1 ? ' is-lagna' : ''}`} />
            {house === 1 && <line x1={x} y1={y + 22} x2={x + 22} y2={y} className="lagna-mark" />}
            <text x={x + C - 6} y={y + 14} textAnchor="end" className="chart-signname" aria-hidden>{short(sign)}</text>
            <text x={x + 6} y={y + C - 7} className="chart-housenum" aria-hidden>{house}</text>
            <PlanetGlyphs {...props} ids={occ[house]} cx={x + C / 2} cy={y + C / 2 + 4} perCol={4} showAsc={house === 1} extra={props.overlay?.houses[house]} focusable={nav.current === house} />
          </g>
        );
      })}
      <g pointerEvents="none" aria-hidden>
        <text x={200} y={186} textAnchor="middle" className="chart-center-title">{varga.id} · {v.vargas[varga.id]}</text>
        <text x={200} y={208} textAnchor="middle" className="chart-center-sub">{chart.input.name || t('chart.birthChart')}</text>
        <text x={200} y={226} textAnchor="middle" className="chart-center-sub">{chart.input.date} · {chart.input.time}</text>
      </g>
      <g className="chart-lines" pointerEvents="none" aria-hidden>
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
