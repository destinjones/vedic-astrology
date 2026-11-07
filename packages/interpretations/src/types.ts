/**
 * Shared identifiers and shapes for the interpretation knowledge base.
 *
 * Conventions (shared with the engine and UI packages):
 *  - Planets are lowercase ids.
 *  - Signs are numbers 1–12 (1 = Aries … 12 = Pisces).
 *  - Houses are numbers 1–12, counted whole-sign from the ascendant by default.
 *  - Nakshatras are numbers 1–27 (1 = Ashwini … 27 = Revati).
 */

import type { RuleSource } from './sources';

export const PLANETS = [
  'sun',
  'moon',
  'mars',
  'mercury',
  'jupiter',
  'venus',
  'saturn',
  'rahu',
  'ketu',
] as const;
export type PlanetId = (typeof PLANETS)[number];

/** The seven visible grahas (no nodes). */
export const SEVEN_PLANETS = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'] as const;
export type SevenPlanetId = (typeof SEVEN_PLANETS)[number];

export type SignNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type HouseNumber = SignNumber;
export type NakshatraNumber = number; // 1–27
export type Pada = 1 | 2 | 3 | 4;

export type Tone = 'benefic' | 'mixed' | 'challenging';
export type Element = 'fire' | 'earth' | 'air' | 'water';
export type Modality = 'movable' | 'fixed' | 'dual';
export type Dignity =
  | 'exalted'
  | 'moolatrikona'
  | 'own'
  | 'great_friend'
  | 'friend'
  | 'neutral'
  | 'enemy'
  | 'great_enemy'
  | 'debilitated';

/** A single readable interpretation, ready for a detail panel. */
export interface Reading {
  id: string;
  title: string;
  /** One or two sentences. */
  summary: string;
  /** One or more paragraphs. */
  detail: string[];
  strengths: string[];
  challenges: string[];
  keywords: string[];
  tone: Tone;
  /** Rough weighting from -3 (very difficult) to +3 (very supportive). */
  score: number;
  /** Optional practical suggestions (remedial or behavioural). */
  remedies?: string[];
  /** Classical source for the rule behind this reading; null when none has been checked yet. */
  source?: RuleSource | null;
}

/** Minimal per-planet data the detectors need. */
export interface PlanetPosition {
  sign: SignNumber;
  house: HouseNumber;
  /** Sidereal longitude, 0–360. */
  longitude: number;
  retrograde: boolean;
  combust?: boolean;
  nakshatra: NakshatraNumber;
  pada: Pada;
  /** Daily speed in degrees; optional. */
  speed?: number;
  /** Compound dignity from the engine, if available. */
  dignity?: Dignity;
}

/** Minimal chart input. The engine adapter maps its Chart object to this. */
export interface ChartInput {
  ascendantSign: SignNumber;
  /** Sidereal ascendant longitude; optional, used for degree-based checks. */
  ascendantLongitude?: number;
  planets: Record<PlanetId, PlanetPosition>;
}

export type YogaCategory =
  | 'raja'
  | 'dhana'
  | 'mahapurusha'
  | 'lunar'
  | 'solar'
  | 'nabhasa'
  | 'parivartana'
  | 'viparita'
  | 'neecha-bhanga'
  | 'spiritual'
  | 'arishta'
  | 'other';

export type Strength = 'strong' | 'moderate' | 'weak';

export interface YogaDefinition {
  id: string;
  name: string;
  /** Sanskrit / alternate names. */
  aka?: string[];
  category: YogaCategory;
  /** Plain-language statement of the rule, for display. */
  rule: string;
  /** Classical source (text, chapter, verse); null when none has been checked yet. */
  source: RuleSource | null;
  reading: Reading;
}

export interface YogaResult {
  id: string;
  name: string;
  category: YogaCategory;
  present: true;
  strength: Strength;
  involved: PlanetId[];
  houses: HouseNumber[];
  /** Why this chart qualifies, in plain words. */
  reason: string;
  reading: Reading;
}

export interface DoshaDefinition {
  id: string;
  name: string;
  aka?: string[];
  rule: string;
  /** Classical source (text, chapter, verse); null when none has been checked yet. */
  source: RuleSource | null;
  reading: Reading;
}

export interface DoshaResult {
  id: string;
  name: string;
  present: boolean;
  /** 'full' | 'partial' | 'cancelled' etc. */
  severity: 'high' | 'moderate' | 'low' | 'cancelled';
  involved: PlanetId[];
  houses: HouseNumber[];
  reason: string;
  cancellations: string[];
  reading: Reading;
}
