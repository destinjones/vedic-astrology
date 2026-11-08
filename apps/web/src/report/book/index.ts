import { jsPDF } from 'jspdf';
import { interpretChart, fromEngineChart, hasReadings, loadLocale, localizer } from '@vedic/interpretations';
import { natalFromChart, scoredDashasFromChart, engineEphemeris } from '@vedic/timing/engine';
import { buildTimeline, type Ephemeris, type Timeline } from '@vedic/timing';
import type { Chart } from '../../types/chart';
import { zip } from '../../export/zip';
import { loadArt } from '../assets';
import { ReportDoc } from '../doc';
import { registerFonts } from '../fonts';
import { LOCALE_SCRIPT, scriptsIn } from '../indic';
import { longDate } from '../format';
import { C, F, PAGE, roman } from '../theme';
import type { Brand, ReportContext } from '../types';
import { glance } from '../sections/glance';
import { grahas } from '../sections/grahas';
import { houses } from '../sections/houses';
import { yogas } from '../sections/yogas';
import { vargas } from '../sections/vargas';
import { dasha } from '../sections/dasha';
import { timing } from '../sections/timing';
import { glossary } from '../sections/glossary';
import { astrologerNote, type BookContext, notesPage } from './common';
import { BOOK_CHAPTERS, type BookDraft } from './draft';
import { dedication, drawContents, frontCover, heart, howToRead, letter, reserveContents, titlePages } from './front';
import { foundations, lagna, moon } from './teach';
import { forecast, wallChart } from './forecast';
import { remediesChapter } from './remedies';
import { backCover, closing, colophon, notesAtBack, sourcesChapter } from './back';

export { BOOK_CHAPTERS, emptyDraft, draftKey, normaliseDraft, type BookDraft } from './draft';

/** Print bleed: 3 mm (0.125 in), what Lulu and Blurb ask for. */
export const BLEED = 8.5;
const MM = 72 / 25.4;

export interface BookOptions {
  draft: BookDraft;
  brand?: Brand;
  locale?: string;
  onProgress?: (message: string) => void;
}

