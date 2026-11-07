import { SATURN_PHASE_TEXT } from '@vedic/timing';
import { PLANET_BY_ID, signInfo } from '../../data/constants';
import { savBars, weatherChart } from '../charts';
import type { ReportDoc } from '../doc';
import { fromTiming, list, monthYear, ordinal, shortDate, toneWord } from '../format';
import { C, CONTENT_W, F, MARGIN } from '../theme';
import type { ReportContext, SectionHelpers } from '../types';

const tc = (s: number) => (s >= 15 ? C.good : s <= -15 ? C.bad : C.mixed);

export function timing(doc: ReportDoc, ctx: ReportContext, h: SectionHelpers) {
  const t = ctx.timeline!;
  const { now } = ctx;
  doc.chapter({
    numeral: h.numeral, kicker: 'Good times and hard times', title: 'The seasons ahead', art: ctx.art.cosmos,
    intro: 'Your dashas set the long chapters of life; the moving planets (gochara, transits) set the weather inside each chapter. This chapter combines the two into a forecast for the next five years, then looks at Saturn\'s long cycles and at the retrogrades coming up.',
  });
  doc.callout({
    label: 'Understanding · how the forecast is scored',
    body: [
      'Each week gets a score from −100 to +100. Just over half comes from the dasha and sub-period running that week; the rest from transits, judged from your Moon sign as classical gochara teaches, with vedha (obstruction) and the ashtakavarga bindus that say how welcoming each sign is to each planet.',
      'Transit scores are measured against your own long-run average, so "demanding" means harder than usual for you, not hard in absolute terms. The weighting is this site\'s own synthesis of the classical rules, so treat the numbers as a guide to emphasis, not a verdict.',
    ],
  });

  doc.h2('Your life weather', { kicker: `${monthYear(t.range.from)} to ${monthYear(t.range.to)}`, toc: true, keep: 220 });
  const wy = doc.y + 14;
  const bands = t.saturn.sadeSati.map((s) => ({ from: s.start.getTime(), to: s.end.getTime(), label: 'Sade Sati', color: C.bad }));
  weatherChart(doc, t.series.map((p) => ({ t: p.date.getTime(), v: p.combined })), MARGIN.left, wy, CONTENT_W, 150, { today: now.getTime(), bands });
  doc.y = wy + 170;
  doc.para('Weekly combined score. Bars above the line are supportive weeks, below the line demanding ones; a red wash marks Sade Sati.', { size: 7.8, color: C.muted, align: 'center' });

  const windows = t.windows.filter((w) => w.end > now);
  if (windows.length) {
    doc.h3('Windows worth marking', { keep: 120 });
    doc.table(
      [
        { header: 'When', width: 0.27, font: F.sansBold },
        { header: 'Feel', width: 0.15 },
        { header: 'Dasha', width: 0.2 },
        { header: 'Main drivers', width: 0.38 },
      ],
      windows.slice(0, 14).map((w) => [
        `${shortDate(w.start)} – ${shortDate(w.end)}`,
        { text: w.tone === 'favourable' ? 'Supportive' : 'Demanding', color: w.tone === 'favourable' ? C.good : C.bad },
        w.dashaPath.map((p) => PLANET_BY_ID[fromTiming(p)].abbr).join('–'),
        w.drivers.slice(1).join('; ') || w.drivers[0] || '',
      ]),
      { size: 8 },
    );
  }

  const snap = t.now;
  doc.h3(`The sky today, ${shortDate(snap.date)}`, { keep: 200 });
  doc.table(
    [
      { header: 'Planet', width: 0.16, font: F.sansBold },
      { header: 'Transiting', width: 0.17 },
      { header: 'From Moon', width: 0.13, align: 'center' },
      { header: 'From lagna', width: 0.13, align: 'center' },
      { header: 'Note', width: 0.27 },
      { header: 'Score', width: 0.14, align: 'right' },
    ],
    snap.planets.map((p) => [
      PLANET_BY_ID[fromTiming(p.planet)].name + (p.retrograde && p.planet !== 'Rahu' && p.planet !== 'Ketu' ? ' R' : ''),
      signInfo(p.sign + 1).name,
      ordinal(p.houseFromMoon), ordinal(p.houseFromLagna),
      p.obstructedBy ? `Obstructed by ${p.obstructedBy}` : p.contacts.length ? p.contacts.map((c) => `${c.kind} natal ${c.natal}`).join(', ') : p.favourable ? 'Favourable house' : '',
      { text: `${p.score > 0 ? '+' : ''}${p.score}`, color: tc(p.score) },
    ]),
    { size: 8 },
  );

  // ---- Saturn
  doc.h2('Saturn\'s long cycles', { kicker: 'Sade Sati, Kantaka and Ashtama Shani', toc: true, keep: 160 });
  doc.para('Saturn takes about two and a half years to cross a sign. Its passage over the sign before your Moon, your Moon sign and the sign after it is the famous seven-and-a-half-year Sade Sati: a period of pressure, responsibility and maturing that most people meet two or three times. Its transits 4th and 8th from the Moon (Kantaka and Ashtama Shani) are shorter echoes of the same theme.');
  const spells = t.saturn.sadeSati;
  if (spells.length) {
    doc.table(
      [
        { header: 'Sade Sati', width: 0.32, font: F.sansBold },
        { header: 'Your age', width: 0.16, align: 'center' },
        { header: 'Bindus', width: 0.2, align: 'center' },
        { header: 'Intensity', width: 0.32 },
      ],
      spells.map((s) => {
        const birth = new Date(ctx.engineChart.meta.utc);
        const age = (d: Date) => Math.floor((d.getTime() - birth.getTime()) / 3.15576e10);
        const live = s.start <= now && now < s.end;
        return [
          { text: `${monthYear(s.start)} – ${monthYear(s.end)}${live ? '  · now' : ''}`, color: live ? C.gold : C.ink, font: F.sansBold },
          `${age(s.start)}–${age(s.end)}`,
          s.bindus.join(' · '),
          { text: toneWord(s.severity.score), color: tc(s.severity.score) },
        ];
      }),
      { size: 8.2 },
    );
    doc.para('Bindus are Saturn\'s ashtakavarga points in the three signs it crosses (out of 8). Four or more makes a sign easier to pass through; three or fewer makes it heavier.', { size: 7.8, color: C.muted });
  }
  const phasesSoon = t.saturn.phases.filter((p) => p.end > now && p.start < new Date(now.getTime() + 12 * 3.15576e10));
  if (phasesSoon.length) {
    doc.h3('Saturn phases in the next twelve years', { keep: 80 });
    doc.bullets(phasesSoon.slice(0, 8).map((p) => `${monthYear(p.start)} – ${monthYear(p.end)}${p.reentry ? ' (retrograde re-entry)' : ''}: ${SATURN_PHASE_TEXT[p.kind]}`), { size: 8.8 });
  }

  // ---- retrogrades
  doc.h2('Retrogrades', { kicker: 'When planets appear to move backwards', toc: true, keep: 160 });
  doc.para('From Earth, every planet except the Sun and Moon seems to stop, reverse and stop again a few times a year. In Jyotisha a retrograde planet is close to the Earth and unusually strong, but its energy turns inward: the period favours revising, repairing and finishing over launching. The weeks before (pre-shadow) and after (post-shadow) the loop cover the same degrees and belong to the same story.');
  const natalR = ctx.chart.planets.filter((p) => p.retrograde && p.id !== 'rahu' && p.id !== 'ketu');
  doc.para(natalR.length
    ? `At your birth ${list(natalR.map((p) => PLANET_BY_ID[p.id].name))} ${natalR.length > 1 ? 'were' : 'was'} retrograde. When ${natalR.length > 1 ? 'these planets turn' : 'this planet turns'} retrograde again in the sky, the period often feels more natural to you than to most people.`
    : 'No planet was retrograde at your birth, so you may feel retrograde periods as a change of pace more than most.', { size: 9.3 });
  const soon = t.retrogrades.filter((r) => (r.postShadowEnd ?? r.stationDirect ?? r.stationRetrograde) > now).slice(0, 14);
  if (soon.length) {
    doc.table(
      [
        { header: 'Planet', width: 0.13, font: F.sansBold },
        { header: 'Turns retrograde', width: 0.18 },
        { header: 'Turns direct', width: 0.17 },
        { header: 'Your houses', width: 0.13, align: 'center' },
        { header: 'What it touches', width: 0.39 },
      ],
      soon.map((r) => [
        PLANET_BY_ID[fromTiming(r.planet)].name,
        shortDate(r.stationRetrograde),
        r.stationDirect ? shortDate(r.stationDirect) : '—',
        r.natalHouses.map(String).join(', '),
        r.contacts.length ? `Crosses natal ${list(r.contacts.map((c) => `${c.planet}${c.kind === 'opposition' ? ' (opposite)' : ''}`))}` : r.summary.split('.')[0],
      ]),
      { size: 8 },
    );
  }

  // ---- ashtakavarga
  const av = t.ashtakavarga;
  doc.h2('Ashtakavarga', { kicker: 'The strength of each sign for you', toc: true, keep: 230 });
  doc.para('Ashtakavarga ("eight-fold division") gives every sign a number of points, bindus, from each planet and the ascendant. The totals across all signs (Sarvashtakavarga) always add up to 337, so the average is 28. Signs above 28 are where transits tend to go well for you; signs below 25 are where they ask more.');
  const by = doc.y + 6;
  savBars(doc, av.sav, ctx.chart.ascendant.sign, MARGIN.left, by, CONTENT_W, 150);
  doc.y = by + 160;
  doc.para('Bars run from your 1st house to your 12th.', { size: 7.8, color: C.muted, align: 'center' });
  const ranked = av.sav.map((v, i) => ({ v, sign: i + 1 })).sort((a, b) => b.v - a.v);
  const houseOf = (s: number) => ((s - ctx.chart.ascendant.sign + 12) % 12) + 1;
  doc.twoLists(
    { title: 'Strongest signs', color: C.good, items: ranked.slice(0, 3).map((r) => `${signInfo(r.sign).name} (${ordinal(houseOf(r.sign))} house): ${r.v} bindus`) },
    { title: 'Most demanding signs', color: C.bad, items: ranked.slice(-3).reverse().map((r) => `${signInfo(r.sign).name} (${ordinal(houseOf(r.sign))} house): ${r.v} bindus`) },
  );
}
