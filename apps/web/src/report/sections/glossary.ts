import type { ReportDoc } from '../doc';
import { C, F, PAGE } from '../theme';
import type { ReportContext, SectionHelpers } from '../types';

const TERMS: [string, string][] = [
  ['Antardasha', 'A sub-period within a mahadasha. Each mahadasha holds nine, one for each graha, in the Vimshottari order.'],
  ['Arudha', 'The "image" of a house in the Jaimini system: how its matters appear to the world rather than how they are.'],
  ['Ascendant (Lagna)', 'The sign and degree rising on the eastern horizon at birth. It becomes the 1st house and the starting point of the chart.'],
  ['Ashtakavarga', 'A points system that scores every sign from the point of view of each planet and the ascendant. Used to judge transits.'],
  ['Aspect (Drishti)', 'A planet\'s "gaze". All planets aspect the 7th sign from themselves; Mars, Jupiter, Saturn and the nodes have extra aspects.'],
  ['Bhava', 'A house: one of the twelve areas of life.'],
  ['Bindu', 'A point in the ashtakavarga. A sign\'s total for one planet runs from 0 to 8.'],
  ['Chara karaka', 'In Jaimini astrology, the planets ranked by degree in sign; the highest (atmakaraka) signifies the soul.'],
  ['Combust (Asta)', 'A planet so close to the Sun that it is lost in its glare. Its independence is reduced.'],
  ['Dasha', 'A planetary period. The planet ruling the period brings its placement and houses into focus.'],
  ['Debilitation (Neecha)', 'The sign where a planet is weakest. It can be cancelled (neecha bhanga) by other factors.'],
  ['Dignity', 'How comfortable a planet is in its sign: exalted, moolatrikona, own, friendly, neutral, enemy or debilitated.'],
  ['Dosha', 'A combination that asks for care, such as Manglik dosha. Most have classical cancellations.'],
  ['Dusthana', 'The 6th, 8th and 12th houses: struggle, transformation and loss, but also healing, research and release.'],
  ['Exaltation (Uchcha)', 'The sign where a planet is at its strongest.'],
  ['Gochara', 'Transits: the current movement of the planets, judged mainly from the natal Moon.'],
  ['Graha', 'One of the nine celestial influences: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu and Ketu.'],
  ['Janma nakshatra', 'The nakshatra the Moon occupied at birth; the birth star.'],
  ['Kendra', 'The angular houses, 1, 4, 7 and 10: the pillars of the chart.'],
  ['Ketu', 'The south node of the Moon. Signifies detachment, past mastery, intuition and liberation.'],
  ['Lord', 'The planet that rules a sign, and so rules the house that sign occupies in your chart.'],
  ['Mahadasha', 'A major period of the Vimshottari dasha, from 6 to 20 years long.'],
  ['Moolatrikona', 'A sign (or part of one) where a planet is nearly as strong as in exaltation, like an office where it works best.'],
  ['Muhurta', 'Electional astrology: choosing an auspicious moment to begin something.'],
  ['Nakshatra', 'One of 27 lunar mansions of 13°20′ each, the older star-based division of the zodiac.'],
  ['Navamsha (D9)', 'The ninth-division chart. Shows marriage, dharma and the inner strength of each planet.'],
  ['Pada', 'A quarter of a nakshatra, 3°20′. Each pada corresponds to one navamsha sign.'],
  ['Panchanga', 'The Indian almanac\'s five limbs of a day: vara, tithi, nakshatra, yoga and karana.'],
  ['Prashna', 'Horary astrology: a chart cast for the moment a question is asked.'],
  ['Rahu', 'The north node of the Moon. Signifies ambition, appetite, the foreign and the unconventional.'],
  ['Rashi', 'A sign of the zodiac. The rashi chart is the main birth chart (D1).'],
  ['Retrograde (Vakri)', 'A planet that appears to move backwards from Earth. Strong but inward-turned.'],
  ['Sade Sati', 'Saturn\'s 7½-year transit over the 12th, 1st and 2nd signs from the natal Moon.'],
  ['Shadbala', 'The six-fold strength of a planet, a numerical measure of how able it is to give results.'],
  ['Sidereal zodiac', 'A zodiac fixed to the stars, used in Vedic astrology. It differs from the seasonal (tropical) zodiac by the ayanamsa.'],
  ['Tithi', 'A lunar day: each 12° step of the Moon away from the Sun. There are 30 in a lunar month.'],
  ['Trikona', 'The trinal houses 1, 5 and 9: houses of fortune, merit and dharma.'],
  ['Upachaya', 'The houses 3, 6, 10 and 11, which improve with time and effort.'],
  ['Varga', 'A divisional chart, made by dividing each sign into equal parts. D9 and D10 are the best known.'],
  ['Vargottama', 'A planet in the same sign in the birth chart and the navamsha. A mark of strength.'],
  ['Vedha', 'An obstruction in transit: a favourable transit is blocked when another planet sits in its vedha point.'],
  ['Vimshottari', 'The 120-year dasha system based on the Moon\'s nakshatra. The most widely used timing method.'],
  ['Yoga', 'A meaningful combination of planets. Also one of the five limbs of the panchanga.'],
  ['Yogakaraka', 'A planet that rules both a kendra and a trikona for your ascendant, and so brings particular success.'],
];

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
