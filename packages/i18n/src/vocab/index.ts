import type { LocaleCode } from '../locales';
import type { Vocab } from './types';
import { bn } from './bn';
import { en } from './en';
import { es } from './es';
import { gu } from './gu';
import { hi } from './hi';
import { kn } from './kn';
import { mr } from './mr';
import { ta } from './ta';
import { te } from './te';

export type { Vocab, PlanetKey, DignityKey, VargaKey } from './types';

/** Vocabulary is small (a few KB per language), so every language is bundled and lookups stay synchronous. */
export const VOCAB: Record<LocaleCode, Vocab> = { en, hi, ta, te, bn, mr, gu, kn, es };

export const getVocab = (locale: LocaleCode | string | undefined): Vocab => VOCAB[locale as LocaleCode] ?? en;
export { SANSKRIT, withSanskritTerms } from './sanskrit';
export type { TermScript } from './sanskrit';
