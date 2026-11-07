/**
 * The daily-timing layer of a panchanga: sunrise and sunset, the three
 * inauspicious day periods (Rahu kalam, Yamaganda, Gulika kalam), Abhijit
 * muhurta, the 24 planetary horas, the five limbs at sunrise with the times
 * they change, and per-person flags (Tara at sunrise, Chandrashtama spans).
 *
 * A Vedic day runs sunrise to sunrise and is named by its civil date. The
 * day periods split sunrise→sunset into eight equal parts; horas split day
 * and night into twelve each, starting from the weekday lord in the Chaldean
 * order. Where the Sun does not rise or set the periods are left out.
 */
import { NAKSHATRAS, SIGN_NAMES, VARA_LORDS, VARA_NAMES, YOGA_NAMES, TITHI_NAMES, MOVABLE_KARANAS } from './constants';
import type { Engine } from './engine';
import { localWeekday } from './kp';
import { GULIKA_PART, RAHU_PART, TARA_NAMES, YAMA_PART, bhadraLoka } from './muhurta';
import { jdToIso, localToUtc, dateToJd, timezoneAt } from './time';
import type { AyanamsaId, GrahaId } from './types';
import { norm360 } from './zodiac';

export interface TimeSpan {
  start: string;
  end: string;
  startJd: number;
  endJd: number;
}

export interface Hora extends TimeSpan {
  lord: GrahaId;
  /** Day hora (sunrise→sunset) or night hora */
  day: boolean;
}

export type PanchangaLimb = 'tithi' | 'nakshatra' | 'yoga' | 'karana' | 'rashi';

export interface LimbChange {
  limb: PanchangaLimb;
  /** When the new value begins */
  at: string;
  atJd: number;
  /** New value: tithi 1–30, nakshatra 1–27, yoga 1–27, karana 1–60, Moon sign 1–12 */
  value: number;
  name: string;
}

export interface Limbs {
  tithi: number;
  tithiName: string;
  paksha: 'shukla' | 'krishna';
  nakshatra: number;
  nakshatraName: string;
  yoga: number;
  yogaName: string;
  karana: number;
  karanaName: string;
  moonSign: number;
  moonSignName: string;
}

export interface PanchangaDayNatal {
  label?: string;
  moonNakshatra: number;
  moonSign: number;
}

export interface PanchangaDayPersonal {
  label?: string;
  /** Tara of the day's sunrise nakshatra from the birth star, 1–9 */
  tara: { number: number; name: string };
  /** Spans of the day when the Moon is in the 8th sign from the birth Moon */
  chandrashtama: TimeSpan[];
}

export interface PanchangaDay {
  /** Civil date YYYY-MM-DD at the place */
  date: string;
  weekday: number;
  weekdayName: string;
  dayLord: GrahaId;
  /** False where the Sun does not rise and set that day; the periods are then empty */
  hasSunrise: boolean;
  sunrise?: string;
  sunset?: string;
  nextSunrise?: string;
  rahuKalam?: TimeSpan;
  yamaganda?: TimeSpan;
  gulikaKalam?: TimeSpan;
  /** Abhijit, the 8th of 15 day muhurtas; left out on Wednesdays as the texts do */
  abhijit?: TimeSpan;
  horas: Hora[];
  /** The five limbs (and the Moon's sign) in force at sunrise */
  atSunrise: Limbs;
  /** Every change from this sunrise to the next */
  changes: LimbChange[];
  /** Spans of Vishti (Bhadra) karana in the day, with where she dwells */
  bhadra: (TimeSpan & { loka: 'earth' | 'heaven' | 'netherworld' })[];
  /** Spans with the Moon in Aquarius or Pisces (Dhanishta panchaka) */
  panchaka: TimeSpan[];
  personal: PanchangaDayPersonal[];
}

export interface PanchangaDayOptions {
  latitude: number;
  longitude: number;
  timezone?: string;
  ayanamsa?: AyanamsaId;
  natals?: PanchangaDayNatal[];
}

/** Chaldean order, slowest to fastest: each hora passes to the next planet in this list */
export const HORA_ORDER: GrahaId[] = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon'];

