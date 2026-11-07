import type { Dignity, GrahaId, PlanetId, SignNumber, SignSlug } from './types';

export const ENGINE_VERSION = '0.1.0';

export const GRAHAS: GrahaId[] = [
  'sun',
  'moon',
  'mars',
  'mercury',
  'jupiter',
  'venus',
  'saturn',
  'rahu',
  'ketu',
];
export const OUTER_PLANETS = ['uranus', 'neptune', 'pluto'] as const;

export const PLANET_NAMES: Record<PlanetId, string> = {
  sun: 'Sun',
  moon: 'Moon',
  mars: 'Mars',
  mercury: 'Mercury',
  jupiter: 'Jupiter',
  venus: 'Venus',
  saturn: 'Saturn',
  rahu: 'Rahu',
  ketu: 'Ketu',
  uranus: 'Uranus',
  neptune: 'Neptune',
  pluto: 'Pluto',
};

/** Sanskrit names, handy for UI labels */
export const PLANET_SANSKRIT: Record<GrahaId, string> = {
  sun: 'Surya',
  moon: 'Chandra',
  mars: 'Mangala',
  mercury: 'Budha',
  jupiter: 'Guru',
  venus: 'Shukra',
  saturn: 'Shani',
  rahu: 'Rahu',
  ketu: 'Ketu',
};

/** Mean daily motion (deg/day), used for the "stationary" flag */
export const MEAN_MOTION: Record<PlanetId, number> = {
  sun: 0.9856,
  moon: 13.176,
  mars: 0.524,
  mercury: 1.383,
  jupiter: 0.083,
  venus: 1.2,
  saturn: 0.0335,
  rahu: 0.053,
  ketu: 0.053,
  uranus: 0.0117,
  neptune: 0.006,
  pluto: 0.004,
};

export const SIGN_SLUGS: SignSlug[] = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
];
export const SIGN_NAMES = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];
export const SIGN_SANSKRIT = [
  'Mesha',
  'Vrishabha',
  'Mithuna',
  'Karka',
  'Simha',
  'Kanya',
  'Tula',
  'Vrishchika',
  'Dhanu',
  'Makara',
  'Kumbha',
  'Meena',
];

/** Sign lords, index 0 = Aries */
export const SIGN_LORDS: GrahaId[] = [
  'mars',
  'venus',
  'mercury',
  'moon',
  'sun',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'saturn',
  'jupiter',
];

export type Modality = 'movable' | 'fixed' | 'dual';
export type Element = 'fire' | 'earth' | 'air' | 'water';
export const signModality = (s: SignNumber): Modality =>
  (['movable', 'fixed', 'dual'] as const)[(s - 1) % 3];
export const signElement = (s: SignNumber): Element =>
  (['fire', 'earth', 'air', 'water'] as const)[(s - 1) % 4];
export const isOddSign = (s: SignNumber) => s % 2 === 1;

export interface NakshatraInfo {
  number: number;
  slug: string;
  name: string;
  lord: GrahaId;
  deity: string;
}

const NAK: [string, string, string][] = [
  ['ashwini', 'Ashwini', 'Ashwini Kumaras'],
  ['bharani', 'Bharani', 'Yama'],
  ['krittika', 'Krittika', 'Agni'],
  ['rohini', 'Rohini', 'Brahma'],
  ['mrigashira', 'Mrigashira', 'Soma'],
  ['ardra', 'Ardra', 'Rudra'],
  ['punarvasu', 'Punarvasu', 'Aditi'],
  ['pushya', 'Pushya', 'Brihaspati'],
  ['ashlesha', 'Ashlesha', 'Nagas'],
  ['magha', 'Magha', 'Pitris'],
  ['purva_phalguni', 'Purva Phalguni', 'Bhaga'],
  ['uttara_phalguni', 'Uttara Phalguni', 'Aryaman'],
  ['hasta', 'Hasta', 'Savitar'],
  ['chitra', 'Chitra', 'Tvashtar'],
  ['swati', 'Swati', 'Vayu'],
  ['vishakha', 'Vishakha', 'Indra-Agni'],
  ['anuradha', 'Anuradha', 'Mitra'],
  ['jyeshtha', 'Jyeshtha', 'Indra'],
  ['mula', 'Mula', 'Nirriti'],
  ['purva_ashadha', 'Purva Ashadha', 'Apas'],
  ['uttara_ashadha', 'Uttara Ashadha', 'Vishvadevas'],
  ['shravana', 'Shravana', 'Vishnu'],
  ['dhanishta', 'Dhanishta', 'Vasus'],
  ['shatabhisha', 'Shatabhisha', 'Varuna'],
  ['purva_bhadrapada', 'Purva Bhadrapada', 'Aja Ekapada'],
  ['uttara_bhadrapada', 'Uttara Bhadrapada', 'Ahir Budhnya'],
  ['revati', 'Revati', 'Pushan'],
];

/** Vimshottari order and years */
export const DASHA_ORDER: GrahaId[] = [
  'ketu',
  'venus',
  'sun',
  'moon',
  'mars',
  'rahu',
  'jupiter',
  'saturn',
  'mercury',
];
export const DASHA_YEARS: Record<GrahaId, number> = {
  ketu: 7,
  venus: 20,
  sun: 6,
  moon: 10,
  mars: 7,
  rahu: 18,
  jupiter: 16,
  saturn: 19,
  mercury: 17,
};
export const DASHA_TOTAL_YEARS = 120;

export const NAKSHATRAS: NakshatraInfo[] = NAK.map(([slug, name, deity], i) => ({
  number: i + 1,
  slug,
  name,
  deity,
  lord: DASHA_ORDER[i % 9],
}));

