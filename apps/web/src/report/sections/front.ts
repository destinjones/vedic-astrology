import { NAKSHATRAS, signInfo } from '../../data/constants';
import type { ReportDoc } from '../doc';
import { longDate } from '../format';
import { C, F, MARGIN, PAGE } from '../theme';
import type { ReportContext } from '../types';

export async function cover(doc: ReportDoc, ctx: ReportContext) {
  const { chart, art } = ctx;
  doc.coverPage();
  const { pdf } = doc;
  const artH = 540;
  const s = Math.max(PAGE.w / art.hero.w, artH / art.hero.h);
  const w = art.hero.w * s;
  const h = art.hero.h * s;
  pdf.addImage(art.hero.data, 'JPEG', (PAGE.w - w) / 2 - 40, 0, w, h, art.hero.alias, 'FAST');
  // fade the art into the night
  for (let i = 0; i < 28; i++) {
    doc.fill(C.night).opacity(Math.min(1, (i / 27) ** 1.6)).pdf.rect(0, 300 + i * 9, PAGE.w, 9.5, 'F');
  }
  doc.fill(C.night).opacity(0.35).pdf.rect(0, 0, PAGE.w, 90, 'F');
  doc.opacity(1).fill(C.night).pdf.rect(0, 552, PAGE.w, PAGE.h - 552, 'F');
  doc.stars(0, 430, PAGE.w, PAGE.h - 430, 150, C.starlight, 99);

  // frame
  doc.stroke(C.goldLight, 0.6);
  pdf.rect(22, 22, PAGE.w - 44, PAGE.h - 44, 'S');
  doc.stroke(C.gold, 0.3);
  pdf.rect(27, 27, PAGE.w - 54, PAGE.h - 54, 'S');
  for (const [cx, cy] of [[22, 22], [PAGE.w - 22, 22], [22, PAGE.h - 22], [PAGE.w - 22, PAGE.h - 22]]) doc.diamond(cx, cy, 4, C.goldLight);

  const brand = ctx.brand;
  if (brand) {
    let by = 44;
    if (brand.logo) {
      const props = pdf.getImageProperties(brand.logo);
      const k = Math.min(120 / props.width, 54 / props.height);
      const lw = props.width * k;
      const lh = props.height * k;
      pdf.addImage(brand.logo, props.fileType || 'PNG', PAGE.w / 2 - lw / 2, by, lw, lh, 'brand-logo', 'FAST');
      by += lh + 10;
    }
    doc.line(brand.name.toUpperCase(), PAGE.w / 2, by, { font: F.sansBold, size: 8, color: '#FFFFFF', charSpace: 2.2, align: 'center' });
    if (brand.tagline) doc.line(brand.tagline, PAGE.w / 2, by + 14, { font: F.serifItalic, size: 11, color: C.goldLight, align: 'center' });
  } else {
    doc.line('JYOTISHA  ·  A VEDIC BIRTH CHART REPORT', PAGE.w / 2, 46, { font: F.sansBold, size: 7.2, color: C.goldLight, charSpace: 2.4, align: 'center' });
  }

  const named = !!chart.input.name?.trim();
  let y = 462;
  doc.line(named ? 'The birth chart of' : 'The birth chart for', PAGE.w / 2, y, { font: F.serifItalic, size: 19, color: C.starlight, align: 'center' });
  y += 30;
  const title = named ? chart.input.name!.trim() : longDate(chart.input.date);
  const lines = doc.wrap(title, PAGE.w - 120, F.serifBold, 46);
  lines.slice(0, 2).forEach((ln, i) => doc.line(ln, PAGE.w / 2, y + i * 48, { font: F.serifBold, size: 46, color: '#FFFFFF', align: 'center' }));
  y += Math.min(2, lines.length) * 48 + 14;
  doc.ornament(PAGE.w / 2, y, 90, C.goldLight);
  y += 16;
  const when = `${named ? `${longDate(chart.input.date)}  ·  ` : ''}${chart.input.time}  ·  ${chart.input.place}`;
  doc.line(when, PAGE.w / 2, y, { font: F.sans, size: 8.6, color: C.starlight, align: 'center', charSpace: 0.3 });

  // three medallions: lagna, moon sign, janma nakshatra
  const moon = chart.planets.find((p) => p.id === 'moon')!;
  const meds = await Promise.all([art.rashi(chart.ascendant.sign, C.night), art.rashi(moon.sign, C.night), art.nakshatra(moon.nakshatra, C.night)]);
  const labels: [string, string][] = [
    ['Lagna', `${signInfo(chart.ascendant.sign).sanskrit} · ${signInfo(chart.ascendant.sign).name}`],
    ['Moon sign', `${signInfo(moon.sign).sanskrit} · ${signInfo(moon.sign).name}`],
    ['Birth star', `${NAKSHATRAS[moon.nakshatra - 1].name}, pada ${moon.pada}`],
  ];
  const size = 92;
  const gap = 58;
  const x0 = PAGE.w / 2 - (size * 3 + gap * 2) / 2;
  const my = 628;
  meds.forEach((m, i) => {
    const x = x0 + i * (size + gap);
    pdf.addImage(m.data, 'JPEG', x, my, size, size, m.alias, 'FAST');
    doc.line(labels[i][0].toUpperCase(), x + size / 2, my + size + 10, { font: F.sansBold, size: 6.6, color: C.goldLight, charSpace: 1.6, align: 'center' });
    doc.line(labels[i][1], x + size / 2, my + size + 22, { font: F.serif, size: 11.5, color: '#FFFFFF', align: 'center' });
  });

  if (brand?.contact) doc.line(brand.contact, PAGE.w / 2, PAGE.h - 66, { font: F.sans, size: 7.4, color: C.starlight, align: 'center', charSpace: 0.4 });
  doc.line(`${brand ? `A consultation summary prepared by ${brand.name}` : 'Sidereal zodiac'}  ·  ${ctx.engineChart.meta.ayanamsaName} ayanamsa  ·  ${longDate(ctx.now)}`, PAGE.w / 2, PAGE.h - 52, { font: F.sans, size: 6.8, color: C.faint, align: 'center', charSpace: 0.6 });
}

