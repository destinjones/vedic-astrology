/**
 * Standalone chart renderer: one function that turns a chart into a complete,
 * self-contained SVG document (no CSS variables, no stylesheet, no fonts to
 * fetch). The same string is used for SVG download, PNG export, share cards,
 * the embed widget and the link-preview images, so they all look alike.
 *
 * Coordinates follow the on-screen charts (NorthChart / SouthChart): the
 * chart square is 400 units, and everything else is laid out around it.
 */
import type { Chart, PlanetId, VargaChart } from '../types/chart';
import { PLANET_BY_ID, signInfo, VARGAS } from '../data/constants';
import { getVarga, occupantsByHouse } from '../lib/astro';
import type { Annotation } from '../lib/annotations';
import { annotationHouse } from '../lib/annotations';

export type ChartStyleId = 'north' | 'south';
export type ExportTheme = 'dark' | 'light';

export interface ChartLabels {
  planet: (id: PlanetId) => string;
  sign: (n: number) => string;
  asc: string;
  varga: (v: VargaChart) => string;
}

export interface ChartSvgOptions {
  style: ChartStyleId;
  varga?: VargaChart;
  theme?: ExportTheme;
  /** Output width in px (height follows the layout). Default 800. */
  width?: number;
  /** Name, date, time and place above the chart. Default true. */
  header?: boolean;
  /** Notes pinned to houses and planets, numbered in the chart and listed below it. */
  annotations?: Annotation[];
  /** Planet degrees beside each planet (D1 only). Default true. */
  degrees?: boolean;
  /** A short line at the bottom, e.g. where the chart was made. */
  footer?: string;
  labels?: Partial<ChartLabels>;
}

export interface Palette {
  bgA: string; bgB: string; page: string; line: string; text: string; muted: string; faint: string;
  accent: string; asc: string; lagnaFill: string; flag: string; pin: string; pinText: string;
  planet: Record<PlanetId, string>;
}

export const PALETTES: Record<ExportTheme, Palette> = {
  dark: {
    bgA: '#1a1638', bgB: '#120f2a', page: '#0b0a1a', line: '#e8b65a', text: '#ece8f6', muted: '#a39cbf', faint: '#6f6890',
    accent: '#e8b65a', asc: '#b48cff', lagnaFill: 'rgba(180,140,255,0.10)', flag: '#f2c14e', pin: '#e8b65a', pinText: '#120f2a',
    planet: Object.fromEntries(Object.values(PLANET_BY_ID).map((p) => [p.id, p.color])) as Record<PlanetId, string>,
  },
  light: {
    bgA: '#fffdf8', bgB: '#f8f1e2', page: '#fffaf0', line: '#b8862b', text: '#2a2338', muted: '#6b6280', faint: '#9b93ad',
    accent: '#9a6a12', asc: '#6b4fb5', lagnaFill: 'rgba(184,134,43,0.12)', flag: '#a06a00', pin: '#6b4fb5', pinText: '#ffffff',
    planet: { sun: '#B4620F', moon: '#4E5D7A', mars: '#B23A2E', mercury: '#2F7D57', jupiter: '#9A7A12', venus: '#A8467F', saturn: '#3F4AA8', rahu: '#545B6A', ketu: '#8A5A33' },
  },
};

const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "Inter, 'Segoe UI', Roboto, Helvetica, Arial, 'Noto Sans Devanagari', 'Nirmala UI', sans-serif";

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const DEFAULT_LABELS: ChartLabels = {
  planet: (id) => PLANET_BY_ID[id].abbr,
  sign: (n) => signInfo(n).short,
  asc: 'Asc',
  varga: (v) => `${v.id} · ${VARGAS.find((x) => x.id === v.id)?.name ?? ''}`.replace(/ · $/, ''),
};

type Pt = [number, number];
const S = 400;
const M = S / 2;
const Q = S / 4;

export const NORTH_POLYS: Pt[][] = [
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

/** grid [col,row] of each sign in the South Indian chart (Pisces top-left, clockwise) */
export const SOUTH_CELL: Record<number, [number, number]> = {
  12: [0, 0], 1: [1, 0], 2: [2, 0], 3: [3, 0],
  4: [3, 1], 5: [3, 2], 6: [3, 3], 7: [2, 3],
  8: [1, 3], 9: [0, 3], 10: [0, 2], 11: [0, 1],
};

const centroid = (pts: Pt[]): Pt => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];

