import type { PlanetId, VargaId } from '../../types/chart';
import { PLANET_BY_ID, VARGAS, signInfo } from '../../data/constants';
import { northChart } from '../charts';
import type { ReportDoc } from '../doc';
import { list, ordinal } from '../format';
import { C, CONTENT_W, F, MARGIN } from '../theme';
import type { ReportContext, SectionHelpers } from '../types';

const IDS: PlanetId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];

export function vargas(doc: ReportDoc, ctx: ReportContext, h: SectionHelpers) {
  const { chart } = ctx;
  doc.chapter({
    numeral: h.numeral, kicker: 'Divisional charts', title: 'Charts within the chart', art: ctx.art.cosmos,
    intro: 'Vedic astrology divides each sign into finer slices and builds a separate chart from each division. These vargas zoom in on one area of life at a time: marriage and inner strength in the navamsha, career in the dashamsha, children, parents, education and more.',
  });
  doc.callout({
    label: 'Understanding · how a varga is made',
    body: 'In the navamsha (D9) every sign is cut into nine parts of 3°20′, exactly one nakshatra pada each, and each part is assigned a sign in a fixed sequence. A planet\'s navamsha sign shows how its promise matures, especially after the age of about thirty-five. A planet that falls in the same sign in the birth chart and the navamsha is called vargottama and is considered notably strong.',
  });

  const d9 = chart.vargas.D9!;
  const vargottama = IDS.filter((id) => chart.planets.find((p) => p.id === id)!.sign === d9.planets[id].sign);
  const big = 250;
  doc.h2('The navamsha · D9', { kicker: 'Marriage, dharma and the fruit of the chart', toc: true, keep: big + 40 });
  const y = doc.y;
  northChart(doc, chart, d9, MARGIN.left, y, big);
  const tx = MARGIN.left + big + 22;
  const tw = CONTENT_W - big - 22;
  const notes = [
    `Navamsha lagna: ${signInfo(d9.ascSign).name}. Its ruler, ${PLANET_BY_ID[signInfo(d9.ascSign).lord].name}, colours the inner life and the kind of partnership that suits you.`,
    vargottama.length ? `Vargottama: ${list(vargottama.map((id) => PLANET_BY_ID[id].name))}. ${vargottama.length > 1 ? 'These planets keep' : 'This planet keeps'} the same sign in both charts and can be relied on.` : 'No planet is vargottama in your chart.',
    `Venus, the karaka of love, falls in ${signInfo(d9.planets.venus.sign).name} in the navamsha, the ${ordinal(d9.planets.venus.house)} house from the navamsha lagna.`,
    `The 7th house of the navamsha holds ${signInfo(((d9.ascSign + 5) % 12) + 1).name}, ruled by ${PLANET_BY_ID[signInfo(((d9.ascSign + 5) % 12) + 1).lord].name}.`,
  ];
  let ny = y;
  notes.forEach((n) => {
    const lines = doc.wrap(n, tw, F.sans, 9);
    doc.diamond(tx + 2, ny + 6, 1.8);
    lines.forEach((ln, i) => doc.line(ln, tx + 10, ny + i * 13.5, { font: F.sans, size: 9 }));
    ny += lines.length * 13.5 + 8;
  });
  doc.y = Math.max(y + big + 18, ny);
  doc.table(
    [{ header: 'Graha', width: 0.22, font: F.sansBold }, { header: 'Birth chart', width: 0.26 }, { header: 'Navamsha', width: 0.26 }, { header: 'Note', width: 0.26 }],
    IDS.map((id) => {
      const s1 = chart.planets.find((p) => p.id === id)!.sign;
      const s9 = d9.planets[id].sign;
      const ex = PLANET_BY_ID[id].exalted === s9;
      const deb = PLANET_BY_ID[id].debilitated === s9;
      return [PLANET_BY_ID[id].name, signInfo(s1).name, signInfo(s9).name,
        { text: s1 === s9 ? 'Vargottama' : ex ? 'Exalted in D9' : deb ? 'Debilitated in D9' : '', color: s1 === s9 || ex ? C.good : deb ? C.bad : C.body }];
    }),
    { size: 8.2 },
  );

  const d10 = chart.vargas.D10!;
  doc.h2('The dashamsha · D10', { kicker: 'Career and achievement', toc: true, keep: big + 40 });
  const y2 = doc.y;
  northChart(doc, chart, d10, MARGIN.left, y2, big);
  const tenth = ((d10.ascSign + 8) % 12) + 1;
  const inTenth = IDS.filter((id) => d10.planets[id].house === 10);
  const careerNotes = [
    `Dashamsha lagna: ${signInfo(d10.ascSign).name}, ruled by ${PLANET_BY_ID[signInfo(d10.ascSign).lord].name}.`,
    `Its 10th house, the house of profession, holds ${signInfo(tenth).name}${inTenth.length ? ` with ${list(inTenth.map((id) => PLANET_BY_ID[id].name))} inside` : ''}. Its ruler ${PLANET_BY_ID[signInfo(tenth).lord].name} sits in the ${ordinal(d10.planets[signInfo(tenth).lord].house)} house of the D10.`,
    `The Sun (authority) is in the ${ordinal(d10.planets.sun.house)} and Saturn (sustained work) in the ${ordinal(d10.planets.saturn.house)} house of the D10. Planets in kendras and trikonas here tend to be prominent in your working life.`,
  ];
  ny = y2;
  careerNotes.forEach((n) => {
    const lines = doc.wrap(n, tw, F.sans, 9);
    doc.diamond(tx + 2, ny + 6, 1.8);
    lines.forEach((ln, i) => doc.line(ln, tx + 10, ny + i * 13.5, { font: F.sans, size: 9 }));
    ny += lines.length * 13.5 + 8;
  });
  doc.y = Math.max(y2 + big + 18, ny);

  // a grid of the other divisional charts
  doc.newPage();
  doc.h2('Six more lenses', { kicker: 'Other divisional charts', toc: true });
  const grid: VargaId[] = ['D2', 'D3', 'D4', 'D7', 'D12', 'D24'];
  const cw = (CONTENT_W - 2 * 22) / 3;
  const s = cw;
  const gy = doc.y;
  grid.forEach((id, i) => {
    const v = chart.vargas[id];
    if (!v) return;
    const info = VARGAS.find((x) => x.id === id)!;
    const x = MARGIN.left + (i % 3) * (cw + 22);
    const yy = gy + Math.floor(i / 3) * (s + 66);
    northChart(doc, chart, v, x, yy, s);
    doc.line(`${id} · ${info.name}`, x + s / 2, yy + s + 7, { font: F.serifBold, size: 11.5, color: C.ink, align: 'center' });
    doc.wrap(info.area, s, F.sans, 7.6).forEach((ln, li) => doc.line(ln, x + s / 2, yy + s + 23 + li * 10, { font: F.sans, size: 7.6, color: C.muted, align: 'center' }));
  });
  doc.y = gy + 2 * (s + 66) + 4;
  doc.callout({
    label: 'Using the vargas',
    body: 'Read a varga only for its own subject, and always together with the birth chart: a varga can confirm or qualify a promise in the D1, but cannot create one that is absent. The finer vargas (D24 and beyond) change every few minutes of birth time, so they are only reliable when the birth time is accurate to the minute.',
  });
}