export interface BookResult {
  /** The book itself (screen edition), or the interior (print edition). */
  pdf: Blob;
  /** Print edition only: back cover, spine and front cover on one sheet. */
  cover?: Blob;
  pages: number;
  /** Print edition only: the spine width used, in millimetres. */
  spineMm?: number;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** A five-year view of the forecast timeline, for the report's own timing chapter. */
function slice(t: Timeline, from: Date, to: Date): Timeline {
  const inR = (d: Date) => d >= from && d < to;
  return {
    ...t,
    range: { from, to },
    series: t.series.filter((p) => inR(p.date)),
    windows: t.windows.filter((w) => w.end > from && w.start < to),
    retrogrades: t.retrogrades.filter((r) => inR(r.stationRetrograde)),
    ingresses: t.ingresses.filter((i) => inR(i.date)),
  };
}

/**
 * Lulu's estimate for a paperback on standard white paper: pages / 444 inches,
 * plus 0.06 in for the cover board. Their cover calculator gives the exact figure
 * for each paper and binding, and the editor lets the astrologer type it in.
 */
export const estimateSpineMm = (pages: number) => Math.round((pages / 444 + 0.06) * 25.4 * 10) / 10;

export async function generateBook(chart: Chart, opts: BookOptions): Promise<BookResult> {
  if (!chart.engineContext) throw new Error('The book needs the Swiss Ephemeris engine, which has not loaded.');
  const say = opts.onProgress ?? (() => {});
  const { draft } = opts;
  const { engine, chart: ec } = chart.engineContext;
  const now = new Date();
  const want = new Set(draft.chapters);
  const print = draft.print;
  const b = print ? BLEED : 0;

  say('Reading the chart…');
  await tick();
  const locale = opts.locale && hasReadings(opts.locale) ? await loadLocale(opts.locale) : 'en';
  const report = interpretChart(fromEngineChart(ec), { locale });
  const L = localizer(locale);
  const natal = natalFromChart(ec);
  const dashas = scoredDashasFromChart(ec, natal);

  let eph: Ephemeris | null = null;
  let full: Timeline | null = null;
  if (want.has('forecast') || want.has('timing')) {
    say(`Working out the next ${draft.years} years…`);
    await tick();
    try {
      eph = engineEphemeris(engine, { ayanamsa: ec.meta.ayanamsa, nodeType: ec.meta.nodeType });
      const from = new Date(Date.UTC(now.getUTCFullYear(), Math.min(0, now.getUTCMonth() - 6), 1));
      const to = new Date(Date.UTC(now.getUTCFullYear() + draft.years, 1, 1));
      full = buildTimeline(eph, natal, { dashas, from, to });
    } catch (e) {
      console.error('Timing unavailable for the book', e);
    }
  }

  say('Preparing the artwork…');
  const pdf = new jsPDF({ unit: 'pt', format: [PAGE.w + 2 * b, PAGE.h + 2 * b], compress: true });
  const allText = [draft.title, draft.dedication, draft.letter, draft.closing, draft.takeaways, ...Object.values(draft.notes)];
  const scripts = scriptsIn(chart.input.name, chart.input.place, draft.author, draft.authorTitle, opts.brand?.name, opts.brand?.tagline, opts.brand?.contact, ...allText);
  const own = opts.locale ? LOCALE_SCRIPT[opts.locale] : undefined;
  if (own) scripts.add(own);
  const [art, indic] = await Promise.all([loadArt(chart.ascendant.longitude), registerFonts(pdf, scripts)]);

  const name = chart.input.name?.trim() || longDate(chart.input.date);
  const brand = opts.brand?.name?.trim() ? opts.brand : undefined;
  const fiveYears = full ? slice(full, new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1)), new Date(Date.UTC(now.getUTCFullYear() + 5, now.getUTCMonth() + 6, 1))) : null;
  const base: ReportContext = {
    chart, engine, engineChart: ec, report, getNakshatra: (n) => L.nakshatra(n), dashas, timeline: fiveYears, art, now, name,
    brand, glossary: new Map(),
  };
  // number the chapters up front, so early chapters can point to later ones
  const chapters = BOOK_CHAPTERS.filter((c) => want.has(c.id) && !(c.id === 'timing' && !fiveYears) && !(c.id === 'forecast' && !full));
  const numerals: Record<string, string> = {};
  chapters.forEach((c, i) => { numerals[c.id] = roman(i + 1); });
  const ctx: BookContext = { ...base, draft, by: draft.author, byline: [draft.author, draft.authorTitle].filter(Boolean).join(', '), numerals, forecast: full, cited: new Map() };
  ctx.annotate = (d, key) => astrologerNote(d, ctx, key);

  const doc = new ReportDoc(pdf, `${name}  ·  ${draft.title || 'The Life Chart Book'}`, indic, { bleed: b, recto: print });
  if (print && draft.notesPages) doc.filler = (d) => notesPage(d);

  say('Laying out the front pages…');
  if (!print) {
    doc.coverPage();
    await frontCover(doc, ctx);
  }
  titlePages(doc, ctx);
  dedication(doc, ctx);
  const contents = reserveContents(doc);
  letter(doc, ctx);
  heart(doc, ctx);
  howToRead(doc, ctx);

  const render: Record<string, (h: { numeral: string }) => void | Promise<void>> = {
    foundations: (h) => foundations(doc, ctx, h),
    glance: (h) => glance(doc, ctx, h),
    lagna: (h) => lagna(doc, ctx, h),
    moon: (h) => moon(doc, ctx, h),
    grahas: (h) => { grahas(doc, ctx, h); },
    houses: (h) => houses(doc, ctx, h),
    yogas: (h) => yogas(doc, ctx, h),
    vargas: (h) => vargas(doc, ctx, h),
    dasha: (h) => { dasha(doc, ctx, h); wallChart(doc, ctx); },
    forecast: (h) => forecast(doc, ctx, h, eph),
    timing: (h) => timing(doc, ctx, h),
    remedies: (h) => remediesChapter(doc, ctx, h),
    glossary: (h) => glossary(doc, ctx, h),
    sources: (h) => sourcesChapter(doc, ctx, h),
  };
  // chapters whose own text does not print the astrologer's chapter note
  const OWN_NOTE = new Set(['foundations', 'lagna', 'moon', 'forecast', 'remedies', 'sources']);
  for (const c of chapters) {
    say(`Writing ${c.title.toLowerCase()}…`);
    await tick();
    try {
      await render[c.id]({ numeral: numerals[c.id] });
      if (!OWN_NOTE.has(c.id)) astrologerNote(doc, ctx, `chapter:${c.id}`);
    } catch (e) {
      console.error(`Book chapter ${c.id} failed`, e);
    }
  }

  say('Finishing the book…');
  closing(doc, ctx);
  colophon(doc, ctx);
  if (draft.notesPages) notesAtBack(doc, print ? 2 : 3);
  if (print) {
    // printers bind in signatures: keep the page count a multiple of four
    while (doc.page % 4) {
      if (draft.notesPages) notesPage(doc, 'Your notes');
      else doc.plainPage();
    }
  } else {
    doc.coverPage();
    backCover(doc, ctx, 0, chapters.slice(0, 12).map((c) => c.title));
  }
  drawContents(doc, contents);
  doc.finish();
  const pages = doc.page;
  pdf.setProperties({
    title: `${name} · ${draft.title || 'The Life Chart Book'}`,
    subject: 'A personal Jyotisha (Vedic astrology) book of the birth chart',
    author: draft.author || brand?.name || 'Jyotisha Explorer',
    creator: 'Jyotisha Explorer',
    keywords: 'vedic astrology, jyotisha, birth chart, kundli, life chart book',
  });
  const result: BookResult = { pdf: pdf.output('blob'), pages };
  if (print) {
    say('Making the cover…');
    const spineMm = draft.spineMm > 0 ? draft.spineMm : estimateSpineMm(pages);
    result.cover = await coverSpread(ctx, chapters.slice(0, 12).map((c) => c.title), spineMm * MM);
    result.spineMm = spineMm;
  }
  return result;
}

