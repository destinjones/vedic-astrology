/**
 * Muhurta: picking a good time to begin something.
 *
 * Searches a date range at a place and scores every stretch of time where the
 * panchanga (tithi, vara, nakshatra, yoga, karana), the rising sign and its
 * houses, and the day's inauspicious periods (Rahu kalam, Yamaganda, Gulika)
 * stay the same. With the person's natal Moon it adds Tara bala (the day's
 * star counted from the birth star) and Chandra bala (the Moon's sign counted
 * from the birth Moon sign), for one person or for several (a couple).
 *
 * The classical muhurta components are all scored: the nakshatra's mukha
 * (facing up, down or sideways), Dhanishta panchaka and the panchaka rahita
 * remainder, Vishti (Bhadra) with her dwelling by the Moon's sign, disha
 * shoola for journeys, Jupiter or Venus combust (Guru/Shukra asta) and
 * Kharmas for weddings and house-warmings.
 *
 * Rules follow Muhurta Chintamani and common panchanga practice. The weights
 * are this project's own and are exported so they can be tuned.
 */
import { COMBUSTION_ORB, GRAHAS, NAKSHATRAS, PLANET_NAMES, SIGN_NAMES, TITHI_NAMES, VARA_NAMES, YOGA_NAMES } from './constants';
import type { Engine } from './engine';
import { localWeekday, sunriseBefore } from './kp';
import { dateToJd, jdToIso, timezoneAt } from './time';
import type { AyanamsaId, GrahaId } from './types';
import { norm360, signOf } from './zodiac';

export type MuhurtaActivity =
  | 'general'
  | 'marriage'
  | 'griha_pravesha'
  | 'property'
  | 'business'
  | 'travel'
  | 'vehicle'
  | 'education'
  | 'medical'
  | 'naming'
  | 'surgery';

type Modality = 'movable' | 'fixed' | 'dual';
/** Which way a nakshatra "faces": up for raising things, down for digging, sideways for movement */
export type NakshatraMukha = 'urdhva' | 'adho' | 'tiryak';
export type Direction = 'east' | 'south' | 'west' | 'north';

export interface MuhurtaActivityDef {
  id: MuhurtaActivity;
  label: string;
  description: string;
  /** Nakshatras (1–27) the texts recommend */
  nakshatras: number[];
  /** Nakshatras to avoid outright */
  avoidNakshatras: number[];
  /** Good weekdays, 0 = Sunday */
  weekdays: number[];
  /** Weekdays to avoid */
  avoidWeekdays: number[];
  /** Preferred rising-sign modality */
  lagna: Modality[];
  /** Houses from the muhurta lagna that must be empty of malefics (beyond the 8th, which is always checked) */
  emptyHouses: number[];
  /** Tithis (1–30) to avoid on top of the general ones */
  avoidTithis: number[];
  /** Preferred nakshatra "face" (mukha), when the texts give one for this kind of work */
  mukha?: NakshatraMukha[];
  /** Dhanishta panchaka (the Moon in Aquarius or Pisces) is avoided for this work */
  panchaka?: boolean;
  /** Jupiter or Venus combust (Guru or Shukra asta) rules this work out */
  asta?: boolean;
  /** The Sun in Sagittarius or Pisces (Kharmas) rules this work out */
  kharmas?: boolean;
}

// Nakshatra groups (Muhurta Chintamani)
const DHRUVA = [4, 12, 21, 26]; // fixed: Rohini, U.Phalguni, U.Ashadha, U.Bhadrapada
const CHARA = [7, 15, 22, 23, 24]; // movable: Punarvasu, Swati, Shravana, Dhanishta, Shatabhisha
const UGRA = [2, 10, 11, 20, 25]; // fierce: Bharani, Magha, P.Phalguni, P.Ashadha, P.Bhadrapada
const MISHRA = [3, 16]; // mixed: Krittika, Vishakha
const KSHIPRA = [1, 8, 13]; // swift: Ashwini, Pushya, Hasta
const MRIDU = [5, 14, 17, 27]; // soft: Mrigashira, Chitra, Anuradha, Revati
const TIKSHNA = [6, 9, 18, 19]; // sharp: Ardra, Ashlesha, Jyeshtha, Mula

// Nakshatra mukha (Muhurta Chintamani, Nakshatra prakarana): nine stars each
const URDHVA = [4, 6, 8, 12, 21, 22, 23, 24, 26]; // Rohini, Ardra, Pushya, U.Phalguni, U.Ashadha, Shravana, Dhanishta, Shatabhisha, U.Bhadrapada
const ADHO = [2, 3, 9, 10, 11, 16, 19, 20, 25]; // Bharani, Krittika, Ashlesha, Magha, P.Phalguni, Vishakha, Mula, P.Ashadha, P.Bhadrapada
const TIRYAK = [1, 5, 7, 13, 14, 15, 17, 18, 27]; // Ashwini, Mrigashira, Punarvasu, Hasta, Chitra, Swati, Anuradha, Jyeshtha, Revati

export const NAKSHATRA_MUKHA: Record<NakshatraMukha, { label: string; meaning: string; members: number[] }> = {
  urdhva: { label: 'Urdhva mukha (facing up)', meaning: 'raising things: building, roofs, flags, coronations, planting trees, opening a shop', members: URDHVA },
  adho: { label: 'Adho mukha (facing down)', meaning: 'going down: digging foundations and wells, mining, burying, surgery, lending', members: ADHO },
  tiryak: { label: 'Tiryak mukha (facing sideways)', meaning: 'moving across: travel, vehicles, ploughing, trade, taming animals', members: TIRYAK },
};
export const mukhaOf = (nak: number): NakshatraMukha => (URDHVA.includes(nak) ? 'urdhva' : ADHO.includes(nak) ? 'adho' : 'tiryak');

