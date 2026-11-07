import { PLANET_PROFILES, type Reading } from '@vedic/interpretations';
import type { PlanetId } from '../../types/chart';
import { NAKSHATRAS, PLANET_BY_ID, signInfo } from '../../data/constants';
import type { ReportDoc } from '../doc';
import { housesRuledBy } from '../../lib/astro';
import { DIGNITY_LABEL, cap, dms, list, ordinal } from '../format';
import { C, CONTENT_W, F, MARGIN, toneColor } from '../theme';
import type { ReportContext, SectionHelpers } from '../types';

const IDS: PlanetId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];

export function grahas(doc: ReportDoc, ctx: ReportContext, h: SectionHelpers) {
  doc.chapter({
    numeral: h.numeral, kicker: 'Placements', title: 'The nine grahas', art: ctx.art.cosmos,
    intro: 'Graha means "one who seizes". The nine grahas are the Sun, the Moon, the five visible planets and the two lunar nodes, Rahu and Ketu. Each one carries a set of life themes into the sign, house and nakshatra where it sits.',
  });
  doc.callout({
    label: 'Understanding · reading a placement',
    title: 'Planet, sign, house, star',
    body: [
      'Think of a planet as an actor, the sign as the costume and manner it wears, the house as the stage (the area of life where it performs) and the nakshatra as its private motive. A planet\'s dignity says how comfortable it is in its sign: exalted and own-sign planets act with confidence, debilitated ones need effort, and the rest fall in between depending on whether the sign\'s ruler is a friend.',
      'Each planet also rules one or two signs, and so one or two houses of your chart. Wherever the planet goes, it carries the matters of those houses with it.',
    ],
    bullets: [
      'Kendras (1, 4, 7, 10) are the pillars of the chart: planets here act visibly.',
      'Trikonas (1, 5, 9) are houses of fortune and merit.',
      'Dusthanas (6, 8, 12) bring struggle, depth or release.',
      'Upachayas (3, 6, 10, 11) improve with time and effort.',
    ],
  });
  doc.h3('The nine at a glance', { keep: 140 });
  doc.table(
    [
      { header: 'Graha', width: 0.2, font: F.sansBold },
      { header: 'Signifies', width: 0.5 },
      { header: 'Overall', width: 0.17 },
      { header: 'House', width: 0.13, align: 'center' },
    ],
    IDS.map((id) => {
      const pr = ctx.report.planets[id];
      return [
        `${PLANET_BY_ID[id].name} · ${PLANET_BY_ID[id].sanskrit}`,
        PLANET_PROFILES[id].significations.slice(0, 4).join(', '),
        { text: pr.tone === 'benefic' ? 'Supportive' : pr.tone === 'challenging' ? 'Demanding' : 'Mixed', color: toneColor(pr.score) },
        String(ctx.chart.planets.find((p) => p.id === id)!.house),
      ];
    }),
    { size: 8.2 },
  );
  const pages: number[] = [];
  IDS.forEach((id, i) => pages.push(planetPages(doc, ctx, id, i)));
  return pages;
}

function plate(doc: ReportDoc, ctx: ReportContext, id: PlanetId, index: number) {
  const { pdf } = doc;
  const p = ctx.chart.planets.find((x) => x.id === id)!;
  const pr = ctx.report.planets[id];
  const info = PLANET_BY_ID[id];
  const H = 156;
  const y = doc.y;
  doc.fill(C.night).pdf.rect(MARGIN.left, y, CONTENT_W, H, 'F');
  doc.stars(MARGIN.left, y, CONTENT_W, H, 60, C.starlight, index * 101 + 5);
  const img = ctx.art.graha[id];
  pdf.addImage(img.data, 'JPEG', MARGIN.left + 8, y + 8, H - 16, H - 16, img.alias, 'FAST');
  doc.fill(C.gold).pdf.rect(MARGIN.left, y + H - 2, CONTENT_W, 2, 'F');
  const tx = MARGIN.left + H + 6;
  doc.line(`GRAHA ${index + 1} OF 9`, tx, y + 24, { font: F.sansBold, size: 6.6, color: C.goldLight, charSpace: 1.6 });
  doc.line(info.sanskrit, tx, y + 38, { font: F.serifBold, size: 34, color: '#FFFFFF' });
  doc.line(`${id === 'sun' || id === 'moon' ? 'The ' : ''}${info.name}${id === 'rahu' ? ', north node of the Moon' : id === 'ketu' ? ', south node of the Moon' : ''}`, tx, y + 78, { font: F.serifItalic, size: 14, color: C.starlight });
  const where = `${signInfo(p.sign).name} ${dms(p.degreeInSign)}  ·  ${ordinal(p.house)} house  ·  ${NAKSHATRAS[p.nakshatra - 1].name} ${p.pada}`;
  doc.line(where, tx, y + 102, { font: F.sans, size: 8.4, color: C.starlight });
  const tags = [DIGNITY_LABEL[pr.dignity], ...(p.retrograde && id !== 'rahu' && id !== 'ketu' ? ['Retrograde'] : []), ...(p.combust ? ['Combust'] : [])];
  let bx = tx;
  for (const t of [...tags, pr.tone === 'benefic' ? 'Supportive overall' : pr.tone === 'challenging' ? 'Demanding overall' : 'Mixed overall']) {
    const w = doc.width(t.toUpperCase(), F.sansBold, 6.4) + t.length * 0.9 + 14;
    const last = t.endsWith('overall');
    doc.fill(last ? toneColor(pr.score) : C.nightSoft).pdf.roundedRect(bx, y + 118, w, 15, 7.5, 7.5, 'F');
    doc.line(t.toUpperCase(), bx + w / 2, y + 122, { font: F.sansBold, size: 6.4, color: last ? '#FFFFFF' : C.goldLight, charSpace: 0.9, align: 'center' });
    bx += w + 6;
  }
  doc.y = y + H + 18;
}

