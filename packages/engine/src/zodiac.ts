import {
  EXALTATION,
  MOOLATRIKONA,
  NAKSHATRAS,
  NAKSHATRA_SPAN,
  OWN_SIGNS,
  PADA_SPAN,
  SIGN_LORDS,
  SIGN_SLUGS,
  naturalRelationship,
} from './constants';
import type { Dignity, GrahaId, Pada, SignNumber, ZodiacPosition } from './types';

export const norm360 = (x: number) => ((x % 360) + 360) % 360;

/** Smallest angular separation, 0–180 */
export const angularDistance = (a: number, b: number) => {
  const d = Math.abs(norm360(a) - norm360(b));
  return d > 180 ? 360 - d : d;
};

export const signOf = (lon: number): SignNumber =>
  (Math.floor(norm360(lon) / 30) + 1) as SignNumber;

/** Adds n signs (n may be negative), wrapping 1–12 */
export const addSigns = (sign: number, n: number): SignNumber =>
  ((((sign - 1 + n) % 12) + 12) % 12 + 1) as SignNumber;

/** House of `sign` counted from `fromSign` (whole sign, 1–12) */
export const houseFrom = (fromSign: number, sign: number): SignNumber => addSigns(sign, -(fromSign - 1));

export const signLord = (sign: SignNumber): GrahaId => SIGN_LORDS[sign - 1];

export function formatDms(deg: number): string {
  let totalSec = Math.round(deg * 3600);
  const d = Math.floor(totalSec / 3600);
  totalSec -= d * 3600;
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
}

export function nakshatraOf(lon: number) {
  const l = norm360(lon);
  const idx = Math.min(26, Math.floor(l / NAKSHATRA_SPAN));
  const within = l - idx * NAKSHATRA_SPAN;
  const pada = (Math.min(3, Math.floor(within / PADA_SPAN)) + 1) as Pada;
  return { info: NAKSHATRAS[idx], pada, fraction: within / NAKSHATRA_SPAN };
}

export function zodiacPosition(lon: number): ZodiacPosition {
  const l = norm360(lon);
  const sign = signOf(l);
  const degreeInSign = l - (sign - 1) * 30;
  const nk = nakshatraOf(l);
  return {
    longitude: l,
    sign,
    signSlug: SIGN_SLUGS[sign - 1],
    degreeInSign,
    dms: formatDms(degreeInSign),
    nakshatra: nk.info.number,
    nakshatraSlug: nk.info.slug,
    nakshatraName: nk.info.name,
    pada: nk.pada,
    nakshatraLord: nk.info.lord,
  };
}

/**
 * Dignity of a graha by sign placement, using exaltation / moolatrikona / own
 * and natural relationship with the sign lord. Rahu/Ketu use the common BPHS
 * convention (exalted Taurus/Scorpio, own Aquarius/Scorpio).
 */
export function dignityOf(planet: GrahaId, lon: number): Dignity {
  const sign = signOf(lon);
  const deg = norm360(lon) - (sign - 1) * 30;
  const ex = EXALTATION[planet];
  if (ex) {
    if (ex.sign === sign) return 'exalted';
    if (addSigns(ex.sign, 6) === sign) return 'debilitated';
  }
  const mt = MOOLATRIKONA[planet];
  if (mt && mt[0] === sign && deg >= mt[1] && deg < mt[2]) return 'moolatrikona';
  if (OWN_SIGNS[planet].includes(sign)) return 'own';
  const lord = signLord(sign);
  const rel = naturalRelationship(planet, lord);
  return rel === 'friend' ? 'friend' : rel === 'enemy' ? 'enemy' : 'neutral';
}