function northSignPoint(pts: Pt[]): Pt {
  const c = centroid(pts);
  const inner = pts.reduce((best, p) => (Math.hypot(p[0] - M, p[1] - M) < Math.hypot(best[0] - M, best[1] - M) ? p : best));
  const dx = c[0] - inner[0];
  const dy = c[1] - inner[1];
  const len = Math.hypot(dx, dy) || 1;
  const k = pts.length === 4 ? 22 : 18;
  return [inner[0] + (dx / len) * k, inner[1] + (dy / len) * k + 4];
}

/**
 * Where a house's planets are centred and where its note pins go, in chart
 * units. Several pins in one house are centred on `pin`, `step` apart
 * (South Indian pins line up leftward from the cell's corner instead).
 */
export function houseAnchor(style: ChartStyleId, house: number, ascSign: number): { cx: number; cy: number; perCol: number; pin: Pt; step: Pt } {
  if (style === 'north') {
    const pts = NORTH_POLYS[house - 1];
    const c = centroid(pts);
    const dist = (p: Pt) => Math.hypot(p[0] - M, p[1] - M);
    if (pts.length === 4) {
      // a diamond: between the labels and its outer corner, spread sideways
      const outer = pts.reduce((b, p) => (dist(p) > dist(b) ? p : b));
      return { cx: c[0], cy: c[1] + (house === 1 ? -8 : 0), perCol: 4, pin: [c[0] + (outer[0] - c[0]) * 0.58, c[1] + (outer[1] - c[1]) * 0.58], step: [17, 0] };
    }
    // a triangle: in the gap between the labels and the sign number, spread across the gap
    const inner = pts.reduce((b, p) => (dist(p) < dist(b) ? p : b));
    const vertical = Math.abs(inner[1] - c[1]) > Math.abs(inner[0] - c[0]);
    return { cx: c[0], cy: c[1], perCol: 3, pin: [c[0] + (inner[0] - c[0]) * 0.52, c[1] + (inner[1] - c[1]) * 0.52], step: vertical ? [17, 0] : [0, 17] };
  }
  const sign = ((ascSign - 1 + house - 1) % 12) + 1;
  const [col, row] = SOUTH_CELL[sign];
  return { cx: col * 100 + 50, cy: row * 100 + 54, perCol: 4, pin: [col * 100 + 86, row * 100 + 86], step: [-17, 0] };
}

/** How far along `step` the k-th of n pins sits. */
export const pinOffset = (style: ChartStyleId, n: number) => (k: number) => (style === 'south' ? k : k - (n - 1) / 2);

interface Item { text: string; deg?: string; flags?: string; color: string; asc?: boolean }

