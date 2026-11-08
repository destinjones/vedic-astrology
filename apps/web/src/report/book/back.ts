import { EDITIONS, formatCitation, type ClassicalText, type Reading } from '@vedic/interpretations';
import type { ReportDoc } from '../doc';
import { longDate } from '../format';
import { C, F, PAGE } from '../theme';
import type { SectionHelpers } from '../types';
import { astrologerNote, type BookContext, notesPage, prose, signature } from './common';
import { paragraphs } from './draft';

/** Every classical citation behind the readings in this book, by text. */
function citationsByText(ctx: BookContext) {
  const by = new Map<ClassicalText, Map<string, Set<string>>>();
  const add = (r: Reading | undefined, what: string) => {
    for (const c of r?.source?.citations ?? []) {
      const m = by.get(c.text) ?? new Map<string, Set<string>>();
      by.set(c.text, m);
      const k = formatCitation(c);
      (m.get(k) ?? m.set(k, new Set()).get(k)!).add(what);
    }
  };
  const { report } = ctx;
  for (const p of Object.values(report.planets)) [p.sign, p.house, p.nakshatra, ...p.lordships].forEach((r) => add(r, r.title));
  report.houseLords.forEach((r) => add(r, r.title));
  report.yogas.forEach((y) => add(y.reading, y.name));
  report.doshas.filter((d) => d.present).forEach((d) => add(d.reading, d.name));
  return by;
}

export function sourcesChapter(doc: ReportDoc, ctx: BookContext, h: SectionHelpers) {
  doc.chapter({
    numeral: h.numeral, kicker: 'Reference', title: 'Sources and further reading', art: ctx.art.cosmos,
    intro: 'The classical texts this book rests on, the editions its chapter and verse numbers follow, and where you can read them yourself.',
  });
  prose(doc, [
    'Indian astrological texts were written as verse, to be memorised, and they survive in many manuscripts and translations. Chapter and verse numbers differ between editions, so each text below names the edition this book counts by. Where a reading in this book was checked against a verse, the verse is given beside it; where a source line is missing, the reading is this project\'s own synthesis of the tradition.',
  ]);
  const by = citationsByText(ctx);
  for (const [text, ed] of Object.entries(EDITIONS) as [ClassicalText, (typeof EDITIONS)[ClassicalText]][]) {
    doc.ensure(90);
    doc.para(ed.title, { font: F.serifBold, size: 15, color: C.ink, after: 1 });
    doc.para(`${ed.author}. ${ed.edition}.${ed.url ? ` Read it at ${ed.url}` : ''}`, { size: 8.6, color: C.muted, after: 4 });
    const cites = by.get(text);
    if (cites?.size) {
      const items = [...cites.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }));
      doc.para(`Cited in this book for: ${items.map(([k, what]) => `${k} (${[...what].slice(0, 2).join('; ')})`).join(' · ')}.`, { size: 8.4, after: 10 });
    } else doc.y += 6;
  }
  const others = [...ctx.cited.entries()].filter(([w]) => !Object.values(EDITIONS).some((e) => w.startsWith(e.title)));
  if (others.length) {
    doc.h3('Other works referred to', { keep: 60 });
    doc.bullets(others.map(([w, d]) => `${w}: ${d}.`), { size: 8.6 });
  }
  astrologerNote(doc, ctx, 'chapter:sources');
}

export function closing(doc: ReportDoc, ctx: BookContext) {
  const own = paragraphs(ctx.draft.closing);
  if (!own.length && !ctx.by) return;
  doc.toRecto();
  doc.newPage();
  doc.setRunning('Until we meet again');
  doc.y += 30;
  doc.label('In closing');
  doc.para('Until we meet again', { font: F.serifBold, size: 26, color: C.ink, after: 14 });
  prose(doc, own.length ? own : [
    'A chart is not read once. As the dashas turn and the planets move, different parts of it come forward, and what reads as a puzzle today often makes sense in a year or two. Keep this book, mark what proves true, and bring your questions to our next conversation.',
  ], { size: 12.4 });
  signature(doc, ctx);
}

