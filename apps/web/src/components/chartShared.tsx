import { useState, type KeyboardEvent } from 'react';
import type { Chart, PlanetId, VargaChart } from '../types/chart';
import type { Selection } from '../types/ui';
import { PLANET_BY_ID } from '../data/constants';
import { addSigns, aspectedHouses } from '../lib/astro';
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


/* ------------------------------------------------------------------ keyboard
 * A chart takes one Tab stop. Arrow keys move between houses by where they sit on screen, so
 * "right" goes to the house drawn to the right in either style. Page Down and Page Up step through
 * the houses in number order, Home and End go to the 1st and 12th. Enter or Space opens a house.
 * Tab from a house steps through the planets in it, then out of the chart.
 */
const activate = (e: KeyboardEvent, run: () => void) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  e.stopPropagation();
  run();
};

const DIRS: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };

/** The house a move from `from` lands on: the nearest centre in that direction, favouring straight lines. */
export function houseInDirection(centers: Record<number, [number, number]>, from: number, key: string): number | null {
  const d = DIRS[key];
  if (!d) return null;
  const [fx, fy] = centers[from];
  let best: number | null = null;
  let bestScore = Infinity;
  for (const [hs, [x, y]] of Object.entries(centers)) {
    const h = Number(hs);
    if (h === from) continue;
    const dx = x - fx;
    const dy = y - fy;
    const along = dx * d[0] + dy * d[1];
    if (along <= 1) continue;
    const across = Math.abs(dx * d[1] - dy * d[0]);
    // within a 60° cone either side; sideways drift costs more than distance
    if (across > along * 1.75) continue;
    const score = along + across * 1.2;
    if (score < bestScore) { bestScore = score; best = h; }
  }
  return best;
}

export interface ChartNav {
  /** The house that holds the chart's Tab stop. */
  current: number;
  houseProps: (house: number, label: string) => {
    tabIndex: number;
    role: 'button';
    'aria-label': string;
    'aria-pressed': boolean;
    'data-house': number;
    onFocus: () => void;
    onKeyDown: (e: KeyboardEvent<SVGGElement>) => void;
  };
}

export function useChartNav(centers: Record<number, [number, number]>, selection: Selection | null, onSelect: (s: Selection) => void): ChartNav {
  const [current, setCurrent] = useState(1);
  return {
    current,
    houseProps: (house, label) => ({
      tabIndex: house === current ? 0 : -1,
      role: 'button',
      'aria-label': label,
      'aria-pressed': selection?.kind === 'house' && selection.num === house,
      'data-house': house,
      onFocus: () => setCurrent(house),
      onKeyDown: (e) => {
        if (e.target !== e.currentTarget) return; // a planet inside the house handles its own keys
        const go = (h: number | null) => {
          if (h == null) return;
          e.preventDefault();
          setCurrent(h);
          (e.currentTarget.ownerSVGElement ?? e.currentTarget.parentElement)?.querySelector<SVGGElement>(`[data-house="${h}"]`)?.focus();
        };
        if (e.key in DIRS) return go(houseInDirection(centers, house, e.key));
        if (e.key === 'Home') return go(1);
        if (e.key === 'End') return go(12);
        if (e.key === 'PageDown') return go((house % 12) + 1);
        if (e.key === 'PageUp') return go(((house + 10) % 12) + 1);
        activate(e, () => onSelect({ kind: 'house', num: house }));
      },
    }),
  };
}

/** What a screen reader hears for a house: number, sign, lagna, occupants. */
export function houseLabel(house: number, varga: VargaChart, names: { sign: (n: number) => string; planet: (id: PlanetId) => string; lagna: string; empty: string; house: string }, overlay?: { label: string; ids: PlanetId[] }) {
  const sign = addSigns(varga.ascSign, house - 1);
  const occ = (Object.keys(varga.planets) as PlanetId[]).filter((id) => varga.planets[id].house === house).map(names.planet);
  const parts = [`${names.house} ${house}`, names.sign(sign)];
  if (house === 1) parts.push(names.lagna);
  parts.push(occ.length ? occ.join(', ') : names.empty);
  if (overlay?.ids.length) parts.push(`${overlay.label}: ${overlay.ids.map(names.planet).join(', ')}`);
  return parts.join(', ');
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
  /** True for the house holding the chart's Tab stop: its planets are reachable with Tab. */
  focusable?: boolean;
}

/** Stack of planet labels centered at (cx, cy) */
export function PlanetGlyphs({ ids, cx, cy, perCol = 3, chart, varga, selection, onSelect, onHoverPlanet, showAsc, extra = [], overlay, focusable = false }: PlanetGlyphsProps) {
  const { t, v } = useI18n();
  const own: (PlanetId | 'asc')[] = showAsc ? ['asc', ...ids] : ids;
  const items: (PlanetId | 'asc' | `x:${PlanetId}`)[] = [...own, ...extra.map((id) => `x:${id}` as const)];
  const cols = Math.ceil(items.length / perCol) || 1;
  const rows = Math.min(items.length, perCol);
  const lh = 16;
  const cw = 46;
  const isD1 = varga.id === 'D1';
  const tab = focusable ? 0 : -1;
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
              tabIndex={tab} role="button" aria-pressed={selection?.kind === 'asc'}
              aria-label={`${t('table.ascendant')}${isD1 ? ` ${Math.floor(chart.ascendant.degreeInSign)}°` : ''}, ${v.signs[varga.ascSign - 1]}`}
              onKeyDown={(e) => activate(e, () => onSelect({ kind: 'asc' }))}
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
              tabIndex={tab} role="button" aria-pressed={overlay.selected === oid}
              aria-label={`${overlay.label}'s ${oinfo.name}, ${Math.floor(opos.degreeInSign)}°${opos.retrograde && oid !== 'rahu' && oid !== 'ketu' ? ', retrograde' : ''}`}
              onKeyDown={(e) => activate(e, () => overlay.onSelect(oid))}
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
            tabIndex={tab}
            role="button"
            aria-pressed={selected}
            aria-label={[
              v.planets[pid].name,
              v.signs[varga.planets[pid].sign - 1],
              isD1 ? `${Math.floor(pos.degreeInSign)}°` : '',
              pos.retrograde && pid !== 'rahu' && pid !== 'ketu' ? t('table.retrograde') : '',
              pos.combust ? t('table.combust') : '',
            ].filter(Boolean).join(', ')}
            onKeyDown={(e) => activate(e, () => onSelect({ kind: 'planet', id: pid }))}
            onFocus={() => onHoverPlanet(pid)}
            onBlur={() => onHoverPlanet(null)}
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