/** Disha shoola: the direction each weekday "spears", 0 = Sunday */
export const VARA_SHOOLA: Direction[] = ['west', 'east', 'north', 'north', 'south', 'west', 'east'];
/** Nakshatra shoola: four stars that spear one direction each */
export const NAKSHATRA_SHOOLA: Partial<Record<number, Direction>> = { 18: 'east', 25: 'south', 4: 'west', 12: 'north' };

/** Panchaka rahita remainders: (tithi + weekday + nakshatra + lagna) mod 9 */
const PANCHAKA_RAHITA: Record<number, { name: string; meaning: string } | null> = {
  0: null, 3: null, 5: null, 7: null,
  1: { name: 'Mrityu panchaka', meaning: 'danger to life' },
  2: { name: 'Agni panchaka', meaning: 'danger from fire' },
  4: { name: 'Raja panchaka', meaning: 'trouble from authority' },
  6: { name: 'Chora panchaka', meaning: 'loss by theft' },
  8: { name: 'Roga panchaka', meaning: 'illness' },
};

/** Where Bhadra (Vishti karana) dwells, by the Moon's sign */
export function bhadraLoka(moonSign: number): 'earth' | 'heaven' | 'netherworld' {
  if ([4, 5, 11, 12].includes(moonSign)) return 'earth';
  if ([1, 2, 3, 8].includes(moonSign)) return 'heaven';
  return 'netherworld';
}

export const NAKSHATRA_GROUPS: Record<string, { label: string; meaning: string; members: number[] }> = {
  dhruva: { label: 'Dhruva (fixed)', meaning: 'lasting things: foundations, homes, marriage, planting', members: DHRUVA },
  chara: { label: 'Chara (movable)', meaning: 'movement: travel, vehicles, starting journeys', members: CHARA },
  ugra: { label: 'Ugra (fierce)', meaning: 'fierce acts: competition, demolition; avoided for gentle beginnings', members: UGRA },
  mishra: { label: 'Mishra (mixed)', meaning: 'mixed: routine work, fire rituals', members: MISHRA },
  kshipra: { label: 'Kshipra (swift)', meaning: 'quick results: trade, medicine, learning, travel', members: KSHIPRA },
  mridu: { label: 'Mridu (soft)', meaning: 'gentle things: friendship, arts, clothes, romance', members: MRIDU },
  tikshna: { label: 'Tikshna (sharp)', meaning: 'sharp acts: surgery, ending things; avoided for auspicious beginnings', members: TIKSHNA },
};

