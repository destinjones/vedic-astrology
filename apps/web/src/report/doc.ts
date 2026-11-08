import type { jsPDF } from 'jspdf';
import { C, CONTENT_W, F, MARGIN, PAGE, type FontName } from './theme';
import { hasIndic, indicFace, INDIC_SCALE, runs, type IndicFonts } from './indic';

/**
 * A small flow-layout layer over jsPDF: a cursor that moves down the page,
 * text that wraps and breaks across pages (and columns), plus the report's
 * recurring pieces (headings, callouts, tables, ornaments).
 *
 * Coordinates are PDF points from the top-left. `y` is the top of the next block.
 */

type PageKind = 'cover' | 'opener' | 'interior' | 'full';

export interface TocEntry { level: 1 | 2; title: string; page: number; numeral?: string }

export interface TextOpts {
  font?: FontName;
  size?: number;
  color?: string;
  /** Line height as a multiple of size. */
  leading?: number;
  x?: number;
  width?: number;
  align?: 'left' | 'center' | 'right';
  /** Extra space after the block. */
  after?: number;
  charSpace?: number;
}

export interface Column {
  header: string;
  /** Points, or a fraction of the table width when <= 1. */
  width: number;
  align?: 'left' | 'right' | 'center';
  font?: FontName;
}
export interface Cell { text: string; color?: string; font?: FontName; fill?: string }
export type Row = (string | Cell)[];

/**
 * The embedded Latin fonts are latin subsets. Swap the few symbols the readings
 * use and drop any other glyph the fonts lack, rather than printing empty boxes.
 * Indian scripts are drawn with Noto faces (see indic.ts).
 */
export const printable = (t: string) =>
  t.replace(/→/g, '–').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[\u2190-\u2211\u2213-\u2BFF\u{1F300}-\u{1FAFF}\uFE0E\uFE0F]/gu, '');

let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

export class ReportDoc {
  readonly pdf: jsPDF;
  y: number = MARGIN.top;
  readonly toc: TocEntry[] = [];
  private pageKinds: PageKind[] = [];
  private running: string[] = [];
  private runningNow = '';
  private frame: { x: number; w: number } = { x: MARGIN.left, w: CONTENT_W };
  private cols: { n: number; i: number; gap: number; top: number } = { n: 1, i: 0, gap: 0, top: MARGIN.top };
  readonly owner: string;
  private readonly indic?: IndicFonts;
  /**
   * Print bleed in points. The jsPDF page must then be PAGE plus twice the bleed:
   * every page is shifted by the bleed, so all layout keeps its trim coordinates,
   * and full-page backgrounds run past the trim edge.
   */
  readonly bleed: number;
  /** Book mode: chapter openers always start on a right-hand (odd) page. */
  readonly recto: boolean;
  /** Fills the left-hand page left over before a recto chapter (a notes page, say). It must add exactly one page. Blank when unset. */
  filler?: (doc: ReportDoc) => void;
  /** Printed small at the foot of every numbered page: the astrologer's name and contact details, when the PDF is branded. */
  readonly footer?: [string, string];

  constructor(pdf: jsPDF, owner: string, indic?: IndicFonts, o: { bleed?: number; recto?: boolean; footer?: [string, string] } = {}) {
    this.pdf = pdf;
    this.owner = owner;
    this.footer = o.footer;
    this.indic = indic;
    this.bleed = o.bleed ?? 0;
    this.recto = !!o.recto;
    if (this.bleed) this.shift();
  }

  /** Move the page origin to the trim corner (PDF space is bottom-up, so down is negative). */
  private shift() {
    (this.pdf as unknown as { internal: { write: (s: string) => void } }).internal.write(`1 0 0 1 ${this.bleed.toFixed(3)} ${(-this.bleed).toFixed(3)} cm`);
  }

  // ------------------------------------------------------------------ basics

  get page() { return this.pdf.getNumberOfPages(); }
  get x() { return this.frame.x; }
  get w() { return this.frame.w; }
  get bottom() { return PAGE.h - MARGIN.bottom; }
  get room() { return this.bottom - this.y; }

  font(name: FontName, size: number, color: string = C.body) {
    this.pdf.setFont(name, 'normal');
    this.pdf.setFontSize(size);
    this.pdf.setTextColor(color);
    return this;
  }

