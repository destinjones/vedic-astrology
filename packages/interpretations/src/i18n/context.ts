import { getVocab, isLocale, list as listFmt, type LocaleCode, type Vocab } from '@vedic/i18n';
import { CONJUNCTIONS, COMBUST_TEXT, DIGNITY_TEXT, RETROGRADE_TEXT, ASPECT_FLAVOR, SPECIAL_ASPECT_NOTES } from '../data/conditions';
import { HOUSE_LORD_IN } from '../data/houseLords';
import { HOUSES, type HouseProfile } from '../data/houses';
import { NAKSHATRAS, type NakshatraProfile } from '../data/nakshatras';
import { PLANET_IN_HOUSE } from '../data/planetInHouse';
import { PLANET_IN_SIGN } from '../data/planetInSign';
import { PLANET_PROFILES, type PlanetProfile } from '../data/planets';
import { SIGNS, type SignProfile } from '../data/signs';
import type { Dignity, PlanetId } from '../types';
import type { ContentPack } from './pack';
import { EN_PHRASES, type Phrases } from './phrases';

export type { LocaleCode };

// ------------------------------------------------------------------ registry

const PACKS: Partial<Record<LocaleCode, ContentPack>> = {};
const LOADERS: Partial<Record<LocaleCode, () => Promise<{ default: ContentPack }>>> = {
  hi: () => import('../locales/hi'),
};

/** Add or replace a language's translations at run time (for tests or plugins). */
export function registerLocale(locale: LocaleCode, pack: ContentPack) {
  PACKS[locale] = pack;
  cache.delete(locale);
}

/** Locales with translated readings (others fall back to English). */
export const READING_LOCALES: LocaleCode[] = ['en', ...(Object.keys(LOADERS) as LocaleCode[])];
export const hasReadings = (locale: string) => locale === 'en' || locale in LOADERS || locale in PACKS;

/**
 * Load a language's readings. Packs are large, so each is its own chunk.
 * Call this before interpretChart(chart, { locale }); unknown locales resolve to English.
 */
export async function loadLocale(locale: string): Promise<LocaleCode> {
  if (!isLocale(locale) || locale === 'en') return 'en';
  if (!PACKS[locale]) {
    const load = LOADERS[locale];
    if (!load) return locale;
    registerLocale(locale, (await load()).default);
  }
  return locale;
}

// ------------------------------------------------------------------ localizer

const pick = <T>(local: T | undefined | null, base: T): T => (local === undefined || local === null || (Array.isArray(local) && local.length === 0 && (base as unknown[]).length > 0) ? base : local);

/** Merged, translated view of the knowledge base for one language. */
export class Localizer {
  readonly ph: Phrases;
  readonly vocab: Vocab;
  readonly locale: LocaleCode;
  private readonly pack: ContentPack;
  constructor(locale: LocaleCode, pack: ContentPack = {}) {
    this.locale = locale;
    this.pack = pack;
    this.ph = { ...EN_PHRASES, ...pack.phrases };
    this.vocab = getVocab(locale);
  }

  ord = (n: number) => this.vocab.ordinal(n);
  list = (items: string[]) => listFmt(this.locale, items);
  planetName = (p: PlanetId) => this.vocab.planets[p].name;
  signName = (n: number) => this.vocab.signs[(((n - 1) % 12) + 12) % 12];
  nakName = (n: number) => this.vocab.nakshatras[(((n - 1) % 27) + 27) % 27];
  dignityName = (d: Dignity) => this.vocab.dignity[d];

  planet(p: PlanetId): PlanetProfile {
    const base = PLANET_PROFILES[p];
    const t = this.pack.planets?.[p] ?? {};
    return {
      ...base,
      name: this.planetName(p),
      significations: pick(t.significations, base.significations),
      body: pick(t.body, base.body),
      essence: t.essence ?? base.essence,
      highExpression: t.highExpression ?? base.highExpression,
      lowExpression: t.lowExpression ?? base.lowExpression,
      gemstone: t.gemstone ?? base.gemstone,
      day: t.day ?? base.day,
    };
  }

