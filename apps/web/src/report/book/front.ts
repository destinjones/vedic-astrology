import { NAKSHATRAS, PLANET_BY_ID, signInfo } from '../../data/constants';
import type { ReportDoc } from '../doc';
import { fromTiming, longDate, monthYear } from '../format';
import { C, CONTENT_W, F, MARGIN, PAGE } from '../theme';
import { astrologerNote, type BookContext, prose, signature } from './common';
import { lines, paragraphs } from './draft';

const named = (ctx: BookContext) => ctx.chart.input.name?.trim() || '';
const first = (ctx: BookContext) => named(ctx).split(/\s+/)[0] || '';

/**
 * The front cover, drawn with the trim's top-left at the origin. `b` is how far
 * the background runs past the trim (the bleed), so the same art serves the
 * screen edition's first page and the print cover spread.
 */
export async function frontCover(doc: ReportDoc, ctx: BookContext, b = 0) {
  const { pdf } = doc;
  const { chart, art } = ctx;
  doc.fill(C.night).pdf.rect(-b, -b, PAGE.w + 2 * b, PAGE.h + 2 * b, 'F');
  const artH = 520;
  const s = Math.max((PAGE.w + 2 * b) / art.hero.w, (artH + b) / art.hero.h);
  pdf.addImage(art.hero.data, 'JPEG', (PAGE.w - art.hero.w * s) / 2 - 40, -b, art.hero.w * s, art.hero.h * s, art.hero.alias, 'FAST');
  for (let i = 0; i < 28; i++) doc.fill(C.night).opacity(Math.min(1, (i / 27) ** 1.6)).pdf.rect(-b, 280 + i * 9, PAGE.w + 2 * b, 9.5, 'F');
  doc.fill(C.night).opacity(0.35).pdf.rect(-b, -b, PAGE.w + 2 * b, 90 + b, 'F');
  doc.opacity(1).fill(C.night).pdf.rect(-b, 532, PAGE.w + 2 * b, PAGE.h - 532 + b, 'F');
  doc.stars(-b, 400, PAGE.w + 2 * b, PAGE.h - 400 + b, 170, C.starlight, 77);

  // a double gold frame, kept well inside the trim
  doc.stroke(C.goldLight, 0.6);
  pdf.rect(26, 26, PAGE.w - 52, PAGE.h - 52, 'S');
  doc.stroke(C.gold, 0.3);
  pdf.rect(31, 31, PAGE.w - 62, PAGE.h - 62, 'S');
  for (const [cx, cy] of [[26, 26], [PAGE.w - 26, 26], [26, PAGE.h - 26], [PAGE.w - 26, PAGE.h - 26]]) doc.diamond(cx, cy, 4, C.goldLight);

  const brand = ctx.brand;
  let by = 50;
  if (brand?.logo) {
    const props = pdf.getImageProperties(brand.logo);
    const k = Math.min(120 / props.width, 50 / props.height);
    pdf.addImage(brand.logo, props.fileType || 'PNG', PAGE.w / 2 - (props.width * k) / 2, by, props.width * k, props.height * k, 'brand-logo', 'FAST');
    by += props.height * k + 10;
  }
  doc.line((brand ? brand.name : 'Jyotisha  ·  Vedic astrology').toUpperCase(), PAGE.w / 2, by, { font: F.sansBold, size: 7.6, color: C.goldLight, charSpace: 2.4, align: 'center' });

  let y = 440;
  doc.line(ctx.draft.title || 'The Life Chart Book', PAGE.w / 2, y, { font: F.serifItalic, size: 21, color: C.starlight, align: 'center' });
  y += 34;
  const title = named(ctx) || longDate(chart.input.date);
  const tl = doc.wrap(title, PAGE.w - 120, F.serifBold, 50);
  tl.slice(0, 2).forEach((ln, i) => doc.line(ln, PAGE.w / 2, y + i * 52, { font: F.serifBold, size: 50, color: '#FFFFFF', align: 'center' }));
  y += Math.min(2, tl.length) * 52 + 14;
  doc.ornament(PAGE.w / 2, y, 90, C.goldLight);
  y += 16;
  doc.line(`${named(ctx) ? `${longDate(chart.input.date)}  ·  ` : ''}${chart.input.time}  ·  ${chart.input.place}`, PAGE.w / 2, y, { font: F.sans, size: 8.6, color: C.starlight, align: 'center', charSpace: 0.3 });

  const moon = chart.planets.find((p) => p.id === 'moon')!;
  const meds = await Promise.all([art.rashi(chart.ascendant.sign, C.night), art.rashi(moon.sign, C.night), art.nakshatra(moon.nakshatra, C.night)]);
  const labels: [string, string][] = [
    ['Lagna', `${signInfo(chart.ascendant.sign).sanskrit} · ${signInfo(chart.ascendant.sign).name}`],
    ['Moon', `${signInfo(moon.sign).sanskrit} · ${signInfo(moon.sign).name}`],
    ['Birth star', NAKSHATRAS[moon.nakshatra - 1].name],
  ];
  const size = 86;
  const gap = 62;
  const x0 = PAGE.w / 2 - (size * 3 + gap * 2) / 2;
  const my = 626;
  meds.forEach((m, i) => {
    const x = x0 + i * (size + gap);
    pdf.addImage(m.data, 'JPEG', x, my, size, size, m.alias, 'FAST');
    doc.line(labels[i][0].toUpperCase(), x + size / 2, my + size + 10, { font: F.sansBold, size: 6.6, color: C.goldLight, charSpace: 1.6, align: 'center' });
    doc.line(labels[i][1], x + size / 2, my + size + 22, { font: F.serif, size: 11.5, color: '#FFFFFF', align: 'center' });
  });
  doc.line(ctx.byline ? `Prepared by ${ctx.byline}` : 'A personal book of the birth chart', PAGE.w / 2, PAGE.h - 56, { font: F.serifItalic, size: 11, color: C.goldLight, align: 'center' });
}