  width(text: string, name?: FontName, size?: number) {
    if (hasIndic(text)) {
      const pdf = this.pdf as unknown as { getFont: () => { fontName: FontName }; getFontSize: () => number };
      return this.runsWidth(this.pieces(text, name ?? pdf.getFont().fontName, size ?? pdf.getFontSize()));
    }
    if (name) this.pdf.setFont(name, 'normal');
    if (size) this.pdf.setFontSize(size);
    return this.pdf.getTextWidth(text);
  }

  wrap(text: string, width: number, name: FontName, size: number): string[] {
    text = printable(text);
    if (hasIndic(text)) return this.wrapMixed(text, width, name, size);
    this.pdf.setFont(name, 'normal');
    this.pdf.setFontSize(size);
    return this.pdf.splitTextToSize(text, width) as string[];
  }

  /** Draw one line with its top at `top`. */
  line(text: string, x: number, top: number, o: TextOpts = {}) {
    const size = o.size ?? 9.5;
    const name = o.font ?? F.sans;
    this.font(name, size, o.color ?? C.body);
    text = printable(text);
    if (hasIndic(text)) return this.lineMixed(text, x, top, name, size, o);
    this.pdf.text(text, x, top + size * 0.8, { align: o.align ?? 'left', charSpace: o.charSpace });
  }

  // ------------------------------------------------------------------ mixed scripts

  /** Text cut into runs, each with the face and size to draw it in (Indic runs already shaped). */
  private pieces(text: string, name: FontName, size: number) {
    const out: { str: string; font: string; size: number; indic?: boolean }[] = [];
    for (const r of runs(text)) {
      if (!r.script) { out.push({ str: r.text, font: name, size }); continue; }
      if (!this.indic?.has(r.script)) continue; // no font for it: drop, as for other missing glyphs
      const face = indicFace(name, r.script);
      out.push({ str: this.indic.shape(face.name, r.text), font: face.name, size: size * INDIC_SCALE[face.kind], indic: true });
    }
    return out;
  }

  /** Letter spacing would break the joined strokes of Indic scripts, so it applies to Latin runs only. */
  private runsWidth(pieces: { str: string; font: string; size: number; indic?: boolean }[], charSpace = 0) {
    let w = 0;
    for (const p of pieces) {
      this.pdf.setFont(p.font, 'normal');
      this.pdf.setFontSize(p.size);
      w += this.pdf.getTextWidth(p.str) + (p.indic ? 0 : charSpace * p.str.length);
    }
    return w;
  }

  private wrapMixed(text: string, width: number, name: FontName, size: number): string[] {
    const space = this.width(' ', name, size);
    const lines: string[] = [];
    for (const para of text.split('\n')) {
      let cur = '';
      let curW = 0;
      for (const word of para.split(' ')) {
        const w = this.runsWidth(this.pieces(word, name, size));
        if (cur && curW + space + w > width) { lines.push(cur); cur = word; curW = w; }
        else { curW += (cur ? space : 0) + w; cur = cur ? `${cur} ${word}` : word; }
      }
      lines.push(cur);
    }
    return lines;
  }

  private lineMixed(text: string, x: number, top: number, name: FontName, size: number, o: TextOpts) {
    const pieces = this.pieces(text, name, size);
    const cs = o.charSpace ?? 0;
    const total = this.runsWidth(pieces, cs);
    let px = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    const base = top + size * 0.8;
    for (const p of pieces) {
      this.pdf.setFont(p.font, 'normal');
      this.pdf.setFontSize(p.size);
      const c = p.indic ? 0 : cs;
      this.pdf.text(p.str, px, base, { charSpace: c || undefined });
      px += this.pdf.getTextWidth(p.str) + c * p.str.length;
    }
    this.pdf.setFont(name, 'normal');
    this.pdf.setFontSize(size);
  }

  fill(color: string) { this.pdf.setFillColor(color); return this; }
  stroke(color: string, w = 0.5) { this.pdf.setDrawColor(color); this.pdf.setLineWidth(w); return this; }
  opacity(a: number) {
    const P = this.pdf as unknown as { GState: new (o: object) => unknown; setGState: (g: unknown) => void };
    P.setGState(new P.GState({ opacity: a, 'stroke-opacity': a }));
    return this;
  }

  polygon(pts: [number, number][], style: 'F' | 'S' | 'FD') {
    const [x0, y0] = pts[0];
    const rel = pts.slice(1).map(([x, y], i) => [x - pts[i][0], y - pts[i][1]]);
    this.pdf.lines(rel, x0, y0, [1, 1], style, true);
  }

  diamond(cx: number, cy: number, r: number, color: string = C.gold) {
    this.fill(color).polygon([[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]], 'F');
  }