  sign(n: number): SignProfile {
    const base = SIGNS[(((n - 1) % 12) + 12) % 12];
    const t = this.pack.signs?.[base.number - 1] ?? {};
    return { ...base, name: this.signName(base.number), flavor: t.flavor ?? base.flavor, style: t.style ?? base.style, themes: pick(t.themes, base.themes), body: t.body ?? base.body, description: t.description ?? base.description };
  }

  house(n: number): HouseProfile {
    const base = HOUSES[(((n - 1) % 12) + 12) % 12];
    const t = this.pack.houses?.[base.number - 1] ?? {};
    return { ...base, name: t.name ?? base.name, sanskrit: t.sanskrit ?? base.sanskrit, label: t.label ?? base.label, significations: pick(t.significations, base.significations), description: t.description ?? base.description };
  }

  nakshatra(n: number): NakshatraProfile {
    const base = NAKSHATRAS[(((n - 1) % 27) + 27) % 27];
    const t = this.pack.nakshatras?.[base.number - 1] ?? {};
    return {
      ...base,
      name: this.nakName(base.number),
      deity: t.deity ?? base.deity,
      symbol: t.symbol ?? base.symbol,
      shakti: t.shakti ?? base.shakti,
      nature: t.nature ?? base.nature,
      keywords: pick(t.keywords, base.keywords),
      description: t.description ?? base.description,
      gifts: pick(t.gifts, base.gifts),
      shadows: pick(t.shadows, base.shadows),
      padas: t.padas ?? base.padas,
    };
  }

  lens(p: PlanetId, fallback: string) { return this.pack.planetLens?.[p] ?? fallback; }

  planetInSign(p: PlanetId, sign: number) {
    const [summary, detail, strengths, challenges] = PLANET_IN_SIGN[p][sign - 1];
    const t = this.pack.planetInSign?.[p]?.[sign - 1];
    return t ? { summary: t[0], detail: t[1], strengths: t[2], challenges: t[3] } : { summary, detail, strengths, challenges };
  }

  planetInHouse(p: PlanetId, house: number) {
    const [summary, detail, strengths, challenges, score] = PLANET_IN_HOUSE[p][house - 1];
    const t = this.pack.planetInHouse?.[p]?.[house - 1];
    return t ? { summary: t[0], detail: t[1], strengths: t[2], challenges: t[3], score } : { summary, detail, strengths, challenges, score };
  }

  houseLord(a: number, b: number) {
    const [summary, detail, score] = HOUSE_LORD_IN[a - 1][b - 1];
    const t = this.pack.houseLords?.[a - 1]?.[b - 1];
    return { summary: t?.[0] ?? summary, detail: t?.[1] ?? detail, score };
  }

  dignity(d: Dignity) {
    const base = DIGNITY_TEXT[d];
    const t = this.pack.dignity?.[d];
    return { ...base, label: t?.label ?? base.label, summary: t?.summary ?? base.summary, detail: t?.detail ?? base.detail };
  }

  retrograde(p: PlanetId) { return this.pack.retrograde?.[p] ?? RETROGRADE_TEXT[p]; }
  combust(p: PlanetId) { return this.pack.combust?.[p] ?? COMBUST_TEXT[p]; }

  conjunction(key: string): [string, string, number] | undefined {
    const base = CONJUNCTIONS[key];
    if (!base) return undefined;
    const t = this.pack.conjunctions?.[key];
    return t ? [t[0], t[1], base[2]] : base;
  }

  aspectFlavor(p: PlanetId) { return this.pack.aspectFlavor?.[p] ?? ASPECT_FLAVOR[p]; }
  specialAspect(p: PlanetId, d: number) { return this.pack.specialAspects?.[p]?.[d] ?? SPECIAL_ASPECT_NOTES[p]?.[d]; }
  yogaText(id: string) { return this.pack.yogas?.[id]; }
  doshaText(id: string) { return this.pack.doshas?.[id]; }
}

const cache = new Map<LocaleCode, Localizer>();
export function localizer(locale: string | undefined): Localizer {
  const code: LocaleCode = isLocale(locale) ? locale : 'en';
  let l = cache.get(code);
  if (!l) { l = new Localizer(code, PACKS[code]); cache.set(code, l); }
  return l;
}

/** Options accepted by every lookup. */
export interface LocaleOptions {
  /** Language for the text. Load it first with loadLocale(); missing text falls back to English. */
  locale?: string;
}
