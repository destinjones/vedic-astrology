import type { Chart, PlanetId, VargaChart } from '../types/chart';
import { PLANET_BY_ID, signInfo } from '../data/constants';
import { ART } from '../data/art';
import type { ReportDoc } from './doc';
import type { Img } from './assets';
import { C, F } from './theme';

type Pt = [number, number];

const occupants = (v: VargaChart) => {
  const m: Record<number, PlanetId[]> = {};
  for (let h = 1; h <= 12; h++) m[h] = [];
  (Object.keys(v.planets) as PlanetId[]).forEach((id) => m[v.planets[id].house].push(id));
  return m;
};

const label = (chart: Chart, v: VargaChart, id: PlanetId, degrees: boolean) => {
  const p = chart.planets.find((x) => x.id === id)!;
  let s = PLANET_BY_ID[id].abbr;
  if (degrees) s += ` ${Math.floor(p.degreeInSign)}°`;
  if (p.retrograde && id !== 'rahu' && id !== 'ketu') s += ' R';
  return v.id === 'D1' && p.combust ? `${s} c` : s;
};

/** North Indian diamond chart. Houses are fixed; the lagna is the top diamond. */
export function northChart(doc: ReportDoc, chart: Chart, v: VargaChart, x: number, y: number, S: number, o: { degrees?: boolean; title?: string } = {}) {
  const { pdf } = doc;
  const M = S / 2;
  const Q = S / 4;
  const polys: Pt[][] = [
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
  doc.fill('#FFFDF8').pdf.rect(x, y, S, S, 'F');
  doc.fill(C.goldPale).polygon(polys[0].map(([a, b]) => [x + a, y + b]), 'F');
  doc.stroke(C.gold, Math.max(0.5, S / 400));
  pdf.rect(x, y, S, S, 'S');
  pdf.line(x, y, x + S, y + S);
  pdf.line(x + S, y, x, y + S);
  doc.polygon([[x + M, y], [x + S, y + M], [x + M, y + S], [x, y + M]], 'S');

  const occ = occupants(v);
  const fs = Math.max(5.6, S / 30);
  polys.forEach((pts, i) => {
    const h = i + 1;
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    // sign number tucked toward the centre of the chart
    const inner = pts.reduce((b, p) => (Math.hypot(p[0] - M, p[1] - M) < Math.hypot(b[0] - M, b[1] - M) ? p : b));
    const d = Math.hypot(cx - inner[0], cy - inner[1]) || 1;
    const k = (pts.length === 4 ? 0.105 : 0.055) * S;
    const sx = inner[0] + ((cx - inner[0]) / d) * k;
    const sy = inner[1] + ((cy - inner[1]) / d) * k;
    const sign = ((v.ascSign - 1 + h - 1) % 12) + 1;
    doc.line(String(sign), x + sx, y + sy - fs * 0.45, { font: F.sans, size: fs * 0.82, color: C.faint, align: 'center' });
    const ids = occ[h];
    const items = h === 1 ? ['Asc', ...ids.map((id) => label(chart, v, id, !!o.degrees))] : ids.map((id) => label(chart, v, id, !!o.degrees));
    const colors = h === 1 ? [C.gold, ...ids.map((id) => PLANET_TEXT[id])] : ids.map((id) => PLANET_TEXT[id]);
    const lh = fs * 1.22;
    const tri = pts.length === 3;
    // triangles are widest at their outer edge but the centroid hugs it; pull labels toward the inner vertex
    const ox = tri ? (inner[0] - cx) * 0.2 : 0;
    const oy = tri ? (inner[1] - cy) * 0.2 : (h === 1 ? -S * 0.03 : h === 7 ? S * 0.03 : 0);
    const perCol = tri ? (Math.abs(inner[1] - cy) > Math.abs(inner[0] - cx) ? 2 : 4) : 4;
    const ncol = Math.ceil(items.length / perCol);
    items.forEach((t, j) => {
      const col = Math.floor(j / perCol);
      const row = j % perCol;
      const rows = Math.min(perCol, items.length - col * perCol);
      const px = x + cx + ox + (col - (ncol - 1) / 2) * fs * (o.degrees ? 3.6 : 2.4);
      const py = y + cy + oy + (row - (rows - 1) / 2) * lh - fs * 0.5;
      doc.line(t, px, py, { font: F.sansBold, size: fs, color: colors[j], align: 'center' });
    });
  });
  if (o.title) doc.line(o.title, x + S / 2, y + S + 6, { font: F.serifBold, size: Math.max(9, S / 18), color: C.ink, align: 'center' });
}

/** Darker versions of the site's planet colours, readable on paper. */
export const PLANET_TEXT: Record<PlanetId, string> = {
  sun: '#B4620F', moon: '#4E5D7A', mars: '#B23A2E', mercury: '#2F7D57', jupiter: '#9A7A12',
  venus: '#A8467F', saturn: '#3F4AA8', rahu: '#545B6A', ketu: '#8A5A33',
};

/** South Indian chart: signs are fixed, Pisces top-left, running clockwise. */
export function southChart(doc: ReportDoc, chart: Chart, v: VargaChart, x: number, y: number, S: number, o: { degrees?: boolean; title?: string; centre?: string[] } = {}) {
  const { pdf } = doc;
  const c = S / 4;
  const cell: Record<number, [number, number]> = {
    12: [0, 0], 1: [1, 0], 2: [2, 0], 3: [3, 0], 4: [3, 1], 5: [3, 2],
    6: [3, 3], 7: [2, 3], 8: [1, 3], 9: [0, 3], 10: [0, 2], 11: [0, 1],
  };
  doc.fill('#FFFDF8').pdf.rect(x, y, S, S, 'F');
  const [ax, ay] = cell[v.ascSign];
  doc.fill(C.goldPale).pdf.rect(x + ax * c, y + ay * c, c, c, 'F');
  doc.stroke(C.gold, Math.max(0.5, S / 400));
  for (let i = 0; i <= 4; i++) {
    const top = i === 2 ? [1, 3] : null;
    if (top) {
      pdf.line(x, y + i * c, x + c, y + i * c);
      pdf.line(x + 3 * c, y + i * c, x + S, y + i * c);
      pdf.line(x + i * c, y, x + i * c, y + c);
      pdf.line(x + i * c, y + 3 * c, x + i * c, y + S);
    } else {
      pdf.line(x, y + i * c, x + S, y + i * c);
      pdf.line(x + i * c, y, x + i * c, y + S);
    }
  }
  // lagna mark: a diagonal across the corner of its cell
  pdf.line(x + ax * c, y + ay * c + c * 0.28, x + ax * c + c * 0.28, y + ay * c);
  const occ = occupants(v);
  const fs = Math.max(5.6, S / 30);
  for (let sign = 1; sign <= 12; sign++) {
    const [cx, cy] = cell[sign];
    const house = ((sign - v.ascSign + 12) % 12) + 1;
    doc.line(signInfo(sign).short, x + cx * c + c - 4, y + cy * c + 4, { font: F.sans, size: fs * 0.8, color: C.faint, align: 'right' });
    const ids = occ[house];
    const items = ids.map((id) => label(chart, v, id, !!o.degrees));
    const lh = fs * 1.22;
    const twoCol = items.length > 4;
    items.forEach((t, j) => {
      const col = twoCol ? j % 2 : 0;
      const row = twoCol ? Math.floor(j / 2) : j;
      const rows = twoCol ? Math.ceil(items.length / 2) : items.length;
      const px = x + cx * c + c / 2 + (twoCol ? (col - 0.5) * c * 0.48 : 0);
      const py = y + cy * c + c / 2 + (row - (rows - 1) / 2) * lh - fs * 0.35;
      doc.line(t, px, py, { font: F.sansBold, size: fs, color: PLANET_TEXT[ids[j]], align: 'center' });
    });
  }
  const centre = o.centre ?? [];
  centre.forEach((t, i) => doc.line(t, x + S / 2, y + S / 2 + (i - (centre.length - 1) / 2) * fs * 1.6 - fs * 0.6, {
    font: i === 0 ? F.serifBold : F.sans, size: i === 0 ? fs * 1.6 : fs * 0.95, color: i === 0 ? C.ink : C.muted, align: 'center',
  }));
  if (o.title) doc.line(o.title, x + S / 2, y + S + 6, { font: F.serifBold, size: Math.max(9, S / 18), color: C.ink, align: 'center' });
}

/**
 * The Blender wheel plate (already rotated so the ascendant is at 9 o'clock)
 * with each graha's artwork set on the graha track at its true longitude.
 */
export function wheelWithPlanets(doc: ReportDoc, chart: Chart, wheel: Img, graha: Record<PlanetId, Img>, x: number, y: number, size: number) {
  const { pdf } = doc;
  pdf.addImage(wheel.data, 'JPEG', x, y, size, size, wheel.alias, 'FAST');
  const cx = x + size / 2;
  const cy = y + size / 2;
  const unit = size / 20.4;
  const r = ART.radii;
  const asc = chart.ascendant.longitude;
  const ang = (lon: number) => ((lon - asc + 180) * Math.PI) / 180;
  const pos = (lon: number, rad: number): Pt => [cx + rad * unit * Math.cos(ang(lon)), cy - rad * unit * Math.sin(ang(lon))];

  // ascendant line from hub to rim
  const [ax0, ay0] = pos(asc, 2.6);
  const [ax1, ay1] = pos(asc, 10.15);
  doc.stroke(C.gold, 1.2);
  pdf.line(ax0, ay0, ax1, ay1);
  const [lx, ly] = pos(asc, 10.5);
  doc.line('ASC', lx - 4, ly - 4, { font: F.sansBold, size: 7, color: C.gold, align: 'right', charSpace: 0.8 });

  // spread planets that sit close together along the track
  const sorted = [...chart.planets].sort((a, b) => a.longitude - b.longitude);
  const track = (r.grahaTrackInner + r.grahaTrackOuter) / 2;
  const minSep = 9;
  const lanes: number[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    const close = prev && Math.abs(p.longitude - prev.longitude) < minSep;
    lanes.push(close ? (lanes[i - 1] + 1) % 3 : 0);
  });
  const sprite = unit * 1.05;
  sorted.forEach((p, i) => {
    const rad = track + [0, -0.62, 0.62][lanes[i]] * (lanes[i] ? 1 : 0);
    const [px, py] = pos(p.longitude, rad);
    const img = graha[p.id];
    doc.fill(C.night).pdf.circle(px, py, sprite * 0.62, 'F');
    pdf.addImage(img.data, 'JPEG', px - sprite / 2, py - sprite / 2, sprite, sprite, img.alias, 'FAST');
    doc.stroke(C.goldLight, 0.5).pdf.circle(px, py, sprite * 0.62, 'S');
    // tick on the inner edge of the rashi ring at the exact degree
    const [t0x, t0y] = pos(p.longitude, r.rashiInner - 0.02);
    const [t1x, t1y] = pos(p.longitude, r.rashiInner + 0.35);
    doc.stroke(C.goldLight, 0.8).pdf.line(t0x, t0y, t1x, t1y);
  });
}

