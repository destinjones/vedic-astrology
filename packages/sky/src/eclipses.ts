/**
 * Solar and lunar eclipses: when, what kind, where the Moon's shadow falls,
 * whether the chart's own place sees it, and which points of a chart the
 * eclipse degree lands on. Times and kinds come from astronomy-engine; the
 * sidereal degree comes from the Swiss Ephemeris engine, so it matches the chart.
 */
import * as A from 'astronomy-engine';
import { angularDistance, type AyanamsaId, type Chart, type Engine, norm360, signOf } from '@vedic/engine';

export type EclipseKind = 'solar' | 'lunar';
export type EclipseType = 'total' | 'annular' | 'partial' | 'penumbral';

export interface Eclipse {
  kind: EclipseKind;
  type: EclipseType;
  /** ISO UTC of greatest eclipse */
  peak: string;
  jdUt: number;
  /** Fraction of the Sun's disc covered (solar) or of the Moon's disc in the umbra (lunar, 0 for penumbral) */
  obscuration: number;
  /** Sidereal longitude of the eclipsed body: the Sun at a solar eclipse, the Moon at a lunar one */
  longitude: number;
  sign: number;
  nakshatra: number;
  /** The node the eclipse falls near */
  node: 'rahu' | 'ketu';
  /** Solar: where on Earth the eclipse is greatest (absent for a partial that misses the Earth's centre line) */
  greatest?: { latitude: number; longitude: number };
  /** Lunar: minutes of totality and of the umbral (partial) phase */
  totalMinutes?: number;
  partialMinutes?: number;
}

const J2000 = 2451545;
const jdOf = (t: A.AstroTime) => t.ut + J2000;

function sidereal(engine: Engine, body: 'sun' | 'moon', jd: number, ayanamsa: AyanamsaId) {
  return engine.longitudeAt(body, jd, { ayanamsa }).longitude;
}

function describe(engine: Engine, kind: EclipseKind, type: EclipseType, peak: A.AstroTime, obscuration: number, ayanamsa: AyanamsaId, extra: Partial<Eclipse>): Eclipse {
  const jd = jdOf(peak);
  const lon = sidereal(engine, kind === 'solar' ? 'sun' : 'moon', jd, ayanamsa);
  const rahu = engine.longitudeAt('rahu', jd, { ayanamsa }).longitude;
  return {
    kind, type, peak: peak.date.toISOString(), jdUt: jd, obscuration,
    longitude: lon, sign: signOf(lon), nakshatra: Math.min(27, Math.floor(norm360(lon) / (360 / 27)) + 1),
    node: angularDistance(lon, rahu) < 90 ? 'rahu' : 'ketu',
    ...extra,
  };
}

/** Every solar and lunar eclipse between two instants, in time order. */
export function findEclipses(engine: Engine, from: Date, to: Date, ayanamsa: AyanamsaId = 'lahiri'): Eclipse[] {
  const out: Eclipse[] = [];
  for (let e = A.SearchGlobalSolarEclipse(from); e.peak.date < to; e = A.NextGlobalSolarEclipse(e.peak)) {
    out.push(describe(engine, 'solar', e.kind as EclipseType, e.peak, e.obscuration ?? 0, ayanamsa,
      e.latitude !== undefined && e.longitude !== undefined ? { greatest: { latitude: e.latitude, longitude: e.longitude } } : {}));
  }
  for (let e = A.SearchLunarEclipse(from); e.peak.date < to; e = A.NextLunarEclipse(e.peak)) {
    out.push(describe(engine, 'lunar', e.kind as EclipseType, e.peak, e.obscuration, ayanamsa, {
      ...(e.sd_total > 0 ? { totalMinutes: Math.round(e.sd_total * 2) } : {}),
      ...(e.sd_partial > 0 ? { partialMinutes: Math.round(e.sd_partial * 2) } : {}),
    }));
  }
  return out.sort((a, b) => a.jdUt - b.jdUt);
}

/* ---------- the path of the Moon's shadow ---------- */

const KM_PER_AU = 149_597_870.7;
const EARTH_EQ = 6378.137 / KM_PER_AU;
const FLAT = 1 / 298.257223563;

/** Where the line from the Sun through the Moon meets the Earth's surface, or null if it misses. */
export function shadowCentreAt(when: Date): { latitude: number; longitude: number } | null {
  const t = A.MakeTime(when);
  const m = A.GeoMoon(t);
  const s = A.GeoVector(A.Body.Sun, t, true);
  let dx = m.x - s.x, dy = m.y - s.y, dz = m.z - s.z;
  const n = Math.hypot(dx, dy, dz);
  dx /= n; dy /= n; dz /= n;
  // the Earth as an oblate spheroid: stretch z so it becomes a sphere
  const k = 1 / (1 - FLAT);
  const [mx, my, mz, ex, ey, ez] = [m.x, m.y, m.z * k, dx, dy, dz * k];
  const a = ex * ex + ey * ey + ez * ez;
  const b = 2 * (mx * ex + my * ey + mz * ez);
  const c = mx * mx + my * my + mz * mz - EARTH_EQ * EARTH_EQ;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const u = (-b - Math.sqrt(disc)) / (2 * a);
  if (u < 0) return null;
  const p = new A.Vector(m.x + u * dx, m.y + u * dy, m.z + u * dz, t);
  const obs = A.VectorObserver(p, false);
  return { latitude: obs.latitude, longitude: ((obs.longitude + 540) % 360) - 180 };
}

