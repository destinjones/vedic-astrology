import { getSign } from '@vedic/interpretations';
import { NAKSHATRAS, PLANET_BY_ID, signInfo } from '../../data/constants';
import { northChart } from '../charts';
import type { ReportDoc } from '../doc';
import { fromTiming, list, monthYear, shortDate, toneWord } from '../format';
import { C, CONTENT_W, F, MARGIN } from '../theme';
import type { ReportContext } from '../types';
import { DASHA_FLAVOR } from './dasha';

/** A short overview for a consultation: everything that matters most, in two pages. */
export function summary(doc: ReportDoc, ctx: ReportContext) {
  const { chart, report, dashas, now } = ctx;
  doc.newPage();
  doc.setRunning('Your chart in brief');
  doc.h2('Your chart in brief', { kicker: 'Summary', toc: true });
  const moon = chart.planets.find((p) => p.id === 'moon')!;
  const S = 210;
  const y = doc.y;
  northChart(doc, chart, chart.vargas.D1!, MARGIN.left, y, S);
  const maha = dashas.find((d) => d.start <= now && now < d.end);
  const antar = maha?.children?.find((d) => d.start <= now && now < d.end);
  const tx = MARGIN.left + S + 24;
  const tw = CONTENT_W - S - 24;
  const facts: [string, string][] = [
    ['Ascendant', `${signInfo(chart.ascendant.sign).name} (${signInfo(chart.ascendant.sign).sanskrit})`],
    ['Moon sign', `${signInfo(moon.sign).name} (${signInfo(moon.sign).sanskrit})`],
    ['Birth star', `${NAKSHATRAS[moon.nakshatra - 1].name}, pada ${moon.pada}`],
    ['Running now', maha ? `${PLANET_BY_ID[fromTiming(maha.lord)].name} mahadasha${antar ? `, ${PLANET_BY_ID[fromTiming(antar.lord)].name} sub-period` : ''}` : '—'],
  ];
  let fy = y;
  for (const [k, v] of facts) {
    doc.line(k.toUpperCase(), tx, fy, { font: F.sansBold, size: 6.6, color: C.gold, charSpace: 1 });
    const lines = doc.wrap(v, tw, F.serifBold, 14);
    lines.forEach((ln, i) => doc.line(ln, tx, fy + 11 + i * 16, { font: F.serifBold, size: 14, color: C.ink }));
    fy += 11 + lines.length * 16 + 12;
  }
  doc.y = Math.max(y + S + 16, fy);
  const asc = getSign(chart.ascendant.sign);
  doc.para(`${asc.name} rising gives a temperament that is ${asc.flavor}. With the Moon in ${signInfo(moon.sign).name}, feelings move ${getSign(moon.sign).style}. ${maha ? `The present ${PLANET_BY_ID[fromTiming(maha.lord)].name} period, until ${monthYear(maha.end)}, emphasises ${DASHA_FLAVOR[fromTiming(maha.lord)]}; its score for this chart is ${maha.score > 0 ? '+' : ''}${maha.score} (${toneWord(maha.score).toLowerCase()}).` : ''}`, { font: F.serif, size: 12, leading: 1.45, color: C.ink, after: 10 });

  doc.twoLists(
    { title: 'Greatest strengths', color: C.good, items: report.highlights.strengths.slice(0, 4).map((r) => `${r.title}: ${r.summary}`) },
    { title: 'Main lessons', color: C.bad, items: report.highlights.challenges.slice(0, 4).map((r) => `${r.title}: ${r.summary}`) },
    8.4,
  );
  const strong = report.yogas.filter((y) => y.strength === 'strong');
  const doshas = report.doshas.filter((d) => d.present);
  doc.h3('Yogas and doshas', { keep: 60 });
  doc.para(`${report.yogas.length} yogas form in this chart${strong.length ? `, the strongest being ${list(strong.slice(0, 5).map((y) => y.name))}` : ''}. ${doshas.length ? `Doshas to keep in mind: ${list(doshas.map((d) => `${d.name} (${d.severity === 'cancelled' ? 'cancelled' : d.severity})`))}.` : 'No doshas form.'}`, { size: 9.2 });
  const windows = ctx.timeline?.windows.filter((w) => w.end > now).slice(0, 5) ?? [];
  if (windows.length) {
    doc.h3('The next windows', { keep: 80 });
    doc.bullets(windows.map((w) => `${shortDate(w.start)} – ${shortDate(w.end)}: ${w.tone === 'favourable' ? 'supportive' : 'demanding'}, during ${w.dashaPath.map((p) => PLANET_BY_ID[fromTiming(p)].name).join('–')}.`), { size: 8.8, mark: C.gold });
  }
}

/** The astrologer's personal note, on its own page after the cover. */
export function note(doc: ReportDoc, ctx: ReportContext) {
  if (!ctx.note?.trim()) return;
  doc.newPage();
  doc.setRunning('A note from your astrologer');
  doc.y += 20;
  doc.label(ctx.brand ? `From ${ctx.brand.name}` : 'A personal note');
  ctx.note.trim().split(/\n\s*\n/).forEach((p) => doc.para(p.replace(/\s*\n\s*/g, ' '), { font: F.serif, size: 13, leading: 1.5, color: C.body, after: 10 }));
  if (ctx.brand) {
    doc.y += 8;
    doc.para(ctx.brand.name, { font: F.serifItalic, size: 16, color: C.ink, after: 2 });
    if (ctx.brand.contact) doc.para(ctx.brand.contact, { size: 8.4, color: C.muted });
  }
}