  /** A gold rule with a diamond in the middle. */
  ornament(cx: number, cy: number, half = 60, color: string = C.gold) {
    this.stroke(color, 0.6);
    this.pdf.line(cx - half, cy, cx - 6, cy);
    this.pdf.line(cx + 6, cy, cx + half, cy);
    this.diamond(cx, cy, 2.6, color);
    this.diamond(cx - half - 4, cy, 1.2, color);
    this.diamond(cx + half + 4, cy, 1.2, color);
  }

  stars(x: number, y: number, w: number, h: number, n: number, color: string = C.starlight, s = 11) {
    seed = s;
    this.fill(color);
    for (let i = 0; i < n; i++) {
      const r = rand() < 0.92 ? 0.25 + rand() * 0.45 : 0.8 + rand() * 0.6;
      this.opacity(0.25 + rand() * 0.7);
      this.pdf.circle(x + rand() * w, y + rand() * h, r, 'F');
    }
    this.opacity(1);
  }

  // ------------------------------------------------------------------ pages

  private startPage(kind: PageKind, bg: string) {
    if (this.pageKinds.length) {
      this.pdf.addPage();
      if (this.bleed) this.shift();
    }
    this.pageKinds.push(kind);
    this.running.push(this.runningNow);
    const b = this.bleed;
    this.fill(bg).pdf.rect(-b, -b, PAGE.w + 2 * b, PAGE.h + 2 * b, 'F');
    this.y = MARGIN.top;
    this.cols = { n: 1, i: 0, gap: 0, top: MARGIN.top };
    this.frame = { x: MARGIN.left, w: CONTENT_W };
  }

  coverPage() { this.startPage('cover', C.night); }
  fullPage(bg: string = C.paper) { this.startPage('full', bg); }
  newPage() { this.startPage('interior', C.paper); }
  /** A page with no running head or folio (blank versos, notes pages, dedications). */
  plainPage(bg: string = C.paper) { this.startPage('full', bg); this.setRunning(''); }

  /** In book mode, make sure the next page starts on the right: fill the left-hand page if needed. */
  toRecto() {
    if (!this.recto || this.page % 2 === 0) return;
    if (this.filler) this.filler(this);
    else this.plainPage();
  }

  setRunning(title: string) { this.runningNow = title; this.running[this.running.length - 1] = title; }

  /** Move to the next column, or the next page. */
  breakFrame() {
    if (this.cols.n > 1 && this.cols.i < this.cols.n - 1) {
      this.cols.i++;
      this.y = this.cols.top;
      this.applyCols();
      return;
    }
    const { n, gap } = this.cols;
    this.newPage();
    if (n > 1) this.columns(n, gap);
  }

  ensure(h: number) {
    if (this.y + h > this.bottom) { this.breakFrame(); return true; }
    return false;
  }

  space(h: number) { this.y += h; if (this.y > this.bottom) this.breakFrame(); }

  columns(n: number, gap = 22) {
    this.cols = { n, i: 0, gap, top: this.y };
    this.applyCols();
  }
  endColumns() {
    this.cols = { n: 1, i: 0, gap: 0, top: this.y };
    this.frame = { x: MARGIN.left, w: CONTENT_W };
  }
  private applyCols() {
    const { n, i, gap } = this.cols;
    const w = (CONTENT_W - gap * (n - 1)) / n;
    this.frame = { x: MARGIN.left + i * (w + gap), w };
  }

  // ------------------------------------------------------------------ flow text

  para(text: string, o: TextOpts = {}) {
    const size = o.size ?? 9.6;
    const font = o.font ?? F.sans;
    const lh = size * (o.leading ?? 1.55);
    const x = o.x ?? this.x;
    const w = o.width ?? (this.w - (x - this.x));
    for (const ln of this.wrap(text, w, font, size)) {
      if (this.y + lh > this.bottom) this.breakFrame();
      const lx = o.x ?? this.x;
      const ax = o.align === 'center' ? lx + w / 2 : o.align === 'right' ? lx + w : lx;
      this.line(ln, ax, this.y, { font, size, color: o.color ?? C.body, align: o.align, charSpace: o.charSpace });
      this.y += lh;
    }
    this.y += o.after ?? size * 0.7;
  }

  /** Measure the height `para` would take. */
  measure(text: string, w: number, o: TextOpts = {}) {
    const size = o.size ?? 9.6;
    return this.wrap(text, w, o.font ?? F.sans, size).length * size * (o.leading ?? 1.55);
  }

