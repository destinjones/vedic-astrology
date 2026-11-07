import type { Chart, VargaId } from '../types/chart';
import type { ChartStyle, Selection } from '../types/ui';
import type { WheelMode } from '../components/NakshatraWheel';
import { HOUSES, NAKSHATRAS, PLANETS, VARGAS } from '../data/constants';
import type { Command } from './commands';
import { scrollBehavior } from './display';

/** Divisional charts with a number-key shortcut: the ones a reading reaches for most. */
const VARGA_KEYS: Partial<Record<VargaId, string>> = { D1: '1', D2: '2', D3: '3', D4: '4', D7: '7', D9: '9', D10: '0' };

/** Grahas in the order j / k step through them, starting at the lagna. */
const STEP_ORDER: Selection[] = [{ kind: 'asc' }, ...PLANETS.map((p) => ({ kind: 'planet', id: p.id }) as Selection)];

const sameSelection = (a: Selection | null, b: Selection) =>
  !!a && a.kind === b.kind && (a.kind !== 'planet' || (b.kind === 'planet' && a.id === b.id))
  && (a.kind !== 'house' || (b.kind === 'house' && a.num === b.num));

export const SECTIONS: { id: string; title: string; key: string; keywords: string; needs?: (c: Chart) => boolean }[] = [
  { id: 'chart', title: 'Birth chart', key: 'c', keywords: 'rashi kundli north south varga divisional' },
  { id: 'details', title: 'Placement details', key: 'i', keywords: 'reading detail panel info' },
  { id: 'yogas', title: 'Yogas and doshas', key: 'y', keywords: 'dosha manglik combinations', needs: (c) => !!c.engineContext },
  { id: 'sky', title: 'Sky view (3D)', key: 's', keywords: 'three d planets orbit' },
  { id: 'wheel', title: 'Nakshatra wheel', key: 'n', keywords: 'stars lunar mansions' },
  { id: 'planets', title: 'Planetary positions', key: 'p', keywords: 'table degrees longitude' },
  { id: 'dasha', title: 'Vimshottari dasha', key: 'd', keywords: 'periods mahadasha antardasha timeline', needs: (c) => !!c.dasha },
  { id: 'timing', title: 'Good and hard times', key: 't', keywords: 'timing transits gochar retrogrades', needs: (c) => !!c.engineContext },
  { id: 'strength', title: 'Planet strength', key: 'b', keywords: 'shadbala bala ashtakavarga strength', needs: (c) => !!c.engineContext?.chart.strength },
  { id: 'jaimini', title: 'Jaimini', key: 'j', keywords: 'chara karaka arudha pada chara dasha', needs: (c) => !!c.engineContext },
  { id: 'events', title: 'Event checker', key: 'e', keywords: 'past life events dashas transits active', needs: (c) => !!c.engineContext },
  { id: 'rectify', title: 'Birth time rectification', key: 'r', keywords: 'rectify correct birth time', needs: (c) => !!c.engineContext },
  { id: 'varshaphal', title: 'Varshaphal (annual chart)', key: 'v', keywords: 'solar return annual year tajika', needs: (c) => !!c.engineContext },
  { id: 'client-history', title: 'Client notes and history', key: 'h', keywords: 'notes questions predictions log' },
];

/** Scroll a part of the explorer into view and move keyboard focus there. */
export function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

export interface ChartCommandState {
  chart: Chart;
  vargaId: VargaId;
  setVargaId: (v: VargaId) => void;
  style: ChartStyle;
  setStyle: (s: ChartStyle) => void;
  selection: Selection | null;
  setSelection: (s: Selection | null) => void;
  wheelMode: WheelMode;
  setWheelMode: (m: WheelMode) => void;
  editBirth: () => void;
}

