import { jsPDF } from 'jspdf';
import { interpretChart, fromEngineChart, hasReadings, loadLocale, localizer } from '@vedic/interpretations';
import { natalFromChart, scoredDashasFromChart, engineEphemeris } from '@vedic/timing/engine';
import { buildTimeline } from '@vedic/timing';
import type { Chart } from '../types/chart';
import { loadArt } from './assets';
import { ReportDoc } from './doc';
import { registerFonts } from './fonts';
import { LOCALE_SCRIPT, scriptsIn } from './indic';
import { registeredSections, FULL_REPORT } from './registry';
import { roman } from './theme';
import { longDate } from './format';
import { brandFooter, type Brand, type ReportContext, type ReportSection } from './types';
import { cover, drawContents, reserveContents, welcome } from './sections/front';
import { glance } from './sections/glance';
import { grahas } from './sections/grahas';
import { houses } from './sections/houses';
import { yogas } from './sections/yogas';
import { vargas } from './sections/vargas';
import { dasha } from './sections/dasha';
import { timing } from './sections/timing';
import { glossary, colophon } from './sections/glossary';
import { note, summary } from './sections/summary';

export type { Brand, ReportContext, ReportSection } from './types';
export { registerReportSection } from './registry';

const BUILTIN: ReportSection[] = [
  { id: 'summary', title: 'One-page summary', order: 50, render: summary },
  { id: 'glance', title: 'Chart at a glance', order: 100, chapter: true, render: glance },
  { id: 'grahas', title: 'The nine grahas', order: 200, chapter: true, render: grahas },
  { id: 'houses', title: 'The twelve houses', order: 300, chapter: true, render: houses },
  { id: 'yogas', title: 'Yogas and doshas', order: 400, chapter: true, render: yogas },
  { id: 'vargas', title: 'Divisional charts', order: 500, chapter: true, render: vargas },
  { id: 'dasha', title: 'Planetary periods', order: 600, chapter: true, render: dasha, available: (c) => c.dashas.length > 0 },
  { id: 'timing', title: 'Good and hard times', order: 700, chapter: true, render: timing, available: (c) => !!c.timeline },
  { id: 'glossary', title: 'Glossary', order: 900, chapter: true, render: glossary },
];

export interface ReportOptions {
  /** Section ids to include, in any order. Defaults to the full report. */
  sections?: string[];
  /** The astrologer's name, practice, contact and logo, on the cover and at the foot of every page. */
  brand?: Brand;
  /** A consultation export: a short client summary, branded, with no general welcome page. */
  consultation?: boolean;
  /** Personal note printed after the cover. */
  note?: string;
  onProgress?: (message: string) => void;
  /** The app's language: readings are printed in it where a translation exists, and its script's fonts are embedded. */
  locale?: string;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

export async function generateReport(chart: Chart, opts: ReportOptions = {}): Promise<Blob> {
  if (!chart.engineContext) throw new Error('The report needs the Swiss Ephemeris engine, which has not loaded.');
  const say = opts.onProgress ?? (() => {});
  const { engine, chart: ec } = chart.engineContext;
  const now = new Date();

  say('Reading your chart…');
  await tick();
  const locale = opts.locale && hasReadings(opts.locale) ? await loadLocale(opts.locale) : 'en';
  const report = interpretChart(fromEngineChart(ec), { locale });
  const L = localizer(locale);
  const getNakshatra = (n: number) => L.nakshatra(n);
  const natal = natalFromChart(ec);
  const dashas = scoredDashasFromChart(ec, natal);
  const wanted = new Set(opts.sections ?? FULL_REPORT());

  let timeline = null;
  if (wanted.has('timing') || wanted.has('summary')) {
    say('Working out the seasons ahead…');
    await tick();
    try {
      const eph = engineEphemeris(engine, { ayanamsa: ec.meta.ayanamsa, nodeType: ec.meta.nodeType });
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1));
      const to = new Date(Date.UTC(now.getUTCFullYear() + 5, now.getUTCMonth() + 6, 1));
      timeline = buildTimeline(eph, natal, { dashas, from, to });
    } catch (e) {
      console.error('Timing unavailable for the report', e);
    }
  }

  say('Preparing the artwork…');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  // fonts for the language's script, and for any other script in what the person typed
  const scripts = scriptsIn(chart.input.name, chart.input.place, opts.note, opts.brand?.name, opts.brand?.practice, opts.brand?.tagline, opts.brand?.contact);
  const own = opts.locale ? LOCALE_SCRIPT[opts.locale] : undefined;
  if (own) scripts.add(own);
  const [art, indic] = await Promise.all([loadArt(chart.ascendant.longitude), registerFonts(pdf, scripts)]);

  const name = chart.input.name?.trim() || longDate(chart.input.date);
  const ctx: ReportContext = {
    chart, engine, engineChart: ec, report, getNakshatra, dashas, timeline, art, now, name,
    brand: opts.brand?.name?.trim() ? opts.brand : undefined, consultation: !!opts.consultation, note: opts.note, glossary: new Map(),
  };
  const doc = new ReportDoc(pdf, ctx.brand ? `${ctx.brand.name}  ·  for ${name}` : `${chart.input.name?.trim() ? name : 'Birth chart'}  ·  Vedic birth chart`, indic,
    { footer: ctx.brand ? brandFooter(ctx.brand) : undefined });

  say('Laying out the pages…');
  await cover(doc, ctx);
  const contentsPage = reserveContents(doc);
  if (ctx.note) note(doc, ctx);
  else if (!ctx.consultation) welcome(doc, ctx);

  const sections = [...BUILTIN, ...registeredSections()]
    .filter((s) => wanted.has(s.id) && (s.available?.(ctx) ?? true))
    .sort((a, b) => a.order - b.order);
  let chapter = 0;
  for (const s of sections) {
    say(`Writing ${s.title.toLowerCase()}…`);
    await tick();
    try {
      await s.render(doc, ctx, { numeral: s.chapter ? roman(++chapter) : '' });
    } catch (e) {
      // one broken section should not cost someone the whole report
      console.error(`Report section ${s.id} failed`, e);
    }
  }
  colophon(doc, ctx);
  drawContents(doc, contentsPage);
  doc.finish();

  pdf.setProperties({
    title: `${name} · Vedic birth chart report`,
    subject: 'Jyotisha birth chart report',
    author: ctx.brand?.name ?? 'Jyotisha Explorer',
    creator: 'Jyotisha Explorer',
    keywords: 'vedic astrology, jyotisha, birth chart, kundli',
  });
  return pdf.output('blob');
}

export function reportFileName(chart: Chart, kind: 'report' | 'consultation' = 'report') {
  const who = (chart.input.name?.trim() || chart.input.date).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  return `${who}-vedic-${kind}.pdf`;
}

export async function downloadReport(chart: Chart, opts: ReportOptions & { kind?: 'report' | 'consultation' } = {}) {
  const blob = await generateReport(chart, { consultation: opts.kind === 'consultation', ...opts });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = reportFileName(chart, opts.kind);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return blob;
}