  /** Small letter-spaced capitals, the report's label style. */
  label(text: string, o: TextOpts = {}) {
    const size = o.size ?? 7;
    this.ensure(size * 2);
    this.line(text.toUpperCase(), o.x ?? this.x, this.y, { font: F.sansBold, size, color: o.color ?? C.gold, charSpace: 1.1, align: o.align });
    this.y += size * 1.9 + (o.after ?? 0);
  }

  h2(text: string, o: { kicker?: string; toc?: boolean; keep?: number } = {}) {
    this.ensure(70 + (o.keep ?? 60));
    if (this.y > MARGIN.top + 4) this.y += 10;
    if (o.kicker) this.label(o.kicker);
    this.para(text, { font: F.serifBold, size: 21, color: C.ink, leading: 1.12, after: 4 });
    this.stroke(C.goldLight, 0.7).pdf.line(this.x, this.y, this.x + 36, this.y);
    this.y += 12;
    if (o.toc) this.toc.push({ level: 2, title: text, page: this.page });
  }

  h3(text: string, o: { color?: string; keep?: number; size?: number } = {}) {
    this.ensure(30 + (o.keep ?? 40));
    this.y += 4;
    this.para(text, { font: F.serifBold, size: o.size ?? 14, color: o.color ?? C.ink, leading: 1.15, after: 3 });
  }

  bullets(items: string[], o: TextOpts & { mark?: string } = {}) {
    const size = o.size ?? 9.2;
    const lh = size * 1.5;
    for (const it of items) {
      const lines = this.wrap(it, this.w - 14, o.font ?? F.sans, size);
      this.ensure(lh * Math.min(2, lines.length));
      this.diamond(this.x + 3, this.y + size * 0.55, 1.9, o.mark ?? C.gold);
      lines.forEach((ln) => {
        if (this.y + lh > this.bottom) this.breakFrame();
        this.line(ln, this.x + 14, this.y, { font: o.font ?? F.sans, size, color: o.color ?? C.body });
        this.y += lh;
      });
      this.y += 2;
    }
    this.y += o.after ?? 4;
  }

  /** Two bulleted lists side by side (stacked when they would not fit on one page). */
  twoLists(a: { title: string; color: string; items: string[] }, b: { title: string; color: string; items: string[] }, size = 8.8) {
    const cw = (this.w - 24) / 2;
    const hOf = (items: string[]) => 7 * 1.9 + items.reduce((s, it) => s + this.measure(it, cw - 14, { size, leading: 1.5 }) + 2, 0) + 4;
    const h = Math.max(hOf(a.items), hOf(b.items));
    if (h > this.bottom - MARGIN.top - 20) {
      for (const l of [a, b]) { this.label(l.title, { color: l.color }); this.bullets(l.items, { size, mark: l.color }); }
      return;
    }
    this.ensure(h);
    const top = this.y;
    const fx = this.frame;
    [a, b].forEach((l, i) => {
      this.frame = { x: fx.x + i * (cw + 24), w: cw };
      this.y = top;
      if (l.items.length) { this.label(l.title, { color: l.color }); this.bullets(l.items, { size, mark: l.color, after: 0 }); }
    });
    this.frame = fx;
    this.y = top + h + 6;
  }

  /**
   * A tinted box with a label and body text, kept on one page (or column).
   * Used for the "Understanding…" lessons and for each yoga/dosha.
   */
  callout(o: { label?: string; title?: string; body: string | string[]; tint?: string; edge?: string; size?: number; bullets?: string[] }) {
    const pad = 13;
    const size = o.size ?? 9;
    const iw = this.w - pad * 2 - 3;
    const paras = Array.isArray(o.body) ? o.body : [o.body];
    let h = pad * 2;
    if (o.label) h += 7 * 1.9;
    if (o.title) h += this.measure(o.title, iw, { font: F.serifBold, size: 13.5, leading: 1.15 }) + 3;
    for (const p of paras) h += this.measure(p, iw, { size }) + size * 0.5;
    for (const b of o.bullets ?? []) h += this.measure(b, iw - 12, { size }) + 2;
    if (h > this.bottom - MARGIN.top) h = this.bottom - this.y; // very long: let it run
    this.ensure(h + 6);
    const top = this.y;
    this.fill(o.tint ?? C.paperDeep).pdf.rect(this.x, top, this.w, h, 'F');
    this.fill(o.edge ?? C.gold).pdf.rect(this.x, top, 2.2, h, 'F');
    const fx = this.frame;
    this.frame = { x: fx.x + pad + 3, w: iw };
    this.y = top + pad;
    if (o.label) this.label(o.label, { color: o.edge ?? C.gold });
    if (o.title) this.para(o.title, { font: F.serifBold, size: 13.5, color: C.ink, leading: 1.15, after: 3 });
    for (const p of paras) this.para(p, { size, after: size * 0.5 });
    if (o.bullets?.length) this.bullets(o.bullets, { size, after: 0, mark: o.edge });
    this.frame = fx;
    this.y = Math.max(this.y, top + h) + 10;
  }