/** Title page (a right-hand page) and its back: the birth details and how they were calculated. */
export function titlePages(doc: ReportDoc, ctx: BookContext) {
  doc.plainPage();
  doc.stars(MARGIN.left, 120, CONTENT_W, 120, 40, C.goldLight, 5);
  let y = 300;
  doc.line((ctx.draft.title || 'The Life Chart Book').toUpperCase(), PAGE.w / 2, y, { font: F.sansBold, size: 8, color: C.gold, charSpace: 3, align: 'center' });
  y += 26;
  const title = named(ctx) || longDate(ctx.chart.input.date);
  const tl = doc.wrap(title, CONTENT_W, F.serifBold, 44);
  tl.slice(0, 2).forEach((ln, i) => doc.line(ln, PAGE.w / 2, y + i * 46, { font: F.serifBold, size: 44, color: C.ink, align: 'center' }));
  y += Math.min(2, tl.length) * 46 + 16;
  doc.ornament(PAGE.w / 2, y, 70);
  y += 22;
  doc.line('A birth chart read through Jyotisha, the astrology of India,', PAGE.w / 2, y, { font: F.serifItalic, size: 14, color: C.body, align: 'center' });
  doc.line('with the teaching behind every reading', PAGE.w / 2, y + 19, { font: F.serifItalic, size: 14, color: C.body, align: 'center' });
  if (ctx.by) {
    doc.line('PREPARED BY', PAGE.w / 2, PAGE.h - 190, { font: F.sansBold, size: 6.8, color: C.muted, charSpace: 2, align: 'center' });
    doc.line(ctx.by, PAGE.w / 2, PAGE.h - 174, { font: F.serifBold, size: 20, color: C.ink, align: 'center' });
    const sub = [ctx.draft.authorTitle, ctx.brand && ctx.brand.name !== ctx.by ? ctx.brand.name : ''].filter(Boolean).join(', ');
    if (sub) doc.line(sub, PAGE.w / 2, PAGE.h - 148, { font: F.serifItalic, size: 12, color: C.muted, align: 'center' });
  } else if (ctx.brand) {
    doc.line(ctx.brand.name, PAGE.w / 2, PAGE.h - 174, { font: F.serifBold, size: 20, color: C.ink, align: 'center' });
    if (ctx.brand.tagline) doc.line(ctx.brand.tagline, PAGE.w / 2, PAGE.h - 148, { font: F.serifItalic, size: 12, color: C.muted, align: 'center' });
  }
  doc.line(longDate(ctx.now), PAGE.w / 2, PAGE.h - 110, { font: F.sans, size: 8, color: C.muted, align: 'center', charSpace: 0.5 });

  // the verso: particulars, like a book's copyright page
  doc.plainPage();
  const m = ctx.engineChart.meta;
  const i = ctx.chart.input;
  doc.y = PAGE.h - 360;
  doc.label('Calculated for');
  doc.facts([
    ['Name', named(ctx) || '—'],
    ['Born', `${longDate(i.date)}, ${i.time}`],
    ['Place', i.place],
  ], 3, { size: 11 });
  doc.para(`Latitude ${i.latitude.toFixed(4)}°, longitude ${i.longitude.toFixed(4)}°, ${m.timezone}. Universal time ${m.utc.replace('T', ' ').slice(0, 16)}. Sidereal zodiac, ${m.ayanamsaName} ayanamsa ${ctx.chart.meta.ayanamsaValue.toFixed(4)}°. Whole-sign houses, ${m.nodeType === 'true' ? 'true' : 'mean'} lunar nodes, Vimshottari dashas with a 365.25-day year. Positions from the Swiss Ephemeris.${m.localMeanTime ? ' The birth predates standard time in this zone, so local mean time was used.' : ''}`, { size: 8.2, color: C.muted, after: 14 });
  const who = [ctx.byline, ctx.brand && ctx.brand.name !== ctx.by ? ctx.brand.name : ''].filter(Boolean).join(', ');
  doc.para(`Prepared ${longDate(ctx.now)}${who ? ` by ${who}` : ''}${ctx.brand?.contact ? ` (${ctx.brand.contact})` : ''} with Jyotisha Explorer, a free and open-source Vedic astrology toolkit. The calculations and readings were made in a web browser; nothing about this chart was sent anywhere to make this book.`, { size: 8.2, color: C.muted, after: 14 });
  doc.para('This book is for reflection and education. It is not medical, legal, financial or psychological advice. A birth time a few minutes out can move the ascendant degree, the divisional charts and the dasha dates, so check the time on your birth record if you can.', { size: 8.2, color: C.muted });
}