function stack(items: Item[], cx: number, cy: number, perCol: number, P: Palette): string {
  const cols = Math.ceil(items.length / perCol) || 1;
  const rows = Math.min(items.length, perCol);
  const lh = 16;
  const cw = 46;
  return items.map((it, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const x = cx + (col - (cols - 1) / 2) * cw;
    const y = cy + (row - (rows - 1) / 2) * lh + 4;
    const deg = it.deg ? `<tspan font-size="10.5" font-weight="400" fill="${P.muted}"> ${esc(it.deg)}</tspan>` : '';
    const flags = it.flags ? `<tspan font-size="9" font-weight="600" fill="${P.flag}" dy="-5">${esc(it.flags)}</tspan>` : '';
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="${it.asc ? 12.5 : 13.5}" font-weight="600" fill="${it.color}">${esc(it.text)}${deg}${flags}</text>`;
  }).join('');
}

function houseItems(chart: Chart, v: VargaChart, ids: PlanetId[], withAsc: boolean, L: ChartLabels, P: Palette, degrees: boolean): Item[] {
  const isD1 = v.id === 'D1';
  const out: Item[] = [];
  if (withAsc) out.push({ text: L.asc, deg: isD1 && degrees ? `${Math.floor(chart.ascendant.degreeInSign)}°` : undefined, color: P.asc, asc: true });
  for (const id of ids) {
    const p = chart.planets.find((x) => x.id === id)!;
    const node = id === 'rahu' || id === 'ketu';
    const flags = `${p.retrograde && !node ? 'R' : ''}${isD1 && p.combust ? 'c' : ''}`;
    out.push({ text: L.planet(id), deg: isD1 && degrees ? `${Math.floor(p.degreeInSign)}°` : undefined, flags: flags || undefined, color: P.planet[id] });
  }
  return out;
}

const pinMark = (x: number, y: number, n: number, P: Palette) =>
  `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="${P.pin}"/><text x="${x.toFixed(1)}" y="${(y + 3.6).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="${P.pinText}">${n}</text></g>`;

/** The 400×400 chart square as an SVG fragment (no outer <svg>). */
export function chartBody(chart: Chart, o: ChartSvgOptions & { id?: string }): string {
  const P = PALETTES[o.theme ?? 'dark'];
  const L = { ...DEFAULT_LABELS, ...o.labels };
  const v = o.varga ?? getVarga(chart, 'D1');
  const occ = occupantsByHouse(v);
  const degrees = o.degrees !== false;
  const gid = `bg-${o.id ?? 'c'}`;
  const parts: string[] = [
    `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.bgA}"/><stop offset="1" stop-color="${P.bgB}"/></linearGradient></defs>`,
    `<rect x="0" y="0" width="${S}" height="${S}" rx="6" fill="url(#${gid})"/>`,
  ];
  const lineAttrs = `stroke="${P.line}" stroke-opacity="0.75" stroke-width="1.4" fill="none"`;

  if (o.style === 'north') {
    parts.push(`<polygon points="${NORTH_POLYS[0].map((p) => p.join(',')).join(' ')}" fill="${P.lagnaFill}"/>`);
    NORTH_POLYS.forEach((pts, i) => {
      const house = i + 1;
      const sign = ((v.ascSign - 1 + i) % 12) + 1;
      const [lx, ly] = northSignPoint(pts);
      parts.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="12" fill="${P.muted}">${sign}</text>`);
      const a = houseAnchor('north', house, v.ascSign);
      parts.push(stack(houseItems(chart, v, occ[house], house === 1, L, P, degrees), a.cx, a.cy, a.perCol, P));
    });
    parts.push(`<g ${lineAttrs}><rect x="0" y="0" width="${S}" height="${S}" rx="6"/><line x1="0" y1="0" x2="${S}" y2="${S}"/><line x1="${S}" y1="0" x2="0" y2="${S}"/><polygon points="${M},0 ${S},${M} ${M},${S} 0,${M}"/></g>`);
  } else {
    for (const [s, [col, row]] of Object.entries(SOUTH_CELL)) {
      const sign = Number(s);
      const house = ((sign - v.ascSign + 12) % 12) + 1;
      const x = col * 100;
      const y = row * 100;
      if (house === 1) parts.push(`<rect x="${x}" y="${y}" width="100" height="100" fill="${P.lagnaFill}"/><line x1="${x}" y1="${y + 22}" x2="${x + 22}" y2="${y}" stroke="${P.asc}" stroke-width="1.5"/>`);
      const name = L.sign(sign);
      parts.push(`<text x="${x + 94}" y="${y + 14}" text-anchor="end" font-size="11" fill="${P.muted}">${esc(name)}</text>`);
      parts.push(`<text x="${x + 6}" y="${y + 93}" font-size="10" fill="${P.faint}">${house}</text>`);
      const a = houseAnchor('south', house, v.ascSign);
      parts.push(stack(houseItems(chart, v, occ[house], house === 1, L, P, degrees), a.cx, a.cy, a.perCol, P));
    }
    parts.push(`<text x="200" y="186" text-anchor="middle" font-size="16" font-weight="600" fill="${P.accent}">${esc(L.varga(v))}</text>`);
    parts.push(`<text x="200" y="208" text-anchor="middle" font-size="11.5" fill="${P.muted}">${esc(chart.input.name?.trim() || 'Birth chart')}</text>`);
    parts.push(`<text x="200" y="226" text-anchor="middle" font-size="11.5" fill="${P.muted}">${esc(`${chart.input.date} · ${chart.input.time.slice(0, 5)}`)}</text>`);
    parts.push(`<g ${lineAttrs}><rect x="0" y="0" width="400" height="400" rx="6"/><rect x="100" y="100" width="200" height="200"/>`
      + `<line x1="100" y1="0" x2="100" y2="400"/><line x1="300" y1="0" x2="300" y2="400"/><line x1="200" y1="0" x2="200" y2="100"/><line x1="200" y1="300" x2="200" y2="400"/>`
      + `<line x1="0" y1="100" x2="400" y2="100"/><line x1="0" y1="300" x2="400" y2="300"/><line x1="0" y1="200" x2="100" y2="200"/><line x1="300" y1="200" x2="400" y2="200"/></g>`);
  }

  // note pins: one numbered dot per note, grouped in the house it is about
  const notes = o.annotations ?? [];
  const byHouse = new Map<number, number[]>();
  notes.forEach((n, i) => {
    const h = annotationHouse(n, chart, v);
    if (h) byHouse.set(h, [...(byHouse.get(h) ?? []), i + 1]);
  });
  for (const [h, nums] of byHouse) {
    const { pin, step } = houseAnchor(o.style, h, v.ascSign);
    const at = pinOffset(o.style, nums.length);
    nums.forEach((n, k) => parts.push(pinMark(pin[0] + step[0] * at(k), pin[1] + step[1] * at(k), n, P)));
  }
  return parts.join('');
}

/** Wraps text to lines of at most `max` characters. */
export function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n+/)) {
    let line = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      if (line && (line + ' ' + w).length > max) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w;
    }
    if (line) out.push(line);
  }
  return out;
}

export interface ChartSvgResult { svg: string; width: number; height: number }

/** A complete SVG document for the chart. */
export function chartSvg(chart: Chart, o: ChartSvgOptions): ChartSvgResult {
  const P = PALETTES[o.theme ?? 'dark'];
  const L = { ...DEFAULT_LABELS, ...o.labels };
  const v = o.varga ?? getVarga(chart, 'D1');
  const pad = 24;
  const header = o.header !== false;
  const notes = o.annotations ?? [];
  const W = S + pad * 2;
  let y = pad;
  const parts: string[] = [];

  if (header) {
    const who = chart.input.name?.trim() || 'Birth chart';
    parts.push(`<text x="${pad}" y="${y + 22}" font-family="${SERIF}" font-size="26" font-weight="600" fill="${P.text}">${esc(who)}</text>`);
    parts.push(`<text x="${W - pad}" y="${y + 21}" text-anchor="end" font-size="13" font-weight="600" fill="${P.accent}">${esc(L.varga(v))}</text>`);
    parts.push(`<text x="${pad}" y="${y + 42}" font-size="11.5" fill="${P.muted}">${esc(`${chart.input.date} · ${chart.input.time.slice(0, 5)} · ${chart.input.place}`)}</text>`);
    y += 56;
  }
  parts.push(`<g transform="translate(${pad},${y})">${chartBody(chart, { ...o, varga: v })}</g>`);
  y += S;

  if (notes.length) {
    y += 22;
    parts.push(`<text x="${pad}" y="${y}" font-family="${SERIF}" font-size="17" font-weight="600" fill="${P.text}">Notes</text>`);
    y += 8;
    notes.forEach((n, i) => {
      const lines = wrap(`${n.title ? n.title + ': ' : ''}${n.text}`, 62);
      y += 18;
      parts.push(pinMark(pad + 8, y - 4, i + 1, P));
      lines.forEach((ln, k) => {
        parts.push(`<text x="${pad + 24}" y="${y + k * 15}" font-size="12" fill="${P.text}">${esc(ln)}</text>`);
      });
      y += (lines.length - 1) * 15;
    });
  }

  if (o.footer) {
    y += 26;
    parts.push(`<text x="${W / 2}" y="${y}" text-anchor="middle" font-size="10" fill="${P.faint}">${esc(o.footer)}</text>`);
  }
  y += pad - (o.footer ? 8 : 0);

  const width = o.width ?? 800;
  const height = Math.round((y / W) * width);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${W} ${y}" font-family="${SANS}">`
    + `<title>${esc(`${chart.input.name?.trim() || 'Birth chart'}: ${L.varga(v)}`)}</title>`
    + `<rect width="${W}" height="${y}" fill="${P.page}"/>${parts.join('')}</svg>`;
  return { svg, width, height };
}
