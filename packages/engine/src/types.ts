/**
 * Public types of @vedic/engine. This file is the shared contract for the UI,
 * timing, interpretation and visuals packages. Change it additively.
 *
 * Conventions (shared across the project):
 *  - Planet ids are lowercase: sun moon mars mercury jupiter venus saturn rahu ketu
 *    (+ optional uranus neptune pluto). The ascendant is "asc" where a point id is needed.
 *  - Signs are numbers 1–12 (1 = Aries … 12 = Pisces); slugs aries…pisces.
 *  - Houses are 1–12. Nakshatras are 1–27 (1 = Ashwini); slugs ashwini…revati. Padas 1–4.
 *  - Longitudes are SIDEREAL ecliptic degrees in [0, 360) unless a field says "tropical".
 *  - Instants are ISO-8601 UTC strings ("2024-01-01T05:30:00.000Z") in serialisable
 *    output, plus Julian Day (UT) numbers where useful for math.
 */

export type GrahaId =
  | 'sun'
  | 'moon'
  | 'mars'
  | 'mercury'
  | 'jupiter'
  | 'venus'
  | 'saturn'
  | 'rahu'
  | 'ketu';
export type OuterPlanetId = 'uranus' | 'neptune' | 'pluto';
export type PlanetId = GrahaId | OuterPlanetId;
export type PointId = PlanetId | 'asc';

export type SignNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type SignSlug =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';
export type HouseNumber = SignNumber;
/** 1 = Ashwini … 27 = Revati */
export type NakshatraNumber = number;
export type Pada = 1 | 2 | 3 | 4;

export type AyanamsaId =
  | 'lahiri'
  | 'raman'
  | 'krishnamurti'
  | 'fagan_bradley'
  | 'yukteshwar'
  | 'jn_bhasin'
  | 'true_chitra'
  | 'true_revati'
  | 'true_pushya'
  | 'true_mula'
  | 'suryasiddhanta'
  | 'aryabhata'
  | 'ushashashi'
  | 'galactic_center_mula';

/**
 * whole_sign (default, traditional), equal (30° from ascendant degree),
 * sripati (Swiss 'S'), placidus, koch, porphyry, campanus, regiomontanus.
 */
export type HouseSystem =
  | 'whole_sign'
  | 'equal'
  | 'sripati'
  | 'placidus'
  | 'koch'
  | 'porphyry'
  | 'campanus'
  | 'regiomontanus';

export type NodeType = 'mean' | 'true';

export type VargaId =
  | 'D1'
  | 'D2'
  | 'D3'
  | 'D4'
  | 'D5'
  | 'D6'
  | 'D7'
  | 'D8'
  | 'D9'
  | 'D10'
  | 'D11'
  | 'D12'
  | 'D16'
  | 'D20'
  | 'D24'
  | 'D27'
  | 'D30'
  | 'D40'
  | 'D45'
  | 'D60';

// ---------------------------------------------------------------- input

export interface BirthPlace {
  /** Display name, e.g. "Chennai, Tamil Nadu, India" */
  name?: string;
  /** Geographic latitude, degrees, north positive */
  latitude: number;
  /** Geographic longitude, degrees, east positive */
  longitude: number;
  /** IANA zone, e.g. "Asia/Kolkata". Looked up from lat/lon when omitted. */
  timezone?: string;
  /** Metres above sea level (optional, only affects topocentric options) */
  altitude?: number;
}

export interface BirthInput {
  /** Local civil date at the birth place, "YYYY-MM-DD" */
  date: string;
  /** Local civil time at the birth place, "HH:mm" or "HH:mm:ss" (24h) */
  time: string;
  place: BirthPlace;
  /**
   * Override the UTC offset in minutes (e.g. +330 for IST) instead of using the
   * IANA historical rules. Use for war time / LMT corrections a user knows about.
   */
  utcOffsetMinutes?: number;
  /**
   * Calendar of `date`. Default 'auto': dates before 1582-10-15 are read as
   * Julian. Set 'julian' for places that switched later (Britain 1752).
   */
  calendar?: import('./time').CalendarSystem;
  /** Optional person label, passed through to the output untouched */
  name?: string;
}

export interface ChartOptions {
  /** Default 'lahiri' (Chitrapaksha) */
  ayanamsa?: AyanamsaId;
  /** Default 'whole_sign' */
  houseSystem?: HouseSystem;
  /** Default 'mean' */
  nodeType?: NodeType;
  /** Include Uranus/Neptune/Pluto. Default false */
  includeOuterPlanets?: boolean;
  /** Which divisional charts to compute. Default: all supported vargas */
  vargas?: VargaId[];
  /** Vimshottari depth: 1 = maha, 2 = antar, 3 = pratyantar (default), up to 5 */
  dashaLevels?: 1 | 2 | 3 | 4 | 5;
  /** Days per dasha year. Default 365.2425 */
  dashaYearDays?: number;
  /** Compute Shadbala and Bhava Bala into `chart.strength`. Default true */
  strength?: boolean;
}

