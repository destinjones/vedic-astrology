import { aspectsOnHouse, formatSource, fromEngineChart, getSign, PLANET_PROFILES, type Reading } from '@vedic/interpretations';
import type { PlanetId } from '../../types/chart';
import { NAKSHATRAS, PLANET_BY_ID, signInfo } from '../../data/constants';
import { northChart } from '../charts';
import type { ReportDoc } from '../doc';
import { cap, dms, list, ordinal } from '../format';
import { C, CONTENT_W, F, MARGIN } from '../theme';
import type { SectionHelpers } from '../types';
import { astrologerNote, type BookContext, lesson, prose, sources } from './common';

const IDS: PlanetId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];
const BPHS = 'Brihat Parashara Hora Shastra (BPHS)';
const ELEMENT: Record<string, string> = {
  fire: 'Fire signs (Aries, Leo, Sagittarius) act through will and enthusiasm.',
  earth: 'Earth signs (Taurus, Virgo, Capricorn) act through patience and practical results.',
  air: 'Air signs (Gemini, Libra, Aquarius) act through ideas, exchange and relationship.',
  water: 'Water signs (Cancer, Scorpio, Pisces) act through feeling, memory and intuition.',
};
const MODALITY: Record<string, string> = {
  movable: 'Movable (chara) signs start things and like change.',
  fixed: 'Fixed (sthira) signs hold on, build and endure.',
  dual: 'Dual (dvisvabhava) signs adapt, bridge and do two things at once.',
};
const GANA: Record<string, string> = {
  deva: 'deva gana, the "divine" temperament: gentle, idealistic and giving',
  manushya: 'manushya gana, the "human" temperament: balanced, ambitious and worldly',
  rakshasa: 'rakshasa gana, the "fierce" temperament: intense, independent and protective',
};
const MOTIVE: Record<string, string> = {
  dharma: 'dharma (right action and purpose)', artha: 'artha (resources and achievement)', kama: 'kama (desire, love and enjoyment)', moksha: 'moksha (release and inner freedom)',
};

/** A reading in full, with its source line when it has one. */
function fullReading(doc: ReportDoc, r: Reading, kicker: string) {
  doc.label(kicker, { after: -2 });
  doc.h3(r.title, { keep: 50 });
  doc.para(r.summary, { font: F.serifItalic, size: 12.5, color: C.ink, leading: 1.4, after: 6 });
  r.detail.forEach((d) => doc.para(d, { size: 9.6 }));
  const src = formatSource(r.source);
  if (src) doc.para(`Classical source: ${src}.`, { size: 7.8, color: C.muted, after: 8 });
}

// ------------------------------------------------------------------ the language of the chart