export function dedication(doc: ReportDoc, ctx: BookContext) {
  const text = paragraphs(ctx.draft.dedication);
  if (!text.length) return;
  doc.toRecto();
  doc.plainPage();
  doc.y = 280;
  doc.ornament(PAGE.w / 2, doc.y, 30);
  doc.y += 30;
  for (const p of text) doc.para(p, { font: F.serifItalic, size: 16, leading: 1.45, color: C.ink, align: 'center', x: MARGIN.left + 50, width: CONTENT_W - 100, after: 10 });
  if (ctx.by) doc.para(`— ${ctx.by}`, { font: F.serif, size: 12, color: C.muted, align: 'center', after: 0 });
}

/** Two pages for the contents, filled in at the end when every page number is known. */
export function reserveContents(doc: ReportDoc) {
  doc.toRecto();
  doc.newPage();
  doc.setRunning('Contents');
  const a = doc.page;
  doc.newPage();
  doc.setRunning('Contents');
  return [a, doc.page] as const;
}

export function drawContents(doc: ReportDoc, pages: readonly [number, number]) {
  let pi = 0;
  doc.pdf.setPage(pages[0]);
  let y = MARGIN.top + 20;
  doc.line('CONTENTS', PAGE.w / 2, y, { font: F.sansBold, size: 7.5, color: C.gold, charSpace: 2.4, align: 'center' });
  doc.line('What is inside', PAGE.w / 2, y + 16, { font: F.serifBold, size: 30, color: C.ink, align: 'center' });
  doc.ornament(PAGE.w / 2, y + 62, 60);
  y += 86;
  const x = MARGIN.left + 12;
  const right = PAGE.w - MARGIN.right - 12;
  const bottom = PAGE.h - MARGIN.bottom - 16;
  const total = doc.toc.reduce((s, e) => s + (e.level === 1 ? 32 : 14), 0);
  const subs = total < (bottom - y) + (bottom - MARGIN.top - 10);
  const next = () => { if (pi === 0) { pi = 1; doc.pdf.setPage(pages[1]); y = MARGIN.top + 10; return true; } return false; };
  for (const e of doc.toc) {
    if (e.level === 2 && !subs) continue;
    const h = e.level === 1 ? 32 : 14;
    if (y + h > bottom && !next()) break;
    if (e.level === 1) {
      y += 9;
      doc.line(e.numeral ?? '', x, y, { font: F.serif, size: 13, color: C.gold });
      doc.line(e.title, x + 36, y, { font: F.serifBold, size: 15, color: C.ink });
      doc.line(String(e.page), right, y, { font: F.serifBold, size: 13, color: C.ink, align: 'right' });
      y += 23;
    } else {
      const t = e.title.length > 70 ? `${e.title.slice(0, 68)}…` : e.title;
      const tw = doc.width(t, F.sans, 8.4);
      doc.line(t, x + 36, y, { font: F.sans, size: 8.4, color: C.body });
      doc.stroke(C.rule, 0.5);
      doc.pdf.setLineDashPattern([0.6, 2.4], 0);
      doc.pdf.line(x + 42 + tw, y + 7.5, right - 18, y + 7.5);
      doc.pdf.setLineDashPattern([], 0);
      doc.line(String(e.page), right, y, { font: F.sans, size: 8.4, color: C.muted, align: 'right' });
      y += 14;
    }
  }
}

