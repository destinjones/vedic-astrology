import type { BirthPlace, Chart, GrahaId, SignNumber } from '@vedic/engine';
import type { AspectKind, TajikaPlanet } from './constants';

export interface VarshaphalOptions {
  /**
   * Calendar year in which the solar return falls (e.g. 2026).
   * Ignored when `age` is given.
   */
  year?: number;
  /** Completed years of life: 0 is the year that starts at birth. */
  age?: number;
  /**
   * Where to cast the annual chart. Tajika casts it for the place the person is
   * living on the return; it defaults to the birthplace.
   */
  place?: BirthPlace;
  /**
   * Let the Moon become lord of the year. Tajika Neelakanthi passes the office
   * to the next strongest candidate; set true to treat the Moon like the rest.
   */
  moonCanRuleYear?: boolean;
}

export interface LocalMoment {
  /** YYYY-MM-DD at the chart's place */
  date: string;
  /** HH:mm:ss at the chart's place */
  time: string;
  timezone: string;
  /** Minutes east of UTC at that moment */
  utcOffsetMinutes: number;
}

export interface PanchaVargiya {
  planet: TajikaPlanet;
  kshetra: number;
  uchcha: number;
  hadda: number;
  drekkana: number;
  navamsa: number;
  /** Sum of the five, 0–80 */
  raw: number;
  /** raw / 4, 0–20 (the usual Tajika scale) */
  total: number;
  /** ≥15 full, ≥10 medium, ≥5 little, else none */
  grade: 'full' | 'medium' | 'little' | 'none';
  haddaLord: TajikaPlanet;
}

export type OfficeRole = 'janma_lagna_lord' | 'varsha_lagna_lord' | 'muntha_lord' | 'tri_rashi_pati' | 'dina_ratri_pati';

export interface OfficeBearer {
  role: OfficeRole;
  label: string;
  planet: TajikaPlanet;
  strength: number;
  /** Tajika aspect (or conjunction) to the annual lagna */
  aspectsLagna: boolean;
}

export interface YearLord {
  planet: TajikaPlanet;
  strength: number;
  grade: PanchaVargiya['grade'];
  house: number;
  sign: SignNumber;
  /** Offices this planet holds */
  roles: OfficeRole[];
  /** Plain sentence on why it won */
  reason: string;
  retrograde: boolean;
  combust: boolean;
}

export interface Muntha {
  sign: SignNumber;
  /** House from the annual lagna */
  house: number;
  lord: TajikaPlanet;
  quality: 'excellent' | 'good' | 'difficult';
  lordHouse: number;
  lordStrength: number;
  /** Planets sharing the Muntha's sign */
  with: GrahaId[];
  /** Tajika aspects on the Muntha sign from benefics and malefics */
  aspectedByBenefics: TajikaPlanet[];
  aspectedByMalefics: TajikaPlanet[];
}

export type IthasalaPhase = 'purna' | 'vartamana' | 'bhavishyat';

export interface TajikaAspect {
  a: TajikaPlanet;
  b: TajikaPlanet;
  kind: AspectKind;
  /** Signs from a to b (1–12) */
  distance: number;
  /** Degree gap within the signs: how far from exact */
  gap: number;
  /** Mean of the two deeptamsas */
  orb: number;
  withinOrb: boolean;
  /** The quicker planet by actual daily motion */
  faster: TajikaPlanet;
  applying: boolean;
  /** Ithasala (applying in orb), Ishrafa (separating in orb), or none */
  relation: 'ithasala' | 'ishrafa' | 'none';
  phase?: IthasalaPhase;
}

export type YogaId =
  | 'ikkavala'
  | 'induvara'
  | 'ithasala'
  | 'ishrafa'
  | 'nakta'
  | 'yamaya'
  | 'kamboola'
  | 'radda'
  | 'manau'
  | 'duhphali_kuttha';

export interface TajikaYoga {
  id: YogaId;
  name: string;
  tone: 'good' | 'mixed' | 'hard';
  planets: TajikaPlanet[];
  /** Why it forms, in plain words */
  why: string;
  /** What the tradition says it means for the year */
  meaning: string;
  /** Pair of significators it concerns, when it is about a life area */
  area?: string;
}

export interface LifeArea {
  id: string;
  name: string;
  house: number;
  /** Lord of the house in the annual chart (karyesha) */
  karyesha: TajikaPlanet;
  lagnaLord: TajikaPlanet;
  /** The strongest link between the two lords */
  link: 'same_planet' | 'ithasala' | 'nakta' | 'yamaya' | 'ishrafa' | 'aspect' | 'none';
  linkVia?: TajikaPlanet;
  verdict: 'promising' | 'workable' | 'slow';
  why: string;
}

export interface Saham {
  id: string;
  name: string;
  sanskrit: string;
  signifies: string;
  /** Formula as written, e.g. "Moon − Sun + Lagna" */
  formula: string;
  longitude: number;
  sign: SignNumber;
  degreeInSign: number;
  house: number;
  lord: TajikaPlanet;
  lordStrength: number;
  /** The lord aspects or occupies the Saham's sign */
  lordAspects: boolean;
  /** +30° rule applied */
  addedSign: boolean;
  verdict: 'supported' | 'mixed' | 'strained';
}

export interface MuddaPeriod {
  lord: GrahaId;
  level: 1 | 2;
  start: string;
  end: string;
  startJd: number;
  endJd: number;
  days: number;
  children?: MuddaPeriod[];
}

export interface Varshaphal {
  /** Completed years at the return */
  age: number;
  /** Calendar year (UTC) of the return */
  year: number;
  returnJd: number;
  returnUtc: string;
  returnLocal: LocalMoment;
  nextReturnJd: number;
  nextReturnUtc: string;
  /** Sidereal Sun at birth, which the return matches */
  natalSunLongitude: number;
  /** Sidereal Sun at the computed return, for checking (equals the natal value to ~0.01") */
  returnSunLongitude: number;
  place: BirthPlace & { timezone: string };
  /** Full annual chart from the engine */
  chart: Chart;
  natal: Chart;
  isDayChart: boolean;
  lagna: {
    sign: SignNumber;
    degreeInSign: number;
    lord: TajikaPlanet;
    /** The annual lagna sign counted from the natal lagna (8 is a classical warning) */
    fromNatalLagna: number;
  };
  muntha: Muntha;
  strengths: Record<TajikaPlanet, PanchaVargiya>;
  officeBearers: OfficeBearer[];
  yearLord: YearLord;
  aspects: TajikaAspect[];
  yogas: TajikaYoga[];
  areas: LifeArea[];
  sahams: Saham[];
  mudda: MuddaPeriod[];
  /** −100 … +100 synthesis of Muntha, year lord, Ikkavala/Induvara and key Ithasalas */
  score: number;
  scoreReasons: { text: string; points: number }[];
}