export function foundations(doc: ReportDoc, ctx: BookContext, h: SectionHelpers) {
  const { chart } = ctx;
  doc.chapter({
    numeral: h.numeral, kicker: 'Part one · the foundations', title: 'The language of your chart', art: ctx.art.cosmos,
    intro: 'Before we read your chart, a short course in how Jyotisha sees the sky: where it comes from, why its zodiac differs from the one in magazines, and the seven building blocks every later chapter is made of.',
  });

  lesson(doc, 'What Jyotisha is');
  prose(doc, [
    'Jyotisha, "the science of light", is the astrology of India. It grew up as one of the six Vedangas, the "limbs of the Veda" that a priest needed to perform the rites at the right time, and over two thousand years it became a full art of reading a life from the sky at birth.',
    'Its best-known textbook is the Brihat Parashara Hora Shastra, attributed to the sage Parashara, which most of this book follows. Beside it stand the Brihat Jataka of Varahamihira (6th century), the Saravali of Kalyana Varma and the Phaladeepika of Mantreswara (around the 14th century). When this book says "the tradition", it means these texts and the teachers who carry them.',
    'A Vedic astrologer does not read a chart as fate written in stone. The usual image is of a field: the chart shows the soil, the climate and the seasons you were given; what you plant and how you tend it is yours.',
  ]);
  sources(doc, ctx, [[BPHS, 'tr. R. Santhanam'], ['Brihat Jataka', 'Varahamihira'], ['Saravali', 'Kalyana Varma'], ['Phaladeepika', 'Mantreswara']]);

  lesson(doc, 'A zodiac fixed to the stars');
  const sun = chart.planets.find((p) => p.id === 'sun')!;
  const ayan = ctx.chart.meta.ayanamsaValue;
  const tropical = Math.floor((((sun.longitude + ayan) % 360) + 360) % 360 / 30) + 1;
  prose(doc, [
    'Western astrology measures the zodiac from the spring equinox, so its signs are tied to the seasons. Jyotisha measures it from the fixed stars, so its signs stay with the constellations they are named after. Because the Earth\'s axis slowly wobbles, the two zodiacs drift apart by about one degree every 72 years. The gap between them is the ayanamsa.',
    `For your birth the gap was ${ayan.toFixed(2)} degrees (${ctx.engineChart.meta.ayanamsaName}). ${tropical === sun.sign
      ? `Your Sun is in ${signInfo(sun.sign).name} in both systems, so the sign you know from magazines is also your Vedic Sun sign.`
      : `That is why the Sun sign you may know from Western astrology, ${signInfo(tropical).name}, is ${signInfo(sun.sign).name} here: every planet in your chart sits about ${Math.round(ayan)} degrees earlier than in a Western chart.`} In India it is the Moon's sign, not the Sun's, that people call "my sign"; ${ctx.numerals.moon ? `Chapter ${ctx.numerals.moon} is about yours` : 'yours is described in the chapter on your chart at a glance'}.`,
  ]);
  sources(doc, ctx, [['Surya Siddhanta', 'chapter 3, on the motion of the equinoxes'], [BPHS, 'Rashi Swaroopa (the nature of the signs)']]);

  lesson(doc, 'The seven building blocks');
  const blocks: [string, string, string][] = [
    ['Grahas · the nine planets', 'The Sun, Moon, Mars, Mercury, Jupiter, Venus and Saturn, with Rahu and Ketu, the two points where the Moon\'s path crosses the Sun\'s. Graha means "one who seizes": each one grips a set of life themes.', 'grahas'],
    ['Rashis · the twelve signs', 'Thirty-degree slices of the sidereal zodiac. A sign is the manner in which a planet acts: boldly in Aries, steadily in Taurus, curiously in Gemini.', 'glance'],
    ['Bhavas · the twelve houses', 'The areas of life, counted from the sign rising at birth: self, resources, effort, home, creativity, health, partnership and so on to release. This book uses whole-sign houses, so each sign is one house.', 'houses'],
    ['Nakshatras · the 27 lunar mansions', 'An older, finer division of the zodiac into 27 star groups of 13°20′, one for each day of the Moon\'s month. They describe motive and instinct, and they set the timing of your dashas.', 'moon'],
    ['Yogas · combinations', 'Patterns of planets that produce a result greater than their parts, for good (raja and dhana yogas) or for care (doshas).', 'yogas'],
    ['Vargas · divisional charts', 'Charts made by dividing each sign into finer parts. The navamsha (ninths) is read beside the birth chart for marriage, dharma and the true strength of each planet.', 'vargas'],
    ['Dashas · planetary periods', 'The clock of Jyotisha: a sequence in which each planet in turn "runs" your life for a number of years, bringing its promises forward.', 'dasha'],
  ];
  for (const [t, body, id] of blocks) {
    doc.ensure(60);
    doc.para(t, { font: F.serifBold, size: 13.5, color: C.ink, after: 2 });
    doc.para(`${body}${ctx.numerals[id] ? ` Yours: Chapter ${ctx.numerals[id]}.` : ''}`, { size: 9.5, after: 8 });
  }
  sources(doc, ctx, [[BPHS, 'chapters on the grahas (Graha Guna Swaroopa), the signs, the houses (Bhava Vivechana), the vargas and the dashas']]);

  lesson(doc, 'The twelve signs in your chart', 'Reference');
  doc.para('The same twelve signs appear in every chart; what makes yours yours is which sign is rising, and so which house each sign becomes. Every planet rules one or two signs and so one or two of your houses.', { size: 9.4 });
  doc.table(
    [
      { header: 'Sign', width: 0.22, font: F.sansBold },
      { header: 'Element', width: 0.12 },
      { header: 'Quality', width: 0.12 },
      { header: 'Ruler', width: 0.13 },
      { header: 'Your house', width: 0.13, align: 'center' },
      { header: 'Holds', width: 0.28 },
    ],
    Array.from({ length: 12 }, (_, i) => {
      const s = i + 1;
      const sp = getSign(s);
      const house = ((s - chart.ascendant.sign + 12) % 12) + 1;
      const here = chart.planets.filter((p) => p.sign === s).map((p) => PLANET_BY_ID[p.id].name);
      return [
        `${sp.name} · ${sp.sanskrit}`, cap(sp.element), cap(sp.modality), PLANET_BY_ID[sp.lord].name,
        { text: ordinal(house), color: house === 1 ? C.gold : C.body, font: house === 1 ? F.sansBold : undefined },
        here.join(', ') || '—',
      ];
    }),
    { size: 8.2 },
  );
  astrologerNote(doc, ctx, 'chapter:foundations');
}

