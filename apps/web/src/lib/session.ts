/**
 * Session mode and the multi-chart dashboard: the talking points an astrologer lines up for a
 * client, and the arrangement of charts on the dashboard. Both are kept in this browser only.
 *
 * Talking points are kept per client tab under their own key, so they never mix with the tab's
 * private notes and history (those live in vedic.tabs.v1 and are never shown in a session).
 */
import { DASHA_ORDER, DASHA_TOTAL_YEARS, DASHA_YEARS } from '@vedic/engine';
import type { Chart, DashaPeriod, PlanetId, VargaChart, VargaId } from '../types/chart';
import type { Selection } from '../types/ui';
import { NAKSHATRAS, PLANET_BY_ID, signInfo, VARGAS } from '../data/constants';

/* ------------------------------------------------------------------ session points */

export interface SessionPoint {
  id: string;
  /** Shown to the client, e.g. "Moon in Rohini". */
  title: string;
  /** Shown to the client under the title. */
  text: string;
  /** Only for the astrologer: never drawn in the client view. */
  cue?: string;
  /** The chart the point is about. */
  varga: VargaId;
  /** What the chart highlights while the point is up. */
  select?: Selection;
}

export interface SessionPrefs {
  /** Show the client's name at the top of the client view. */
  showName: boolean;
  /** Show the birth date, time and place. Off by default: the screen may be recorded. */
  showBirth: boolean;
  /** Show the list of points so the client can see what is coming. */
  showAgenda: boolean;
}

export const DEFAULT_SESSION_PREFS: SessionPrefs = { showName: true, showBirth: false, showAgenda: true };

const POINTS_KEY = 'vedic.session.v1';
const PREFS_KEY = 'vedic.session.prefs.v1';

const VARGA_IDS = new Set<string>(VARGAS.map((v) => v.id));
const isVarga = (x: unknown): x is VargaId => typeof x === 'string' && VARGA_IDS.has(x);

function validSelection(s: unknown): Selection | undefined {
  if (!s || typeof s !== 'object') return undefined;
  const o = s as Record<string, unknown>;
  if (o.kind === 'asc') return { kind: 'asc' };
  if (o.kind === 'planet' && typeof o.id === 'string' && o.id in PLANET_BY_ID) return { kind: 'planet', id: o.id as PlanetId };
  if ((o.kind === 'house' || o.kind === 'nakshatra') && typeof o.num === 'number') return { kind: o.kind, num: o.num };
  return undefined;
}

/** Drops anything malformed, so a hand-edited or old store never breaks the view. */
export function cleanPoints(list: unknown): SessionPoint[] {
  if (!Array.isArray(list)) return [];
  return list.flatMap((p): SessionPoint[] => {
    if (!p || typeof p !== 'object') return [];
    const o = p as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.title !== 'string') return [];
    return [{
      id: o.id,
      title: o.title,
      text: typeof o.text === 'string' ? o.text : '',
      cue: typeof o.cue === 'string' && o.cue ? o.cue : undefined,
      varga: isVarga(o.varga) ? o.varga : 'D1',
      select: validSelection(o.select),
    }];
  });
}