const span = (a: number, b: number): TimeSpan => ({ start: jdToIso(a), end: jdToIso(b), startJd: a, endJd: b });
const tithiName = (t: number) => (t === 15 ? 'Purnima' : t === 30 ? 'Amavasya' : TITHI_NAMES[(t - 1) % 15]);
function karanaName(k: number) {
  if (k === 1) return 'Kimstughna';
  if (k >= 58) return ['Shakuni', 'Chatushpada', 'Naga'][k - 58];
  return MOVABLE_KARANAS[(k - 2) % 7];
}

function limbsAt(engine: Engine, jd: number, ayanamsa: AyanamsaId): Limbs {
  const snap = engine.positionsAt(jd, { ayanamsa });
  const sun = snap.planets.sun.longitude;
  const moon = snap.planets.moon.longitude;
  const elong = norm360(moon - sun);
  const tithi = Math.min(30, Math.floor(elong / 12) + 1);
  const nakshatra = Math.min(27, Math.floor(moon / (360 / 27)) + 1);
  const yoga = Math.min(27, Math.floor(norm360(sun + moon) / (360 / 27)) + 1);
  const karana = Math.min(60, Math.floor(elong / 6) + 1);
  const moonSign = Math.min(12, Math.floor(norm360(moon) / 30) + 1);
  return {
    tithi,
    tithiName: tithiName(tithi),
    paksha: tithi <= 15 ? 'shukla' : 'krishna',
    nakshatra,
    nakshatraName: NAKSHATRAS[nakshatra - 1].name,
    yoga,
    yogaName: YOGA_NAMES[yoga - 1],
    karana,
    karanaName: karanaName(karana),
    moonSign,
    moonSignName: SIGN_NAMES[moonSign - 1],
  };
}

const LIMB_KEYS: PanchangaLimb[] = ['tithi', 'nakshatra', 'yoga', 'karana', 'rashi'];
const limbValue = (l: Limbs, k: PanchangaLimb) => (k === 'rashi' ? l.moonSign : l[k]);
const limbName = (l: Limbs, k: PanchangaLimb) =>
  k === 'tithi' ? `${l.paksha === 'shukla' ? 'Shukla' : 'Krishna'} ${l.tithiName}` : k === 'nakshatra' ? l.nakshatraName : k === 'yoga' ? l.yogaName : k === 'karana' ? l.karanaName : l.moonSignName;

/** Every limb change in [a, b): sampled every 40 minutes (karanas last at least ~5 hours) and bisected to the minute */
function changesBetween(engine: Engine, a: number, b: number, ayanamsa: AyanamsaId): LimbChange[] {
  const out: LimbChange[] = [];
  const step = 40 / 1440;
  let t = a;
  let prev = limbsAt(engine, a, ayanamsa);
  while (t < b) {
    const n = Math.min(b, t + step);
    const next = limbsAt(engine, n, ayanamsa);
    for (const k of LIMB_KEYS) {
      if (limbValue(next, k) === limbValue(prev, k)) continue;
      let lo = t;
      let hi = n;
      const v0 = limbValue(prev, k);
      while (hi - lo > 0.5 / 1440) {
        const mid = (lo + hi) / 2;
        if (limbValue(limbsAt(engine, mid, ayanamsa), k) === v0) lo = mid;
        else hi = mid;
      }
      const at = limbsAt(engine, hi, ayanamsa);
      out.push({ limb: k, at: jdToIso(hi), atJd: hi, value: limbValue(at, k), name: limbName(at, k) });
    }
    prev = next;
    t = n;
  }
  return out.sort((x, y) => x.atJd - y.atJd);
}

/** Spans of [a, b) where `test` holds for the value of one limb, using the change list */
function spansWhere(start: Limbs, changes: LimbChange[], a: number, b: number, limb: PanchangaLimb, test: (v: number) => boolean): TimeSpan[] {
  const out: TimeSpan[] = [];
  let v = limbValue(start, limb);
  let from = a;
  for (const c of changes.filter((x) => x.limb === limb)) {
    if (test(v)) out.push(span(from, c.atJd));
    v = c.value;
    from = c.atJd;
  }
  if (test(v)) out.push(span(from, b));
  return out;
}

const partOf = (sr: number, ss: number, part: number) => {
  const len = (ss - sr) / 8;
  return span(sr + (part - 1) * len, sr + part * len);
};

