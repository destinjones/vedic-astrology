/**
 * Sankranti ingress charts: the moment the Sun enters each sidereal sign. Mesha
 * Sankranti (the Sun into Aries) is the classical chart of the year for a
 * country or city; the other eleven give the months. Found with the Swiss
 * Ephemeris to well under a second, for the chosen ayanamsa.
 */
import { type AyanamsaId, type Engine, jdToDate, norm360 } from '@vedic/engine';

export const SANKRANTI_NAMES = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
] as const;

export interface Sankranti {
  /** Sign the Sun enters, 1 = Aries */
  sign: number;
  name: `${(typeof SANKRANTI_NAMES)[number]} Sankranti`;
  jdUt: number;
  /** ISO UTC */
  utc: string;
}

/** JD (UT) of the first moment at or after jdStart when the Sun's sidereal longitude reaches `target`. */
export function sunReaches(engine: Engine, target: number, jdStart: number, ayanamsa: AyanamsaId = 'lahiri'): number {
  const at = (jd: number) => engine.longitudeAt('sun', jd, { ayanamsa });
  // first guess from the mean motion, then Newton steps with the true speed
  let jd = jdStart + norm360(target - at(jdStart).longitude) / 0.9856;
  for (let i = 0; i < 12; i++) {
    const p = at(jd);
    const gap = ((target - p.longitude + 540) % 360) - 180;
    jd += gap / p.speed;
    if (Math.abs(gap) < 1e-8) break;
  }
  return jd;
}

/** The twelve Sankrantis from Mesha Sankranti of `year` (usually around 14 April) onward. */
export function sankrantis(engine: Engine, year: number, ayanamsa: AyanamsaId = 'lahiri'): Sankranti[] {
  const out: Sankranti[] = [];
  // start a month before mid-April and walk forward sign by sign
  let jd = Date.UTC(year, 2, 10) / 86400000 + 2440587.5;
  for (let s = 0; s < 12; s++) {
    jd = sunReaches(engine, s * 30, jd, ayanamsa);
    out.push({ sign: s + 1, name: `${SANKRANTI_NAMES[s]} Sankranti`, jdUt: jd, utc: jdToDate(jd).toISOString() });
    jd += 25;
  }
  return out;
}

/** Local wall-clock date and time ("YYYY-MM-DD", "HH:mm:ss") of an instant in an IANA zone, for casting the chart. */
export function localDateTime(utc: string, timeZone: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(utc)).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}` };
}
