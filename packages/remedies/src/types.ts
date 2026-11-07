import type { GrahaId } from '@vedic/engine';

export type SourceId =
  | 'bphs_karakamsa'
  | 'bphs_dasha_shanti'
  | 'bphs_bhava_lords'
  | 'bphs_avatara'
  | 'jaimini_sutras'
  | 'yajnavalkya_grahashanti'
  | 'rigveda'
  | 'yajurveda'
  | 'vyasa_stotra'
  | 'bija_tradition'
  | 'japa_counts'
  | 'navagraha_yantra'
  | 'gem_tradition'
  | 'vrata_tradition';

export interface Source {
  id: SourceId;
  /** Title of the work */
  work: string;
  /** Chapter, section or verse, as precisely as we can stand behind */
  ref: string;
  /** What the source says that matters here, or a caveat about it */
  note?: string;
}

/** A source reference with an optional more exact locus (a verse). */
export interface Citation {
  source: SourceId;
  /** e.g. "1.35.2" for a Rig Veda verse */
  locus?: string;
}

export interface GemRemedy {
  /** English name */
  name: string;
  /** Sanskrit or common Indian name */
  sanskrit: string;
  /** Lower-cost substitutes (upratna) */
  substitutes: string[];
  metal: string;
  finger: string;
  cite: Citation[];
}

export interface MantraRemedy {
  /** Short name mantra, fine for daily use */
  name: string;
  /** Tantric bija (seed) mantra */
  bija: string;
  /** Opening words of the Vedic mantra used in graha shanti */
  vedic: { incipit: string; cite: Citation };
  /** Customary full japa count */
  count: number;
  /** Alternative count: Vimshottari years × 1,000 */
  vimshottariCount: number;
  cite: Citation[];
}

export interface YantraRemedy {
  /** Magic constant: every row, column and diagonal adds to this */
  total: number;
  /** 3 × 3 grid, rows top to bottom */
  grid: number[][];
  cite: Citation[];
}

export interface CharityRemedy {
  /** Things given, in plain words */
  items: string[];
  /** The closing gift named in the Yajnavalkya Smriti */
  dakshina: string;
  /** Homa wood (samidh) */
  samidh: string;
  /** Who to help, a modern reading of the graha's people */
  serve: string;
  cite: Citation[];
}

export interface FastRemedy {
  day: string;
  note: string;
  cite: Citation[];
}

/** Everything the tradition offers for one graha, independent of any chart. */
export interface GrahaRemedySet {
  graha: GrahaId;
  name: string;
  sanskrit: string;
  gem: GemRemedy;
  mantra: MantraRemedy;
  yantra: YantraRemedy;
  charity: CharityRemedy;
  fast: FastRemedy;
  /** The Navagraha Stotra verse's opening words */
  stotra: { incipit: string; cite: Citation };
  /** A plain behavioural practice tied to the graha's significations (original text) */
  practice: string;
  colour: string;
}

export type AfflictionFactorId =
  | 'debilitated'
  | 'enemy_sign'
  | 'combust'
  | 'dusthana'
  | 'malefic_conjunction'
  | 'malefic_aspect'
  | 'papakartari'
  | 'lost_war'
  | 'low_shadbala'
  | 'eclipsed_luminary'
  | 'weak_moon'
  // mitigations, negative weight
  | 'strong_dignity'
  | 'jupiter_support';

export interface AfflictionFactor {
  id: AfflictionFactorId;
  weight: number;
  /** Plain-language reason, specific to this chart */
  reason: string;
}

export type Severity = 'none' | 'mild' | 'moderate' | 'strong';

/** What a planet's lordships make it for this lagna (BPHS). */
export type FunctionalNature = 'benefic' | 'neutral' | 'malefic' | 'node';

export type RemedyKind = 'mantra' | 'charity' | 'fast' | 'practice' | 'yantra' | 'gem';

export type GemAdvice = 'consider' | 'caution' | 'avoid';

export interface GrahaRemedy {
  graha: GrahaId;
  /** Sum of factor weights, 0 or more */
  score: number;
  severity: Severity;
  afflicted: boolean;
  factors: AfflictionFactor[];
  functional: FunctionalNature;
  /** Houses ruled for this lagna (whole sign) */
  rules: number[];
  /** Whether a gem is sensible, and why */
  gem: { advice: GemAdvice; reason: string };
  /** The graha's mahadasha or antardasha is running now */
  runningDasha: 'mahadasha' | 'antardasha' | null;
  /** What to start with, in order */
  priority: RemedyKind[];
  set: GrahaRemedySet;
}

export interface IshtaDevata {
  /** Navamsa sign of the Atmakaraka */
  karakamsa: number;
  /** 12th sign from the Karakamsa, read in the navamsa */
  twelfth: number;
  /** Grahas in that sign in the navamsa */
  occupants: GrahaId[];
  /** The graha the deity is read from */
  significator: GrahaId;
  /** How the significator was chosen */
  basis: 'occupant' | 'lord';
  deity: string;
  /** Vishnu avatar BPHS links to the significator */
  avatar: string;
  /** Other forms the tradition names for the same graha */
  alternatives: string[];
  /** Deities for further occupants, when there is more than one */
  others: { graha: GrahaId; deity: string }[];
  atmakaraka: GrahaId;
  explanation: string[];
  cite: Citation[];
}

export interface RemedyReport {
  grahas: GrahaRemedy[];
  /** Afflicted grahas, worst first */
  afflicted: GrahaRemedy[];
  ishtaDevata: IshtaDevata;
  disclaimers: string[];
}

export interface RemedyOptions {
  /** Date used to find the running dasha. Default: now */
  at?: Date | string | number;
  /** Chara karaka scheme for the Atmakaraka. Default 8 */
  karakaScheme?: 7 | 8;
  /** Score at which a graha counts as afflicted. Default 2 */
  threshold?: number;
}