/** Label list next to the wheel, so every sprite can be identified. */
export function wheelKey(doc: ReportDoc, chart: Chart, graha: Record<PlanetId, Img>, x: number, y: number, w: number) {
  const ids: PlanetId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];
  ids.forEach((id, i) => {
    const p = chart.planets.find((q) => q.id === id)!;
    const ty = y + i * 26;
    const img = graha[id];
    doc.fill(C.night).pdf.circle(x + 9, ty + 9, 10, 'F');
    doc.pdf.addImage(img.data, 'JPEG', x + 1, ty + 1, 16, 16, img.alias, 'FAST');
    const info = PLANET_BY_ID[id];
    doc.line(`${info.name}`, x + 26, ty + 1, { font: F.serifBold, size: 11, color: C.ink });
    doc.line(`${signInfo(p.sign).name} ${Math.floor(p.degreeInSign)}°${String(Math.floor((p.degreeInSign % 1) * 60)).padStart(2, '0')}′`, x + w, ty + 3, { font: F.sans, size: 7.6, color: C.muted, align: 'right' });
  });
}

export interface SeriesPt { t: number; v: number }

/**
 * Area chart around a zero line: green above, terracotta below, with year ticks
 * and an optional "today" marker. Values are -100..100.
 */
export function weatherChart(doc: ReportDoc, pts: SeriesPt[], x: number, y: number, w: number, h: number, o: { today?: number; bands?: { from: number; to: number; label: string; color: string }[] } = {}) {
  const { pdf } = doc;
  if (!pts.length) return;
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const max = Math.max(40, ...pts.map((p) => Math.abs(p.v)));
  const X = (t: number) => x + ((t - t0) / (t1 - t0)) * w;
  const Y = (v: number) => y + h / 2 - (v / max) * (h / 2 - 4);
  doc.fill('#FFFDF8').pdf.rect(x, y, w, h, 'F');
  for (const b of o.bands ?? []) {
    const bx = X(Math.max(t0, b.from));
    const bw = X(Math.min(t1, b.to)) - bx;
    if (bw <= 0) continue;
    doc.fill(b.color).opacity(0.13).pdf.rect(bx, y, bw, h, 'F');
    doc.opacity(1);
  }
  // filled bars per sample: simple and robust
  const bw = w / pts.length + 0.3;
  pts.forEach((p) => {
    const px = X(p.t);
    const top = Y(Math.max(0, p.v));
    const bot = Y(Math.min(0, p.v));
    doc.fill(p.v >= 0 ? C.good : C.bad).opacity(0.22 + Math.min(0.55, Math.abs(p.v) / 120)).pdf.rect(px - bw / 2, top, bw, Math.max(0.2, bot - top), 'F');
  });
  doc.opacity(1);
  // outline
  doc.stroke(C.ink, 0.7);
  for (let i = 1; i < pts.length; i++) pdf.line(X(pts[i - 1].t), Y(pts[i - 1].v), X(pts[i].t), Y(pts[i].v));
  doc.stroke(C.faint, 0.4).pdf.line(x, Y(0), x + w, Y(0));
  doc.stroke(C.rule, 0.5).pdf.rect(x, y, w, h, 'S');
  // year ticks
  const y0 = new Date(t0).getUTCFullYear();
  const y1 = new Date(t1).getUTCFullYear();
  for (let yr = y0 + 1; yr <= y1; yr++) {
    const t = Date.UTC(yr, 0, 1);
    const tx = X(t);
    doc.stroke(C.rule, 0.4).pdf.line(tx, y, tx, y + h);
    doc.line(String(yr), tx, y + h + 4, { font: F.sans, size: 6.8, color: C.muted, align: 'center' });
  }
  if (o.today && o.today > t0 && o.today < t1) {
    const tx = X(o.today);
    doc.stroke(C.gold, 1).pdf.line(tx, y - 4, tx, y + h);
    doc.line('TODAY', tx, y - 12, { font: F.sansBold, size: 6, color: C.gold, align: 'center', charSpace: 0.8 });
  }
  doc.line('+ supportive', x + 4, y + 3, { font: F.sans, size: 6.4, color: C.good });
  doc.line('− demanding', x + 4, y + h - 11, { font: F.sans, size: 6.4, color: C.bad });
}

