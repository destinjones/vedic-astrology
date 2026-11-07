import type { DashaPeriod } from '@vedic/timing';
import { NAKSHATRAS, PLANET_BY_ID } from '../../data/constants';
import { spanBar } from '../charts';
import type { ReportDoc } from '../doc';
import { ageAt, fromTiming, list, monthYear, ordinal, shortDate, toneWord } from '../format';
import { C, CONTENT_W, F, MARGIN } from '../theme';
import type { ReportContext, SectionHelpers } from '../types';

/** What each planet's period tends to bring to the foreground. */
export const DASHA_FLAVOR: Record<string, string> = {
  sun: 'recognition, authority, health and vitality, your relationship with father figures and the state, and the question of who you really are',
  moon: 'emotional life, home and mother, public contact, travel and changes of residence, nourishment and care',
  mars: 'energy, ambition and conflict, property and land, siblings, technical skill, sport and decisive action',
  mercury: 'learning, writing and trade, communication, friends and networks, adaptability and a lighter, quicker pace',
  jupiter: 'growth, teachers and wisdom, children, wealth through good counsel, faith and widening horizons',
  venus: 'love and marriage, comforts and beauty, art, vehicles and luxuries, pleasure and the search for balance',
  saturn: 'work, duty and endurance, slow and lasting achievement, hard lessons, service and maturity',
  rahu: 'ambition and appetite, the foreign and the unconventional, technology, sudden rises and restlessness',
  ketu: 'detachment and inner work, research, spiritual practice, losses that free you, and unexpected insight',
};

const tc = (s: number) => (s >= 15 ? C.good : s <= -15 ? C.bad : C.mixed);

