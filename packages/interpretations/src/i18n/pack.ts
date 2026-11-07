import type { HouseProfile } from '../data/houses';
import type { NakshatraProfile } from '../data/nakshatras';
import type { PlanetProfile } from '../data/planets';
import type { SignProfile } from '../data/signs';
import type { Dignity, PlanetId } from '../types';
import type { Phrases } from './phrases';

type Text<T, K extends keyof T> = Partial<Pick<T, K>>;

/** Translated planet-in-sign / planet-in-house entry: [summary, detail, strengths, challenges]. */
export type PlacementText = [summary: string, detail: string, strengths: string[], challenges: string[]];
export interface ReadingText { name?: string; rule?: string; summary?: string; detail?: string[]; strengths?: string[]; challenges?: string[]; remedies?: string[] }

/**
 * Everything a language can translate. Every field is optional: whatever is
 * missing falls back to English, so a language pack can grow file by file.
 * Arrays are indexed like the English tables (signs 0–11, nakshatras 0–26 …).
 * Planet, sign and nakshatra names come from @vedic/i18n, so they are not repeated here.
 */
export interface ContentPack {
  phrases?: Partial<Phrases>;
  planets?: Partial<Record<PlanetId, Text<PlanetProfile, 'significations' | 'body' | 'essence' | 'highExpression' | 'lowExpression' | 'gemstone' | 'day'>>>;
  signs?: Text<SignProfile, 'flavor' | 'style' | 'themes' | 'body' | 'description'>[];
  houses?: Text<HouseProfile, 'name' | 'sanskrit' | 'label' | 'significations' | 'description'>[];
  nakshatras?: Text<NakshatraProfile, 'deity' | 'symbol' | 'shakti' | 'nature' | 'keywords' | 'description' | 'gifts' | 'shadows' | 'padas'>[];
  /** Lens each planet brings to its nakshatra. */
  planetLens?: Partial<Record<PlanetId, string>>;
  planetInSign?: Partial<Record<PlanetId, PlacementText[]>>;
  planetInHouse?: Partial<Record<PlanetId, PlacementText[]>>;
  /** houseLords[lordOf-1][placedIn-1] = [summary, detail] */
  houseLords?: [summary: string, detail: string][][];
  dignity?: Partial<Record<Dignity, { label: string; summary?: string; detail: string }>>;
  retrograde?: Partial<Record<PlanetId, { summary: string; detail: string; strengths: string[]; challenges: string[] }>>;
  combust?: Partial<Record<PlanetId, string>>;
  /** Keyed like CONJUNCTIONS ('mars+moon'): [summary, detail]. */
  conjunctions?: Record<string, [summary: string, detail: string]>;
  aspectFlavor?: Partial<Record<PlanetId, string>>;
  specialAspects?: Partial<Record<PlanetId, Record<number, string>>>;
  yogas?: Record<string, ReadingText>;
  doshas?: Record<string, ReadingText>;
}