  table(cols: Column[], rows: Row[], o: { size?: number; zebra?: boolean; headerFill?: string; pad?: number } = {}) {
    const size = o.size ?? 8.4;
    const pad = o.pad ?? 5;
    const lh = size * 1.38;
    const total = this.w;
    const fixed = cols.reduce((s, c) => s + (c.width > 1 ? c.width : 0), 0);
    const frac = cols.reduce((s, c) => s + (c.width <= 1 ? c.width : 0), 0) || 1;
    const widths = cols.map((c) => (c.width > 1 ? c.width : ((total - fixed) * c.width) / frac));
    const header = () => {
      this.fill(o.headerFill ?? C.ink).pdf.rect(this.x, this.y, total, lh + pad * 1.6, 'F');
      let cx = this.x;
      cols.forEach((c, i) => {
        const tx = c.align === 'right' ? cx + widths[i] - pad : c.align === 'center' ? cx + widths[i] / 2 : cx + pad;
        this.line(c.header.toUpperCase(), tx, this.y + pad * 0.8 + 1, { font: F.sansBold, size: size - 1.6, color: C.goldPale, charSpace: 0.6, align: c.align });
        cx += widths[i];
      });
      this.y += lh + pad * 1.6;
    };
    this.ensure(lh * 3 + pad * 4);
    header();
    rows.forEach((row, ri) => {
      const cells = row.map((r) => (typeof r === 'string' ? { text: r } : r));
      const wrapped = cells.map((c, i) => this.wrap(c.text, widths[i] - pad * 2, c.font ?? cols[i].font ?? F.sans, size));
      const h = Math.max(...wrapped.map((l) => l.length)) * lh + pad * 1.4;
      if (this.y + h > this.bottom) { this.breakFrame(); header(); }
      if (o.zebra !== false && ri % 2 === 1) this.fill(C.paperDeep).pdf.rect(this.x, this.y, total, h, 'F');
      let cx = this.x;
      cells.forEach((c, i) => {
        if (c.fill) this.fill(c.fill).pdf.rect(cx, this.y, widths[i], h, 'F');
        const al = cols[i].align;
        const tx = al === 'right' ? cx + widths[i] - pad : al === 'center' ? cx + widths[i] / 2 : cx + pad;
        wrapped[i].forEach((ln, li) => this.line(ln, tx, this.y + pad * 0.7 + li * lh, { font: c.font ?? cols[i].font ?? F.sans, size, color: c.color ?? C.body, align: al }));
        cx += widths[i];
      });
      this.stroke(C.rule, 0.4).pdf.line(this.x, this.y + h, this.x + total, this.y + h);
      this.y += h;
    });
    this.y += 12;
  }

  /** Label/value pairs laid out in a grid of `per` columns. */
  facts(items: [string, string][], per = 3, o: { size?: number } = {}) {
    const size = o.size ?? 11.5;
    const cw = this.w / per;
    for (let i = 0; i < items.length; i += per) {
      const row = items.slice(i, i + per);
      const hs = row.map(([, v]) => this.measure(v, cw - 12, { font: F.serif, size, leading: 1.2 }));
      const h = 7 * 1.9 + Math.max(...hs) + 10;
      this.ensure(h);
      row.forEach(([k, v], j) => {
        const x = this.x + j * cw;
        this.line(k.toUpperCase(), x, this.y, { font: F.sansBold, size: 6.6, color: C.gold, charSpace: 1 });
        this.wrap(v, cw - 12, F.serif, size).forEach((ln, li) => this.line(ln, x, this.y + 13 + li * size * 1.2, { font: F.serifBold, size, color: C.ink }));
      });
      this.y += h;
    }
  }

