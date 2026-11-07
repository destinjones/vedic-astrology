/**
 * Chart data contract used by the UI.
 * Ids match the shared convention across packages:
 *   planets: lowercase 'sun'…'ketu', signs 1–12, houses 1–12, nakshatras 1–27.
 * Longitudes are sidereal degrees in [0, 360).
 */

export type PlanetId =
  | 'sun' | 'moon' | 'mars' | 'mercury' | 'jupiter'
  | 'venus' | 'saturn' | 'rahu' | 'ketu';

export type BodyId = PlanetId | 'asc';

export type SignNum = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type Ayanamsa = 'lahiri' | 'raman' | 'krishnamurti' | 'true_chitra';

export type VargaId =
  | 'D1' | 'D2' | 'D3' | 'D4' | 'D7' | 'D9' | 'D10' | 'D12'
  | 'D16' | 'D20' | 'D24' | 'D27' | 'D30' | 'D40' | 'D45' | 'D60';

export interface BirthInput {
  name?: string;
  /** YYYY-MM-DD, local civil date at birthplace */
  date: string;
  /** HH:mm or HH:mm:ss, local civil time at birthplace */
  time: string;
  place: string;
  latitude: number;
  longitude: number;
  /** IANA zone, e.g. "Asia/Kolkata". Used for historical DST. */
  timezone: string;
  ayanamsa: Ayanamsa;
}

export interface PlanetPosition {
  id: PlanetId;
  longitude: number;
  sign: number;
  degreeInSign: number;
  nakshatra: number;
  pada: number;
  /** whole-sign house from the ascendant in D1 */
  house: number;
  retrograde: boolean;
  combust: boolean;
  /** degrees per day, negative when retrograde */
  speed: number;
}

export interface AscendantPosition {
  longitude: number;
  sign: number;
  degreeInSign: number;
  nakshatra: number;
  pada: number;
}

export interface VargaPlacement {
  sign: number;
  house: number;
}

export interface VargaChart {
  id: VargaId;
  ascSign: number;
  planets: Record<PlanetId, VargaPlacement>;
}

export type DashaSystemId = 'vimshottari' | 'yogini' | 'ashtottari' | 'kalachakra';

export interface DashaPeriod {
  /** Planet ruling the period (for Kalachakra, the lord of its sign) */
  lord: PlanetId;
  /** Yogini name or sign name, when the period is not named after its planet */
  name?: string;
  /** Kalachakra: the sign ruling the period */
  sign?: SignNum;
  /** ISO date-time */
  start: string;
  end: string;
  sub?: DashaPeriod[];
}

export interface Chart {
  input: BirthInput;
  ascendant: AscendantPosition;
  planets: PlanetPosition[];
  vargas: Partial<Record<VargaId, VargaChart>>;
  dasha?: DashaPeriod[];
  /** Other dasha systems, with a one-line note on how this chart's sequence starts. Engine only. */
  dashaSystems?: Partial<Record<Exclude<DashaSystemId, 'vimshottari'>, { periods: DashaPeriod[]; note: string }>>;
  /** The live engine and its full chart, for the timing and reading layers. Absent on the preview calculator. */
  engineContext?: {
    engine: import('@vedic/engine').Engine;
    chart: import('@vedic/engine').Chart;
  };
  meta: {
    ayanamsaValue: number;
    /** 'mock' while the real engine is not wired in */
    source: 'mock' | 'engine';
  };
}
