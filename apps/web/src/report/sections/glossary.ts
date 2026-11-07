import type { ReportDoc } from '../doc';
import { C, F, PAGE } from '../theme';
import type { ReportContext, SectionHelpers } from '../types';
import { TERMS } from '../../learn/terms';

export function glossary(doc: ReportDoc, ctx: ReportContext, h: SectionHelpers) {
  doc.chapter({
    numeral: h.numeral, kicker: 'Reference', title: 'Glossary', art: ctx.art.cosmos,
    intro: 'The Sanskrit words used in this report, and a few you will meet as you read further. Many have no single English equivalent, so each is explained the way an astrologer uses it.',
  });
  const all = new Map<string, string>(TERMS);
  for (const [k, v] of ctx.glossary) if (!all.has(k)) all.set(k, v);
  const entries = [...all.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  doc.columns(2, 26);
  let letter = '';
  for (const [term, text] of entries) {
    const L = term[0].toUpperCase();
    const hgt = doc.measure(text, doc.w, { size: 8.6, leading: 1.45 }) + 18;
    doc.ensure(hgt + (L !== letter ? 24 : 0));
    if (L !== letter) {
      letter = L;
      doc.line(L, doc.x, doc.y, { font: F.serifBold, size: 18, color: C.goldLight });
      doc.stroke(C.rule, 0.5).pdf.line(doc.x + 16, doc.y + 12, doc.x + doc.w, doc.y + 12);
      doc.y += 24;
    }
    doc.line(term, doc.x, doc.y, { font: F.serifBold, size: 11.5, color: C.ink });
    doc.y += 15;
    doc.para(text, { size: 8.6, leading: 1.45, after: 7 });
  }
  doc.endColumns();
}

export function colophon(doc: ReportDoc, ctx: ReportContext) {
  doc.newPage();
  doc.setRunning('About this report');
  doc.h2('About this report', { kicker: 'Method and sources', toc: true });
  const m = ctx.engineChart.meta;
  doc.para(`Positions are calculated with the Swiss Ephemeris (${m.ayanamsaName} ayanamsa, ${m.nodeType === 'true' ? 'true' : 'mean'} nodes) for ${m.utc.replace('T', ' ').slice(0, 16)} UTC. Houses are whole signs from the ascendant. Divisional charts follow Parashara. Dashas use the Vimshottari system with a 365.25-day year. Yogas and doshas are detected from their classical definitions, with common cancellations applied. Timing scores combine dasha strength and Moon-based transits, with vedha and ashtakavarga, measured against your chart's own baseline.`, { size: 9.2 });
  doc.para('The readings draw on the classical texts, chiefly Brihat Parashara Hora Shastra, Phaladeepika, Saravali and Jataka Parijata, retold in plain modern English. Where the tradition disagrees with itself, the report follows the most widely taught view.', { size: 9.2 });
  doc.callout({
    label: 'Please read',
    body: 'This report is for reflection and education. It is not medical, legal, financial or psychological advice, and it should not be the basis of a decision that affects your health, money or safety. A birth time that is off by a few minutes can change the ascendant degree, the divisional charts and the dasha dates, so check the time on your birth record if you can.',
    edge: C.mixed,
  });
  doc.para('Made with Jyotisha Explorer, a free and open-source project (AGPL-3.0). Fonts: Cormorant Garamond and Inter (SIL Open Font License). Planet, rashi and nakshatra artwork rendered in Blender for the project.', { size: 8, color: C.muted });

  // back cover
  doc.coverPage();
  const { pdf } = doc;
  const art = ctx.art.wheelHero;
  const w = PAGE.w + 80;
  const hh = (art.h / art.w) * w;
  pdf.addImage(art.data, 'JPEG', -40, PAGE.h / 2 - hh / 2 - 40, w, hh, art.alias, 'FAST');
  doc.stars(0, 0, PAGE.w, PAGE.h, 160, C.starlight, 4242);
  doc.ornament(PAGE.w / 2, PAGE.h - 150, 80, C.goldLight);
  doc.line('As above, so below.', PAGE.w / 2, PAGE.h - 132, { font: F.serifItalic, size: 16, color: C.starlight, align: 'center' });
  doc.line('JYOTISHA EXPLORER', PAGE.w / 2, PAGE.h - 92, { font: F.sansBold, size: 7.2, color: C.goldLight, charSpace: 2.4, align: 'center' });
}
