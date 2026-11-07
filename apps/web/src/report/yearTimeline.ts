/**
 * A printable year: twelve months of life weather, the windows worth marking,
 * a month-by-month table with the dasha running and the sky events, and the
 * sub-periods that fall in the year. Short (three or four pages), so it is
 * quick to make and good to print and pin up.
 */
import { jsPDF } from 'jspdf';
import type { Engine, Chart as EngineChart } from '@vedic/engine';
import { activeDashas, buildTimeline, flattenDashas, SATURN_PHASE_TEXT, type DashaPeriod, type Timeline } from '@vedic/timing';
import { engineEphemeris, natalFromChart, scoredDashasFromChart } from '@vedic/timing/engine';
import type { BirthInput } from '../types/chart';
import { PLANET_BY_ID, signInfo } from '../data/constants';
import { weatherChart } from './charts';
import { ReportDoc } from './doc';
import { registerFonts } from './fonts';
import { scriptsIn } from './indic';
import { fromTiming, longDate, monthYear, shortDate } from './format';
import { C, CONTENT_W, F, MARGIN } from './theme';

const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const abbr = (p: string) => PLANET_BY_ID[fromTiming(p)].abbr;
const chainText = (path: string[]) => path.map(abbr).join('–');
const feel = (s: number) => (s >= 25 ? 'Strong' : s >= 10 ? 'Supportive' : s > -10 ? 'Mixed' : s > -25 ? 'Demanding' : 'Hard');
const feelColor = (s: number) => (s >= 10 ? C.good : s <= -10 ? C.bad : C.mixed);
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export interface YearOptions {
  /** First month of the year shown; default this month */
  start?: Date;
}

export interface YearData {
  start: Date;
  end: Date;
  timeline: Timeline;
  months: { start: Date; end: Date; avg: number; best: number; worst: number; dasha: DashaPeriod[]; events: string[] }[];
  periods: DashaPeriod[];
}

/** Everything the year PDF prints, computed separately so it can be tested without drawing. */
export function yearData(engine: Engine, ec: EngineChart, opts: YearOptions = {}): YearData {
  const now = opts.start ?? new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), 1));
  const natal = natalFromChart(ec);
  const dashas = scoredDashasFromChart(ec, natal);
  const eph = engineEphemeris(engine, { ayanamsa: ec.meta.ayanamsa, nodeType: ec.meta.nodeType });
  const timeline = buildTimeline(eph, natal, { dashas, from: start, to: end, stepDays: 2 });

  const months: YearData['months'] = [];
  for (let i = 0; i < 12; i++) {
    const a = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const b = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i + 1, 1));
    const pts = timeline.series.filter((p) => p.date >= a && p.date < b);
    const vals = pts.map((p) => p.combined);
    const avg = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
    const events: string[] = [];
    for (const g of timeline.ingresses) {
      if (g.date >= a && g.date < b) events.push(`${g.planet} enters ${signInfo(g.toSign + 1).name}${g.retrograde ? ' (retrograde)' : ''}, ${g.date.getUTCDate()} ${MON[g.date.getUTCMonth()].slice(0, 3)}`);
    }
    for (const r of timeline.retrogrades) {
      if (r.stationRetrograde >= a && r.stationRetrograde < b) events.push(`${r.planet} turns retrograde, ${r.stationRetrograde.getUTCDate()} ${MON[a.getUTCMonth()].slice(0, 3)}`);
      if (r.stationDirect && r.stationDirect >= a && r.stationDirect < b) events.push(`${r.planet} turns direct, ${r.stationDirect.getUTCDate()} ${MON[a.getUTCMonth()].slice(0, 3)}`);
    }
    for (const d of flattenDashas(dashas, 2)) {
      if (d.start >= a && d.start < b) events.push(`${d.path.join('–')} antardasha begins, ${d.start.getUTCDate()} ${MON[a.getUTCMonth()].slice(0, 3)}`);
    }
    months.push({
      start: a, end: b, avg,
      best: vals.length ? Math.max(...vals) : 0,
      worst: vals.length ? Math.min(...vals) : 0,
      dasha: activeDashas(dashas, new Date((a.getTime() + b.getTime()) / 2)),
      events,
    });
  }
  const periods = flattenDashas(dashas, 3).filter((p) => p.end > start && p.start < end);
  return { start, end, timeline, months, periods };
}

