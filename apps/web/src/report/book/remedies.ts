import type { Chart as EngineChart } from '@vedic/engine';
import { remedies as computeRemedies, SOURCES, type Citation, type GrahaRemedy, type RemedyKind, type SourceId } from '@vedic/remedies';
import { PLANET_BY_ID, signInfo } from '../../data/constants';
import type { ReportDoc } from '../doc';
import { list, ordinal } from '../format';
import { C, F } from '../theme';
import type { SectionHelpers } from '../types';
import { astrologerNote, type BookContext, fold, lesson, prose } from './common';

const KIND: Record<RemedyKind, string> = { mantra: 'mantra', charity: 'charity', fast: 'fasting', practice: 'a daily practice', yantra: 'a yantra', gem: 'a gemstone' };
const NATURE = { benefic: 'a functional benefic', neutral: 'functionally neutral', malefic: 'a functional malefic', node: 'a node' } as const;
const GEM = { consider: 'may suit you', caution: 'only with an astrologer\'s advice', avoid: 'not advised' } as const;
const fmt = (n: number) => n.toLocaleString('en-GB');

export function remediesChapter(doc: ReportDoc, ctx: BookContext, h: SectionHelpers) {
  const r = computeRemedies(ctx.engineChart as EngineChart, { at: ctx.now });
  const order: SourceId[] = [];
  const cite = (cs: Citation | Citation[]) => {
    const arr = Array.isArray(cs) ? cs : [cs];
    const nums = arr.map((c) => { if (!order.includes(c.source)) order.push(c.source); return order.indexOf(c.source) + 1; });
    return `[${[...new Set(nums)].join(', ')}]`;
  };

  doc.chapter({
    numeral: h.numeral, kicker: 'Part four · living with your chart', title: 'Remedies and practices', art: ctx.art.cosmos,
    intro: 'Upaya, "the means", is the tradition\'s answer to a difficult placement: not a cure, but a way of meeting a planet\'s themes with attention. This chapter explains the kinds of remedy, then names the ones the texts give for the planets that need most care in your chart.',
  });

  lesson(doc, 'What a remedy is');
  prose(doc, [
    `Parashara closes almost every description of a difficult period with its shanti, its pacification: repeating the planet's mantra, a fire offering and a gift ${cite({ source: 'bphs_dasha_shanti' })}. The Yajnavalkya Smriti gives each planet its own wood for the fire and its own closing gift ${cite({ source: 'yajnavalkya_grahashanti' })}. Later custom added fasting on the planet's weekday, number squares (yantras) and gemstones.`,
    'The idea behind all of them is the same: a planet that is weak or troubled in your chart is a part of life that needs more conscious care. A mantra keeps it in mind; charity turns its themes outward; a practice puts it into daily habit. Nothing here needs to be bought, and none of it replaces medical, legal or financial help.',
  ]);
  doc.callout({ label: 'Read this first', body: r.disclaimers.map(fold), edge: C.mixed, tint: C.mixedPale, size: 8.6 });

  // ---- Ishta devata
  const d = r.ishtaDevata;
  doc.h2(`Your Ishta devata: ${fold(d.deity)}`, { kicker: 'In your chart · the chosen deity', toc: true });
  doc.para(`Read from ${PLANET_BY_ID[d.significator].name} ${d.basis === 'occupant' ? 'in' : 'ruling'} ${signInfo(d.twelfth).name}, the 12th sign from your Karakamsa (${signInfo(d.karakamsa).name}) ${cite(d.cite.slice(0, 2))}. Parashara also pairs ${PLANET_BY_ID[d.significator].name} with ${fold(d.avatar)} ${cite(d.cite[2] ?? d.cite[0])}${d.alternatives.length ? `; other forms the tradition names are ${list(d.alternatives.map(fold))}` : ''}.`, { font: F.serif, size: 12, leading: 1.45, color: C.ink });
  d.explanation.forEach((t) => doc.para(fold(t), { size: 9.2 }));

  // ---- the planets that need care
  const focus: GrahaRemedy[] = r.afflicted.length ? r.afflicted.slice(0, 4) : r.grahas.filter((g) => g.runningDasha).slice(0, 2);
  doc.h2(r.afflicted.length ? 'The planets that need most care' : 'Remedies for the planets running your life now', { kicker: 'In your chart', toc: true });
  doc.para(r.afflicted.length
    ? `Each planet was checked for the classical signs of strain: debilitation, an enemy sign, combustion, the 6th, 8th and 12th houses, malefic company and aspects, and low strength. ${list(r.afflicted.map((g) => PLANET_BY_ID[g.graha].name))} ${r.afflicted.length > 1 ? 'score' : 'scores'} highest; ${focus.length < r.afflicted.length ? `the first ${focus.length} are given here.` : 'each is given here.'}`
    : 'No planet in your chart reaches the level of strain that calls for remedies. The tradition still suggests honouring the planets whose periods are running, so they are given here.', { size: 9.4 });

  for (const g of focus) {
    const s = g.set;
    const nm = PLANET_BY_ID[g.graha].name;
    doc.ensure(260);
    doc.h3(`${nm} · ${s.sanskrit}`, { keep: 200, size: 17 });
    doc.para(`${nm} rules your ${list(g.rules.map(ordinal)) || '—'} house${g.rules.length === 1 ? '' : 's'}, which makes it ${NATURE[g.functional]} for ${signInfo(ctx.chart.ascendant.sign).name} rising ${cite({ source: 'bphs_bhava_lords' })}.${g.runningDasha ? ` Its ${g.runningDasha} is running now, so its remedies matter more this year.` : ''} Start with ${list(g.priority.slice(0, 3).map((k) => KIND[k]))}.`, { size: 9.3 });
    if (g.factors.length) doc.bullets(g.factors.filter((f) => f.weight > 0).map((f) => fold(f.reason)), { size: 8.6, mark: C.bad });
    doc.table(
      [{ header: 'Remedy', width: 0.22, font: F.sansBold }, { header: `For ${nm}`, width: 0.78 }],
      [
        ['Mantra', `${fold(s.mantra.name)}. Seed (bija) mantra: ${fold(s.mantra.bija)}. Customary count ${fmt(s.mantra.count)}, or ${fmt(s.mantra.vimshottariCount)} by the Vimshottari years ${cite(s.mantra.cite)}.`],
        ['Vedic verse', `${fold(s.mantra.vedic.incipit)} ${cite(s.mantra.vedic.cite)}`],
        ['Hymn', `Navagraha Stotra: ${fold(s.stotra.incipit)} ${cite(s.stotra.cite)}`],
        ['Charity', `${list(s.charity.items)}; traditionally closed with ${s.charity.dakshina}. Serve ${s.charity.serve} ${cite(s.charity.cite)}.`],
        ['Fast', `${s.fast.day}. ${fold(s.fast.note)} ${cite(s.fast.cite)}`],
        ['Practice', fold(s.practice)],
        ['Gemstone', `${s.gem.name} (${fold(s.gem.sanskrit)}), set in ${s.gem.metal}, on the ${s.gem.finger}; substitutes ${list(s.gem.substitutes)}. For you: ${GEM[g.gem.advice]}. ${fold(g.gem.reason)} ${cite(s.gem.cite)}`],
        ['Colours', s.colour],
      ],
      { size: 8.2, zebra: true },
    );
    // the yantra: a magic square
    const Y = 22;
    doc.ensure(Y * 3 + 30);
    const top = doc.y;
    s.yantra.grid.forEach((row, ri) => row.forEach((n, ci) => {
      const x = doc.x + ci * Y;
      const y = top + ri * Y;
      doc.stroke(C.gold, 0.6).pdf.rect(x, y, Y, Y, 'S');
      doc.line(String(n), x + Y / 2, y + 6, { font: F.serifBold, size: 11, color: C.ink, align: 'center' });
    }));
    doc.para(`${nm}'s yantra: every row, column and diagonal adds to ${s.yantra.total} ${cite(s.yantra.cite)}. It is drawn, kept or meditated on rather than worn.`, { size: 8.6, x: doc.x + Y * 3 + 16, color: C.muted });
    doc.y = Math.max(doc.y, top + Y * 3 + 12);
    astrologerNote(doc, ctx, `remedy:${g.graha}`);
  }

  // ---- sources, numbered as cited
  doc.h3('Sources for this chapter', { keep: 80 });
  order.forEach((id, i) => {
    const s = SOURCES[id];
    ctx.cited.set(s.work, s.ref);
    doc.para(`[${i + 1}] ${fold(s.work)}, ${fold(s.ref)}.${s.note ? ` ${fold(s.note)}` : ''}`, { size: 8, color: C.body, after: 4 });
  });
  astrologerNote(doc, ctx, 'chapter:remedies');
}