export const MUHURTA_ACTIVITIES: MuhurtaActivityDef[] = [
  {
    id: 'general',
    label: 'Any good beginning',
    description: 'A generally auspicious start for something new',
    nakshatras: [...DHRUVA, ...KSHIPRA, ...MRIDU, ...CHARA],
    avoidNakshatras: [...UGRA, ...TIKSHNA],
    weekdays: [1, 3, 4, 5],
    avoidWeekdays: [2, 6],
    lagna: ['fixed', 'dual'],
    emptyHouses: [],
    avoidTithis: [],
  },
  {
    id: 'marriage',
    label: 'Marriage',
    description: 'Vivaha: the wedding ceremony itself',
    nakshatras: [4, 5, 10, 12, 13, 15, 17, 19, 21, 26, 27],
    avoidNakshatras: [2, 3, 6, 9, 11, 16, 18, 20, 25],
    weekdays: [1, 3, 4, 5],
    avoidWeekdays: [2, 6],
    lagna: ['fixed', 'dual'],
    emptyHouses: [7],
    avoidTithis: [8, 23],
    asta: true,
    kharmas: true,
  },
  {
    id: 'griha_pravesha',
    label: 'Moving into a new home',
    description: 'Griha pravesha: first entry into a new house',
    nakshatras: [...DHRUVA, ...MRIDU, 22, 23, 24],
    avoidNakshatras: [...UGRA, ...TIKSHNA],
    weekdays: [1, 3, 4, 5],
    avoidWeekdays: [0, 2],
    lagna: ['fixed', 'dual'],
    emptyHouses: [4],
    avoidTithis: [],
    mukha: ['urdhva'],
    panchaka: true,
    asta: true,
    kharmas: true,
  },
  {
    id: 'property',
    label: 'Buying land or a house',
    description: 'Signing for or registering property',
    nakshatras: [...DHRUVA, ...MRIDU, 8, 16, 19],
    avoidNakshatras: [2, 6, 9, 18],
    weekdays: [4, 5],
    avoidWeekdays: [2],
    lagna: ['fixed'],
    emptyHouses: [4],
    avoidTithis: [],
    mukha: ['urdhva'],
    panchaka: true,
    asta: true,
  },
  {
    id: 'business',
    label: 'Starting a business',
    description: 'Opening a shop or office, launching a venture, signing a deal',
    nakshatras: [...KSHIPRA, ...DHRUVA, ...MRIDU, 22],
    avoidNakshatras: [...UGRA, ...TIKSHNA],
    weekdays: [3, 4, 5],
    avoidWeekdays: [2, 6],
    lagna: ['fixed', 'dual'],
    emptyHouses: [10],
    avoidTithis: [],
    mukha: ['urdhva'],
  },
  {
    id: 'travel',
    label: 'Setting out on a journey',
    description: 'Yatra: leaving for a long trip or relocation',
    nakshatras: [1, 5, 7, 8, 13, 17, 22, 23, 27],
    avoidNakshatras: [2, 3, 6, 9, 10, 18, 19],
    weekdays: [1, 3, 4, 5],
    avoidWeekdays: [2, 6],
    lagna: ['movable', 'dual'],
    emptyHouses: [],
    avoidTithis: [6, 21],
    mukha: ['tiryak'],
    panchaka: true,
  },
  {
    id: 'vehicle',
    label: 'Buying a vehicle',
    description: 'Taking delivery of a car, bike or other vehicle',
    nakshatras: [...KSHIPRA, ...CHARA, ...MRIDU],
    avoidNakshatras: [...UGRA, ...TIKSHNA],
    weekdays: [1, 3, 4, 5],
    avoidWeekdays: [2, 6],
    lagna: ['movable', 'dual'],
    emptyHouses: [4],
    avoidTithis: [],
    mukha: ['tiryak'],
  },
  {
    id: 'education',
    label: 'Starting studies',
    description: 'Vidyarambha: first lessons, a course or a new school',
    nakshatras: [1, 5, 7, 8, 13, 14, 15, 22, 23, 24, 27],
    avoidNakshatras: [...UGRA, 9, 18, 19],
    weekdays: [0, 3, 4, 5],
    avoidWeekdays: [2, 6],
    lagna: ['dual', 'fixed'],
    emptyHouses: [5],
    avoidTithis: [],
  },
  {
    id: 'medical',
    label: 'Starting a treatment',
    description: 'Beginning medicine or a course of treatment',
    nakshatras: [1, 5, 7, 8, 13, 15, 17, 22, 23, 24, 27],
    avoidNakshatras: [...UGRA, ...TIKSHNA],
    weekdays: [0, 1, 3, 4, 5],
    avoidWeekdays: [2, 6],
    lagna: ['movable', 'dual'],
    emptyHouses: [6],
    avoidTithis: [],
  },
  {
    id: 'surgery',
    label: 'Surgery',
    description: 'Planned surgery: the texts use the sharp stars that cut cleanly',
    nakshatras: [...TIKSHNA, 1, 8, 13],
    avoidNakshatras: [4, 12, 21, 26],
    weekdays: [2, 6, 0],
    avoidWeekdays: [],
    lagna: ['movable', 'dual'],
    emptyHouses: [8],
    avoidTithis: [],
    mukha: ['adho'],
  },
  {
    id: 'naming',
    label: 'Naming a child',
    description: 'Namakarana: the naming ceremony',
    nakshatras: [...DHRUVA, ...MRIDU, ...KSHIPRA, ...CHARA],
    avoidNakshatras: [...UGRA, ...TIKSHNA],
    weekdays: [1, 3, 4, 5],
    avoidWeekdays: [2, 6],
    lagna: ['fixed', 'dual'],
    emptyHouses: [],
    avoidTithis: [],
  },
];

/** Weights for every rule; exported so they can be tuned and shown */
export const MUHURTA_WEIGHTS = {
  base: 40,
  nakshatraGood: 14,
  nakshatraAvoid: -16,
  weekdayGood: 7,
  weekdayAvoid: -9,
  tithiPurna: 5,
  tithiGood: 3,
  tithiRikta: -12,
  tithiAvoid: -10,
  amavasya: -25,
  shuklaPaksha: 3,
  lateKrishna: -5,
  yogaBad: -9,
  yogaSevere: -18,
  vishti: -20,
  vishtiAway: -8,
  mukhaGood: 4,
  mukhaOpposite: -4,
  panchaka: -12,
  panchakaRahita: 3,
  rahitaMrityu: -10,
  rahitaAgni: -8,
  rahitaOther: -5,
  shoola: -18,
  asta: -25,
  kharmas: -25,
  karanaFixed: -6,
  taraGood: 8,
  taraJanma: -4,
  taraBad: -10,
  taraNaidhana: -18,
  chandraGood: 8,
  chandraMid: -6,
  chandrashtama: -24,
  lagnaModality: 7,
  lagnaEighthFromNatal: -10,
  beneficKendra: 3,
  maleficLagna: -8,
  maleficEighth: -10,
  maleficEmptyHouse: -6,
  rahuKalam: -30,
  yamaganda: -20,
  gulika: -12,
  abhijit: 8,
};

export interface MuhurtaNatal {
  /** Who this is, for labels when several people are checked (e.g. a couple) */
  label?: string;
  /** Natal Moon nakshatra 1–27 */
  moonNakshatra: number;
  /** Natal Moon sign 1–12 */
  moonSign: number;
  /** Natal ascendant sign 1–12 (optional, for the 8th-from-lagna rule) */
  lagnaSign?: number;
}

export interface MuhurtaSearch {
  activity: MuhurtaActivity;
  /** Range start and end (Date, ISO or JD UT). At most 92 days apart */
  start: Date | string | number;
  end: Date | string | number;
  latitude: number;
  longitude: number;
  timezone?: string;
  natal?: MuhurtaNatal;
  /**
   * Several people at once, such as a couple for a wedding. Tara bala,
   * Chandra bala and the 8th-from-lagna rule are checked for each, and a
   * blocker for any one of them blocks the window. Used instead of `natal`.
   */
  natals?: MuhurtaNatal[];
  /** Direction of travel, for the disha shoola rules */
  direction?: Direction;
  /** Sampling step in minutes (boundaries are refined to the minute). Default 10 */
  stepMinutes?: number;
  /** Only report windows that fall between sunrise and sunset. Default false */
  daytimeOnly?: boolean;
  /** Shortest window to report, minutes. Default 12 */
  minMinutes?: number;
  /** How many best windows to return. Default 12 */
  limit?: number;
  ayanamsa?: AyanamsaId;
}