export function colophon(doc: ReportDoc, ctx: BookContext) {
  doc.newPage();
  doc.setRunning('About this book');
  doc.h2('About this book', { kicker: 'Method', toc: true });
  const m = ctx.engineChart.meta;
  doc.para(`Positions are calculated with the Swiss Ephemeris (${m.ayanamsaName} ayanamsa, ${m.nodeType === 'true' ? 'true' : 'mean'} nodes) for ${m.utc.replace('T', ' ').slice(0, 16)} UTC. Houses are whole signs from the ascendant. Divisional charts follow Parashara. Dashas use the Vimshottari system with a 365.25-day year. Yogas and doshas are detected from their classical definitions, with common cancellations applied. Timing scores combine dasha strength and Moon-based transits, with vedha and ashtakavarga, measured against your chart's own baseline.`, { size: 9 });
  doc.para(`Made on ${longDate(ctx.now)} with Jyotisha Explorer, a free and open-source project (AGPL-3.0)${ctx.by ? `, and written with ${ctx.by}` : ''}. Fonts: Cormorant Garamond and Inter (SIL Open Font License). Planet, rashi and nakshatra artwork rendered in Blender for the project.`, { size: 8, color: C.muted });
}

/** Ruled pages at the back for the client's own notes. */
export function notesAtBack(doc: ReportDoc, n = 2) {
  for (let i = 0; i < n; i++) notesPage(doc, 'Your notes');
}

/** The back cover, trim origin at (0, 0); `b` is the bleed the background runs into. */
export function backCover(doc: ReportDoc, ctx: BookContext, b = 0, chapters: string[] = []) {
  const { pdf } = doc;
  doc.fill(C.night).pdf.rect(-b, -b, PAGE.w + 2 * b, PAGE.h + 2 * b, 'F');
  const art = ctx.art.wheelHero;
  const w = PAGE.w + 80;
  const hh = (art.h / art.w) * w;
  pdf.addImage(art.data, 'JPEG', -40, 40, w, hh, art.alias, 'FAST');
  doc.fill(C.night).opacity(0.55).pdf.rect(-b, -b, PAGE.w + 2 * b, PAGE.h + 2 * b, 'F');
  doc.opacity(1);
  doc.stars(-b, -b, PAGE.w + 2 * b, PAGE.h + 2 * b, 160, C.starlight, 4242);
  let y = 120;
  doc.line((ctx.draft.title || 'The Life Chart Book').toUpperCase(), PAGE.w / 2, y, { font: F.sansBold, size: 8, color: C.goldLight, charSpace: 2.6, align: 'center' });
  y += 26;
  for (const ln of doc.wrap('A personal book of the birth chart: every placement explained, the teaching behind it, the years ahead one by one, and the remedies the tradition gives.', PAGE.w - 170, F.serifItalic, 15)) {
    doc.line(ln, PAGE.w / 2, y, { font: F.serifItalic, size: 15, color: C.starlight, align: 'center' });
    y += 21;
  }
  y += 14;
  if (chapters.length) {
    doc.ornament(PAGE.w / 2, y, 50, C.goldLight);
    y += 24;
    for (const c of chapters) { doc.line(c, PAGE.w / 2, y, { font: F.serif, size: 12, color: '#FFFFFF', align: 'center' }); y += 18; }
  }
  doc.ornament(PAGE.w / 2, PAGE.h - 190, 80, C.goldLight);
  doc.line('As above, so below.', PAGE.w / 2, PAGE.h - 172, { font: F.serifItalic, size: 16, color: C.starlight, align: 'center' });
  doc.line((ctx.brand?.name ?? 'Jyotisha Explorer').toUpperCase(), PAGE.w / 2, PAGE.h - 132, { font: F.sansBold, size: 7.4, color: C.goldLight, charSpace: 2.4, align: 'center' });
  if (ctx.brand?.contact) doc.line(ctx.brand.contact, PAGE.w / 2, PAGE.h - 116, { font: F.sans, size: 7.6, color: C.starlight, align: 'center' });
}
