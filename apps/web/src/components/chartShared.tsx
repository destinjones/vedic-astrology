import type { Chart, PlanetId, VargaChart } from '../types/chart';
import type { Selection } from '../types/ui';
import { PLANET_BY_ID } from '../data/constants';
import { aspectedHouses } from '../lib/astro';

export interface ChartViewProps {
  chart: Chart;
  varga: VargaChart;
  selection: Selection | null;
  hoverPlanet: PlanetId | null;
  onSelect: (s: Selection) => void;
  onHoverPlanet: (id: PlanetId | null) => void;
}

/** Houses to highlight because the hovered/selected planet aspects them */
export function aspectTargets(varga: VargaChart, focus: PlanetId | null): Set<number> {
  if (!focus) return new Set();
  return new Set(aspectedHouses(focus, varga.planets[focus].house));
}

export function focusPlanet(selection: Selection | null, hover: PlanetId | null): PlanetId | null {
  return hover ?? (selection?.kind === 'planet' ? selection.id : null);
}

interface PlanetGlyphsProps extends ChartViewProps {
  ids: PlanetId[];
  cx: number;
  cy: number;
  /** max items per column */
  perCol?: number;
  showAsc?: boolean;
}

/** Stack of planet labels centered at (cx, cy) */
export function PlanetGlyphs({ ids, cx, cy, perCol = 3, chart, varga, selection, onSelect, onHoverPlanet, showAsc }: PlanetGlyphsProps) {
  const items: (PlanetId | 'asc')[] = showAsc ? ['asc', ...ids] : ids;
  const cols = Math.ceil(items.length / perCol) || 1;
  const rows = Math.min(items.length, perCol);
  const lh = 16;
  const cw = 46;
  const isD1 = varga.id === 'D1';
  return (
    <g>
      {items.map((id, i) => {
        const col = Math.floor(i / perCol);
        const row = i % perCol;
        const x = cx + (col - (cols - 1) / 2) * cw;
        const y = cy + (row - (rows - 1) / 2) * lh + 4;
        if (id === 'asc') {
          return (
            <text key="asc" x={x} y={y} textAnchor="middle" className="chart-asc"
              onClick={(e) => { e.stopPropagation(); onSelect({ kind: 'asc' }); }}>
              Asc{isD1 ? ` ${Math.floor(chart.ascendant.degreeInSign)}°` : ''}
            </text>
          );
        }
        const info = PLANET_BY_ID[id];
        const pos = chart.planets.find((p) => p.id === id)!;
        const selected = selection?.kind === 'planet' && selection.id === id;
        return (
          <text
            key={id}
            x={x}
            y={y}
            textAnchor="middle"
            fill={info.color}
            className={`chart-planet${selected ? ' is-selected' : ''}`}
            onMouseEnter={() => onHoverPlanet(id)}
            onMouseLeave={() => onHoverPlanet(null)}
            onClick={(e) => { e.stopPropagation(); onSelect({ kind: 'planet', id }); }}
          >
            <title>{`${info.name}${pos.retrograde ? ' (retrograde)' : ''}${pos.combust ? ' (combust)' : ''}`}</title>
            {info.abbr}
            {isD1 && <tspan className="chart-deg"> {Math.floor(pos.degreeInSign)}°</tspan>}
            {pos.retrograde && id !== 'rahu' && id !== 'ketu' && <tspan className="chart-flag" dy={-5}>R</tspan>}
            {pos.combust && <tspan className="chart-flag" dy={pos.retrograde && id !== 'rahu' && id !== 'ketu' ? 0 : -5}>c</tspan>}
          </text>
        );
      })}
    </g>
  );
}