  /** A chapter opener: dark band with art, numeral, title and a short lesson. */
  chapter(o: { numeral: string; title: string; kicker: string; intro: string; art?: { data: string; w: number; h: number; alias: string } }) {
    this.toRecto();
    this.runningNow = o.title;
    this.newPage();
    this.pageKinds[this.pageKinds.length - 1] = 'opener';
    const bandH = 300;
    const b = this.bleed;
    this.fill(C.night).pdf.rect(-b, -b, PAGE.w + 2 * b, bandH + b, 'F');
    if (o.art) {
      // cover-fit the art into the band
      const s = Math.max((PAGE.w + 2 * b) / o.art.w, (bandH + b) / o.art.h);
      const w = o.art.w * s;
      const h = o.art.h * s;
      this.pdf.addImage(o.art.data, 'JPEG', (PAGE.w - w) / 2, (bandH - b - h) / 2, w, h, o.art.alias, 'FAST');
      this.fill(C.night).opacity(0.45).pdf.rect(-b, -b, PAGE.w + 2 * b, bandH + b, 'F');
      this.opacity(1);
    }
    this.stars(0, 0, PAGE.w, bandH, 90, C.starlight, o.title.length * 31);
    this.fill(C.gold).pdf.rect(-b, bandH, PAGE.w + 2 * b, 2, 'F');
    this.line(o.kicker.toUpperCase(), PAGE.w / 2, 104, { font: F.sansBold, size: 7.5, color: C.goldLight, charSpace: 2.2, align: 'center' });
    this.line(o.numeral, PAGE.w / 2, 124, { font: F.serif, size: 30, color: C.goldLight, align: 'center' });
    const titleLines = this.wrap(o.title, PAGE.w - 140, F.serifBold, 38);
    titleLines.forEach((ln, i) => this.line(ln, PAGE.w / 2, 168 + i * 42, { font: F.serifBold, size: 38, color: '#FFFFFF', align: 'center' }));
    this.ornament(PAGE.w / 2, 176 + titleLines.length * 42, 70, C.goldLight);
    this.toc.push({ level: 1, title: o.title, page: this.page, numeral: o.numeral });
    this.y = bandH + 40;
    this.para(o.intro, { font: F.serifItalic, size: 14, color: C.ink, leading: 1.42, x: MARGIN.left + 30, width: CONTENT_W - 60, align: 'center', after: 10 });
    this.ornament(PAGE.w / 2, this.y + 4, 24);
    this.y += 26;
  }

  // ------------------------------------------------------------------ finishing

  /** Branding beside the folio, on the left or the right, cut short so it never runs into the page number. */
  private footLine(full: string, y: number, right: boolean) {
    if (!full.trim()) return;
    const room = PAGE.w / 2 - 26 - MARGIN.left;
    const o = { font: F.sans, size: 6.4, color: C.muted } as const;
    let [text = '', ...rest] = this.wrap(full.trim(), room, o.font, o.size);
    if (rest.length) {
      while (text.length > 1 && this.width(`${text}...`, o.font, o.size) > room) text = text.slice(0, -1);
      text = `${text.trimEnd()}...`;
    }
    if (right) this.line(text, PAGE.w - MARGIN.right, y, { ...o, align: 'right' });
    else this.line(text, MARGIN.left, y, o);
  }

  /** Running headers and folios, drawn once the page count is known. */
  finish(skipFolioOn: number[] = []) {
    const n = this.page;
    for (let p = 1; p <= n; p++) {
      const kind = this.pageKinds[p - 1];
      if (kind === 'cover' || skipFolioOn.includes(p)) continue;
      this.pdf.setPage(p);
      if (kind === 'interior') {
        const top = 40;
        this.line(this.owner.toUpperCase(), MARGIN.left, top, { font: F.sansBold, size: 6.4, color: C.muted, charSpace: 1.3 });
        this.line((this.running[p - 1] || '').toUpperCase(), PAGE.w - MARGIN.right, top, { font: F.sansBold, size: 6.4, color: C.gold, charSpace: 1.3, align: 'right' });
        this.stroke(C.rule, 0.5).pdf.line(MARGIN.left, top + 13, PAGE.w - MARGIN.right, top + 13);
      }
      if (kind !== 'full') {
        const fy = PAGE.h - 38;
        this.diamond(PAGE.w / 2 - 16, fy + 4, 1.4);
        this.diamond(PAGE.w / 2 + 16, fy + 4, 1.4);
        this.line(String(p), PAGE.w / 2, fy, { font: F.serifBold, size: 10, color: C.ink, align: 'center' });
        if (this.footer) {
          this.footLine(this.footer[0], fy + 2, false);
          this.footLine(this.footer[1], fy + 2, true);
        }
      }
    }
  }
}