export interface MuhurtaFactor {
  key: string;
  label: string;
  detail: string;
  points: number;
  /** A rule the texts treat as disqualifying */
  blocker?: boolean;
}

export interface MuhurtaState {
  tithi: number;
  tithiName: string;
  paksha: 'shukla' | 'krishna';
  weekday: number;
  weekdayName: string;
  nakshatra: number;
  nakshatraName: string;
  yoga: number;
  yogaName: string;
  karana: number;
  karanaName: string;
  lagnaSign: number;
  lagnaName: string;
  moonSign: number;
  tara?: { number: number; name: string };
  chandra?: number;
  /** Tara and Chandra bala for every person checked, in the order given */
  personal: { label?: string; tara: { number: number; name: string }; chandra: number }[];
  /** Which way the day's nakshatra faces */
  mukha: NakshatraMukha;
  /** Dhanishta panchaka: the Moon in Aquarius or Pisces */
  panchaka: boolean;
  /** Panchaka rahita remainder (tithi + weekday + nakshatra + lagna) mod 9 and its name, if a bad one */
  rahita: { remainder: number; name?: string; meaning?: string };
  /** Where Bhadra dwells when the karana is Vishti */
  bhadraLoka?: 'earth' | 'heaven' | 'netherworld';
  /** Jupiter and Venus combust */
  asta: { jupiter: boolean; venus: boolean };
  /** Directions speared by the weekday and the nakshatra */
  shoola: { vara: Direction; nakshatra?: Direction };
  period: 'rahu_kalam' | 'yamaganda' | 'gulika' | 'abhijit' | null;
  daytime: boolean;
  /** Signs occupied by each graha */
  planetSigns: Record<GrahaId, number>;
}

export interface MuhurtaWindow {
  start: string;
  end: string;
  startJd: number;
  endJd: number;
  minutes: number;
  score: number;
  /** 'excellent' ≥ 80, 'good' ≥ 65, 'fair' ≥ 50, else 'poor'; any blocker makes it 'avoid' */
  grade: 'excellent' | 'good' | 'fair' | 'poor' | 'avoid';
  state: MuhurtaState;
  factors: MuhurtaFactor[];
}

export interface MuhurtaDay {
  /** Local date YYYY-MM-DD */
  date: string;
  sunrise?: string;
  sunset?: string;
  best: number;
  /** Best window's index into `windows` */
  bestIndex: number;
  /** Fraction of the day (0–1) in good-or-better windows */
  goodShare: number;
}

export interface MuhurtaResult {
  activity: MuhurtaActivityDef;
  timezone: string;
  /** Every segment, in time order */
  windows: MuhurtaWindow[];
  /** The best non-blocked windows, highest score first */
  best: MuhurtaWindow[];
  days: MuhurtaDay[];
  weights: typeof MUHURTA_WEIGHTS;
}

export const TARA_NAMES = ['Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyari', 'Sadhaka', 'Naidhana', 'Mitra', 'Parama Mitra'];
const BAD_YOGAS = [1, 6, 9, 10, 13, 15, 19]; // Vishkambha, Atiganda, Shula, Ganda, Vyaghata, Vajra, Parigha
const SEVERE_YOGAS = [17, 27]; // Vyatipata, Vaidhriti
const MOVABLE_KARANAS = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti'];
const NATURAL_BENEFICS: GrahaId[] = ['jupiter', 'venus', 'mercury'];
const NATURAL_MALEFICS: GrahaId[] = ['saturn', 'mars', 'rahu', 'ketu', 'sun'];
// Day split into 8 parts sunrise→sunset; part number (1-based) per weekday Sun..Sat
export const RAHU_PART = [8, 2, 7, 5, 6, 4, 3];
export const YAMA_PART = [5, 4, 3, 2, 1, 7, 6];
export const GULIKA_PART = [7, 6, 5, 4, 3, 2, 1];

const toJd = (w: Date | string | number) => (typeof w === 'number' ? w : dateToJd(typeof w === 'string' ? new Date(w) : w));
const modalityOf = (sign: number): Modality => (['movable', 'fixed', 'dual'] as const)[(sign - 1) % 3];
const houseFromSign = (fromSign: number, sign: number) => ((((sign - fromSign) % 12) + 12) % 12) + 1;

function karanaName(k: number) {
  if (k === 1) return 'Kimstughna';
  if (k >= 58) return ['Shakuni', 'Chatushpada', 'Naga'][k - 58];
  return MOVABLE_KARANAS[(k - 2) % 7];
}
function tithiName(t: number) {
  return t === 15 ? 'Purnima' : t === 30 ? 'Amavasya' : TITHI_NAMES[(t - 1) % 15];
}

interface DayInfo {
  sunrise: number;
  sunset: number | null;
  nextSunrise: number;
  weekday: number;
}

