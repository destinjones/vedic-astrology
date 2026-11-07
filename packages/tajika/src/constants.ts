import type { GrahaId, SignNumber } from '@vedic/engine';

/**
 * Tajika works with the seven visible planets. Rahu and Ketu appear in the
 * annual chart but take no office, aspect or strength.
 */
export type TajikaPlanet = 'sun' | 'moon' | 'mars' | 'mercury' | 'jupiter' | 'venus' | 'saturn';
export const TAJIKA_PLANETS: TajikaPlanet[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];

/** Days per sidereal year, used only as a first guess for the solar return search */
export const SIDEREAL_YEAR_DAYS = 365.256363;

/**
 * Deeptamsa: the half-orb of light each planet throws (Tajika Neelakanthi).
 * Two planets are within orb when their degree gap is at most the mean of the two.
 */
export const DEEPTAMSA: Record<TajikaPlanet, number> = {
  sun: 15,
  moon: 12,
  mars: 8,
  mercury: 7,
  jupiter: 9,
  venus: 7,
  saturn: 9,
};

/**
 * Tajika aspects counted in signs from one planet to the other.
 * 2, 6, 8 and 12 make no aspect. Conjunction (1) is included because
 * Ithasala can form inside one sign.
 */
export type AspectKind = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
export const ASPECT_BY_DISTANCE: Partial<Record<number, AspectKind>> = {
  1: 'conjunction',
  3: 'sextile',
  11: 'sextile',
  4: 'square',
  10: 'square',
  5: 'trine',
  9: 'trine',
  7: 'opposition',
};
export const ASPECT_INFO: Record<AspectKind, { name: string; nature: 'friendly' | 'inimical' | 'mixed'; open: boolean; text: string }> = {
  conjunction: { name: 'Conjunction', nature: 'mixed', open: true, text: 'the two share one sign, so their matters blend' },
  sextile: { name: 'Sextile (3/11)', nature: 'friendly', open: false, text: 'a quiet, friendly glance that helps from behind the scenes' },
  trine: { name: 'Trine (5/9)', nature: 'friendly', open: true, text: 'an open, friendly aspect that cooperates plainly' },
  square: { name: 'Square (4/10)', nature: 'inimical', open: false, text: 'a hidden enmity that works through friction' },
  opposition: { name: 'Opposition (1/7)', nature: 'inimical', open: true, text: 'open enmity that forces a confrontation before anything moves' },
};

/**
 * Tri-rashi pati, lord of the triplicity, by the annual lagna sign
 * (index 0 = Aries) for day and night annual charts (Tajika Neelakanthi).
 */
export const TRI_RASHI_PATI: Record<'day' | 'night', TajikaPlanet[]> = {
  day: ['sun', 'venus', 'saturn', 'venus', 'jupiter', 'moon', 'mercury', 'mars', 'saturn', 'mars', 'jupiter', 'moon'],
  night: ['jupiter', 'moon', 'mercury', 'mars', 'sun', 'venus', 'saturn', 'venus', 'saturn', 'mars', 'jupiter', 'moon'],
};

/**
 * Hadda (terms) used by Tajika, which follow the Egyptian terms.
 * Each sign is a list of [lord, end degree].
 */
export const HADDAS: [TajikaPlanet, number][][] = [
  [['jupiter', 6], ['venus', 12], ['mercury', 20], ['mars', 25], ['saturn', 30]],
  [['venus', 8], ['mercury', 14], ['jupiter', 22], ['saturn', 27], ['mars', 30]],
  [['mercury', 6], ['jupiter', 12], ['venus', 17], ['mars', 24], ['saturn', 30]],
  [['mars', 7], ['venus', 13], ['mercury', 19], ['jupiter', 26], ['saturn', 30]],
  [['jupiter', 6], ['venus', 11], ['saturn', 18], ['mercury', 24], ['mars', 30]],
  [['mercury', 7], ['venus', 17], ['jupiter', 21], ['mars', 28], ['saturn', 30]],
  [['saturn', 6], ['mercury', 14], ['jupiter', 21], ['venus', 28], ['mars', 30]],
  [['mars', 7], ['venus', 11], ['mercury', 19], ['jupiter', 24], ['saturn', 30]],
  [['jupiter', 12], ['venus', 17], ['mercury', 21], ['saturn', 26], ['mars', 30]],
  [['mercury', 7], ['jupiter', 14], ['venus', 22], ['saturn', 26], ['mars', 30]],
  [['mercury', 7], ['venus', 13], ['jupiter', 20], ['mars', 25], ['saturn', 30]],
  [['venus', 12], ['jupiter', 16], ['mercury', 19], ['mars', 28], ['saturn', 30]],
];

export function haddaLord(sign: SignNumber, degreeInSign: number): TajikaPlanet {
  const row = HADDAS[sign - 1];
  for (const [lord, end] of row) if (degreeInSign < end) return lord;
  return row[row.length - 1][0];
}

/** Maximum points of each of the five Pancha-vargiya components */
export const PANCHA_VARGIYA_MAX = { kshetra: 30, uchcha: 20, hadda: 15, drekkana: 10, navamsa: 5 } as const;

/** Muntha by house from the annual lagna: classical quality */
export const MUNTHA_QUALITY: Record<number, 'excellent' | 'good' | 'difficult'> = {
  1: 'good', 2: 'good', 3: 'good', 4: 'difficult', 5: 'good', 6: 'difficult',
  7: 'difficult', 8: 'difficult', 9: 'excellent', 10: 'excellent', 11: 'excellent', 12: 'difficult',
};

/** Vimshottari order and years. Mudda dasha compresses these 120 years into one solar year */
export const VIMSHOTTARI_ORDER: GrahaId[] = ['ketu', 'venus', 'sun', 'moon', 'mars', 'rahu', 'jupiter', 'saturn', 'mercury'];
export const VIMSHOTTARI_YEARS: Record<GrahaId, number> = {
  ketu: 7, venus: 20, sun: 6, moon: 10, mars: 7, rahu: 18, jupiter: 16, saturn: 19, mercury: 17,
};

export const NATURAL_BENEFICS: TajikaPlanet[] = ['jupiter', 'venus', 'moon', 'mercury'];
export const NATURAL_MALEFICS: TajikaPlanet[] = ['saturn', 'mars', 'sun'];