/** The centre line of a total, annular or hybrid solar eclipse, sampled every `stepMinutes`. */
export function solarPath(e: Eclipse, stepMinutes = 2): { latitude: number; longitude: number; time: string }[] {
  if (e.kind !== 'solar') return [];
  const peak = Date.parse(e.peak);
  const pts: { latitude: number; longitude: number; time: string }[] = [];
  for (let m = -240; m <= 240; m += stepMinutes) {
    const when = new Date(peak + m * 60000);
    const p = shadowCentreAt(when);
    if (p) pts.push({ ...p, time: when.toISOString() });
  }
  return pts;
}

/* ---------- seen from one place ---------- */

export interface LocalView {
  visible: boolean;
  /** What is seen there, which can be less than the global type */
  type?: EclipseType;
  obscuration?: number;
  /** ISO UTC times; absent for a lunar eclipse when not computed */
  begins?: string;
  peak?: string;
  ends?: string;
  /** Altitude of the eclipsed body at greatest eclipse, degrees */
  altitude: number;
}

export function localView(e: Eclipse, latitude: number, longitude: number): LocalView {
  const obs = new A.Observer(latitude, longitude, 0);
  if (e.kind === 'solar') {
    const l = A.SearchLocalSolarEclipse(new Date(Date.parse(e.peak) - 86400000), obs);
    if (Math.abs(l.peak.time.date.getTime() - Date.parse(e.peak)) > 86400000) return { visible: false, altitude: -90 };
    const up = [l.partial_begin, l.peak, l.partial_end].some((x) => x.altitude > 0);
    return {
      visible: up, type: l.kind as EclipseType, obscuration: l.obscuration, altitude: l.peak.altitude,
      begins: l.partial_begin.time.date.toISOString(), peak: l.peak.time.date.toISOString(), ends: l.partial_end.time.date.toISOString(),
    };
  }
  const half = ((e.partialMinutes ?? 0) / 2) * 60000;
  const alt = (ms: number) => {
    const t = A.MakeTime(new Date(ms));
    const eq = A.Equator(A.Body.Moon, t, obs, true, true);
    return A.Horizon(t, obs, eq.ra, eq.dec, 'normal').altitude;
  };
  const p = Date.parse(e.peak);
  const altitude = alt(p);
  return {
    visible: [p - half, p, p + half].some((t) => alt(t) > 0), type: e.type, obscuration: e.obscuration, altitude,
    peak: e.peak, ...(half ? { begins: new Date(p - half).toISOString(), ends: new Date(p + half).toISOString() } : {}),
  };
}

/* ---------- hits on a chart ---------- */

export interface ChartPoint { id: string; label: string; longitude: number }

export interface EclipseHit {
  point: ChartPoint;
  /** degrees between the eclipse and the point */
  orb: number;
  /** 'conjunct' when on the point, 'opposite' when on the point 180° away (the other end of the axis) */
  aspect: 'conjunct' | 'opposite';
}

/** The sensitive points of a natal chart: the two axes, the lights and the nodes. */
export function chartPoints(chart: Chart): ChartPoint[] {
  const asc = chart.ascendant.longitude;
  const mc = chart.midheaven.longitude;
  return [
    { id: 'asc', label: 'Ascendant', longitude: asc },
    { id: 'dsc', label: 'Descendant', longitude: norm360(asc + 180) },
    { id: 'mc', label: 'Midheaven', longitude: mc },
    { id: 'ic', label: 'Nadir (IC)', longitude: norm360(mc + 180) },
    { id: 'sun', label: 'Sun', longitude: chart.planets.sun.longitude },
    { id: 'moon', label: 'Moon', longitude: chart.planets.moon.longitude },
    { id: 'rahu', label: 'Rahu', longitude: chart.planets.rahu.longitude },
    { id: 'lagna-lord', label: 'Lagna lord', longitude: chart.planets[chart.ascendant.signLord].longitude },
  ];
}

/** Points the eclipse degree falls on, within `orb` degrees, closest first. */
export function eclipseHits(e: Eclipse, points: ChartPoint[], orb = 3): EclipseHit[] {
  const hits: EclipseHit[] = [];
  for (const p of points) {
    const d = angularDistance(e.longitude, p.longitude);
    if (d <= orb) hits.push({ point: p, orb: d, aspect: 'conjunct' });
    else if (180 - d <= orb && p.id !== 'dsc' && p.id !== 'ic') hits.push({ point: p, orb: 180 - d, aspect: 'opposite' });
  }
  return hits.sort((a, b) => a.orb - b.orb);
}