// ---------------------------------------------------------------- output

export interface ZodiacPosition {
  /** Sidereal longitude 0–360 */
  longitude: number;
  sign: SignNumber;
  signSlug: SignSlug;
  /** Degrees within sign, 0–30 */
  degreeInSign: number;
  /** "12°34'56\"" */
  dms: string;
  nakshatra: NakshatraNumber;
  nakshatraSlug: string;
  nakshatraName: string;
  pada: Pada;
  /** Vimshottari lord of the nakshatra */
  nakshatraLord: GrahaId;
}

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

export interface PlanetPosition extends ZodiacPosition {
  id: PlanetId;
  name: string;
  /** Ecliptic latitude, degrees */
  latitude: number;
  /** Distance, AU */
  distance: number;
  /** Longitudinal speed, degrees/day (negative = retrograde) */
  speed: number;
  /** Tropical longitude, for reference */
  tropicalLongitude: number;
  house: HouseNumber;
  retrograde: boolean;
  /** Within the classical combustion orb of the Sun (never for sun/rahu/ketu) */
  combust: boolean;
  /** Angular distance from the Sun, degrees 0–180 */
  distanceFromSun: number;
  /** Lord of the sign the planet occupies */
  signLord: GrahaId;
  /** Dignity by sign (natural relationships). Undefined for outer planets */
  dignity?: Dignity;
  /** Speed is below 10% of the planet's mean motion (near a station) */
  stationary: boolean;
}

export interface House {
  number: HouseNumber;
  sign: SignNumber;
  signSlug: SignSlug;
  /** Start of the house (sidereal). For whole sign: 0° of the sign */
  cusp: number;
  lord: GrahaId;
  occupants: PlanetId[];
}

export interface VargaPlacement {
  sign: SignNumber;
  signSlug: SignSlug;
  /** House counted from the varga ascendant (whole sign) */
  house: HouseNumber;
  /** Longitude inside the varga sign (amsa scaled), 0–30 */
  degreeInSign: number;
}

export interface VargaChart {
  id: VargaId;
  division: number;
  name: string;
  ascendant: VargaPlacement;
  planets: Partial<Record<PlanetId, VargaPlacement>>;
  /** sign number -> planets in it (handy for drawing) */
  signs: Record<SignNumber, PointId[]>;
  /** Vargottama: same sign in D1 and this varga (D9 is the usual one) */
  vargottama: PlanetId[];
}

export type DashaSystem = 'vimshottari' | 'yogini' | 'ashtottari' | 'kalachakra';

export interface DashaPeriod {
  /** Lord of this period (for Kalachakra, the lord of the period's sign) */
  lord: GrahaId;
  /** Kalachakra only: the sign that rules this period */
  sign?: SignNumber;
  /** Display name when the period is not simply named after its lord: the yogini (e.g. 'Mangala') or the sign (e.g. 'Aries') */
  name?: string;
  /** 1 = mahadasha, 2 = antardasha, 3 = pratyantardasha, 4 = sookshma, 5 = prana */
  level: number;
  /** ISO UTC */
  start: string;
  /** ISO UTC (exclusive) */
  end: string;
  startJd: number;
  endJd: number;
  /** Length in (dasha) years */
  years: number;
  /** Chain of lords from mahadasha to this period, e.g. ['jupiter','saturn'] */
  path: GrahaId[];
  children?: DashaPeriod[];
}

export interface VimshottariDasha {
  system: 'vimshottari';
  /** Moon's nakshatra lord at birth = first mahadasha lord */
  startLord: GrahaId;
  /** Fraction (0–1) of the first mahadasha already elapsed at birth */
  elapsedFraction: number;
  /** Remaining balance of the first mahadasha at birth, in years */
  balanceYears: number;
  yearDays: number;
  /** 9 mahadashas from birth (the first one starts before birth) + 1 extra cycle start, 120y */
  periods: DashaPeriod[];
}

/** Common shape of every dasha system's result */
export interface DashaTree {
  system: DashaSystem;
  yearDays: number;
  /** Fraction (0–1) of the first mahadasha already elapsed at birth */
  elapsedFraction: number;
  /** Remaining balance of the first mahadasha at birth, in years */
  balanceYears: number;
  /** Mahadashas in order; the first starts at or before birth, the last ends at least 120 years after birth */
  periods: DashaPeriod[];
}

export interface YoginiDasha extends DashaTree {
  system: 'yogini';
  /** 1 = Mangala ... 8 = Sankata */
  startYogini: number;
  startLord: GrahaId;
}

