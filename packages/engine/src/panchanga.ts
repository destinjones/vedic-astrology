/**
 * Panchanga for any instant and place: tithi, vara, nakshatra, yoga and karana,
 * with the moment each of the four moving limbs began and ends.
 *
 * Tithi = Moon − Sun in 12° steps, karana = 6° half-tithis, nakshatra = Moon in
 * 13°20′ steps, yoga = Sun + Moon in 13°20′ steps (Surya Siddhanta ch. 2;
 * Muhurta Chintamani ch. 1). The vara is the weekday of the sunrise that
 * opened the Vedic day, so a birth before sunrise belongs to the previous vara.
 */
import { MOVABLE_KARANAS, NAKSHATRAS, TITHI_NAMES, VARA_LORDS, VARA_NAMES, YOGA_NAMES } from './constants';
import type { Engine } from './engine';
import { jdToIso } from './time';
import type { AyanamsaId, Panchanga } from './types';
import { norm360 } from './zodiac';

export interface PanchangaSpan {
  /** ISO UTC the limb began */
  start: string;
  /** ISO UTC the limb ends */
  end: string;
}

export interface PanchangaAt extends Panchanga {
  /** Instant this panchanga is for, ISO UTC */
  utc: string;
  jdUt: number;
  /** When each moving limb began and ends */
  spans: { tithi: PanchangaSpan; nakshatra: PanchangaSpan; yoga: PanchangaSpan; karana: PanchangaSpan };
  /** The next tithi, nakshatra, yoga and karana names, for "until …, then …" */
  next: { tithiName: string; nakshatraName: string; yogaName: string; karanaName: string };
}

export interface PanchangaPlace {
  latitude: number;
  longitude: number;
  ayanamsa?: AyanamsaId;
}

const NAK = 360 / 27;

export function tithiName(t: number): string {
  return t === 15 ? 'Purnima' : t === 30 ? 'Amavasya' : TITHI_NAMES[(t - 1) % 15];
}

/** Karana 1–60 by half-tithi index */
export function karanaName(k: number): string {
  if (k === 1) return 'Kimstughna';
  if (k >= 58) return ['Shakuni', 'Chatushpada', 'Naga'][k - 58];
  return MOVABLE_KARANAS[(k - 2) % 7];
}

/**
 * The instant near jd at which f(jd) (a longitude-like angle) crosses `target`.
 * Newton steps on the unwrapped difference; f's rate comes from `rate`.
 */
function crossing(f: (jd: number) => { value: number; rate: number }, target: number, jd: number): number {
  let t = jd;
  for (let i = 0; i < 30; i++) {
    const { value, rate } = f(t);
    let diff = norm360(target - value);
    if (diff > 180) diff -= 360;
    if (Math.abs(diff) < 1e-7) break;
    t += diff / (rate || 1);
  }
  return t;
}

export function panchangaAt(engine: Engine, when: Date | string | number, place: PanchangaPlace): PanchangaAt {
  const jd = typeof when === 'number' ? when : (new Date(when).getTime() / 86400000 + 2440587.5);
  const a = { ayanamsa: place.ayanamsa ?? 'lahiri' } as const;
  const sm = (t: number) => {
    const s = engine.longitudeAt('sun', t, a);
    const m = engine.longitudeAt('moon', t, a);
    return { s, m };
  };
  const elong = (t: number) => { const { s, m } = sm(t); return { value: norm360(m.longitude - s.longitude), rate: m.speed - s.speed }; };
  const moon = (t: number) => { const m = engine.longitudeAt('moon', t, a); return { value: m.longitude, rate: m.speed }; };
  // The yoga uses the sidereal sum, as tradition does.
  const sum = (t: number) => { const { s, m } = sm(t); return { value: norm360(m.longitude + s.longitude), rate: m.speed + s.speed }; };

  const e = elong(jd).value;
  const mo = moon(jd).value;
  const su = sum(jd).value;
  const tithi = Math.floor(e / 12) + 1;
  const karana = Math.floor(e / 6) + 1;
  const nak = Math.min(27, Math.floor(mo / NAK) + 1);
  const yoga = Math.min(27, Math.floor(su / NAK) + 1);

  // A tithi lasts about a day: start the search from the linear guess.
  const span = (f: typeof elong, step: number, idx: number): PanchangaSpan => {
    const rate = f(jd).rate;
    const v = f(jd).value;
    const lo = (idx - 1) * step;
    const hi = idx * step;
    const s = crossing(f, lo, jd - norm360(v - lo) / rate);
    const en = crossing(f, hi % 360, jd + norm360(hi - v) / rate);
    return { start: jdToIso(s), end: jdToIso(en) };
  };

  // Vedic day: the sunrise at or before jd.
  let sunrise: number | null = null;
  let sunset: number | null = null;
  try {
    const prev = engine.sunriseSunset(jd - 1, place.latitude, place.longitude).sunrise;
    if (prev !== null) {
      sunrise = prev;
      const today = engine.sunriseSunset(prev + 0.01, place.latitude, place.longitude).sunrise;
      if (today !== null && today <= jd) sunrise = today;
      if (sunrise > jd) sunrise = null;
    }
    if (sunrise !== null) sunset = engine.sunriseSunset(sunrise + 0.001, place.latitude, place.longitude).sunset;
  } catch {
    /* polar day or night */
  }
  // Weekday of that sunrise in local mean time (sunrise is far from midnight, so the zone does not matter)
  const ref = sunrise ?? jd - 0.25;
  const vara = Math.floor(ref + 0.5 + place.longitude / 360 + 1) % 7; // JD 0.5 shift: JDN mod 7 = 0 is Monday, so +1 makes 0 Sunday

  return {
    utc: jdToIso(jd),
    jdUt: jd,
    tithi,
    tithiName: tithiName(tithi),
    paksha: tithi <= 15 ? 'shukla' : 'krishna',
    vara,
    varaName: VARA_NAMES[vara],
    varaLord: VARA_LORDS[vara],
    nakshatra: nak,
    nakshatraName: NAKSHATRAS[nak - 1].name,
    yoga,
    yogaName: YOGA_NAMES[yoga - 1],
    karana,
    karanaName: karanaName(karana),
    sunrise: sunrise !== null ? jdToIso(sunrise) : undefined,
    sunset: sunset !== null ? jdToIso(sunset) : undefined,
    spans: {
      tithi: span(elong, 12, tithi),
      karana: span(elong, 6, karana),
      nakshatra: span(moon, NAK, nak),
      yoga: span(sum, NAK, yoga),
    },
    next: {
      tithiName: tithiName((tithi % 30) + 1),
      karanaName: karanaName((karana % 60) + 1),
      nakshatraName: NAKSHATRAS[nak % 27].name,
      yogaName: YOGA_NAMES[yoga % 27],
    },
  };
}