// ------------------------------------------------------------------ the rising sign

export async function lagna(doc: ReportDoc, ctx: BookContext, h: SectionHelpers) {
  const { chart, report, art } = ctx;
  const asc = getSign(chart.ascendant.sign);
  const lord = asc.lord as PlanetId;
  const lp = chart.planets.find((p) => p.id === lord)!;
  doc.chapter({
    numeral: h.numeral, kicker: 'The first pillar', title: 'Your rising sign', art: art.cosmos,
    intro: 'The lagna is the sign that was rising on the eastern horizon at the minute you were born. It is the first house of your chart and the point every other house is counted from: the single most personal fact in Jyotisha.',
  });

  lesson(doc, 'What the lagna is');
  prose(doc, [
    'As the Earth turns, all twelve signs rise over the eastern horizon in a day, about one every two hours. The one rising at your birth is your lagna, or ascendant. Two people born on the same day in the same town can have quite different charts because of it, which is why an exact birth time matters so much.',
    'The tradition reads the lagna as the body, health, temperament and the general direction of a life. Its ruling planet, the lagna lord, is the "captain" of the chart: wherever it sits, the life leans that way. Planets in the first house colour the personality strongly, and planets aspecting it shape how you meet the world.',
  ]);
  sources(doc, ctx, [[BPHS, 'Bhava Vivechana, on the first house (tanu bhava)'], ['Phaladeepika', 'on the effects of the lagna']]);

  doc.h2(`${asc.name} rising`, { kicker: 'In your chart', toc: true });
  const img = await art.rashi(chart.ascendant.sign);
  const top = doc.y;
  const S = 120;
  doc.pdf.addImage(img.data, 'JPEG', MARGIN.left, top, S, S, img.alias, 'FAST');
  const tx = MARGIN.left + S + 22;
  const tw = CONTENT_W - S - 22;
  let ty = top;
  for (const [k, v] of [
    ['Sign', `${asc.name} (${asc.sanskrit}), ${dms(chart.ascendant.degreeInSign)}`],
    ['Element and quality', `${cap(asc.element)}, ${asc.modality}`],
    ['Ruled by', `${PLANET_BY_ID[lord].name}, now in the ${ordinal(lp.house)} house`],
    ['Rising star', `${NAKSHATRAS[chart.ascendant.nakshatra - 1].name}, pada ${chart.ascendant.pada}`],
  ] as [string, string][]) {
    doc.line(k.toUpperCase(), tx, ty, { font: F.sansBold, size: 6.6, color: C.gold, charSpace: 1 });
    const ls = doc.wrap(v, tw, F.serifBold, 13);
    ls.forEach((ln, i) => doc.line(ln, tx, ty + 11 + i * 15, { font: F.serifBold, size: 13, color: C.ink }));
    ty += 11 + ls.length * 15 + 8;
  }
  doc.y = Math.max(top + S + 14, ty);
  prose(doc, [
    `${asc.description} With ${asc.name} rising, you tend to meet life ${asc.style}, and the themes of ${list(asc.themes)} run through it. The sign traditionally governs the ${asc.body}.`,
    `${ELEMENT[asc.element] ?? ''} ${MODALITY[asc.modality] ?? ''} ${asc.gender === 'masculine' ? 'It is an odd (masculine) sign, outward and active.' : 'It is an even (feminine) sign, receptive and inward.'}`,
  ]);

  const r1 = report.houseLords[0];
  fullReading(doc, r1, `The captain · ${PLANET_BY_ID[lord].name} in the ${ordinal(lp.house)} house`);
  const lprof = PLANET_PROFILES[lord];
  doc.para(`${PLANET_BY_ID[lord].name} is ${lprof.essence}. As the ruler of your lagna it becomes a personal significator for you, whatever its natural reputation: its dasha periods are turning points, and how it is placed says much about health and confidence.`, { size: 9.5 });

  const input = fromEngineChart(ctx.engineChart);
  const inFirst = chart.planets.filter((p) => p.house === 1);
  const aspecting = aspectsOnHouse(input, 1).filter((p) => !inFirst.some((x) => x.id === p)) as PlanetId[];
  doc.h3('Who stands in the first house', { keep: 60 });
  if (inFirst.length) {
    for (const p of inFirst) {
      const r = report.planets[p.id].house;
      doc.para(`${PLANET_BY_ID[p.id].name}. ${r.summary}`, { size: 9.5 });
    }
  } else {
    doc.para('No planet sits in your first house. That is common, and it means the lagna is read through its sign, its ruler and the planets that aspect it.', { size: 9.5 });
  }
  if (aspecting.length) doc.para(`Aspecting it: ${list(aspecting.map((p) => PLANET_BY_ID[p].name))}. ${aspecting.map((p) => `${PLANET_BY_ID[p].name} lends ${PLANET_PROFILES[p].significations.slice(0, 2).join(' and ')}`).join('; ')}.`, { size: 9.5 });

  const nak = ctx.getNakshatra(chart.ascendant.nakshatra);
  doc.h3(`The rising star: ${nak.name}`, { keep: 60 });
  doc.para(`The degree rising also falls in a nakshatra. Yours is ${nak.name}, ruled by ${PLANET_BY_ID[nak.lord].name}, with ${nak.deity} as its deity and ${nak.symbol} as its symbol. ${nak.description}`, { size: 9.5 });
  doc.para(`Pada ${chart.ascendant.pada}: ${nak.padas[chart.ascendant.pada - 1]}`, { size: 9.5, color: C.muted });
  astrologerNote(doc, ctx, 'chapter:lagna');
}