export function dasha(doc: ReportDoc, ctx: ReportContext, h: SectionHelpers) {
  const { chart, dashas, now } = ctx;
  const birth = new Date(ctx.engineChart.meta.utc);
  const moon = chart.planets.find((p) => p.id === 'moon')!;
  const nak = NAKSHATRAS[moon.nakshatra - 1];
  doc.chapter({
    numeral: h.numeral, kicker: 'The timing of life', title: 'Your planetary periods', art: ctx.art.cosmos,
    intro: 'Vimshottari dasha divides a 120-year life cycle among the nine grahas. Each planet in turn "runs" a period of years, bringing its own placement, houses and promises to the front of your life. It is the single most used timing tool in Vedic astrology.',
  });
  const first = dashas[0];
  doc.callout({
    label: 'Understanding · where your sequence begins',
    body: [
      `The sequence starts from the Moon's nakshatra at birth. Your Moon was in ${nak.name}, ruled by ${PLANET_BY_ID[nak.lord].name}, so your life opened in the ${PLANET_BY_ID[fromTiming(first.lord)].name} mahadasha, with the part already "used" by how far the Moon had travelled through the star.`,
      'The periods always follow the same order and lengths: Ketu 7 years, Venus 20, Sun 6, Moon 10, Mars 7, Rahu 18, Jupiter 16, Saturn 19 and Mercury 17. Each mahadasha (major period) is divided into nine antardashas (sub-periods) in the same order, starting with its own lord.',
    ],
  });

  // life band
  doc.h2('The periods of your life', { toc: true, keep: 120 });
  const spans = dashas.map((d) => ({ from: d.start.getTime(), to: d.end.getTime(), label: PLANET_BY_ID[fromTiming(d.lord)].abbr, score: d.score, sub: String(d.start.getUTCFullYear()) }));
  const by = doc.y + 10;
  spanBar(doc, spans, MARGIN.left, by, CONTENT_W, 30, { today: now.getTime() });
  doc.y = by + 52;
  doc.para('Each band is one mahadasha, coloured by how supportive its lord is for your chart: green supportive, gold mixed, terracotta demanding. The diamond marks today.', { size: 7.8, color: C.muted, align: 'center' });

  doc.table(
    [
      { header: 'Mahadasha', width: 0.22, font: F.sansBold },
      { header: 'From', width: 0.17 },
      { header: 'To', width: 0.17 },
      { header: 'Your age', width: 0.14, align: 'center' },
      { header: 'Tone', width: 0.15 },
      { header: 'Score', width: 0.15, align: 'right' },
    ],
    dashas.map((d) => {
      const live = d.start <= now && now < d.end;
      const nm = PLANET_BY_ID[fromTiming(d.lord)].name;
      return [
        { text: live ? `${nm}  · now` : nm, color: live ? C.gold : C.ink, font: F.sansBold },
        monthYear(d.start), monthYear(d.end),
        `${Math.max(0, ageAt(birth, d.start))}–${ageAt(birth, d.end)}`,
        { text: toneWord(d.score), color: tc(d.score) },
        { text: `${d.score > 0 ? '+' : ''}${d.score}`, color: tc(d.score) },
      ];
    }),
    { size: 8.3 },
  );

  const maha = dashas.find((d) => d.start <= now && now < d.end);
  if (maha) {
    const mid = fromTiming(maha.lord);
    doc.newPage();
    doc.h2(`Now: the ${PLANET_BY_ID[mid].name} mahadasha`, { kicker: `${shortDate(maha.start)} to ${shortDate(maha.end)}`, toc: true });
    doc.para(`A ${PLANET_BY_ID[mid].name} period brings ${DASHA_FLAVOR[mid]} to the foreground. How it plays out for you depends on where ${PLANET_BY_ID[mid].name} sits and which houses it rules in your chart.`, { font: F.serif, size: 12, leading: 1.45, color: C.ink, after: 8 });
    period(doc, maha);
    const kids = maha.children ?? [];
    if (kids.length) {
      doc.h3('Its sub-periods (antardashas)', { keep: 160 });
      doc.table(
        [
          { header: 'Antardasha', width: 0.3, font: F.sansBold },
          { header: 'From', width: 0.2 },
          { header: 'To', width: 0.2 },
          { header: 'Tone', width: 0.15 },
          { header: 'Score', width: 0.15, align: 'right' },
        ],
        kids.map((k) => {
          const live = k.start <= now && now < k.end;
          return [
            { text: `${PLANET_BY_ID[mid].abbr}–${PLANET_BY_ID[fromTiming(k.lord)].name}${live ? '  · now' : ''}`, color: live ? C.gold : C.ink, font: F.sansBold },
            shortDate(k.start), shortDate(k.end),
            { text: toneWord(k.score), color: tc(k.score) },
            { text: `${k.score > 0 ? '+' : ''}${k.score}`, color: tc(k.score) },
          ];
        }),
        { size: 8.3 },
      );
      const antar = kids.find((k) => k.start <= now && now < k.end);
      if (antar) {
        const aid = fromTiming(antar.lord);
        doc.h3(`The current sub-period: ${PLANET_BY_ID[mid].name}–${PLANET_BY_ID[aid].name}, until ${shortDate(antar.end)}`, { keep: 80 });
        doc.para(`Within the larger ${PLANET_BY_ID[mid].name} story, ${PLANET_BY_ID[aid].name} adds ${DASHA_FLAVOR[aid].split(',').slice(0, 3).join(',')}.`, { size: 9.3 });
        period(doc, antar);
      }
      const next = dashas[dashas.indexOf(maha) + 1];
      if (next) {
        const nid = fromTiming(next.lord);
        doc.callout({
          label: `Looking ahead · from ${monthYear(next.start)}`,
          title: `The ${PLANET_BY_ID[nid].name} mahadasha`,
          body: `After ${PLANET_BY_ID[mid].name} comes ${PLANET_BY_ID[nid].name}, running ${Math.round((next.end.getTime() - next.start.getTime()) / 3.15576e10)} years until ${monthYear(next.end)}. Expect more emphasis on ${DASHA_FLAVOR[nid]}. Its score for your chart is ${next.score > 0 ? '+' : ''}${next.score} (${toneWord(next.score).toLowerCase()}).`,
          edge: tc(next.score),
        });
      }
    }
  }
}

function period(doc: ReportDoc, d: DashaPeriod) {
  const reasons = d.reasons.slice(0, 7);
  const good = reasons.filter((r) => r.weight > 0).map((r) => `${r.text} (+${Math.round(r.weight)})`);
  const hard = reasons.filter((r) => r.weight < 0).map((r) => `${r.text} (${Math.round(r.weight)})`);
  doc.facts([
    ['Score', `${d.score > 0 ? '+' : ''}${d.score} of 100`],
    ['Tone', toneWord(d.score)],
    ['Life areas', list([...new Set(d.themes.map((t) => ordinal(t.house)))]) + ' houses'],
  ], 3, { size: 12.5 });
  if (good.length || hard.length) doc.twoLists({ title: 'Working for you', color: C.good, items: good }, { title: 'Asking for care', color: C.bad, items: hard });
  if (d.themes.length) {
    doc.label('What it activates', { after: 1 });
    doc.bullets(d.themes.map((t) => `${ordinal(t.house)} house (${t.via === 'rules' ? 'it rules' : 'it occupies'}): ${t.topic}`), { size: 8.8 });
  }
}
