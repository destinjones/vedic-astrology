import { getSign } from '@vedic/interpretations';
import type { PlanetId } from '../../types/chart';
import { NAKSHATRAS, PLANET_BY_ID, signInfo } from '../../data/constants';
import { northChart, southChart, wheelKey, wheelWithPlanets } from '../charts';
import type { ReportDoc } from '../doc';
import { DIGNITY_LABEL, cap, dms, ordinal } from '../format';
import { C, CONTENT_W, F, MARGIN } from '../theme';
import type { ReportContext, SectionHelpers } from '../types';

export async function glance(doc: ReportDoc, ctx: ReportContext, h: SectionHelpers) {
  const { chart, art, report } = ctx;
  const moon = chart.planets.find((p) => p.id === 'moon')!;
  doc.chapter({
    numeral: h.numeral, kicker: 'The foundation', title: 'Your chart at a glance', art: art.cosmos,
    intro: 'Three points carry the most weight in a Vedic chart: the sign rising in the east at your birth, the sign the Moon was in, and the nakshatra (lunar mansion) the Moon occupied. Together they describe your body and path, your mind and feelings, and your deepest instincts.',
  });

  // ---- the three pillars, in three columns under the opener
  const asc = getSign(chart.ascendant.sign);
  const ms = getSign(moon.sign);
  const nak = ctx.getNakshatra(moon.nakshatra);
  const pillars = [
    { img: await art.rashi(chart.ascendant.sign), label: 'Ascendant · Lagna', name: `${asc.name} rising`, sub: `${asc.sanskrit} · ${dms(chart.ascendant.degreeInSign)}`, text: `${asc.description} As your lagna, ${asc.name} shapes your body, temperament and the direction your life takes.` },
    { img: await art.rashi(moon.sign), label: 'Moon sign · Rashi', name: `Moon in ${ms.name}`, sub: `${ms.sanskrit} · ${ordinal(moon.house)} house`, text: `Your mind and emotions move ${ms.style}. In India this, not the Sun sign, is "your sign".` },
    { img: await art.nakshatra(moon.nakshatra), label: 'Birth star · Janma nakshatra', name: nak.name, sub: `Pada ${moon.pada} · ruled by ${PLANET_BY_ID[nak.lord].name}`, text: `${nak.description}` },
  ];
  const colW = (CONTENT_W - 2 * 18) / 3;
  const top = doc.y;
  let maxY = top;
  pillars.forEach((p, i) => {
    const x = MARGIN.left + i * (colW + 18);
    doc.pdf.addImage(p.img.data, 'JPEG', x + colW / 2 - 36, top, 72, 72, p.img.alias, 'FAST');
    let y = top + 80;
    doc.line(p.label.toUpperCase(), x + colW / 2, y, { font: F.sansBold, size: 6.2, color: C.gold, charSpace: 1, align: 'center' });
    y += 12;
    doc.line(p.name, x + colW / 2, y, { font: F.serifBold, size: 15, color: C.ink, align: 'center' });
    y += 19;
    doc.line(p.sub, x + colW / 2, y, { font: F.sans, size: 7.4, color: C.muted, align: 'center' });
    y += 15;
    const lines = doc.wrap(p.text, colW, F.sans, 8.1).slice(0, 13);
    lines.forEach((ln, li) => doc.line(ln, x + colW / 2, y + li * 12, { font: F.sans, size: 8.1, color: C.body, align: 'center' }));
    maxY = Math.max(maxY, y + lines.length * 12);
  });
  doc.y = maxY + 10;

  // ---- the two chart styles
  doc.newPage();
  doc.h2('Your birth chart', { kicker: 'Rashi chart · D1', toc: true });
  const S = (CONTENT_W - 30) / 2;
  const y0 = doc.y;
  northChart(doc, chart, chart.vargas.D1!, MARGIN.left, y0, S);
  southChart(doc, chart, chart.vargas.D1!, MARGIN.left + S + 30, y0, S, { degrees: true, centre: ['Rashi', chart.input.name?.trim() || 'Birth chart', chart.input.date] });
  doc.line('North Indian style', MARGIN.left + S / 2, y0 + S + 7, { font: F.serifItalic, size: 10.5, color: C.muted, align: 'center' });
  doc.line('South Indian style', MARGIN.left + S * 1.5 + 30, y0 + S + 7, { font: F.serifItalic, size: 10.5, color: C.muted, align: 'center' });
  doc.y = y0 + S + 30;
  doc.para('Su Sun · Mo Moon · Ma Mars · Me Mercury · Ju Jupiter · Ve Venus · Sa Saturn · Ra Rahu · Ke Ketu · R retrograde · c combust · the shaded house holds the ascendant', { size: 7.2, color: C.muted, align: 'center' });
  doc.callout({
    label: 'Understanding · two ways to draw one sky',
    body: [
      'Both drawings show the same chart. In the North Indian diamond the houses stay still: the top diamond is always the 1st house, and the small numbers are the signs (1 is Aries, 12 is Pisces). Counting runs anticlockwise.',
      'In the South Indian square the signs stay still, Pisces in the top-left corner and Aries next to it, running clockwise; the diagonal stroke marks the ascendant. Vedic astrology counts houses as whole signs: whatever sign rises is the whole 1st house, the next sign is the 2nd, and so on.',
    ],
  });

  // ---- positions table
  doc.h2('Where each planet stood', { kicker: 'Planetary positions', toc: true, keep: 200 });
  const ids: PlanetId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];
  doc.table(
    [
      { header: 'Graha', width: 0.17, font: F.sansBold },
      { header: 'Sign', width: 0.15 },
      { header: 'Degree', width: 0.1, align: 'right' },
      { header: 'Nakshatra', width: 0.22 },
      { header: 'House', width: 0.08, align: 'center' },
      { header: 'Dignity', width: 0.16 },
      { header: 'Motion', width: 0.12 },
    ],
    [
      ['Ascendant', signInfo(chart.ascendant.sign).name, dms(chart.ascendant.degreeInSign), `${NAKSHATRAS[chart.ascendant.nakshatra - 1].name} ${chart.ascendant.pada}`, '1', '', ''],
      ...ids.map((id) => {
        const p = chart.planets.find((x) => x.id === id)!;
        const pr = report.planets[id];
        const dig = DIGNITY_LABEL[pr.dignity];
        const good = ['exalted', 'moolatrikona', 'own', 'great_friend'].includes(pr.dignity);
        const bad = ['debilitated', 'great_enemy', 'enemy'].includes(pr.dignity);
        const motion = id === 'rahu' || id === 'ketu' ? 'Always R' : p.retrograde ? 'Retrograde' : p.combust ? 'Combust' : 'Direct';
        return [
          `${PLANET_BY_ID[id].name} · ${PLANET_BY_ID[id].sanskrit}`,
          signInfo(p.sign).name,
          dms(p.degreeInSign),
          `${NAKSHATRAS[p.nakshatra - 1].name} ${p.pada}`,
          String(p.house),
          { text: dig, color: good ? C.good : bad ? C.bad : C.body },
          { text: p.retrograde && p.combust && id !== 'rahu' && id !== 'ketu' ? 'R, combust' : motion, color: motion === 'Direct' ? C.muted : C.body },
        ];
      }),
    ],
  );

  // ---- element balance and birth panchanga
  const counts = { fire: 0, earth: 0, air: 0, water: 0 } as Record<string, number>;
  const mods = { movable: 0, fixed: 0, dual: 0 } as Record<string, number>;
  [chart.ascendant.sign, ...chart.planets.filter((p) => p.id !== 'rahu' && p.id !== 'ketu').map((p) => p.sign)].forEach((s) => { counts[getSign(s).element]++; mods[getSign(s).modality]++; });
  const top2 = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  doc.h3('The balance of elements', { keep: 90 });
  doc.facts([
    ['Fire', `${counts.fire} of 8`], ['Earth', `${counts.earth} of 8`], ['Air', `${counts.air} of 8`], ['Water', `${counts.water} of 8`],
  ], 4, { size: 15 });
  doc.para(`Counting the ascendant and the seven visible planets, ${top2[0][0]} leads${top2[1][1] === top2[0][1] ? ` together with ${top2[1][0]}` : ''}. ${ELEMENT_TEXT[top2[0][0]]} By quality the chart has ${mods.movable} movable, ${mods.fixed} fixed and ${mods.dual} dual placements: ${MOD_TEXT[Object.entries(mods).sort((a, b) => b[1] - a[1])[0][0]]}`);

  const pc = ctx.engineChart.panchanga;
  doc.h2('The day you were born', { kicker: 'Birth panchanga', toc: true, keep: 200 });
  doc.para('An Indian almanac (panchanga, "five limbs") describes every day by five measures of the Sun and Moon. The limbs of your birth day are read as quiet background colours to the whole chart.');
  doc.facts([
    ['Vara · weekday', `${pc.varaName}, ruled by ${PLANET_BY_ID[pc.varaLord as PlanetId]?.name ?? cap(pc.varaLord)}`],
    ['Tithi · lunar day', `${pc.tithiName} (${cap(pc.paksha)} paksha)`],
    ['Nakshatra', pc.nakshatraName],
    ['Yoga', pc.yogaName],
    ['Karana', pc.karanaName],
    ['Moon phase', pc.paksha === 'shukla' ? 'Waxing, growing toward full' : 'Waning, moving toward new'],
  ], 3, { size: 12.5 });
  doc.callout({
    label: 'Understanding · the five limbs',
    body: 'Vara is the weekday and its planetary ruler. Tithi is the lunar day, one of thirty steps of 12° in the Moon\'s distance from the Sun; the bright half (shukla paksha) waxes, the dark half (krishna paksha) wanes. Nakshatra is the Moon\'s star. Yoga is one of 27 measures of the Sun and Moon\'s combined motion, and karana is half a tithi. Muhurta, the art of choosing good dates, is built from these same five limbs.',
  });

  // ---- the wheel
  doc.newPage();
  doc.h2('Your sky on the great wheel', { kicker: 'The zodiac and the 27 nakshatras', toc: true });
  const wy = doc.y;
  const ws = 312;
  wheelWithPlanets(doc, chart, art.wheel, art.graha, MARGIN.left - 6, wy, ws);
  wheelKey(doc, chart, art.graha, MARGIN.left + ws + 10, wy + 40, CONTENT_W - ws - 4);
  doc.y = wy + ws + 14;
  doc.para(`The wheel is turned so your ascendant, ${asc.name} at ${dms(chart.ascendant.degreeInSign)}, sits on the left at the gold line, where the eastern horizon was at your birth. From the centre outwards: the planets on their track, the twelve rashis (signs) and the twenty-seven nakshatras. Each planet is set at its exact sidereal longitude.`, { size: 9 });
  doc.callout({
    label: 'Understanding · the sidereal zodiac',
    body: [
      'Western astrology ties its zodiac to the seasons. Vedic astrology ties it to the stars themselves, so the signs slowly drift apart: today the difference, called the ayanamsa, is about 24°. That is why your Vedic Sun sign is often the sign before the one you know from magazines.',
      `Each sign spans 30°. Each nakshatra spans 13°20′ and is split into four padas (quarters) of 3°20′. Your Moon at ${dms(moon.degreeInSign)} ${signInfo(moon.sign).name} falls in ${NAKSHATRAS[moon.nakshatra - 1].name}, pada ${moon.pada}.`,
    ],
  });
  ctx.glossary.set('Ayanamsa', 'The gap in degrees between the tropical (seasonal) and sidereal (star-based) zodiacs. Lahiri, the Indian government standard, is used here.');
}

const ELEMENT_TEXT: Record<string, string> = {
  fire: 'Fire gives drive, warmth and the urge to lead and initiate.',
  earth: 'Earth gives patience, practicality and a feel for what lasts.',
  air: 'Air gives ideas, sociability and a mind that connects things.',
  water: 'Water gives feeling, intuition and a deep need for belonging.',
};
const MOD_TEXT: Record<string, string> = {
  movable: 'you tend to start things and move toward change.',
  fixed: 'you tend to hold your course and build steadily.',
  dual: 'you tend to adapt, learn and keep several options open.',
};