export function findMuhurtas(engine: Engine, q: MuhurtaSearch): MuhurtaResult {
  const def = MUHURTA_ACTIVITIES.find((a) => a.id === q.activity);
  if (!def) throw new Error(`Unknown activity "${q.activity}"`);
  const startJd = toJd(q.start);
  const endJd = toJd(q.end);
  if (!(endJd > startJd)) throw new Error('The end of the range must be after the start');
  if (endJd - startJd > 92) throw new Error('Search at most three months at a time');
  const tz = q.timezone ?? timezoneAt(q.latitude, q.longitude);
  const ayanamsa = q.ayanamsa ?? 'lahiri';
  const step = (q.stepMinutes ?? 10) / 1440;
  const W = MUHURTA_WEIGHTS;
  const natals: MuhurtaNatal[] = q.natals?.length ? q.natals : q.natal ? [q.natal] : [];

  // Sunrises covering the range (Vedic days run sunrise to sunrise)
  const days: DayInfo[] = [];
  {
    let sr = sunriseBefore(engine, startJd, q.latitude, q.longitude);
    let guard = 0;
    if (sr === null) sr = startJd - 0.25; // polar: use 6-hour-offset civil days
    while (sr < endJd && guard++ < 200) {
      let ss: number | null = null;
      let next: number | null = null;
      try {
        const a = engine.sunriseSunset(sr + 0.001, q.latitude, q.longitude);
        ss = a.sunset;
        next = a.sunrise;
      } catch {
        /* polar */
      }
      if (next === null || next <= sr) next = sr + 1;
      if (ss !== null && ss > next) ss = null;
      days.push({ sunrise: sr, sunset: ss, nextSunrise: next, weekday: localWeekday(sr, tz) });
      sr = next;
    }
  }
  const dayOf = (jd: number) => days.find((d) => jd >= d.sunrise && jd < d.nextSunrise) ?? days[days.length - 1];

  const stateAt = (jd: number): MuhurtaState => {
    const snap = engine.positionsAt(jd, { ayanamsa });
    const sun = snap.planets.sun.longitude;
    const moon = snap.planets.moon.longitude;
    const elong = norm360(moon - sun);
    const tithi = Math.floor(elong / 12) + 1;
    const yoga = Math.floor(norm360(sun + moon) / (360 / 27)) + 1;
    const karana = Math.floor(elong / 6) + 1;
    const nak = Math.min(27, Math.floor(moon / (360 / 27)) + 1);
    const lagnaSign = signOf(engine.ascendantAt(jd, q.latitude, q.longitude, ayanamsa));
    const moonSign = signOf(moon);
    const d = dayOf(jd);
    let period: MuhurtaState['period'] = null;
    const daytime = d.sunset !== null ? jd < d.sunset : jd < d.sunrise + 0.5;
    if (d.sunset !== null && daytime) {
      const part = Math.floor(((jd - d.sunrise) / (d.sunset - d.sunrise)) * 8) + 1;
      if (part === RAHU_PART[d.weekday]) period = 'rahu_kalam';
      else if (part === YAMA_PART[d.weekday]) period = 'yamaganda';
      else if (part === GULIKA_PART[d.weekday]) period = 'gulika';
      else {
        const mid = (d.sunrise + d.sunset) / 2;
        const muhurta = (d.sunset - d.sunrise) / 15;
        if (d.weekday !== 3 && Math.abs(jd - mid) < muhurta / 2) period = 'abhijit';
      }
    }
    const planetSigns = {} as Record<GrahaId, number>;
    for (const g of GRAHAS) planetSigns[g] = snap.planets[g].sign;
    const fromSun = (g: GrahaId) => {
      const d = Math.abs(norm360(snap.planets[g].longitude - sun));
      return Math.min(d, 360 - d);
    };
    const orb = (g: 'jupiter' | 'venus') => (snap.planets[g].retrograde ? COMBUSTION_ORB[g]!.retro : COMBUSTION_ORB[g]!.direct);
    const kName = karanaName(karana);
    const rem = (tithi + (d.weekday + 1) + nak + lagnaSign) % 9;
    const rahitaBad = PANCHAKA_RAHITA[rem];
    const s: MuhurtaState = {
      tithi,
      tithiName: tithiName(tithi),
      paksha: tithi <= 15 ? 'shukla' : 'krishna',
      weekday: d.weekday,
      weekdayName: VARA_NAMES[d.weekday],
      nakshatra: nak,
      nakshatraName: NAKSHATRAS[nak - 1].name,
      yoga,
      yogaName: YOGA_NAMES[yoga - 1],
      karana,
      karanaName: kName,
      lagnaSign,
      lagnaName: SIGN_NAMES[lagnaSign - 1],
      moonSign,
      personal: natals.map((n) => {
        const t = ((((nak - n.moonNakshatra) % 27) + 27) % 27) % 9;
        return { label: n.label, tara: { number: t + 1, name: TARA_NAMES[t] }, chandra: houseFromSign(n.moonSign, moonSign) };
      }),
      mukha: mukhaOf(nak),
      panchaka: moonSign === 11 || moonSign === 12,
      rahita: rahitaBad ? { remainder: rem, ...rahitaBad } : { remainder: rem },
      bhadraLoka: kName === 'Vishti' ? bhadraLoka(moonSign) : undefined,
      asta: { jupiter: fromSun('jupiter') < orb('jupiter'), venus: fromSun('venus') < orb('venus') },
      shoola: { vara: VARA_SHOOLA[d.weekday], nakshatra: NAKSHATRA_SHOOLA[nak] },
      period,
      daytime,
      planetSigns,
    };
    if (s.personal[0]) {
      s.tara = s.personal[0].tara;
      s.chandra = s.personal[0].chandra;
    }
    return s;
  };

  // Key of everything that affects the score; a change starts a new window
  const keyOf = (s: MuhurtaState) =>
    [s.tithi, s.weekday, s.nakshatra, s.yoga, s.karana, s.lagnaSign, s.period, s.daytime, s.asta.jupiter, s.asta.venus, ...GRAHAS.map((g) => s.planetSigns[g])].join('|');

  // Sample, then bisect each change to the minute
  const cuts: number[] = [startJd];
  let jd = startJd;
  let prevKey = keyOf(stateAt(startJd));
  while (jd < endJd) {
    const next = Math.min(endJd, jd + step);
    if (keyOf(stateAt(next)) !== prevKey) {
      // bisect to the first change after jd; later changes in this step are found from there
      let lo = jd;
      let hi = next;
      while (hi - lo > 1 / 1440) {
        const mid = (lo + hi) / 2;
        if (keyOf(stateAt(mid)) === prevKey) lo = mid;
        else hi = mid;
      }
      cuts.push(hi);
      prevKey = keyOf(stateAt(hi));
      jd = hi;
      continue;
    }
    jd = next;
  }
  cuts.push(endJd);

  const windows: MuhurtaWindow[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i];
    const b = cuts[i + 1];
    if (b - a < 0.5 / 1440) continue;
    const s = stateAt((a + b) / 2);
    const factors = scoreState(s, def, natals, W, q.direction);
    const score = Math.max(0, Math.min(100, Math.round(W.base + factors.reduce((t, f) => t + f.points, 0))));
    const blocked = factors.some((f) => f.blocker);
    windows.push({
      start: jdToIso(a),
      end: jdToIso(b),
      startJd: a,
      endJd: b,
      minutes: Math.round((b - a) * 1440),
      score,
      grade: blocked ? 'avoid' : score >= 80 ? 'excellent' : score >= 65 ? 'good' : score >= 50 ? 'fair' : 'poor',
      state: s,
      factors,
    });
  }

  const minMin = q.minMinutes ?? 12;
  const eligible = windows.filter(
    (w) => w.grade !== 'avoid' && w.minutes >= minMin && (!q.daytimeOnly || w.state.daytime),
  );
  const best = [...eligible].sort((x, y) => y.score - x.score || x.startJd - y.startJd).slice(0, q.limit ?? 12);

  const dayList: MuhurtaDay[] = days
    .filter((d) => d.nextSunrise > startJd && d.sunrise < endJd)
    .map((d) => {
      let bestScore = -1;
      let bestIndex = -1;
      let good = 0;
      const span = d.nextSunrise - d.sunrise;
      windows.forEach((w, i) => {
        const mid = (w.startJd + w.endJd) / 2;
        if (mid < d.sunrise || mid >= d.nextSunrise) return;
        if (w.grade === 'good' || w.grade === 'excellent') good += w.endJd - w.startJd;
        const ok = w.grade !== 'avoid' && w.minutes >= minMin && (!q.daytimeOnly || w.state.daytime);
        if (ok && w.score > bestScore) {
          bestScore = w.score;
          bestIndex = i;
        }
      });
      const local = new Date(jdToIso(d.sunrise));
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(local);
      return {
        date,
        sunrise: jdToIso(d.sunrise),
        sunset: d.sunset !== null ? jdToIso(d.sunset) : undefined,
        best: Math.max(0, bestScore),
        bestIndex,
        goodShare: good / span,
      };
    });

  return { activity: def, timezone: tz, windows, best, days: dayList, weights: W };
}