/** Everything about the open chart that can be reached from the keyboard. */
export function chartCommands(s: ChartCommandState): Command[] {
  const vi = VARGAS.findIndex((v) => v.id === s.vargaId);
  const stepVarga = (d: number) => {
    const next = VARGAS[(vi + d + VARGAS.length) % VARGAS.length].id;
    s.setVargaId(next);
  };
  const si = STEP_ORDER.findIndex((x) => sameSelection(s.selection, x));
  const stepGraha = (d: number) => {
    const n = STEP_ORDER.length;
    const from = si < 0 ? (d > 0 ? -1 : 0) : si;
    s.setSelection(STEP_ORDER[(from + d + n) % n]);
  };

  const out: Command[] = [
    { id: 'varga.next', group: 'Divisional charts', title: 'Next divisional chart', shortcut: ']', keywords: 'varga forward', run: () => stepVarga(1) },
    { id: 'varga.prev', group: 'Divisional charts', title: 'Previous divisional chart', shortcut: '[', keywords: 'varga back', run: () => stepVarga(-1) },
    ...VARGAS.map((v): Command => ({
      id: `varga.${v.id}`,
      group: 'Divisional charts',
      title: `${v.name} (${v.id})`,
      hint: v.area,
      keywords: `${v.id} d${v.id.slice(1)} varga divisional`,
      shortcut: VARGA_KEYS[v.id],
      active: v.id === s.vargaId,
      run: () => { s.setVargaId(v.id); jumpTo('chart'); },
    })),

    { id: 'style.toggle', group: 'Chart', title: s.style === 'north' ? 'Show South Indian style' : 'Show North Indian style', shortcut: 'v', keywords: 'north south style diamond square layout switch', run: () => s.setStyle(s.style === 'north' ? 'south' : 'north') },
    { id: 'wheel.toggle', group: 'Chart', title: s.wheelMode === 'art' ? 'Nakshatra wheel as a diagram' : 'Nakshatra wheel as artwork', shortcut: 'w', keywords: 'wheel art diagram', run: () => { s.setWheelMode(s.wheelMode === 'art' ? 'diagram' : 'art'); jumpTo('wheel'); } },
    { id: 'birth.edit', group: 'Chart', title: 'Edit birth details', shortcut: 'e', keywords: 'change time date place form new chart', run: s.editBirth },

    { id: 'graha.next', group: 'Placements', title: 'Next graha', shortcut: 'j', keywords: 'planet step forward', run: () => stepGraha(1) },
    { id: 'graha.prev', group: 'Placements', title: 'Previous graha', shortcut: 'k', keywords: 'planet step back', run: () => stepGraha(-1) },
    { id: 'asc', group: 'Placements', title: 'Lagna (ascendant)', shortcut: 'l', keywords: 'ascendant rising lagna', active: s.selection?.kind === 'asc', run: () => { s.setSelection({ kind: 'asc' }); jumpTo('details'); } },
    ...PLANETS.map((p): Command => ({
      id: `planet.${p.id}`,
      group: 'Placements',
      title: `${p.glyph} ${p.name}`,
      hint: p.sanskrit,
      keywords: `${p.sanskrit} ${p.abbr} planet graha ${p.karaka}`,
      active: s.selection?.kind === 'planet' && s.selection.id === p.id,
      run: () => { s.setSelection({ kind: 'planet', id: p.id }); jumpTo('details'); },
    })),
    ...HOUSES.map((h): Command => ({
      id: `house.${h.num}`,
      group: 'Houses',
      title: `House ${h.num} · ${h.name}`,
      hint: h.bhava,
      keywords: `bhava ${h.bhava} ${h.themes} h${h.num}`,
      active: s.selection?.kind === 'house' && s.selection.num === h.num,
      run: () => { s.setSelection({ kind: 'house', num: h.num }); jumpTo('details'); },
    })),
    ...NAKSHATRAS.map((n, i): Command => ({
      id: `nak.${i + 1}`,
      group: 'Nakshatras',
      title: n.name,
      keywords: 'nakshatra star',
      active: s.selection?.kind === 'nakshatra' && s.selection.num === i + 1,
      run: () => { s.setSelection({ kind: 'nakshatra', num: i + 1 }); jumpTo('details'); },
    })),

    ...SECTIONS.filter((x) => !x.needs || x.needs(s.chart)).map((x): Command => ({
      id: `go.${x.id}`,
      group: 'Go to',
      title: x.title,
      keywords: `${x.keywords} scroll section view`,
      shortcut: `g ${x.key}`,
      run: () => jumpTo(x.id),
    })),
    { id: 'go.top', group: 'Go to', title: 'Top of the page', keywords: 'summary start', shortcut: 'g g', run: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
  ];
  return out;
}