/** One sheet for the printer: back cover, spine and front cover, with bleed all round. */
async function coverSpread(ctx: BookContext, chapters: string[], spine: number): Promise<Blob> {
  const b = BLEED;
  const W = 2 * PAGE.w + spine + 2 * b;
  const H = PAGE.h + 2 * b;
  const pdf = new jsPDF({ unit: 'pt', format: [W, H], orientation: 'landscape', compress: true });
  const indic = await registerFonts(pdf, scriptsIn(ctx.chart.input.name, ctx.draft.author, ctx.brand?.name, ctx.draft.title));
  const doc = new ReportDoc(pdf, '', indic);
  doc.fill(C.night).pdf.rect(0, 0, W, H, 'F');
  // each panel is drawn in its own trim coordinates, shifted into place and clipped to its edges
  const panel = async (x0: number, draw: () => void | Promise<void>, left: boolean) => {
    pdf.saveGraphicsState();
    const cx = left ? 0 : x0 - b;
    const cw = left ? x0 + PAGE.w : W - cx;
    pdf.rect(cx, 0, cw, H, null);
    pdf.clip();
    pdf.discardPath();
    (pdf as unknown as { internal: { write: (s: string) => void } }).internal.write(`1 0 0 1 ${x0.toFixed(3)} ${(-b).toFixed(3)} cm`);
    await draw();
    pdf.restoreGraphicsState();
  };
  await panel(b, () => backCover(doc, ctx, b, chapters), true);
  await panel(b + PAGE.w + spine, () => frontCover(doc, ctx, b), false);
  // the spine: title and name, reading top to bottom, when there is room for type
  const sx = b + PAGE.w;
  doc.fill(C.night).pdf.rect(sx, 0, spine, H, 'F');
  doc.fill(C.gold).pdf.rect(sx, 0, 0.6, H, 'F');
  doc.fill(C.gold).pdf.rect(sx + spine - 0.6, 0, 0.6, H, 'F');
  if (spine >= 6 * MM) {
    const size = Math.min(13, spine * 0.42);
    const text = `${ctx.chart.input.name?.trim() || longDate(ctx.chart.input.date)}   ·   ${ctx.draft.title || 'The Life Chart Book'}${ctx.brand ? `   ·   ${ctx.brand.name}` : ''}`;
    pdf.setFont(F.serifBold, 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor('#FFFFFF');
    const tw = pdf.getTextWidth(text);
    pdf.text(text, sx + spine / 2 - size * 0.32, H / 2 - tw / 2, { angle: -90 });
  }
  return pdf.output('blob');
}

const safe = (chart: Chart) => (chart.input.name?.trim() || chart.input.date).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
export const bookFileName = (chart: Chart, part: 'book' | 'interior' | 'cover' | 'print' = 'book') =>
  `${safe(chart)}-life-chart-book${part === 'book' ? '' : `-${part}`}.${part === 'print' ? 'zip' : 'pdf'}`;

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Make the book and download it: one PDF on screen, or a zip of interior and cover for the printer. */
export async function downloadBook(chart: Chart, opts: BookOptions) {
  const r = await generateBook(chart, opts);
  if (!r.cover) { save(r.pdf, bookFileName(chart)); return r; }
  const readme = [
    `${opts.draft.title || 'The Life Chart Book'} for ${chart.input.name?.trim() || chart.input.date}: print files`,
    '',
    `interior.pdf  ${r.pages} pages, A4 (210 x 297 mm) trim with 3 mm bleed on every edge. Chapters start on right-hand pages; the page count is a multiple of four.`,
    `cover.pdf     back cover, spine (${r.spineMm} mm) and front cover on one sheet, with 3 mm bleed.`,
    '',
    'For Lulu: choose A4, upload interior.pdf as the interior. The spine above is Lulu\'s estimate for a paperback on standard white paper;',
    'check it against the cover template Lulu shows for your paper and binding, and if it differs, enter that width in the book editor and export again.',
    'Keep the bottom right of the back cover clear if the printer adds a barcode.',
  ].join('\n');
  const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
  const z = zip([
    { name: 'interior.pdf', data: await bytes(r.pdf) },
    { name: 'cover.pdf', data: await bytes(r.cover) },
    { name: 'README.txt', data: new TextEncoder().encode(readme) },
  ]);
  save(new Blob([z as BlobPart], { type: 'application/zip' }), bookFileName(chart, 'print'));
  return r;
}
