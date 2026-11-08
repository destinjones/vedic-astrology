import type { ReportDoc } from '../doc';
import { C, F, MARGIN, PAGE } from '../theme';
import type { ReportContext } from '../types';
import type { Timeline } from '@vedic/timing';
import { paragraphs, type BookDraft } from './draft';

/** Everything a book chapter can draw from: the report's context plus the astrologer's draft. */
export interface BookContext extends ReportContext {
  draft: BookDraft;
  /** The astrologer's name from "Prepared by", or '' when the book is unsigned. Never the practice name. */
  by: string;
  /** The astrologer's name with their title, for signatures and the title page ("Asha Rao, Jyotishi"). */
  byline: string;
  /** Chapter numeral by id, filled in as chapters are laid out (and known in advance for cross-references). */
  numerals: Record<string, string>;
  /** Timeline for the whole forecast span (the timing chapter gets a five-year slice of it). */
  forecast: Timeline | null;
  /** Works cited by the book's own chapters, gathered for the sources chapter. */
  cited: Map<string, string>;
}

/**
 * The embedded fonts are Latin subsets without the IAST accents (ā, ṣ, ṃ…).
 * Remedy texts quote Sanskrit in IAST, so fold those letters to plain ones rather than lose them.
 */
/** Sign a letter: the astrologer's name, their title, then the practice and its contact. */
export function signature(doc: ReportDoc, ctx: BookContext) {
  if (!ctx.by && !ctx.brand) return;
  doc.y += 10;
  if (ctx.by) doc.para(ctx.by, { font: F.serifItalic, size: 17, color: C.ink, after: 2 });
  const sub = [ctx.draft.authorTitle, ctx.brand?.name !== ctx.by ? ctx.brand?.name : ''].filter(Boolean).join(', ');
  if (!ctx.by && ctx.brand) doc.para(ctx.brand.name, { font: F.serifItalic, size: 17, color: C.ink, after: 2 });
  else if (sub) doc.para(sub, { size: 9, color: C.muted, after: 2 });
  if (ctx.brand?.contact) doc.para(ctx.brand.contact, { size: 8.4, color: C.muted });
}

export const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');

/** "Chapter IV" for a chapter that is in the book, or '' when it is not. */
export const see = (ctx: BookContext, id: string, words = 'see Chapter') => (ctx.numerals[id] ? `${words} ${ctx.numerals[id]}` : '');

/** The astrologer's note for a key, printed in their own voice: serif, with a gold rule and their name. */
export function astrologerNote(doc: ReportDoc, ctx: BookContext, key: string, label?: string) {
  const text = ctx.draft.notes[key];
  const paras = paragraphs(text);
  if (!paras.length) return;
  const size = 11.2;
  const lh = size * 1.48;
  const inset = 16;
  const w = doc.w - inset;
  const first = doc.measure(paras[0], w, { font: F.serif, size, leading: 1.48 });
  doc.ensure(40 + Math.min(first, lh * 4));
  doc.y += 6;
  let top = doc.y;
  let page = doc.page;
  const rule = (to: number) => doc.stroke(C.goldLight, 1.6).pdf.line(doc.x + 2, top, doc.x + 2, to);
  doc.label(label ?? (ctx.by ? `A note from ${ctx.by}` : 'Your astrologer\'s note'), { x: doc.x + inset });
  for (const p of paras) {
    for (const ln of doc.wrap(p, w, F.serif, size)) {
      if (doc.y + lh > doc.bottom) {
        rule(doc.y);
        doc.breakFrame();
        top = doc.y;
        page = doc.page;
      }
      doc.line(ln, doc.x + inset, doc.y, { font: F.serif, size, color: C.ink });
      doc.y += lh;
    }
    doc.y += 5;
  }
  if (doc.page === page) rule(doc.y - 4);
  doc.y += 8;
}

/** A page of ruled lines for the client's own notes. */
export function notesPage(doc: ReportDoc, title = 'Notes') {
  doc.plainPage();
  doc.line(title.toUpperCase(), PAGE.w / 2, MARGIN.top, { font: F.sansBold, size: 7, color: C.gold, charSpace: 2.2, align: 'center' });
  doc.ornament(PAGE.w / 2, MARGIN.top + 20, 30);
  doc.stroke(C.rule, 0.5);
  for (let y = MARGIN.top + 54; y < PAGE.h - MARGIN.bottom; y += 24) doc.pdf.line(MARGIN.left, y, PAGE.w - MARGIN.right, y);
}

/** "Sources" line under a teaching section: the works it rests on, remembered for the sources chapter. */
export function sources(doc: ReportDoc, ctx: BookContext, refs: [string, string][]) {
  for (const [work, detail] of refs) if (!ctx.cited.has(work)) ctx.cited.set(work, detail);
  doc.para(`Sources: ${refs.map(([w, d]) => `${w}, ${d}`).join('; ')}.`, { size: 7.8, color: C.muted, after: 8 });
}

/** The big lesson heading used at the start of each "teaching" passage. */
export function lesson(doc: ReportDoc, title: string, kicker = 'The teaching') {
  doc.h2(title, { kicker, toc: true });
}

/** Paragraphs in the book's reading voice (larger serif than the report's body text). */
export function prose(doc: ReportDoc, texts: string[], o: { size?: number } = {}) {
  for (const t of texts) doc.para(t, { font: F.serif, size: o.size ?? 11.6, leading: 1.5, color: C.body, after: 7 });
}