/** One Vedic day of the panchanga at a place */
export function panchangaDay(engine: Engine, date: string, o: PanchangaDayOptions): PanchangaDay {
  const tz = o.timezone ?? timezoneAt(o.latitude, o.longitude);
  const ayanamsa = o.ayanamsa ?? 'lahiri';
  const midnight = dateToJd(localToUtc(date, '00:00', tz).utc);
  let sunrise: number | null = null;
  let sunset: number | null = null;
  let nextSunrise: number | null = null;
  try {
    sunrise = engine.sunriseSunset(midnight, o.latitude, o.longitude).sunrise;
    if (sunrise !== null && sunrise - midnight > 1) sunrise = null; // no sunrise on this civil date
    if (sunrise !== null) {
      const after = engine.sunriseSunset(sunrise + 0.001, o.latitude, o.longitude);
      sunset = after.sunset;
      nextSunrise = after.sunrise;
      if (sunset === null || nextSunrise === null || sunset > nextSunrise) sunrise = null;
    }
  } catch {
    sunrise = null;
  }
  const has = sunrise !== null && sunset !== null && nextSunrise !== null;
  // Without a sunrise, the day runs 06:00 to 06:00 local civil time
  const a = has ? sunrise! : midnight + 0.25;
  const b = has ? nextSunrise! : midnight + 1.25;
  const weekday = localWeekday(a, tz);
  const dayLord = VARA_LORDS[weekday];

  const atSunrise = limbsAt(engine, a, ayanamsa);
  const changes = changesBetween(engine, a, b, ayanamsa);

  const day: PanchangaDay = {
    date,
    weekday,
    weekdayName: VARA_NAMES[weekday],
    dayLord,
    hasSunrise: has,
    horas: [],
    atSunrise,
    changes,
    bhadra: [],
    panchaka: spansWhere(atSunrise, changes, a, b, 'rashi', (s) => s === 11 || s === 12),
    personal: [],
  };

  // Bhadra spans, with her dwelling by the Moon's sign at the start of each span
  const vishti = spansWhere(atSunrise, changes, a, b, 'karana', (k) => karanaName(k) === 'Vishti');
  day.bhadra = vishti.map((v) => ({ ...v, loka: bhadraLoka(limbsAt(engine, (v.startJd + v.endJd) / 2, ayanamsa).moonSign) }));

  if (has) {
    const sr = sunrise!, ss = sunset!, nx = nextSunrise!;
    day.sunrise = jdToIso(sr);
    day.sunset = jdToIso(ss);
    day.nextSunrise = jdToIso(nx);
    day.rahuKalam = partOf(sr, ss, RAHU_PART[weekday]);
    day.yamaganda = partOf(sr, ss, YAMA_PART[weekday]);
    day.gulikaKalam = partOf(sr, ss, GULIKA_PART[weekday]);
    if (weekday !== 3) {
      const m = (ss - sr) / 15;
      day.abhijit = span(sr + 7 * m, sr + 8 * m);
    }
    let lordIdx = HORA_ORDER.indexOf(dayLord);
    for (let i = 0; i < 24; i++) {
      const isDay = i < 12;
      const len = isDay ? (ss - sr) / 12 : (nx - ss) / 12;
      const s0 = isDay ? sr + i * len : ss + (i - 12) * len;
      day.horas.push({ ...span(s0, s0 + len), lord: HORA_ORDER[lordIdx % 7], day: isDay });
      lordIdx++;
    }
  }

  for (const n of o.natals ?? []) {
    const t = ((((atSunrise.nakshatra - n.moonNakshatra) % 27) + 27) % 27) % 9;
    const eighth = ((n.moonSign + 6) % 12) + 1;
    day.personal.push({
      label: n.label,
      tara: { number: t + 1, name: TARA_NAMES[t] },
      chandrashtama: spansWhere(atSunrise, changes, a, b, 'rashi', (s) => s === eighth),
    });
  }
  return day;
}

/** Every day of a civil month (month 1–12) */
export function panchangaMonth(engine: Engine, year: number, month: number, o: PanchangaDayOptions): PanchangaDay[] {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out: PanchangaDay[] = [];
  for (let d = 1; d <= days; d++) {
    out.push(panchangaDay(engine, `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`, o));
  }
  return out;
}

/** The hora running at an instant, from a day computed with panchangaDay */
export const horaAt = (day: PanchangaDay, when: Date | string | number): Hora | undefined => {
  const jd = typeof when === 'number' ? when : dateToJd(typeof when === 'string' ? new Date(when) : when);
  return day.horas.find((h) => jd >= h.startJd && jd < h.endJd);
};