function reading(doc: ReportDoc, r: Reading, kicker: string) {
  doc.label(kicker, { after: -2 });
  doc.h3(r.title, { keep: 50 });
  doc.para(r.summary, { font: F.serifItalic, size: 12, color: C.ink, leading: 1.38, after: 6 });
  r.detail.forEach((d) => doc.para(d, { size: 9.3 }));
  doc.y += 4;
}

function planetPages(doc: ReportDoc, ctx: ReportContext, id: PlanetId, index: number) {
  doc.newPage();
  doc.setRunning(`The nine grahas · ${PLANET_BY_ID[id].name}`);
  const page = doc.page;
  doc.toc.push({ level: 2, title: `${PLANET_BY_ID[id].sanskrit} · the ${PLANET_BY_ID[id].name}`, page });
  plate(doc, ctx, id, index);
  const prof = PLANET_PROFILES[id];
  const pr = ctx.report.planets[id];
  doc.para(`${cap(prof.essence)}. ${PLANET_BY_ID[id].name} signifies ${list(prof.significations.slice(0, 6))}. At its best: ${prof.highExpression.replace(/\.$/, '')}. When strained: ${prof.lowExpression.replace(/\.$/, '')}.`, { size: 9.4, after: 10 });

  reading(doc, pr.sign, 'The sign · how it behaves');
  reading(doc, pr.house, 'The house · where it acts');
  reading(doc, pr.nakshatra, 'The nakshatra · why it acts');

  if (pr.lordships.length) {
    doc.label('Lordship · what it carries', { after: -2 });
    const ruled = housesRuledBy(id, ctx.chart.ascendant.sign);
    doc.h3(`Lord of the ${list(ruled.map(ordinal))} house${ruled.length > 1 ? 's' : ''}`, { keep: 40 });
    pr.lordships.forEach((l) => {
      if (pr.lordships.length > 1) doc.para(l.title, { font: F.sansBold, size: 9, color: C.ink, after: 2 });
      doc.para(l.summary, { size: 9.3 });
    });
  }

  if (pr.retrograde || pr.combust) {
    doc.callout({
      label: pr.retrograde && pr.combust ? 'Retrograde and combust' : pr.retrograde ? 'Retrograde at birth' : 'Combust at birth',
      body: [...(pr.retrograde ? [pr.retrograde.summary, ...pr.retrograde.detail.slice(0, 1)] : []), ...(pr.combust ? [pr.combust] : [])],
      edge: C.mixed,
      tint: '#F4EEDF',
    });
  }

  if (pr.conjunctions.length) {
    doc.label('Companions · planets in the same sign', { after: 2 });
    pr.conjunctions.forEach((c) => {
      doc.para(c.title, { font: F.sansBold, size: 9, color: C.ink, after: 2 });
      doc.para(c.summary, { size: 9.2 });
    });
  }

  if (pr.aspects.length) {
    doc.label('Drishti · where its gaze falls', { after: 2 });
    doc.bullets(pr.aspects.map((a) => `${a.title}: ${a.summary}`), { size: 8.8 });
  }

  const strengths = dedupe([...pr.sign.strengths, ...pr.house.strengths, ...pr.nakshatra.strengths]).slice(0, 6);
  const challenges = dedupe([...pr.sign.challenges, ...pr.house.challenges, ...pr.nakshatra.challenges]).slice(0, 6);
  if (strengths.length || challenges.length) {
    doc.y += 4;
    doc.twoLists({ title: 'Gifts to use', color: C.good, items: strengths }, { title: 'Lessons to work with', color: C.bad, items: challenges });
  }
  const remedies = dedupe([pr.sign, pr.house, pr.nakshatra, ...pr.lordships].flatMap((r) => r.remedies ?? [])).slice(0, 4);
  if (remedies.length) {
    doc.callout({ label: 'Traditional supports', body: 'Practices the tradition associates with this planet. Treat them as reflection and habit, not as guarantees.', bullets: remedies, edge: C.good, tint: C.goodPale });
  }
  ctx.annotate?.(doc, `graha:${id}`);
  return page;
}

const dedupe = (xs: string[]) => [...new Set(xs.map((x) => x.trim()))].filter(Boolean);
