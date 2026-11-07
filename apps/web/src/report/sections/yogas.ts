import { DOSHA_DEFINITIONS, YOGA_DEFINITIONS, formatSource, type RuleSource } from '@vedic/interpretations';
import type { ReportDoc } from '../doc';
import { cap, list } from '../format';
import { C } from '../theme';
import type { ReportContext, SectionHelpers } from '../types';

const CATEGORY: Record<string, string> = {
  raja: 'Raja yoga · power and status', dhana: 'Dhana yoga · wealth', mahapurusha: 'Mahapurusha yoga · great person',
  lunar: 'Lunar yoga', solar: 'Solar yoga', nabhasa: 'Nabhasa yoga · pattern', parivartana: 'Parivartana · exchange',
  viparita: 'Viparita raja yoga · reversal', 'neecha-bhanga': 'Neecha bhanga · cancelled weakness', spiritual: 'Spiritual yoga',
  arishta: 'Arishta yoga · caution', other: 'Yoga',
};

/** "Classical source: BPHS 37.7–10; Phaladeepika 6.5." or the reason there is none. */
const sourceLine = (s?: RuleSource | null): string[] => {
  if (!s) return [];
  if (s.citations.length) return [`Classical source: ${formatSource(s)}.`];
  return s.nonClassical ? [`Classical source: none found. ${s.nonClassical}`] : [];
};

export function yogas(doc: ReportDoc, ctx: ReportContext, h: SectionHelpers) {
  const { report } = ctx;
  const present = report.doshas.filter((d) => d.present);
  const clear = report.doshas.filter((d) => !d.present);
  doc.chapter({
    numeral: h.numeral, kicker: 'Special combinations', title: 'Yogas and doshas', art: ctx.art.cosmos,
    intro: `A yoga ("union") is a combination of planets that produces a result greater than its parts. A dosha ("fault") is a combination that asks for care. Your chart was checked against ${Object.keys(YOGA_DEFINITIONS).length} yogas and ${Object.keys(DOSHA_DEFINITIONS).length} doshas: ${report.yogas.length} yoga combinations and ${present.length} dosha${present.length === 1 ? '' : 's'} form.`,
  });
  doc.callout({
    label: 'Understanding · how much a yoga matters',
    body: 'Almost every chart holds several yogas, so their presence alone is not remarkable. What matters is strength: the planets forming a yoga should be well placed and dignified, and a yoga gives its fullest results during the dasha periods of the planets that form it. Each entry below says why the combination applies to you and how strong it is.',
  });

  doc.h2('Yogas in your chart', { toc: true });
  if (!report.yogas.length) doc.para('None of the yogas in our catalogue form in this chart. That is unusual but not a weakness; the strength of individual planets matters more.');
  const order = { strong: 0, moderate: 1, weak: 2 } as const;
  [...report.yogas].sort((a, b) => order[a.strength] - order[b.strength]).forEach((y) => {
    doc.callout({
      label: `${CATEGORY[y.category] ?? 'Yoga'} · ${y.strength}`,
      title: y.name,
      body: [y.reason, y.reading.summary, ...y.reading.detail.slice(0, 1)],
      edge: y.category === 'arishta' ? C.bad : y.strength === 'strong' ? C.good : C.gold,
      tint: y.strength === 'strong' ? C.goodPale : C.paperDeep,
      bullets: [
        ...(y.involved.length ? [`Planets: ${list(y.involved.map(cap))}${y.houses.length ? `; houses ${y.houses.join(', ')}` : ''}.`] : []),
        ...sourceLine(y.reading.source),
      ],
    });
  });

  doc.h2('Doshas to understand', { toc: true });
  if (!present.length) doc.para('None of the doshas checked form in your chart.');
  present.forEach((d) => {
    const sev = d.severity === 'cancelled' ? 'present but cancelled' : `${d.severity} intensity`;
    doc.callout({
      label: `Dosha · ${sev}`,
      title: d.name,
      body: [d.reason, d.reading.summary, ...d.reading.detail.slice(0, 1), ...(d.cancellations.length ? [`What softens it: ${d.cancellations.join('; ')}.`] : [])],
      edge: d.severity === 'cancelled' || d.severity === 'low' ? C.mixed : C.bad,
      tint: d.severity === 'cancelled' || d.severity === 'low' ? C.mixedPale : C.badPale,
      bullets: [...(d.reading.remedies?.slice(0, 4) ?? []), ...sourceLine(d.reading.source)],
    });
  });
  if (clear.length) {
    doc.h3('Checked and clear', { keep: 40 });
    doc.para(`These were looked for and do not form in your chart: ${list(clear.map((d) => d.name))}.`, { size: 9.2 });
  }
  ctx.glossary.set('Manglik (Kuja) dosha', 'Mars in the 1st, 2nd, 4th, 7th, 8th or 12th house, traditionally checked before marriage. Many classical exceptions cancel it, and it is matched by a similar placement in the partner\'s chart.');
  ctx.glossary.set('Kaal Sarp yoga', 'All seven visible planets fall on one side of the Rahu–Ketu axis. Read as intense focus and periods of sudden change.');
}
