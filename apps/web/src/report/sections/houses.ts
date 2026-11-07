import { aspectsOnHouse, fromEngineChart, getHouse, getSign } from '@vedic/interpretations';
import type { PlanetId } from '../../types/chart';
import { PLANET_BY_ID, signInfo } from '../../data/constants';
import type { ReportDoc } from '../doc';
import { list, ordinal } from '../format';
import { C, F, toneColor } from '../theme';
import type { ReportContext, SectionHelpers } from '../types';

export function houses(doc: ReportDoc, ctx: ReportContext, h: SectionHelpers) {
  const { chart, report } = ctx;
  const input = fromEngineChart(ctx.engineChart);
  doc.chapter({
    numeral: h.numeral, kicker: 'The stages of life', title: 'The twelve houses', art: ctx.art.cosmos,
    intro: 'The houses (bhavas) divide life into twelve rooms: self, resources, effort, home, creativity, health, partnership, transformation, fortune, career, gains and release. A house is coloured by its sign, by the planets inside it, by the planets that aspect it, and above all by where its ruler has gone.',
  });
  const ascLord = signInfo(chart.ascendant.sign).lord;
  const al = chart.planets.find((p) => p.id === ascLord)!;
  doc.callout({
    label: 'The chart ruler',
    title: `${PLANET_BY_ID[ascLord].name}, lord of your ascendant, sits in the ${ordinal(al.house)} house`,
    body: [report.houseLords[0].summary, ...report.houseLords[0].detail.slice(0, 1)],
  });

  const occ: Record<number, PlanetId[]> = {};
  chart.planets.forEach((p) => { (occ[p.house] ??= []).push(p.id); });
  doc.h2('The houses at a glance', { toc: true, keep: 200 });
  doc.table(
    [
      { header: 'House', width: 0.2, font: F.sansBold },
      { header: 'Sign', width: 0.14 },
      { header: 'Lord', width: 0.11 },
      { header: 'Lord in', width: 0.1, align: 'center' },
      { header: 'Planets inside', width: 0.22 },
      { header: 'Aspected by', width: 0.23 },
    ],
    Array.from({ length: 12 }, (_, i) => {
      const n = i + 1;
      const sign = ((chart.ascendant.sign - 1 + i) % 12) + 1;
      const lord = signInfo(sign).lord;
      const lordHouse = chart.planets.find((p) => p.id === lord)!.house;
      const hp = getHouse(n);
      return [
        `${ordinal(n)} · ${hp.sanskrit.replace(' Bhava', '')}`,
        signInfo(sign).name,
        PLANET_BY_ID[lord].abbr,
        { text: ordinal(lordHouse), color: [6, 8, 12].includes(lordHouse) ? C.bad : [1, 4, 5, 7, 9, 10].includes(lordHouse) ? C.good : C.body },
        (occ[n] ?? []).map((id) => PLANET_BY_ID[id].abbr).join(', ') || '—',
        aspectsOnHouse(input, n).filter((p) => !(occ[n] ?? []).includes(p as PlanetId)).map((p) => PLANET_BY_ID[p as PlanetId].abbr).join(', ') || '—',
      ];
    }),
    { size: 8.2 },
  );
  doc.para('Lord in: the house the ruling planet occupies. Green marks a kendra or trikona (strong support), terracotta a dusthana (6, 8 or 12). Aspects are the full Vedic sign aspects: every planet looks at the 7th sign from itself; Mars also at the 4th and 8th, Jupiter at the 5th and 9th, Saturn at the 3rd and 10th, and the nodes at the 5th and 9th.', { size: 7.8, color: C.muted });

  for (let n = 1; n <= 12; n++) {
    const hp = getHouse(n);
    const sign = ((chart.ascendant.sign - 1 + n - 1) % 12) + 1;
    const lr = report.houseLords[n - 1];
    const inside = occ[n] ?? [];
    doc.ensure(150);
    doc.y += 8;
    const top = doc.y;
    doc.line(String(n), doc.x, top - 4, { font: F.serifBold, size: 30, color: C.goldLight });
    const fx = doc.x;
    doc.line(`${hp.sanskrit.toUpperCase()}  ·  ${getSign(sign).name.toUpperCase()}`, fx + 34, top, { font: F.sansBold, size: 6.6, color: C.gold, charSpace: 1.2 });
    doc.y = top + 11;
    doc.para(`The ${ordinal(n)} house: ${hp.label}`, { font: F.serifBold, size: 14.5, color: C.ink, leading: 1.15, x: fx + 34, after: 3 });
    doc.para(hp.description, { size: 9, x: fx + 34 });
    const bits = [
      inside.length ? `${list(inside.map((id) => PLANET_BY_ID[id].name))} ${inside.length > 1 ? 'live' : 'lives'} here, so ${inside.length > 1 ? 'their' : 'its'} themes are woven into this part of life.` : 'No planet sits here; the house is read through its sign and its ruler.',
      `${lr.title}. ${lr.summary}`,
    ];
    bits.forEach((b) => doc.para(b, { size: 9, x: fx + 34, color: C.body }));
    doc.stroke(toneColor(lr.score), 1.4).pdf.line(fx + 26, top + 2, fx + 26, Math.min(doc.y - 6, doc.bottom));
  }
}
