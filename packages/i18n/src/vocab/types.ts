export type PlanetKey = 'sun' | 'moon' | 'mars' | 'mercury' | 'jupiter' | 'venus' | 'saturn' | 'rahu' | 'ketu';
export type DignityKey = 'exalted' | 'moolatrikona' | 'own' | 'great_friend' | 'friend' | 'neutral' | 'enemy' | 'great_enemy' | 'debilitated';
export type VargaKey = 'D1' | 'D2' | 'D3' | 'D4' | 'D7' | 'D9' | 'D10' | 'D12' | 'D16' | 'D20' | 'D24' | 'D27' | 'D30' | 'D40' | 'D45' | 'D60';

type Tuple<T, N extends number, R extends T[] = []> = R['length'] extends N ? R : Tuple<T, N, [...R, T]>;

/**
 * The astrological words every package needs. One file per language in this folder.
 * Every field is required, so the type checker lists anything a new language is missing.
 */
export interface Vocab {
  planets: Record<PlanetKey, { name: string; short: string }>;
  /** Aries … Pisces (rashi names in Indian languages). */
  signs: Tuple<string, 12>;
  /** Ashwini … Revati. */
  nakshatras: Tuple<string, 27>;
  /** One-word house themes: Self, Wealth, Courage … */
  houses: Tuple<string, 12>;
  /** Bhava names: Tanu, Dhana, Sahaja … */
  bhavas: Tuple<string, 12>;
  vargas: Record<VargaKey, string>;
  dignity: Record<DignityKey, string>;
  nature: { benefic: string; malefic: string; neutral: string; variable: string };
  element: { fire: string; earth: string; air: string; water: string };
  modality: { movable: string; fixed: string; dual: string };
  gana: { deva: string; manushya: string; rakshasa: string };
  houseGroups: { kendra: string; trikona: string; dusthana: string; upachaya: string; maraka: string; panaphara: string; apoklima: string };
  strength: { strong: string; moderate: string; weak: string };
  severity: { high: string; moderate: string; low: string; cancelled: string };
  tone: { benefic: string; mixed: string; challenging: string };
  /** 1 → "1st". Used for houses and aspects, so 1–12 is enough; larger numbers may fall back to digits. */
  ordinal: (n: number) => string;
}