/** Page 2 is reserved for the contents and filled in at the end, when page numbers are known. */
export function reserveContents(doc: ReportDoc) {
  doc.newPage();
  doc.setRunning('Contents');
  return doc.page;
}

export function drawContents(doc: ReportDoc, page: number) {
  doc.pdf.setPage(page);
  let y = MARGIN.top + 26;
  doc.line('CONTENTS', PAGE.w / 2, y, { font: F.sansBold, size: 7.5, color: C.gold, charSpace: 2.4, align: 'center' });
  y += 18;
  doc.line('What is inside', PAGE.w / 2, y, { font: F.serifBold, size: 30, color: C.ink, align: 'center' });
  y += 46;
  doc.ornament(PAGE.w / 2, y, 60);
  y += 30;
  const x = MARGIN.left + 20;
  const right = PAGE.w - MARGIN.right - 20;
  const entries = doc.toc;
  const subs = entries.filter((e) => e.level === 2).length;
  const tight = entries.length > 34;
  for (const e of entries) {
    if (e.level === 1) {
      y += tight ? 6 : 10;
      doc.line(e.numeral ?? '', x, y, { font: F.serif, size: 13, color: C.gold });
      doc.line(e.title, x + 34, y, { font: F.serifBold, size: 15, color: C.ink });
      doc.line(String(e.page), right, y, { font: F.serifBold, size: 13, color: C.ink, align: 'right' });
      y += tight ? 20 : 23;
    } else if (subs) {
      const tw = doc.width(e.title, F.sans, 8.6);
      doc.line(e.title, x + 34, y, { font: F.sans, size: 8.6, color: C.body });
      doc.stroke(C.rule, 0.5);
      doc.pdf.setLineDashPattern([0.6, 2.4], 0);
      doc.pdf.line(x + 40 + tw, y + 7.5, right - 18, y + 7.5);
      doc.pdf.setLineDashPattern([], 0);
      doc.line(String(e.page), right, y, { font: F.sans, size: 8.6, color: C.muted, align: 'right' });
      y += tight ? 13 : 15;
    }
    if (y > PAGE.h - MARGIN.bottom - 10) break;
  }
}

