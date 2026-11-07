/**
 * Muhurta: picking a good time to begin something.
 *
 * Searches a date range at a place and scores every stretch of time where the
 * panchanga (tithi, vara, nakshatra, yoga, karana), the rising sign and its
 * houses, and the day's inauspicious periods (Rahu kalam, Yamaganda, Gulika)
 * stay the same. With the person's natal Moon it adds Tara bala (the day's
 * star counted from the birth star) and Chandra bala (the Moon's sign counted
 * from the birth Moon sign).
 *
 * Rules follow Muhurta Chintamani and common panchanga practice. The weights
 * are this project's own and are exported so they can be tuned.
 */
import { GRAHAS, NAKSHATRAS, PLANET_NAMES, SIGN_NAMES, TITHI_NAMES, VARA_NAMES, YOGA_NAMES } from './constants';
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
}

// Nakshatra groups (Muhurta Chintamani)
const DHRUVA = [4, 12, 21, 26]; // fixed: Rohini, U.Phalguni, U.Ashadha, U.Bhadrapada
const CHARA = [7, 15, 22, 23, 24]; // movable: Punarvasu, Swati, Shravana, Dhanishta, Shatabhisha
const UGRA = [2, 10, 11, 20, 25]; // fierce: Bharani, Magha, P.Phalguni, P.Ashadha, P.Bhadrapada
const MISHRA = [3, 16]; // mixed: Krittika, Vishakha
const KSHIPRA = [1, 8, 13]; // swift: Ashwini, Pushya, Hasta
const MRIDU = [5, 14, 17, 27]; // soft: Mrigashira, Chitra, Anuradha, Revati
const TIKSHNA = [6, 9, 18, 19]; // sharp: Ardra, Ashlesha, Jyeshtha, Mula

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

const TARA_NAMES = ['Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyari', 'Sadhaka', 'Naidhana', 'Mitra', 'Parama Mitra'];
const BAD_YOGAS = [1, 6, 9, 10, 13, 15, 19]; // Vishkambha, Atiganda, Shula, Ganda, Vyaghata, Vajra, Parigha
const SEVERE_YOGAS = [17, 27]; // Vyatipata, Vaidhriti
const MOVABLE_KARANAS = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti'];
const NATURAL_BENEFICS: GrahaId[] = ['jupiter', 'venus', 'mercury'];
const NATURAL_MALEFICS: GrahaId[] = ['saturn', 'mars', 'rahu', 'ketu', 'sun'];
// Day split into 8 parts sunrise→sunset; part number (1-based) per weekday Sun..Sat
const RAHU_PART = [8, 2, 7, 5, 6, 4, 3];
const YAMA_PART = [5, 4, 3, 2, 1, 7, 6];
const GULIKA_PART = [7, 6, 5, 4, 3, 2, 1];

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
      karanaName: karanaName(karana),
      lagnaSign,
      lagnaName: SIGN_NAMES[lagnaSign - 1],
      moonSign,
      period,
      daytime,
      planetSigns,
    };
    if (q.natal) {
      const t = ((((nak - q.natal.moonNakshatra) % 27) + 27) % 27) % 9;
      s.tara = { number: t + 1, name: TARA_NAMES[t] };
      s.chandra = houseFromSign(q.natal.moonSign, moonSign);
    }
    return s;
  };

  // Key of everything that affects the score; a change starts a new window
  const keyOf = (s: MuhurtaState) =>
    [s.tithi, s.weekday, s.nakshatra, s.yoga, s.karana, s.lagnaSign, s.period, s.daytime, ...GRAHAS.map((g) => s.planetSigns[g])].join('|');

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
    const factors = scoreState(s, def, q.natal, W);
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

function scoreState(s: MuhurtaState, def: MuhurtaActivityDef, natal: MuhurtaNatal | undefined, W: typeof MUHURTA_WEIGHTS): MuhurtaFactor[] {
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

  // Karana
  if (s.karanaName === 'Vishti') add('karana', 'Vishti (Bhadra) karana', 'Bhadra is rejected for auspicious beginnings.', W.vishti, def.id !== 'surgery');
  else if (['Shakuni', 'Chatushpada', 'Naga', 'Kimstughna'].includes(s.karanaName))
    add('karana', `${s.karanaName} karana`, 'A fixed karana around the new Moon, weak for beginnings.', W.karanaFixed);

  // Tara and Chandra bala
  if (natal && s.tara) {
    const n = s.tara.number;
    if ([2, 4, 6, 8, 9].includes(n)) add('tara', `${s.tara.name} tara`, `The day's star is ${s.tara.name.toLowerCase()} (${n}) from your birth star: supportive.`, W.taraGood);
    else if (n === 7) add('tara', 'Naidhana tara', 'The 7th tara from your birth star, the most harmful one.', W.taraNaidhana, true);
    else if (n === 1) add('tara', 'Janma tara', 'The Moon is in your birth star: sensitive, mixed.', W.taraJanma);
    else add('tara', `${s.tara.name} tara`, `The ${n === 3 ? '3rd' : '5th'} tara from your birth star: obstructive.`, W.taraBad);
  }
  if (natal && s.chandra) {
    const h = s.chandra;
    if (h === 8) add('chandra', 'Chandrashtama', 'The Moon transits the 8th sign from your birth Moon: avoid starting anything important.', W.chandrashtama, true);
    else if ([1, 3, 6, 7, 10, 11].includes(h)) add('chandra', `Moon ${ord(h)} from birth Moon`, 'Good Chandra bala.', W.chandraGood);
    else if ([2, 5, 9].includes(h) && s.paksha === 'shukla') add('chandra', `Moon ${ord(h)} from birth Moon`, 'Good Chandra bala in the waxing fortnight.', W.chandraGood / 2);
    else add('chandra', `Moon ${ord(h)} from birth Moon`, 'Weak Chandra bala.', W.chandraMid);
  }

  // Lagna
  const mod = modalityOf(s.lagnaSign);
  if (def.lagna.includes(mod)) add('lagna', `${s.lagnaName} rising`, `A ${mod} sign, as preferred for ${def.label.toLowerCase()}.`, W.lagnaModality);
  else add('lagna', `${s.lagnaName} rising`, `A ${mod} sign; ${def.lagna.join(' or ')} signs are preferred.`, 0);
  if (natal?.lagnaSign && houseFromSign(natal.lagnaSign, s.lagnaSign) === 8)
    add('lagna8', 'Lagna 8th from birth lagna', 'The rising sign is the 8th from your birth ascendant.', W.lagnaEighthFromNatal);
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