export interface Span { from: number; to: number; label: string; score: number; sub?: string }

/** A life-long band of periods, coloured by score. */
export function spanBar(doc: ReportDoc, spans: Span[], x: number, y: number, w: number, h: number, o: { today?: number; years?: boolean } = {}) {
  if (!spans.length) return;
  const t0 = spans[0].from;
  const t1 = spans[spans.length - 1].to;
  const X = (t: number) => x + ((t - t0) / (t1 - t0)) * w;
  spans.forEach((s) => {
    const a = X(s.from);
    const b = X(s.to);
    const col = s.score >= 15 ? C.good : s.score <= -15 ? C.bad : C.mixed;
    doc.fill(col).opacity(0.18 + Math.min(0.62, Math.abs(s.score) / 90)).pdf.rect(a, y, b - a, h, 'F');
    doc.opacity(1);
    doc.stroke('#FFFFFF', 0.8).pdf.line(b, y, b, y + h);
    if (b - a > 16) doc.line(s.label, (a + b) / 2, y + h / 2 - 4, { font: F.sansBold, size: 7.2, color: C.ink, align: 'center' });
    if (s.sub && b - a > 26) doc.line(s.sub, (a + b) / 2, y + h + 3, { font: F.sans, size: 6, color: C.muted, align: 'center' });
  });
  doc.stroke(C.rule, 0.5).pdf.rect(x, y, w, h, 'S');
  if (o.today && o.today > t0 && o.today < t1) {
    const tx = X(o.today);
    doc.stroke(C.ink, 1.2).pdf.line(tx, y - 5, tx, y + h + 2);
    doc.diamond(tx, y - 7, 2.6, C.gold);
  }
}