export interface AshtottariDasha extends DashaTree {
  system: 'ashtottari';
  startLord: GrahaId;
  /**
   * Classical condition for using Ashtottari: Rahu in a kendra or trikona from the
   * lagna lord, but not in the lagna. Set by the chart; undefined from the bare function.
   */
  applicable?: boolean;
}

export interface KalachakraDasha extends DashaTree {
  system: 'kalachakra';
  /** 'savya' (direct) or 'apasavya' (reverse) chakra of the Moon's nakshatra */
  direction: 'savya' | 'apasavya';
  /** Moon's nakshatra pada at birth, 1–4 */
  pada: Pada;
  /** Paramayus of the birth pada: 83, 85, 86 or 100 years */
  paramayus: number;
  /** First sign of the birth pada's cycle (body) */
  deha: SignNumber;
  /** Last sign of the birth pada's cycle (life) */
  jeeva: SignNumber;
}

export interface OtherDashas {
  yogini: YoginiDasha;
  ashtottari: AshtottariDasha;
  kalachakra: KalachakraDasha;
}

export interface Panchanga {
  /** 1–30 (1–15 Shukla, 16–30 Krishna) */
  tithi: number;
  tithiName: string;
  paksha: 'shukla' | 'krishna';
  /** 0 = Sunday. Vedic day: begins at local sunrise */
  vara: number;
  varaName: string;
  varaLord: GrahaId;
  nakshatra: NakshatraNumber;
  nakshatraName: string;
  /** 1–27 */
  yoga: number;
  yogaName: string;
  /** 1–60 half-tithi index; name follows the 11 karanas */
  karana: number;
  karanaName: string;
  /** ISO UTC of sunrise/sunset on the Vedic day, if computable at that latitude */
  sunrise?: string;
  sunset?: string;
}

export interface ChartMeta {
  name?: string;
  input: BirthInput;
  options: Required<Omit<ChartOptions, 'vargas'>> & { vargas: VargaId[] };
  /** Resolved IANA zone */
  timezone: string;
  /** Offset applied at the birth instant, minutes east of UTC */
  utcOffsetMinutes: number;
  /** Birth was before standard time in the zone: the place's own Local Mean Time was used */
  localMeanTime: boolean;
  /** Calendar the birth date was read in */
  calendar: 'gregorian' | 'julian';
  /** The birth date in the proleptic Gregorian calendar (differs from input.date when Julian) */
  gregorianDate: string;
  /** Birth instant, ISO UTC */
  utc: string;
  /** Julian day (UT) */
  jdUt: number;
  /** Julian day (TT/ET) */
  jdEt: number;
  ayanamsa: AyanamsaId;
  ayanamsaName: string;
  /** Ayanamsa value at birth, degrees */
  ayanamsaValue: number;
  houseSystem: HouseSystem;
  nodeType: NodeType;
  /** Swiss Ephemeris flag used: 'swiss' (bundled files, ~1800–2400) or 'moshier' */
  ephemeris: 'swiss' | 'moshier';
  engineVersion: string;
}

export interface Chart {
  meta: ChartMeta;
  ascendant: ZodiacPosition & { id: 'asc'; signLord: GrahaId };
  /** Sidereal MC (10th house point) */
  midheaven: ZodiacPosition;
  planets: Record<GrahaId, PlanetPosition> & Partial<Record<OuterPlanetId, PlanetPosition>>;
  /** Index 0 = house 1 */
  houses: House[];
  vargas: Partial<Record<VargaId, VargaChart>>;
  dasha: VimshottariDasha;
  /** Yogini, Ashtottari and Kalachakra dashas, same depth and year length as `dasha` */
  dashas: OtherDashas;
  panchanga: Panchanga;
  /** Shadbala for the seven grahas and Bhava Bala for the twelve houses (absent when options.strength is false) */
  strength?: import('./strength').ChartStrength;
}

/** Light-weight snapshot for transits / timelines */
export interface PlanetSnapshot {
  id: PlanetId;
  longitude: number;
  sign: SignNumber;
  degreeInSign: number;
  nakshatra: NakshatraNumber;
  pada: Pada;
  speed: number;
  retrograde: boolean;
  latitude: number;
}

export interface PositionsSnapshot {
  utc: string;
  jdUt: number;
  ayanamsaValue: number;
  planets: Record<GrahaId, PlanetSnapshot> & Partial<Record<OuterPlanetId, PlanetSnapshot>>;
}

export interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country?: string;
  admin1?: string;
  population?: number;
  elevation?: number;
  /** The former or alternate name the user typed, when this match came from it (e.g. "Pondicherry") */
  formerly?: string;
}