const DEFAULT_LETTER = [
  'This book is yours to keep. It holds a map of the sky at the moment you were born, read through Jyotisha, the astrology of India, whose name means "the science of light". For more than two thousand years its astrologers have read a birth chart as a picture of the karma a person arrives with: the gifts that come easily, the lessons that return, and the seasons of life in which each of them ripens.',
  'It is written to teach as it goes. Each chapter first explains an idea of the tradition, in plain words, and then shows what it means in your own chart, with the reason it applies to you and, where there is one, the classical text it comes from. You do not need to know any astrology to begin. By the last page you should be able to look at your own chart and see why it says what it says.',
  'Read it slowly, and come back to it. The forecast chapters are meant to be reopened each year, and the ruled pages are for your own notes: what you notice, what proves true, and what you would ask next time.',
];

export function letter(doc: ReportDoc, ctx: BookContext) {
  doc.toRecto();
  doc.newPage();
  doc.setRunning(ctx.by ? `A letter from ${ctx.by}` : 'Before you begin');
  doc.y += 16;
  doc.label(ctx.by ? `A letter from ${ctx.by}` : 'Before you begin');
  doc.para(first(ctx) ? `Dear ${first(ctx)},` : 'Dear reader,', { font: F.serifBold, size: 24, color: C.ink, leading: 1.2, after: 12 });
  const own = paragraphs(ctx.draft.letter);
  prose(doc, own.length ? own : DEFAULT_LETTER, { size: 12.4 });
  signature(doc, ctx);
}

/** "The heart of your chart": the astrologer's takeaways, or the strongest findings when there are none. */
export function heart(doc: ReportDoc, ctx: BookContext) {
  const { chart, report, dashas, now } = ctx;
  doc.newPage();
  doc.setRunning('The heart of your chart');
  doc.h2('The heart of your chart', { kicker: 'If you read one page', toc: true });
  const own = lines(ctx.draft.takeaways);
  const moon = chart.planets.find((p) => p.id === 'moon')!;
  const maha = dashas.find((d) => d.start <= now && now < d.end);
  if (own.length) {
    doc.para(ctx.by ? `${ctx.by} chose these as the things in your chart most worth remembering.` : 'The things in your chart most worth remembering.', { font: F.serifItalic, size: 12.5, color: C.muted, after: 12 });
    own.forEach((t, i) => {
      doc.ensure(50);
      const top = doc.y;
      doc.line(String(i + 1), doc.x, top - 2, { font: F.serifBold, size: 24, color: C.goldLight });
      doc.para(t, { font: F.serif, size: 12.5, leading: 1.45, color: C.ink, x: doc.x + 34, after: 12 });
    });
  } else {
    doc.para('The three foundations of your chart, its greatest gifts and its main lessons, in one place.', { font: F.serifItalic, size: 12.5, color: C.muted, after: 10 });
    doc.facts([
      ['Rising sign', `${signInfo(chart.ascendant.sign).name} (${signInfo(chart.ascendant.sign).sanskrit})`],
      ['Moon sign', `${signInfo(moon.sign).name} (${signInfo(moon.sign).sanskrit})`],
      ['Birth star', `${NAKSHATRAS[moon.nakshatra - 1].name}, pada ${moon.pada}`],
    ], 3, { size: 13 });
    if (maha) doc.para(`You are in the ${PLANET_BY_ID[fromTiming(maha.lord)].name} mahadasha until ${monthYear(maha.end)}.`, { font: F.serif, size: 12.5, color: C.ink, after: 10 });
    doc.twoLists(
      { title: 'Greatest gifts', color: C.good, items: report.highlights.strengths.slice(0, 5).map((r) => `${r.title}: ${r.summary}`) },
      { title: 'Main lessons', color: C.bad, items: report.highlights.challenges.slice(0, 5).map((r) => `${r.title}: ${r.summary}`) },
      9,
    );
  }
  astrologerNote(doc, ctx, 'chapter:heart');
}

/** How the book is laid out, and how to use it. */
export function howToRead(doc: ReportDoc, ctx: BookContext) {
  doc.h3('How this book works', { keep: 120 });
  doc.bullets([
    'Every chapter opens with the teaching: what the idea is, where it comes from and how astrologers use it. Then comes "In your chart": what it means for you, and why.',
    'Boxes headed "Understanding" explain a technique in more depth. Sanskrit words are explained where they first appear and again in the glossary.',
    'Where a reading rests on a classical text, the text is named, with its chapter and verse where known (for example "BPHS 34.2" is Brihat Parashara Hora Shastra, chapter 34, verse 2). The last chapter lists every work and where to read it.',
    ...(ctx.by ? [`Notes in a serif face with a gold rule are ${ctx.by}'s own words, written for you.`] : []),
    ...(ctx.draft.notesPages ? ['The ruled pages are for your notes. Write in this book.'] : []),
  ], { size: 9.4 });
  doc.callout({
    label: 'A note on free will',
    body: 'Jyotisha describes tendencies and timing, not fixed fate. The tradition itself says a chart shows the field you play on, not the moves you make. Read the demanding parts as weather to prepare for, and the supportive parts as tailwinds worth using.',
  });
}