// ------------------------------------------------------------------ the Moon and birth star

export async function moon(doc: ReportDoc, ctx: BookContext, h: SectionHelpers) {
  const { chart, report, art } = ctx;
  const m = chart.planets.find((p) => p.id === 'moon')!;
  const ms = getSign(m.sign);
  const nak = ctx.getNakshatra(m.nakshatra);
  doc.chapter({
    numeral: h.numeral, kicker: 'The second and third pillars', title: 'Your Moon and birth star', art: art.cosmos,
    intro: 'In Jyotisha the Moon is the mind: what you feel, how you remember and what makes you feel safe. The sign it was in is your rashi, and the star it was passing is your janma nakshatra, the most personal detail in the whole tradition.',
  });

  lesson(doc, 'Why the Moon matters so much');
  prose(doc, [
    'Western astrology leads with the Sun. Jyotisha leads with the Moon, because it moves fastest and is closest to us, and because the tradition sees the mind (manas) as the instrument through which every other planet is felt. A strong, calm Moon steadies the whole chart; a troubled one makes even good placements harder to enjoy.',
    'Your Moon sign is the starting point for reading transits (gochara): when Saturn or Jupiter moves through the signs, its effect is counted from the Moon. Sade Sati, Saturn\'s seven-and-a-half-year passage over the Moon, is the best-known example.',
  ]);
  lesson(doc, 'The 27 nakshatras');
  prose(doc, [
    'Long before the twelve signs, Indian astronomers divided the sky into 27 nakshatras, the stations the Moon visits on its monthly round. Each spans 13°20′ and is split into four padas (quarters) of 3°20′. Each has a ruling planet, a presiding deity, a symbol and a shakti, the particular power it grants.',
    `The nakshatra the Moon occupied at birth is your janma nakshatra. It describes your instincts and motives, it is used to match charts for marriage and to choose good days, and it decides where your dasha sequence begins: the planet ruling your birth star ran the first period of your life.${ctx.numerals.dasha ? ` (The periods themselves are in Chapter ${ctx.numerals.dasha}.)` : ''}`,
  ]);
  sources(doc, ctx, [[BPHS, 'on the Moon as mind (Graha Guna Swaroopa) and on the Vimshottari dasha from the birth star'], ['Phaladeepika', 'on gochara (transits) counted from the Moon']]);

  doc.h2(`Moon in ${ms.name}`, { kicker: 'In your chart', toc: true });
  const img = await art.rashi(m.sign);
  const top = doc.y;
  doc.pdf.addImage(img.data, 'JPEG', MARGIN.left, top, 96, 96, img.alias, 'FAST');
  doc.para(`Your Moon was in ${ms.name} (${ms.sanskrit}) at ${dms(m.degreeInSign)}, in the ${ordinal(m.house)} house. Your feelings move ${ms.style}. ${ms.description}`, { font: F.serif, size: 12, leading: 1.45, color: C.ink, x: MARGIN.left + 112, after: 6 });
  doc.y = Math.max(doc.y, top + 104);
  const pr = report.planets.moon;
  fullReading(doc, pr.sign, 'The Moon\'s sign · how your mind moves');
  fullReading(doc, pr.house, 'The Moon\'s house · where your heart is invested');

  doc.newPage();
  doc.h2(`Your birth star: ${nak.name}`, { kicker: 'Janma nakshatra', toc: true });
  const ni = await art.nakshatra(m.nakshatra);
  const nt = doc.y;
  doc.pdf.addImage(ni.data, 'JPEG', MARGIN.left + CONTENT_W / 2 - 60, nt, 120, 120, ni.alias, 'FAST');
  doc.y = nt + 132;
  doc.facts([
    ['Ruling planet', PLANET_BY_ID[nak.lord].name],
    ['Deity', nak.deity],
    ['Symbol', nak.symbol],
    ['Shakti (power)', nak.shakti],
    ['Temperament', cap(nak.gana)],
    ['Pada', `${m.pada} of 4`],
  ], 3, { size: 11.5 });
  prose(doc, [
    nak.description,
    `${nak.name} belongs to the ${GANA[nak.gana] ?? nak.gana}. Its driving motive is ${MOTIVE[nak.motivation] ?? nak.motivation}. Its nature is described as ${nak.nature}.`,
  ]);
  doc.twoLists({ title: 'Its gifts', color: C.good, items: nak.gifts }, { title: 'Its shadows', color: C.bad, items: nak.shadows });
  doc.callout({ label: `Your pada · the ${ordinal(m.pada)} quarter`, body: nak.padas[m.pada - 1] });
  fullReading(doc, pr.nakshatra, 'The Moon in its star · your deepest instincts');
  sources(doc, ctx, [[BPHS, 'Nakshatra and pada divisions'], ['Brihat Samhita', 'Varahamihira, on the nakshatras and their deities']]);
  astrologerNote(doc, ctx, 'chapter:moon');
}

/** A small chart for chapters that refer to it. */
export function miniChart(doc: ReportDoc, ctx: BookContext) {
  const S = 170;
  doc.ensure(S + 20);
  northChart(doc, ctx.chart, ctx.chart.vargas.D1!, MARGIN.left + CONTENT_W / 2 - S / 2, doc.y, S);
  doc.y += S + 14;
}

export { IDS };