export function welcome(doc: ReportDoc, ctx: ReportContext) {
  doc.newPage();
  doc.setRunning('Welcome');
  const named = ctx.chart.input.name?.trim();
  doc.y += 10;
  doc.label('Before you begin');
  doc.para(named ? `Dear ${named.split(' ')[0]},` : 'Welcome,', { font: F.serifBold, size: 24, color: C.ink, leading: 1.2, after: 10 });
  doc.para(
    'This report is a map of the sky at the moment you were born, read through Jyotisha, the astrology of India. Jyotisha means "the science of light". For more than two thousand years its astrologers have read a birth chart as a picture of the karma a person arrives with: the gifts that come easily, the lessons that keep returning, and the seasons of life when each of them ripens.',
    { font: F.serif, size: 12.5, leading: 1.5, color: C.body, after: 8 },
  );
  doc.para(
    'Every placement in these pages is calculated from your birth date, time and place with the Swiss Ephemeris, the same astronomical engine used by professional astrologers, in the sidereal zodiac that Vedic astrology uses. Every reading comes with the reason it applies to you, so you can check it against the chart yourself. The report is written to teach as it goes: by the last page you should be able to look at your own chart and see why it says what it says.',
    { font: F.serif, size: 12.5, leading: 1.5, color: C.body, after: 14 },
  );
  doc.h3('How to read this report');
  doc.bullets([
    'Start with Chapter I, your chart at a glance. The ascendant (lagna), the Moon and your birth star (janma nakshatra) are the three pillars every other reading rests on.',
    'The nine grahas each get their own pages. Read the planet in its sign (how it behaves), its house (where in life it acts) and its nakshatra (the deeper motive behind it).',
    'Yogas are special combinations that lift a chart; doshas are combinations that ask for care. Both list the exact planets and houses involved.',
    'The dasha and timing chapters turn the chart into a calendar: which planet is "running" your life now, and which months ahead are likely to feel supportive or demanding.',
    'Unfamiliar words are explained in the boxes headed "Understanding" and again in the glossary at the back.',
  ]);
  doc.space(4);
  doc.callout({
    label: 'A note on free will',
    body: 'Jyotisha describes tendencies and timing, not fixed fate. The tradition itself says a chart shows the field you play on, not the moves you make. Read the challenging parts as weather to prepare for, and the supportive parts as tailwinds worth using.',
  });
  const facts = ctx.engineChart.meta;
  doc.space(6);
  doc.label('Calculated for');
  doc.facts([
    ['Date of birth', longDate(ctx.chart.input.date)],
    ['Time of birth', `${ctx.chart.input.time} (${facts.timezone})`],
    ['Place', ctx.chart.input.place],
  ], 3, { size: 12 });
  doc.y += 4;
  doc.para(`Latitude ${ctx.chart.input.latitude.toFixed(4)}°, longitude ${ctx.chart.input.longitude.toFixed(4)}°. UTC ${facts.utc.replace('T', ' ').slice(0, 16)}. ${facts.ayanamsaName} ayanamsa ${ctx.chart.meta.ayanamsaValue.toFixed(4)}°. Whole-sign houses, ${facts.nodeType === 'true' ? 'true' : 'mean'} lunar nodes.${facts.localMeanTime ? ' The birth predates standard time in this zone, so local mean time was used.' : ''}`, { size: 8, color: C.muted });
}
