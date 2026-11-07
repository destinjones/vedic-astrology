/**
 * Retrograde periods (with shadow phases) and how each one touches the natal chart.
 */
import { type Ephemeris, type NatalChart, type Planet, PLANETS, type Reason, type Scored } from './types';
import { addDays, houseFrom, norm360, ordinal, scored, signName, signOf } from './astro';
import { findLongitudeCrossing, findStations } from './events';
import { HOUSE_TOPICS } from './dasha';

export const RETRO_PLANETS: Planet[] = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

export const RETRO_MEANING: Record<string, string> = {
  Mercury: 'review contracts, communication, travel plans and devices; revisit rather than launch',
  Venus: 'old relationships and values resurface; reconsider spending, art and agreements',
  Mars: 'energy turns inward; frustration and delays in action, good for strategy and repairs',
  Jupiter: 'inner growth over outer expansion; revisit beliefs, teachers, studies and investments',
  Saturn: 'karmic review of duties and structures; finish unfinished work, consolidate',
};

export interface NatalContact {
  planet: Planet | 'Ascendant';
  /** Closest separation in degrees reached during the retrograde loop. */
  orb: number;
  kind: 'conjunction' | 'opposition';
}

export interface RetrogradePeriod extends Scored {
  planet: Planet;
  preShadowStart: Date | null;
  stationRetrograde: Date;
  stationDirect: Date | null;
  postShadowEnd: Date | null;
  /** Longitudes at the two stations (the retrograde zone). */
  zone: [number, number];
  signs: number[];
  /** Natal houses (whole sign from ascendant) the retrograde zone covers. */
  natalHouses: number[];
  contacts: NatalContact[];
  natalRetrograde: boolean;
  summary: string;
}

const ORB = 3;

export function findRetrogrades(eph: Ephemeris, chart: NatalChart, from: Date, to: Date, planets = RETRO_PLANETS): RetrogradePeriod[] {
  const out: RetrogradePeriod[] = [];
  const asc = signOf(chart.ascendant);
  for (const p of planets) {
    // Search a little wider so a period straddling `from` is complete
    const stations = findStations(eph, p, addDays(from, -160), addDays(to, 160));
    for (let i = 0; i < stations.length; i++) {
      const sr = stations[i];
      if (sr.type !== 'retrograde') continue;
      const sd = stations[i + 1]?.type === 'direct' ? stations[i + 1] : null;
      const endish = sd?.date ?? to;
      if (endish < from || sr.date > to) continue;
      const preShadowStart = sd ? findLongitudeCrossing(eph, p, sd.longitude, addDays(sr.date, -200), sr.date, -1) : null;
      const postShadowEnd = sd ? findLongitudeCrossing(eph, p, sr.longitude, sd.date, addDays(sd.date, 250), 1) : null;
      const hi = sr.longitude, lo = sd?.longitude ?? hi;
      const span = norm360(hi - lo);
      const signs = new Set<number>();
      for (let x = 0; x <= span; x += 1) signs.add(signOf(lo + x));
      signs.add(signOf(hi));
      const natalHouses = [...signs].map((s) => houseFrom(asc, s));

      const contacts: NatalContact[] = [];
      const targets: [Planet | 'Ascendant', number][] = [...PLANETS.map((q) => [q, chart.planets[q].longitude] as [Planet, number]), ['Ascendant', chart.ascendant]];
      for (const [name, lon] of targets) {
        if (name === p) continue;
        for (const [kind, off] of [['conjunction', 0], ['opposition', 180]] as const) {
          const t = norm360(lon + off);
          const into = norm360(t - lo);
          const orb = into <= span ? 0 : Math.min(norm360(lo - t), norm360(t - hi));
          if (orb <= ORB) contacts.push({ planet: name, orb: Math.round(orb * 10) / 10, kind });
        }
      }
      const natalRetrograde = chart.planets[p].speed < 0;

      const reasons: Reason[] = [{ weight: -12, text: `${p} retrograde: ${RETRO_MEANING[p]}` }];
      for (const h of natalHouses) reasons.push({ weight: [6, 8, 12].includes(h) ? -6 : [1, 4, 7, 10].includes(h) ? -4 : 0, text: `falls in your ${ordinal(h)} house (${HOUSE_TOPICS[h]})` });
      for (const c of contacts) {
        const sensitive = c.planet === 'Moon' || c.planet === 'Sun' || c.planet === 'Ascendant';
        reasons.push({ weight: (c.kind === 'conjunction' ? -8 : -5) * (sensitive ? 1.5 : 1), text: `stations ${c.kind === 'conjunction' ? 'over' : 'opposite'} your natal ${c.planet} (orb ${c.orb}°)` });
      }
      if (natalRetrograde) reasons.push({ weight: 8, text: `${p} was retrograde at your birth, so its retrograde phases tend to feel natural, even productive` });
      const s = scored(reasons, 45);
      const zoneTxt = `${signName(signOf(lo))} ${Math.floor(lo % 30)}° to ${signName(signOf(hi))} ${Math.floor(hi % 30)}°`;
      out.push({
        ...s, planet: p, preShadowStart, stationRetrograde: sr.date, stationDirect: sd?.date ?? null, postShadowEnd,
        zone: [lo, hi], signs: [...signs], natalHouses, contacts, natalRetrograde,
        summary: `${p} retrograde ${zoneTxt}, through your ${natalHouses.map(ordinal).join(' and ')} house${natalHouses.length > 1 ? 's' : ''}${contacts.length ? `${contacts.map((c) => `${c.kind === 'conjunction' ? 'over' : 'opposite'} natal ${c.planet}`).join(', ').replace(/^/, ', stationing ')}` : ''}.`,
      });
    }
  }
  return out.sort((a, b) => a.stationRetrograde.getTime() - b.stationRetrograde.getTime());
}

/** Is `planet` retrograde (or in shadow) on a given date? */
export function retroStatusAt(periods: RetrogradePeriod[], planet: Planet, at: Date): 'pre-shadow' | 'retrograde' | 'post-shadow' | null {
  for (const r of periods) {
    if (r.planet !== planet) continue;
    if (r.stationRetrograde <= at && (!r.stationDirect || at < r.stationDirect)) return 'retrograde';
    if (r.preShadowStart && r.preShadowStart <= at && at < r.stationRetrograde) return 'pre-shadow';
    if (r.stationDirect && r.postShadowEnd && r.stationDirect <= at && at < r.postShadowEnd) return 'post-shadow';
  }
  return null;
}