export async function generateYearPdf(engine: Engine, ec: EngineChart, input: BirthInput, opts: YearOptions = {}): Promise<Blob> {
  const y = yearData(engine, ec, opts);
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const indic = await registerFonts(pdf, scriptsIn(input.name, input.place));
  const name = input.name?.trim() || longDate(input.date);
  const doc = new ReportDoc(pdf, `${name}  ·  the year ahead`, indic);
  const last = new Date(y.end.getTime() - 86_400_000);
  const range = `${monthYear(y.start)} to ${monthYear(last)}`;

  doc.newPage();
  doc.setRunning('The year ahead');
  doc.h2(`Your year, ${range}`, { kicker: input.name?.trim() ? `For ${input.name.trim()}` : 'Vedic timeline' });
  const moon = signInfo(Math.floor(ec.planets.moon.longitude / 30) + 1).name;
  const lagna = signInfo(Math.floor(ec.ascendant.longitude / 30) + 1).name;
  const cur = y.months[0].dasha;
  doc.facts([
    ['Born', `${longDate(input.date)}, ${input.time.slice(0, 5)}`],
    ['Place', input.place || '—'],
    ['Lagna and Moon', `${lagna} rising, Moon in ${moon}`],
    ['Dasha now', cur.map((d) => d.lord).join(' – ') || '—'],
  ], 2);
  doc.para('Every two days gets a score from −100 to +100: about 60% from the Vimshottari periods running, 40% from transits read from your Moon with vedha and ashtakavarga, measured against your own long-run baseline. Above the line is supportive, below is demanding.', { size: 8.6, color: C.muted });

  const wy = doc.y + 16;
  const pts = y.timeline.series.map((p) => ({ t: p.date.getTime(), v: p.combined }));
  const bands = y.timeline.saturn.sadeSati.map((s) => ({ from: s.start.getTime(), to: s.end.getTime(), label: 'Sade Sati', color: C.bad }));
  weatherChart(doc, pts, MARGIN.left, wy, CONTENT_W, 170, { today: Date.now(), bands });
  // month labels under the chart
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  for (const m of y.months) {
    const mid = (m.start.getTime() + m.end.getTime()) / 2;
    const x = MARGIN.left + ((mid - t0) / (t1 - t0)) * CONTENT_W;
    doc.line(MON[m.start.getUTCMonth()].slice(0, 3), x, wy + 176, { font: F.sansBold, size: 6.8, color: C.ink, align: 'center' });
  }
  doc.y = wy + 196;

  const windows = y.timeline.windows;
  doc.h3('Windows worth marking', { keep: 90 });
  if (windows.length) {
    doc.table(
      [
        { header: 'When', width: 0.27, font: F.sansBold },
        { header: 'Feel', width: 0.14 },
        { header: 'Dasha', width: 0.17 },
        { header: 'Main drivers', width: 0.42 },
      ],
      windows.map((w) => [
        `${shortDate(w.start)} – ${shortDate(w.end)}`,
        { text: w.tone === 'favourable' ? 'Supportive' : 'Demanding', color: w.tone === 'favourable' ? C.good : C.bad },
        chainText(w.dashaPath),
        w.drivers.slice(1).join('; ') || w.drivers[0] || '',
      ]),
      { size: 8 },
    );
  } else {
    doc.para('No stretch of three weeks or more stands out clearly this year: the months run close to your usual baseline.', { size: 9 });
  }

  doc.h2('Month by month', { kicker: range, keep: 200 });
  doc.table(
    [
      { header: 'Month', width: 0.15, font: F.sansBold },
      { header: 'Dasha', width: 0.14 },
      { header: 'Score', width: 0.1, align: 'center' },
      { header: 'Feel', width: 0.12 },
      { header: 'In the sky and in the periods', width: 0.49 },
    ],
    y.months.map((m) => [
      `${MON[m.start.getUTCMonth()]} ${m.start.getUTCFullYear()}`,
      chainText(m.dasha.map((d) => d.lord)),
      { text: signed(m.avg), color: feelColor(m.avg) },
      { text: feel(m.avg), color: feelColor(m.avg) },
      m.events.slice(0, 5).join('; ') || '—',
    ]),
    { size: 7.8 },
  );

  doc.h2('Periods in the year', { kicker: 'Vimshottari pratyantardashas', keep: 160 });
  doc.para('The sub-sub-periods that run during the year, with how well their lords work for your chart. The finer sookshma and prana levels are in the app.', { size: 8.6, color: C.muted });
  doc.table(
    [
      { header: 'From', width: 0.19 },
      { header: 'To', width: 0.19 },
      { header: 'Maha – antar – pratyantar', width: 0.38, font: F.sansBold },
      { header: 'Lord score', width: 0.24 },
    ],
    y.periods.map((p) => [shortDate(p.start), shortDate(p.end), p.path.join(' – '), { text: `${signed(p.score)} · ${feel(p.score).toLowerCase()}`, color: feelColor(p.score) }]),
    { size: 7.8 },
  );

  const sat = y.timeline.saturn.phases.filter((p) => p.end > y.start && p.start < y.end);
  if (sat.length) {
    doc.h3('Saturn this year', { keep: 80 });
    for (const p of sat) doc.para(`${shortDate(p.start)} – ${shortDate(p.end)}: ${SATURN_PHASE_TEXT[p.kind]}`, { size: 8.8 });
  }

  doc.callout({
    label: 'Please read',
    body: 'A traditional reading for reflection and planning, not a prediction you can rely on, and not medical, legal or financial advice. The scores weigh classical rules in this site’s own way. A birth time a few minutes off moves the dasha dates by days or weeks.',
    edge: C.mixed,
  });
  doc.para('Made with Jyotisha Explorer, free and open source (AGPL-3.0). Positions from the Swiss Ephemeris.', { size: 7.6, color: C.muted });
  doc.finish();
  pdf.setProperties({ title: `${name} · the year ahead (${range})`, creator: 'Jyotisha Explorer', subject: 'Vedic yearly timeline' });
  return pdf.output('blob');
}

export async function downloadYearPdf(engine: Engine, ec: EngineChart, input: BirthInput, opts: YearOptions = {}) {
  const blob = await generateYearPdf(engine, ec, input, opts);
  const who = (input.name?.trim() || input.date).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  const start = opts.start ?? new Date();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${who}-year-${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
