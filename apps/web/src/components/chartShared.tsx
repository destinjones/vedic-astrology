import type { Chart, PlanetId, VargaChart } from '../types/chart';
import type { Selection } from '../types/ui';
import { PLANET_BY_ID } from '../data/constants';
import { aspectedHouses } from '../lib/astro';
import { useI18n } from '../i18n';

export interface ChartViewProps {
  chart: Chart;
  varga: VargaChart;
  selection: Selection | null;
  hoverPlanet: PlanetId | null;
  onSelect: (s: Selection) => void;
  onHoverPlanet: (id: PlanetId | null) => void;
  /** Another person's planets drawn in this chart's houses (synastry). */
  overlay?: ChartOverlay;
}

export interface ChartOverlay {
  chart: Chart;
  /** Overlay planets grouped by the host chart's house. */
  houses: Record<number, PlanetId[]>;
  /** Shown in tooltips, e.g. "Ravi". */
  label: string;
  selected?: PlanetId | null;
  onSelect: (id: PlanetId) => void;
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
  /** Overlay planets for this house. */
  extra?: PlanetId[];
}

/** Stack of planet labels centered at (cx, cy) */
export function PlanetGlyphs({ ids, cx, cy, perCol = 3, chart, varga, selection, onSelect, onHoverPlanet, showAsc, extra = [], overlay }: PlanetGlyphsProps) {
  const { t, v } = useI18n();
  const own: (PlanetId | 'asc')[] = showAsc ? ['asc', ...ids] : ids;
  const items: (PlanetId | 'asc' | `x:${PlanetId}`)[] = [...own, ...extra.map((id) => `x:${id}` as const)];
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
              {t('chart.asc')}{isD1 ? ` ${Math.floor(chart.ascendant.degreeInSign)}°` : ''}
            </text>
          );
        }
        if (id.startsWith('x:') && overlay) {
          const oid = id.slice(2) as PlanetId;
          const oinfo = PLANET_BY_ID[oid];
          const opos = overlay.chart.planets.find((p) => p.id === oid)!;
          return (
            <text key={id} x={x} y={y} textAnchor="middle" fill={oinfo.color}
              className={`chart-planet is-overlay${overlay.selected === oid ? ' is-selected' : ''}`}
              onClick={(e) => { e.stopPropagation(); overlay.onSelect(oid); }}>
              <title>{`${overlay.label}'s ${oinfo.name}${opos.retrograde && oid !== 'rahu' && oid !== 'ketu' ? ' (retrograde)' : ''}`}</title>
              {oinfo.abbr}
              <tspan className="chart-deg"> {Math.floor(opos.degreeInSign)}°</tspan>
            </text>
          );
        }
        if (id.startsWith('x:')) return null;
        const pid = id as PlanetId;
        const info = PLANET_BY_ID[pid];
        const pos = chart.planets.find((p) => p.id === pid)!;
        const selected = selection?.kind === 'planet' && selection.id === pid;
        return (
          <text
            key={id}
            x={x}
            y={y}
            textAnchor="middle"
            fill={info.color}
            className={`chart-planet${selected ? ' is-selected' : ''}`}
            onMouseEnter={() => onHoverPlanet(pid)}
            onMouseLeave={() => onHoverPlanet(null)}
            onClick={(e) => { e.stopPropagation(); onSelect({ kind: 'planet', id: pid }); }}
          >
            <title>{`${v.planets[pid].name}${pos.retrograde ? t('chart.retrogradeSuffix') : ''}${pos.combust ? t('chart.combustSuffix') : ''}`}</title>
            {v.planets[pid].short}
            {isD1 && <tspan className="chart-deg"> {Math.floor(pos.degreeInSign)}°</tspan>}
            {pos.retrograde && pid !== 'rahu' && pid !== 'ketu' && <tspan className="chart-flag" dy={-5}>{t('chart.retroFlag')}</tspan>}
            {pos.combust && <tspan className="chart-flag" dy={pos.retrograde && pid !== 'rahu' && pid !== 'ketu' ? 0 : -5}>{t('chart.combustFlag')}</tspan>}
          </text>
        );
      })}
    </g>
  );
}