function readJson(key: string): unknown {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

export function loadPoints(tabId: string): SessionPoint[] {
  const all = readJson(POINTS_KEY) as Record<string, unknown> | null;
  return cleanPoints(all?.[tabId]);
}

export function storePoints(tabId: string, points: SessionPoint[]) {
  const all = { ...((readJson(POINTS_KEY) as Record<string, unknown> | null) ?? {}) };
  if (points.length) all[tabId] = points; else delete all[tabId];
  writeJson(POINTS_KEY, all);
}

export function loadSessionPrefs(): SessionPrefs {
  const o = (readJson(PREFS_KEY) ?? {}) as Partial<SessionPrefs>;
  return {
    showName: typeof o.showName === 'boolean' ? o.showName : DEFAULT_SESSION_PREFS.showName,
    showBirth: typeof o.showBirth === 'boolean' ? o.showBirth : DEFAULT_SESSION_PREFS.showBirth,
    showAgenda: typeof o.showAgenda === 'boolean' ? o.showAgenda : DEFAULT_SESSION_PREFS.showAgenda,
  };
}
export const storeSessionPrefs = (p: SessionPrefs) => writeJson(PREFS_KEY, p);

let seq = 0;
export const newId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * A point drafted from what the astrologer clicked: a title such as "Moon in Rohini" and a
 * one-line fact under it that they can rewrite in their own words.
 */
export function draftPoint(chart: Chart, varga: VargaChart, sel: Selection | null): Omit<SessionPoint, 'id'> {
  const vname = VARGAS.find((v) => v.id === varga.id)?.name ?? varga.id;
  const inChart = varga.id === 'D1' ? '' : ` in the ${vname} (${varga.id})`;
  if (sel?.kind === 'planet') {
    const info = PLANET_BY_ID[sel.id];
    const pl = varga.planets[sel.id];
    if (varga.id === 'D1') {
      const pos = chart.planets.find((p) => p.id === sel.id)!;
      const nak = NAKSHATRAS[pos.nakshatra - 1]?.name ?? '';
      return {
        title: `${info.name} in ${nak}`,
        text: `${info.name} sits in ${signInfo(pos.sign).name}, in your ${ordinal(pl.house)} house${pos.retrograde && sel.id !== 'rahu' && sel.id !== 'ketu' ? ', moving retrograde' : ''}.`,
        varga: varga.id, select: sel,
      };
    }
    return {
      title: `${info.name}${inChart}`,
      text: `${info.name} falls in ${signInfo(pl.sign).name}, the ${ordinal(pl.house)} house of this chart.`,
      varga: varga.id, select: sel,
    };
  }
  if (sel?.kind === 'house') {
    const sign = signInfo(((varga.ascSign - 1 + sel.num - 1) % 12) + 1);
    const occupants = (Object.keys(varga.planets) as PlanetId[]).filter((id) => varga.planets[id].house === sel.num).map((id) => PLANET_BY_ID[id].name);
    return {
      title: `Your ${ordinal(sel.num)} house${inChart}`,
      text: `${sign.name} on the ${ordinal(sel.num)} house${occupants.length ? `, holding ${listJoin(occupants)}` : ', with no planets in it'}.`,
      varga: varga.id, select: sel,
    };
  }
  if (sel?.kind === 'nakshatra') {
    const nak = NAKSHATRAS[sel.num - 1];
    return { title: `${nak?.name ?? 'Nakshatra'}`, text: '', varga: varga.id, select: sel };
  }
  const asc = signInfo(varga.id === 'D1' ? chart.ascendant.sign : varga.ascSign);
  return { title: `${asc.name} rising${inChart}`, text: `Your lagna is ${asc.name}.`, varga: varga.id, select: { kind: 'asc' } };
}

const listJoin = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Moves the item at `from` to `to`, leaving the list as it was if either is out of range. */
export function move<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const next = list.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

/* ------------------------------------------------------------------ dasha now */

/** Vimshottari sub-periods (BPHS 46): nine parts from the period's own lord, each parent × years / 120. */
export function vimshottariSubs(p: DashaPeriod): DashaPeriod[] {
  if (p.sub?.length) return p.sub;
  const a = Date.parse(p.start), b = Date.parse(p.end);
  const i0 = DASHA_ORDER.indexOf(p.lord);
  let t = a;
  return DASHA_ORDER.map((_, k) => {
    const lord = DASHA_ORDER[(i0 + k) % 9];
    const e = k === 8 ? b : t + ((b - a) * DASHA_YEARS[lord]) / DASHA_TOTAL_YEARS;
    const d: DashaPeriod = { lord, start: new Date(t).toISOString(), end: new Date(e).toISOString() };
    t = e;
    return d;
  });
}

const running = (list: DashaPeriod[], at: number) => list.find((p) => Date.parse(p.start) <= at && at < Date.parse(p.end));

/** The maha, antar and pratyantar dasha running at `at`, outermost first. */
export function dashaChain(dasha: DashaPeriod[] | undefined, at: number = Date.now(), depth = 3): DashaPeriod[] {
  const chain: DashaPeriod[] = [];
  let level = dasha ?? [];
  for (let i = 0; i < depth; i++) {
    const p = running(level, at);
    if (!p) break;
    chain.push(p);
    level = vimshottariSubs(p);
  }
  return chain;
}

/* ------------------------------------------------------------------ dashboard layout */

export type PanelKind = VargaId | 'dasha-now' | 'dasha' | 'planets';

export interface Panel {
  id: string;
  kind: PanelKind;
  /** Takes two columns. */
  wide?: boolean;
}

export interface DashboardLayout {
  columns: 2 | 3 | 4;
  panels: Panel[];
}

export interface NamedLayout { name: string; layout: DashboardLayout }

export const PANEL_KINDS: { kind: PanelKind; label: string }[] = [
  ...VARGAS.map((v) => ({ kind: v.id as PanelKind, label: `${v.id} ${v.name}` })),
  { kind: 'dasha-now', label: 'Dasha now' },
  { kind: 'dasha', label: 'Dasha timeline' },
  { kind: 'planets', label: 'Planet positions' },
];
const KINDS = new Set<string>(PANEL_KINDS.map((k) => k.kind));

const layoutOf = (kinds: PanelKind[], columns: DashboardLayout['columns'] = 4): DashboardLayout =>
  ({ columns, panels: kinds.map((kind, i) => ({ id: `d${i}`, kind })) });

/** Ready-made arrangements; the first is the default. */
export const PRESET_LAYOUTS: NamedLayout[] = [
  { name: 'Core: D1, D9, D10, dasha', layout: layoutOf(['D1', 'D9', 'D10', 'dasha-now']) },
  { name: 'Marriage: D1, D9, D7, dasha', layout: layoutOf(['D1', 'D9', 'D7', 'dasha-now']) },
  { name: 'Career: D1, D10, D9, D24', layout: layoutOf(['D1', 'D10', 'D9', 'D24']) },
  { name: 'Wealth: D1, D2, D4, dasha', layout: layoutOf(['D1', 'D2', 'D4', 'dasha-now']) },
  { name: 'Six charts', layout: layoutOf(['D1', 'D9', 'D10', 'D7', 'D12', 'dasha-now'], 3) },
];
export const DEFAULT_LAYOUT = PRESET_LAYOUTS[0].layout;

export const MAX_PANELS = 12;

export function cleanLayout(x: unknown): DashboardLayout {
  if (!x || typeof x !== 'object') return DEFAULT_LAYOUT;
  const o = x as Record<string, unknown>;
  const columns = o.columns === 2 || o.columns === 3 || o.columns === 4 ? o.columns : 4;
  const seen = new Set<string>();
  const panels = (Array.isArray(o.panels) ? o.panels : []).flatMap((p): Panel[] => {
    if (!p || typeof p !== 'object') return [];
    const q = p as Record<string, unknown>;
    if (typeof q.id !== 'string' || seen.has(q.id) || typeof q.kind !== 'string' || !KINDS.has(q.kind)) return [];
    seen.add(q.id);
    return [{ id: q.id, kind: q.kind as PanelKind, ...(q.wide === true ? { wide: true } : {}) }];
  }).slice(0, MAX_PANELS);
  return panels.length ? { columns, panels } : DEFAULT_LAYOUT;
}

const LAYOUT_KEY = 'vedic.dashboard.v1';
const SAVED_KEY = 'vedic.dashboard.saved.v1';

export const loadLayout = () => cleanLayout(readJson(LAYOUT_KEY));
export const storeLayout = (l: DashboardLayout) => writeJson(LAYOUT_KEY, l);

export function loadSavedLayouts(): NamedLayout[] {
  const list = readJson(SAVED_KEY);
  if (!Array.isArray(list)) return [];
  return list.flatMap((x): NamedLayout[] =>
    x && typeof x === 'object' && typeof (x as NamedLayout).name === 'string' && (x as NamedLayout).name.trim()
      ? [{ name: (x as NamedLayout).name.trim(), layout: cleanLayout((x as NamedLayout).layout) }]
      : []);
}
export const storeSavedLayouts = (l: NamedLayout[]) => writeJson(SAVED_KEY, l);

/** Saves a layout under a name, replacing one with the same name. */
export function upsertLayout(list: NamedLayout[], name: string, layout: DashboardLayout): NamedLayout[] {
  const n = name.trim();
  if (!n) return list;
  const rest = list.filter((x) => x.name.toLowerCase() !== n.toLowerCase());
  return [...rest, { name: n, layout }];
}
