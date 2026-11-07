import type { Chart as EngineChart, Engine } from '@vedic/engine';
import type { ChartInterpretation, NakshatraProfile } from '@vedic/interpretations';
import type { DashaPeriod as ScoredDasha, Timeline } from '@vedic/timing';
import type { Chart } from '../types/chart';
import type { ReportArt } from './assets';
import type { ReportDoc } from './doc';

/** Everything a report section can draw from. */
export interface ReportContext {
  /** The UI's chart (planets, vargas, dasha). */
  chart: Chart;
  /** The live engine and its full chart, for sections that compute more (strength, Jaimini, other dashas…). */
  engine: Engine;
  engineChart: EngineChart;
  /** Every placement reading, yoga and dosha from @vedic/interpretations. */
  report: ChartInterpretation;
  getNakshatra: (n: number) => NakshatraProfile;
  /** Scored Vimshottari tree (maha → antar → pratyantar). */
  dashas: ScoredDasha[];
  /** Life weather, windows, retrogrades, Sade Sati and ashtakavarga around today. Null if it could not be computed. */
  timeline: Timeline | null;
  art: ReportArt;
  now: Date;
  /** Display name for the person (or "Your chart"). */
  name: string;
  /** Set for a consultation export: the astrologer's own name and logo. */
  brand?: Brand;
  /** Optional personal note from the astrologer, printed after the cover. */
  note?: string;
  /** Glossary terms any section can add; the glossary chapter prints them all. */
  glossary: Map<string, string>;
}

export interface Brand {
  name: string;
  tagline?: string;
  contact?: string;
  /** PNG or JPEG data URL. */
  logo?: string;
}

export interface SectionHelpers {
  /** Roman numeral for this chapter (assigned in order). */
  numeral: string;
}

/**
 * One chapter (or part) of the PDF. Built-in sections live in ./sections;
 * features can add their own with registerReportSection (see README.md).
 */
export interface ReportSection {
  id: string;
  /** Shown in the section picker of the consultation export. */
  title: string;
  blurb?: string;
  /** Sort key. Built-ins: 100 glance, 200 grahas, 300 houses, 400 yogas, 500 vargas, 600 dasha, 700 timing; 800–899 are free for new chapters; 900 glossary. */
  order: number;
  /** Counts as a numbered chapter (it should start with doc.chapter). */
  chapter?: boolean;
  /** Skip the section when this returns false. */
  available?: (ctx: ReportContext) => boolean;
  render: (doc: ReportDoc, ctx: ReportContext, h: SectionHelpers) => void | Promise<void>;
}
