/**
 * Saturn–Jupiter double transit over time (K. N. Rao's rule, after the
 * classical gochara texts): an event of a house is triggered when transiting
 * Jupiter and transiting Saturn both influence that house, by occupation or by
 * their sign aspects (Jupiter 5/7/9, Saturn 3/7/10). Rao also allows the
 * house's lord in place of the house; that looser rule is an option.
 *
 * This is distinct from Sade Sati, which only tracks Saturn over the Moon.
 * The per-event check lives in lifeEvents.ts (`doubleTransit`); this file
 * turns it into windows for every house across a span of years.
 */
import { aspectedSigns, doubleTransit } from './lifeEvents';
import { DAY_MS, signOf } from './astro';
import type { Ephemeris, NatalChart } from './types';

export interface DoubleTransitWindow {
  house: number;
  start: Date;
  end: Date;
  /** How each planet touches the house at the start of the window */
  jupiter: string[];
  saturn: string[];
}

export interface DoubleTransitOptions {
  /** Sampling step in days. Default 5 (both planets change sign far more slowly). */
  stepDays?: number;
  /** Houses to track. Default all twelve. */
  houses?: number[];
  /**
   * 'house' (default): both planets must occupy or aspect the house itself.
   * 'house-or-lord': either the house or its lord counts, as in the event checker. Looser, so far more windows.
   */
  rule?: 'house' | 'house-or-lord';
  /** Join windows separated by a gap shorter than this many days (retrograde wobble). Default 45. */
  mergeGapDays?: number;
}

export function doubleTransitWindows(
  chart: NatalChart,
  eph: Ephemeris,
  from: Date,
  to: Date,
  opts: DoubleTransitOptions = {},
): DoubleTransitWindow[] {
  const step = (opts.stepDays ?? 5) * DAY_MS;
  const houses = opts.houses ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const sign = (p: 'Jupiter' | 'Saturn', d: Date) =>
    signOf(eph.position ? eph.position(p, d).longitude : eph.positions(d)[p].longitude);
  const open = new Map<number, DoubleTransitWindow>();
  const out: DoubleTransitWindow[] = [];
  let lastKey = '';
  let lastActive = new Map<number, ReturnType<typeof doubleTransit>>();
  for (let t = from.getTime(); t <= to.getTime() + step; t += step) {
    const d = new Date(Math.min(t, to.getTime()));
    const j = sign('Jupiter', d);
    const s = sign('Saturn', d);
    const key = `${j}|${s}`;
    if (key !== lastKey) {
      lastKey = key;
      lastActive = new Map();
      for (const h of houses) {
        const dt = doubleTransit(chart, j, s, h);
        if (!dt.active) continue;
        if (opts.rule !== 'house-or-lord') {
          const hSign = (signOf(chart.ascendant) + h - 1) % 12;
          const on = (p: 'Jupiter' | 'Saturn', x: number) => x === hSign || aspectedSigns(p, x).includes(hSign);
          if (!on('Jupiter', j) || !on('Saturn', s)) continue;
          dt.jupiter = dt.jupiter.filter((t) => !t.includes(' lord '));
          dt.saturn = dt.saturn.filter((t) => !t.includes(' lord '));
        }
        lastActive.set(h, dt);
      }
    }
    for (const h of houses) {
      const dt = lastActive.get(h);
      const w = open.get(h);
      if (dt && !w) open.set(h, { house: h, start: d, end: d, jupiter: dt.jupiter, saturn: dt.saturn });
      else if (dt && w) w.end = d;
      else if (!dt && w) { w.end = d; out.push(w); open.delete(h); }
    }
    if (d.getTime() >= to.getTime()) break;
  }
  for (const w of open.values()) { w.end = to; out.push(w); }
  out.sort((a, b) => a.house - b.house || a.start.getTime() - b.start.getTime());
  const gap = (opts.mergeGapDays ?? 45) * DAY_MS;
  const merged: DoubleTransitWindow[] = [];
  for (const w of out) {
    const last = merged[merged.length - 1];
    if (last && last.house === w.house && w.start.getTime() - last.end.getTime() <= gap) last.end = w.end;
    else merged.push(w);
  }
  return merged.sort((a, b) => a.start.getTime() - b.start.getTime() || a.house - b.house);
}