export const NAKSHATRA_SPAN = 360 / 27; // 13°20'
export const PADA_SPAN = NAKSHATRA_SPAN / 4; // 3°20'

// ---------------------------------------------------------------- dignity

/** Exaltation sign and exact degree (0–30 within sign) */
export const EXALTATION: Partial<Record<GrahaId, { sign: SignNumber; degree: number }>> = {
  sun: { sign: 1, degree: 10 },
  moon: { sign: 2, degree: 3 },
  mars: { sign: 10, degree: 28 },
  mercury: { sign: 6, degree: 15 },
  jupiter: { sign: 4, degree: 5 },
  venus: { sign: 12, degree: 27 },
  saturn: { sign: 7, degree: 20 },
  // Common (BPHS-based) convention; some schools use Gemini/Sagittarius.
  rahu: { sign: 2, degree: 20 },
  ketu: { sign: 8, degree: 20 },
};

/** Moolatrikona ranges [sign, fromDeg, toDeg) */
export const MOOLATRIKONA: Partial<Record<GrahaId, [SignNumber, number, number]>> = {
  sun: [5, 0, 20],
  moon: [2, 3, 30],
  mars: [1, 0, 12],
  mercury: [6, 15, 20],
  jupiter: [9, 0, 10],
  venus: [7, 0, 15],
  saturn: [11, 0, 20],
};

export const OWN_SIGNS: Record<GrahaId, SignNumber[]> = {
  sun: [5],
  moon: [4],
  mars: [1, 8],
  mercury: [3, 6],
  jupiter: [9, 12],
  venus: [2, 7],
  saturn: [10, 11],
  // Co-rulership convention used by many Parashari texts
  rahu: [11],
  ketu: [8],
};

/** Natural (naisargika) relationships, BPHS */
export const NATURAL_FRIENDS: Record<GrahaId, { friends: GrahaId[]; enemies: GrahaId[] }> = {
  sun: { friends: ['moon', 'mars', 'jupiter'], enemies: ['venus', 'saturn'] },
  moon: { friends: ['sun', 'mercury'], enemies: [] },
  mars: { friends: ['sun', 'moon', 'jupiter'], enemies: ['mercury'] },
  mercury: { friends: ['sun', 'venus'], enemies: ['moon'] },
  jupiter: { friends: ['sun', 'moon', 'mars'], enemies: ['mercury', 'venus'] },
  venus: { friends: ['mercury', 'saturn'], enemies: ['sun', 'moon'] },
  saturn: { friends: ['mercury', 'venus'], enemies: ['sun', 'moon', 'mars'] },
  rahu: { friends: ['mercury', 'venus', 'saturn'], enemies: ['sun', 'moon', 'mars'] },
  ketu: { friends: ['mars', 'venus', 'saturn'], enemies: ['sun', 'moon'] },
};

export type Relationship = 'friend' | 'neutral' | 'enemy';
export function naturalRelationship(of: GrahaId, toward: GrahaId): Relationship {
  if (of === toward) return 'friend';
  const r = NATURAL_FRIENDS[of];
  if (r.friends.includes(toward)) return 'friend';
  if (r.enemies.includes(toward)) return 'enemy';
  return 'neutral';
}

/**
 * Combustion orbs (degrees from the Sun). Mercury/Venus have smaller orbs
 * when retrograde (Surya Siddhanta / Phaladeepika values).
 */
export const COMBUSTION_ORB: Partial<Record<GrahaId, { direct: number; retro: number }>> = {
  moon: { direct: 12, retro: 12 },
  mars: { direct: 17, retro: 17 },
  mercury: { direct: 14, retro: 12 },
  jupiter: { direct: 11, retro: 11 },
  venus: { direct: 10, retro: 8 },
  saturn: { direct: 15, retro: 15 },
};

export const DIGNITY_RANK: Record<Dignity, number> = {
  exalted: 8,
  moolatrikona: 7,
  own: 6,
  great_friend: 5,
  friend: 4,
  neutral: 3,
  enemy: 2,
  great_enemy: 1,
  debilitated: 0,
};

// ---------------------------------------------------------------- panchanga

export const TITHI_NAMES = [
  'Pratipada',
  'Dwitiya',
  'Tritiya',
  'Chaturthi',
  'Panchami',
  'Shashthi',
  'Saptami',
  'Ashtami',
  'Navami',
  'Dashami',
  'Ekadashi',
  'Dwadashi',
  'Trayodashi',
  'Chaturdashi',
];
export const VARA_NAMES = [
  'Ravivara',
  'Somavara',
  'Mangalavara',
  'Budhavara',
  'Guruvara',
  'Shukravara',
  'Shanivara',
];
export const VARA_LORDS: GrahaId[] = [
  'sun',
  'moon',
  'mars',
  'mercury',
  'jupiter',
  'venus',
  'saturn',
];
export const YOGA_NAMES = [
  'Vishkambha',
  'Priti',
  'Ayushman',
  'Saubhagya',
  'Shobhana',
  'Atiganda',
  'Sukarma',
  'Dhriti',
  'Shula',
  'Ganda',
  'Vriddhi',
  'Dhruva',
  'Vyaghata',
  'Harshana',
  'Vajra',
  'Siddhi',
  'Vyatipata',
  'Variyana',
  'Parigha',
  'Shiva',
  'Siddha',
  'Sadhya',
  'Shubha',
  'Shukla',
  'Brahma',
  'Indra',
  'Vaidhriti',
];
export const MOVABLE_KARANAS = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti'];
