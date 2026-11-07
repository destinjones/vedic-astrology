import type { ReportSection } from './types';

/**
 * Report sections: the built-in list (for pickers) and any registered at runtime.
 * This file has no PDF dependencies, so a feature can import it eagerly:
 *
 *   import { registerReportSection } from '../report/registry';
 *   registerReportSection({ id: 'shadbala', title: 'Planet strength', order: 810, chapter: true, render(doc, ctx, h) { … } });
 *
 * The PDF generator itself is loaded only when someone clicks Download.
 */

export interface SectionChoice { id: string; title: string; blurb: string; order: number }

export const BUILTIN_SECTIONS: SectionChoice[] = [
  { id: 'summary', title: 'One-page summary', blurb: 'Big three, chart, key yogas and doshas, current period and the next windows', order: 50 },
  { id: 'glance', title: 'Chart at a glance', blurb: 'Ascendant, Moon and birth star, both chart styles, positions, panchanga, the wheel', order: 100 },
  { id: 'grahas', title: 'The nine grahas', blurb: 'A page or two on each planet: sign, house, nakshatra, lordship, aspects', order: 200 },
  { id: 'houses', title: 'The twelve houses', blurb: 'Every house, its ruler and the planets in and aspecting it', order: 300 },
  { id: 'yogas', title: 'Yogas and doshas', blurb: 'Every combination found, why it applies and what softens it', order: 400 },
  { id: 'vargas', title: 'Divisional charts', blurb: 'Navamsha and dashamsha in depth, six more vargas', order: 500 },
  { id: 'dasha', title: 'Planetary periods', blurb: 'Vimshottari dashas for life, the current period and sub-periods', order: 600 },
  { id: 'timing', title: 'Good and hard times', blurb: 'Five-year forecast, Sade Sati, retrogrades, ashtakavarga', order: 700 },
  { id: 'glossary', title: 'Glossary', blurb: 'Every Sanskrit term explained', order: 900 },
];

const extra = new Map<string, ReportSection>();

export function registerReportSection(section: ReportSection) {
  extra.set(section.id, section);
}

export const registeredSections = () => [...extra.values()];

/** Everything a person can pick from, in report order. */
export const sectionChoices = (): SectionChoice[] =>
  [...BUILTIN_SECTIONS, ...registeredSections().map((s) => ({ id: s.id, title: s.title, blurb: s.blurb ?? '', order: s.order }))]
    .sort((a, b) => a.order - b.order);

/** The full report: everything except the short summary. */
export const FULL_REPORT = () => sectionChoices().filter((s) => s.id !== 'summary').map((s) => s.id);
/** A sensible default for a client consultation. */
export const CONSULT_DEFAULT = ['summary', 'glance', 'yogas', 'dasha', 'timing'];