/** Sarvashtakavarga bars, one per sign, with the 28-bindu average line. */
export function savBars(doc: ReportDoc, sav: number[], ascSign: number, x: number, y: number, w: number, h: number) {
  const max = Math.max(40, ...sav);
  const bw = w / 12;
  doc.fill('#FFFDF8').pdf.rect(x, y, w, h, 'F');
  for (let i = 0; i < 12; i++) {
    const sign = ((ascSign - 1 + i) % 12) + 1;
    const v = sav[sign - 1];
    const bh = (v / max) * (h - 18);
    const col = v >= 30 ? C.good : v < 25 ? C.bad : C.mixed;
    doc.fill(col).opacity(0.75).pdf.rect(x + i * bw + bw * 0.18, y + h - 18 - bh, bw * 0.64, bh, 'F');
    doc.opacity(1);
    doc.line(String(v), x + i * bw + bw / 2, y + h - 18 - bh - 10, { font: F.sansBold, size: 7, color: C.ink, align: 'center' });
    doc.line(`${i + 1} · ${signInfo(sign).short}`, x + i * bw + bw / 2, y + h - 12, { font: F.sans, size: 6.4, color: C.muted, align: 'center' });
  }
  const ly = y + h - 18 - (28 / max) * (h - 18);
  doc.stroke(C.gold, 0.6);
  doc.pdf.setLineDashPattern([2, 2], 0);
  doc.pdf.line(x, ly, x + w, ly);
  doc.pdf.setLineDashPattern([], 0);
  doc.line('average 28', x + w - 2, ly - 9, { font: F.sans, size: 6, color: C.gold, align: 'right' });
}
