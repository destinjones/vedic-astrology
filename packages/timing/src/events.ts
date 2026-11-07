/** Root-finding over an ephemeris: sign ingresses and retrograde stations. */
import { type Ephemeris, type Planet, type PlanetPosition } from './types';
import { DAY_MS, norm360, signOf } from './astro';

const pos = (eph: Ephemeris, p: Planet, d: Date): PlanetPosition =>
  eph.position ? eph.position(p, d) : eph.positions(d)[p];

/** Typical sampling step (days) that cannot skip a sign or a station. */
export const STEP_DAYS: Record<Planet, number> = {
  Moon: 0.25, Sun: 2, Mercury: 1, Venus: 1, Mars: 2, Jupiter: 4, Saturn: 5, Rahu: 10, Ketu: 10,
};

function bisect(lo: number, hi: number, f: (t: number) => boolean, tolMs = 60_000): number {
  // f(lo) false, f(hi) true
  while (hi - lo > tolMs) {
    const mid = (lo + hi) / 2;
    if (f(mid)) hi = mid; else lo = mid;
  }
  return hi;
}

export interface Ingress {
  planet: Planet;
  date: Date;
  fromSign: number;
  toSign: number;
  retrograde: boolean;
}

export function findIngresses(eph: Ephemeris, planet: Planet, from: Date, to: Date): Ingress[] {
  const step = STEP_DAYS[planet] * DAY_MS;
  const out: Ingress[] = [];
  let t0 = from.getTime();
  let s0 = signOf(pos(eph, planet, from).longitude);
  for (let t = t0 + step; t <= to.getTime() + step; t += step) {
    const tt = Math.min(t, to.getTime());
    const s1 = signOf(pos(eph, planet, new Date(tt)).longitude);
    if (s1 !== s0) {
      const at = bisect(t0, tt, (x) => signOf(pos(eph, planet, new Date(x)).longitude) !== s0);
      const p = pos(eph, planet, new Date(at));
      out.push({ planet, date: new Date(at), fromSign: s0, toSign: signOf(p.longitude), retrograde: p.speed < 0 });
      s0 = signOf(p.longitude);
      t0 = at;
      continue;
    }
    t0 = tt;
    if (tt === to.getTime()) break;
  }
  return out;
}

export interface Station {
  planet: Planet;
  date: Date;
  type: 'retrograde' | 'direct';
  longitude: number;
}

export function findStations(eph: Ephemeris, planet: Planet, from: Date, to: Date): Station[] {
  if (planet === 'Sun' || planet === 'Moon' || planet === 'Rahu' || planet === 'Ketu') return [];
  const step = STEP_DAYS[planet] * DAY_MS;
  const out: Station[] = [];
  let t0 = from.getTime();
  let v0 = pos(eph, planet, from).speed;
  for (let t = t0 + step; t <= to.getTime(); t += step) {
    const v1 = pos(eph, planet, new Date(t)).speed;
    if (Math.sign(v1) !== Math.sign(v0) && v0 !== 0) {
      const goingRetro = v0 > 0;
      const at = bisect(t0, t, (x) => (goingRetro ? pos(eph, planet, new Date(x)).speed < 0 : pos(eph, planet, new Date(x)).speed > 0));
      out.push({ planet, date: new Date(at), type: goingRetro ? 'retrograde' : 'direct', longitude: pos(eph, planet, new Date(at)).longitude });
    }
    t0 = t;
    v0 = v1;
  }
  return out;
}

/** Find when `planet` (moving direct) reaches longitude `target`, searching between from..to. */
export function findLongitudeCrossing(eph: Ephemeris, planet: Planet, target: number, from: Date, to: Date, direction: 1 | -1 = 1): Date | null {
  const step = STEP_DAYS[planet] * DAY_MS;
  const delta = (t: number) => ((norm360(pos(eph, planet, new Date(t)).longitude - target) + 540) % 360) - 180;
  let t0 = from.getTime();
  let d0 = delta(t0);
  const scan = (stepSigned: number, end: number) => {
    for (let t = t0 + stepSigned; stepSigned > 0 ? t <= end : t >= end; t += stepSigned) {
      const d1 = delta(t);
      if (Math.abs(d1 - d0) < 90 && Math.sign(d1) !== Math.sign(d0)) {
        const lo = Math.min(t0, t), hi = Math.max(t0, t);
        const signLo = Math.sign(delta(lo));
        return new Date(bisect(lo, hi, (x) => Math.sign(delta(x)) !== signLo));
      }
      t0 = t; d0 = d1;
    }
    return null;
  };
  return direction === 1 ? scan(step, to.getTime()) : (t0 = to.getTime(), d0 = delta(t0), scan(-step, from.getTime()));
}