function scoreState(s: MuhurtaState, def: MuhurtaActivityDef, natals: MuhurtaNatal[], W: typeof MUHURTA_WEIGHTS, direction?: Direction): MuhurtaFactor[] {
  const f: MuhurtaFactor[] = [];
  const add = (key: string, label: string, detail: string, points: number, blocker = false) => f.push({ key, label, detail, points, blocker });

  // Nakshatra
  const group = Object.values(NAKSHATRA_GROUPS).find((g) => g.members.includes(s.nakshatra));
  if (def.nakshatras.includes(s.nakshatra))
    add('nakshatra', `${s.nakshatraName} nakshatra`, `Recommended for ${def.label.toLowerCase()}${group ? `. ${group.label}: ${group.meaning}` : ''}.`, W.nakshatraGood);
  else if (def.avoidNakshatras.includes(s.nakshatra))
    add('nakshatra', `${s.nakshatraName} nakshatra`, `Avoided for ${def.label.toLowerCase()}${group ? `. ${group.label}: ${group.meaning}` : ''}.`, W.nakshatraAvoid);
  else add('nakshatra', `${s.nakshatraName} nakshatra`, `Neutral for this activity${group ? `. ${group.label}: ${group.meaning}` : ''}.`, 0);

  // Vara
  if (def.weekdays.includes(s.weekday)) add('vara', s.weekdayName, 'A favoured weekday for this activity.', W.weekdayGood);
  else if (def.avoidWeekdays.includes(s.weekday)) add('vara', s.weekdayName, 'A weekday the texts avoid for this activity.', W.weekdayAvoid);
  else add('vara', s.weekdayName, 'A neutral weekday for this activity.', 0);

  // Tithi
  const t15 = ((s.tithi - 1) % 15) + 1;
  const paksha = s.paksha === 'shukla' ? 'Shukla' : 'Krishna';
  if (s.tithi === 30) add('tithi', 'Amavasya', 'The new Moon day is avoided for new beginnings.', W.amavasya, def.id !== 'surgery');
  else if ([4, 9, 14].includes(t15)) add('tithi', `${paksha} ${s.tithiName}`, 'A Rikta ("empty") tithi: work begun now tends to come to nothing.', W.tithiRikta);
  else if (def.avoidTithis.includes(s.tithi)) add('tithi', `${paksha} ${s.tithiName}`, `Avoided for ${def.label.toLowerCase()}.`, W.tithiAvoid);
  else if ([5, 10, 15].includes(t15)) add('tithi', `${paksha} ${s.tithiName}`, 'A Purna ("full") tithi: work begun now comes to completion.', W.tithiPurna);
  else if ([2, 3, 7, 11, 12, 13].includes(t15)) add('tithi', `${paksha} ${s.tithiName}`, 'A generally good tithi.', W.tithiGood);
  else add('tithi', `${paksha} ${s.tithiName}`, 'A middling tithi.', 0);
  if (s.paksha === 'shukla') add('paksha', 'Waxing Moon', 'The bright fortnight supports growth.', W.shuklaPaksha);
  else if (s.tithi >= 23) add('paksha', 'Late waning Moon', 'The Moon is weak in the last part of the dark fortnight.', W.lateKrishna);

  // Yoga
  if (SEVERE_YOGAS.includes(s.yoga)) add('yoga', `${s.yogaName} yoga`, 'One of the two worst yogas; the texts reject it for any auspicious work.', W.yogaSevere, true);
  else if (BAD_YOGAS.includes(s.yoga)) add('yoga', `${s.yogaName} yoga`, 'An inauspicious yoga.', W.yogaBad);

  // Karana, with Bhadra's dwelling
  if (s.karanaName === 'Vishti') {
    const exempt = def.id === 'surgery';
    if (s.bhadraLoka === 'earth' || exempt)
      add('karana', 'Vishti (Bhadra) karana', `Bhadra is rejected for auspicious beginnings, and with the Moon in ${SIGN_NAMES[s.moonSign - 1]} she dwells on earth, where she does harm.`, W.vishti, !exempt);
    else
      add('karana', 'Vishti (Bhadra) karana', `Bhadra is in force, but with the Moon in ${SIGN_NAMES[s.moonSign - 1]} she dwells in ${s.bhadraLoka === 'heaven' ? 'heaven' : 'the netherworld'}, and Muhurta Chintamani holds that she then does little harm on earth. Many panchangas still avoid her.`, W.vishtiAway);
  } else if (['Shakuni', 'Chatushpada', 'Naga', 'Kimstughna'].includes(s.karanaName))
    add('karana', `${s.karanaName} karana`, 'A fixed karana around the new Moon, weak for beginnings.', W.karanaFixed);

  // Nakshatra mukha
  if (def.mukha) {
    const m = NAKSHATRA_MUKHA[s.mukha];
    if (def.mukha.includes(s.mukha)) add('mukha', m.label, `Suited to ${m.meaning}.`, W.mukhaGood);
    else if ((def.mukha.includes('urdhva') && s.mukha === 'adho') || (def.mukha.includes('adho') && s.mukha === 'urdhva'))
      add('mukha', m.label, `The star faces the wrong way for this work: it suits ${m.meaning}.`, W.mukhaOpposite);
  }

  // Panchaka
  if (def.panchaka && s.panchaka)
    add('panchaka', 'Dhanishta panchaka', `The Moon is in ${SIGN_NAMES[s.moonSign - 1]}, crossing the last five stars (Dhanishta to Revati). Building, roofing, entering a house and southward journeys are avoided in these days.`, W.panchaka, def.id === 'travel' && direction === 'south');
  if (s.rahita.name) {
    const pts = s.rahita.remainder === 1 ? W.rahitaMrityu : s.rahita.remainder === 2 ? W.rahitaAgni : W.rahitaOther;
    add('rahita', s.rahita.name, `Tithi, weekday, nakshatra and lagna add up to a remainder of ${s.rahita.remainder} when divided by 9, which the panchaka check reads as ${s.rahita.meaning}. It passes when the lagna changes.`, pts);
  } else add('rahita', 'Panchaka rahita', `Tithi, weekday, nakshatra and lagna leave a remainder of ${s.rahita.remainder} by 9, free of the five panchakas.`, W.panchakaRahita);

  // Disha shoola
  if (direction) {
    if (s.shoola.vara === direction) add('shoola', `${s.weekdayName} shoola`, `${s.weekdayName} spears the ${direction}. The texts say not to set out ${direction}ward on this weekday.`, W.shoola, true);
    if (s.shoola.nakshatra === direction) add('nshoola', `${s.nakshatraName} shoola`, `${s.nakshatraName} spears the ${direction}, so a ${direction}ward journey is avoided while the Moon is in it.`, W.shoola, true);
  }

  // Jupiter and Venus combust, and Kharmas
  if (def.asta) {
    const asta = (['jupiter', 'venus'] as const).filter((g) => s.asta[g]);
    if (asta.length)
      add('asta', `${asta.map((g) => (g === 'jupiter' ? 'Guru' : 'Shukra')).join(' and ')} asta`, `${asta.map((g) => PLANET_NAMES[g]).join(' and ')} ${asta.length > 1 ? 'are' : 'is'} combust (too close to the Sun). Marriages, house-warmings and other samskaras wait until ${asta.length > 1 ? 'they rise' : 'it rises'} again.`, W.asta, true);
  }
  if (def.kharmas && (s.planetSigns.sun === 9 || s.planetSigns.sun === 12))
    add('kharmas', 'Kharmas', `The Sun is in ${SIGN_NAMES[s.planetSigns.sun - 1]}, Jupiter's sign, the month called Kharmas or Malmas in North India, when weddings and house-warmings are not held. Regional calendars differ on which months they close.`, W.kharmas, true);

  // Tara and Chandra bala, for every person
  const multi = natals.length > 1;
  s.personal.forEach((p, i) => {
    const who = multi ? `${p.label ?? `Person ${i + 1}`}: ` : '';
    const your = multi ? `${p.label ?? `person ${i + 1}`}'s` : 'your';
    const k = multi ? `-${i}` : '';
    const n = p.tara.number;
    if ([2, 4, 6, 8, 9].includes(n)) add(`tara${k}`, `${who}${p.tara.name} tara`, `The day's star is ${p.tara.name.toLowerCase()} (${n}) from ${your} birth star: supportive.`, W.taraGood);
    else if (n === 7) add(`tara${k}`, `${who}Naidhana tara`, `The 7th tara from ${your} birth star, the most harmful one.`, W.taraNaidhana, true);
    else if (n === 1) add(`tara${k}`, `${who}Janma tara`, `The Moon is in ${your} birth star: sensitive, mixed.`, W.taraJanma);
    else add(`tara${k}`, `${who}${p.tara.name} tara`, `The ${n === 3 ? '3rd' : '5th'} tara from ${your} birth star: obstructive.`, W.taraBad);
    const h = p.chandra;
    if (h === 8) add(`chandra${k}`, `${who}Chandrashtama`, `The Moon transits the 8th sign from ${your} birth Moon: avoid starting anything important.`, W.chandrashtama, true);
    else if ([1, 3, 6, 7, 10, 11].includes(h)) add(`chandra${k}`, `${who}Moon ${ord(h)} from birth Moon`, 'Good Chandra bala.', W.chandraGood);
    else if ([2, 5, 9].includes(h) && s.paksha === 'shukla') add(`chandra${k}`, `${who}Moon ${ord(h)} from birth Moon`, 'Good Chandra bala in the waxing fortnight.', W.chandraGood / 2);
    else add(`chandra${k}`, `${who}Moon ${ord(h)} from birth Moon`, 'Weak Chandra bala.', W.chandraMid);
  });

  // Lagna
  const mod = modalityOf(s.lagnaSign);
  if (def.lagna.includes(mod)) add('lagna', `${s.lagnaName} rising`, `A ${mod} sign, as preferred for ${def.label.toLowerCase()}.`, W.lagnaModality);
  else add('lagna', `${s.lagnaName} rising`, `A ${mod} sign; ${def.lagna.join(' or ')} signs are preferred.`, 0);
  natals.forEach((n, i) => {
    if (n.lagnaSign && houseFromSign(n.lagnaSign, s.lagnaSign) === 8) {
      const multi = natals.length > 1;
      add(`lagna8${multi ? `-${i}` : ''}`, `${multi ? `${n.label ?? `Person ${i + 1}`}: ` : ''}Lagna 8th from birth lagna`, `The rising sign is the 8th from ${multi ? `${n.label ?? `person ${i + 1}`}'s` : 'your'} birth ascendant.`, W.lagnaEighthFromNatal);
    }
  });
  const houseOf = (g: GrahaId) => houseFromSign(s.lagnaSign, s.planetSigns[g]);
  const benK = NATURAL_BENEFICS.filter((g) => [1, 4, 7, 10, 5, 9].includes(houseOf(g)));
  if (benK.length)
    add('benefics', `${benK.map((g) => PLANET_NAMES[g]).join(', ')} in angles or trines`, 'Benefics in the kendras and trikonas from the muhurta lagna strengthen it.', W.beneficKendra * benK.length);
  const malL = NATURAL_MALEFICS.filter((g) => houseOf(g) === 1);
  if (malL.length) add('malefic1', `${malL.map((g) => PLANET_NAMES[g]).join(', ')} rising`, 'A malefic in the muhurta lagna.', W.maleficLagna * malL.length);
  const in8 = GRAHAS.filter((g) => houseOf(g) === 8);
  if (in8.length)
    add('eighth', `${in8.map((g) => PLANET_NAMES[g]).join(', ')} in the 8th`, 'The 8th house from the muhurta lagna should be empty.', W.maleficEighth * Math.min(2, in8.length));
  for (const h of def.emptyHouses) {
    const mal = NATURAL_MALEFICS.filter((g) => houseOf(g) === h);
    if (mal.length)
      add(`empty${h}`, `${mal.map((g) => PLANET_NAMES[g]).join(', ')} in the ${ord(h)}`, `For ${def.label.toLowerCase()} the ${ord(h)} house should be free of malefics.`, W.maleficEmptyHouse * mal.length);
  }

  // Day periods
  if (s.period === 'rahu_kalam') add('period', 'Rahu kalam', 'The daily period ruled by Rahu, avoided for beginnings.', W.rahuKalam, true);
  else if (s.period === 'yamaganda') add('period', 'Yamaganda', 'The daily period ruled by Yama, avoided for beginnings.', W.yamaganda, true);
  else if (s.period === 'gulika') add('period', 'Gulika kalam', 'The daily period of Gulika (Saturn’s son).', W.gulika);
  else if (s.period === 'abhijit') add('period', 'Abhijit muhurta', 'The midday muhurta that overcomes most defects.', W.abhijit);

  return f;
}

const ord = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
