import type { GrahaId, SignNumber } from '@vedic/engine';

/** 7 = Sun to Saturn (Parashara's alternative), 8 = adds Rahu (Jaimini Sutras / BPHS main scheme). */
export type KarakaScheme = 7 | 8;

export type KarakaId = 'AK' | 'AmK' | 'BK' | 'MK' | 'PiK' | 'PK' | 'GK' | 'DK';

export interface CharaKaraka {
  id: KarakaId;
  /** "Atmakaraka" */
  name: string;
  /** What the role signifies, one short phrase */
  signifies: string;
  planet: GrahaId;
  /** Degrees used for ranking: degree in sign, or 30 minus it for Rahu */
  degree: number;
  sign: SignNumber;
  /** House from the lagna (whole sign) */
  house: number;
  /** Degrees ahead of the next karaka in the ranking; small values mean a close call */
  margin: number;
}

export type ArudhaId = 'AL' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7' | 'A8' | 'A9' | 'A10' | 'A11' | 'UL';

export interface ArudhaPada {
  id: ArudhaId;
  /** House the pada is built for, 1–12 */
  ofHouse: number;
  name: string;
  /** Sign of the house the pada is built for */
  houseSign: SignNumber;
  /** Lord used (stronger lord for Scorpio and Aquarius) */
  lord: GrahaId;
  lordSign: SignNumber;
  /** Sign the pada falls in */
  sign: SignNumber;
  /** House of the pada from the lagna */
  house: number;
  /** The pada fell in the house itself or its 7th and moved 10 signs on */
  exception: boolean;
}

export interface DualLordChoice {
  lord: GrahaId;
  /** Plain-language reason the lord was picked (only set for dual-lord signs) */
  reason?: string;
}

export interface CharaDashaPeriod {
  sign: SignNumber;
  /** 1 = mahadasha (sign dasha), 2 = antardasha */
  level: 1 | 2;
  /** 1 = first 12-sign cycle, 2 = second (12 minus first-cycle years) … */
  cycle: number;
  years: number;
  start: string;
  end: string;
  startJd: number;
  endJd: number;
  /** Mahadasha sign then antardasha sign */
  path: SignNumber[];
  children?: CharaDashaPeriod[];
}

export interface CharaDashaYears {
  sign: SignNumber;
  lord: GrahaId;
  lordSign: SignNumber;
  /** Signs counted from the dasha sign to its lord, 1–12 */
  count: number;
  direction: 'forward' | 'backward';
  /** +1 lord exalted, −1 lord debilitated */
  adjustment: number;
  years: number;
  lordReason?: string;
}

export interface CharaDasha {
  system: 'chara';
  /** Sequence runs forward through the zodiac or backward, set by the 9th sign from the lagna */
  direction: 'forward' | 'backward';
  /** Order of the 12 sign dashas, starting from the lagna */
  order: SignNumber[];
  /** First-cycle length of each sign's dasha and how it was worked out */
  yearsBySign: CharaDashaYears[];
  yearDays: number;
  periods: CharaDashaPeriod[];
}

export interface JaiminiOptions {
  /** Default 8 */
  karakaScheme?: KarakaScheme;
  /** How far the chara dasha runs from birth, years. Default 120 */
  dashaSpanYears?: number;
  /** Days per dasha year. Default 365.2425 */
  yearDays?: number;
}

/** Same shape as a Reading in @vedic/interpretations, so it renders in the same blocks. */
export interface JaiminiReading {
  id: string;
  title: string;
  summary: string;
  detail: string[];
  strengths: string[];
  challenges: string[];
  keywords: string[];
  tone: 'benefic' | 'mixed' | 'challenging';
  score: number;
}
