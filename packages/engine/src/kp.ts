/**
 * Krishnamurti Paddhati (KP).
 *
 * KP uses the Krishnamurti ayanamsa, Placidus house cusps and a division of
 * every nakshatra into nine unequal "subs" in Vimshottari proportion. A point's
 * sign lord, star (nakshatra) lord, sub lord and sub-sub lord are its four
 * rulers; the sub lord of a house cusp decides whether that house's matters
 * come to pass.
 */
import { DASHA_ORDER, DASHA_TOTAL_YEARS, DASHA_YEARS, GRAHAS, NAKSHATRA_SPAN, SIGN_LORDS, VARA_LORDS } from './constants';
import type { Engine } from './engine';
import { DateTime } from 'luxon';
import { dateToJd, jdToDate, jdToIso, localToUtc, timezoneAt } from './time';
import type { AyanamsaId, BirthInput, Chart, GrahaId, NodeType } from './types';
import { norm360, signOf } from './zodiac';

export interface KpLords {
  sign: GrahaId;
  star: GrahaId;
  sub: GrahaId;
  subSub: GrahaId;
}

export interface KpPoint {
  longitude: number;
  /** 1–12 */
  sign: number;
  degreeInSign: number;
  /** 1–27 */
  nakshatra: number;
  lords: KpLords;
  /** 1–249 KP horary number of the sub the point falls in */
  kpNumber: number;
}

export interface KpPlanet extends KpPoint {
  id: GrahaId;
  retrograde: boolean;
  /** Placidus bhava (cusp n up to cusp n+1) the planet occupies */
  house: number;
}

export interface KpCusp extends KpPoint {
  house: number;
}

/**
 * The four KP significator levels, strongest first:
 *  A: houses occupied by the planet's star lord
 *  B: houses occupied by the planet itself
 *  C: houses owned by the planet's star lord
 *  D: houses owned by the planet
 * Rahu and Ketu additionally act for their sign lord (`agent`).
 */
export interface KpSignification {
  planet: GrahaId;
  levelA: number[];
  levelB: number[];
  levelC: number[];
  levelD: number[];
  /** Nodes only: houses signified by the sign lord they act for */
  agent: number[];
  /** Union of all levels, sorted */
  houses: number[];
}

export interface KpHouseSignificators {
  house: number;
  /** Planets in the star of occupants */
  levelA: GrahaId[];
  /** Occupants */
  levelB: GrahaId[];
  /** Planets in the star of the cusp-sign lord */
  levelC: GrahaId[];
  /** Cusp-sign lord(s) */
  levelD: GrahaId[];
  /** All of the above, strongest first, without repeats */
  all: GrahaId[];
}

export interface KpRulingPlanets {
  dayLord: GrahaId;
  lagnaSignLord: GrahaId;
  lagnaStarLord: GrahaId;
  lagnaSubLord: GrahaId;
  moonSignLord: GrahaId;
  moonStarLord: GrahaId;
  moonSubLord: GrahaId;
  /**
   * Distinct ruling planets in the usual order of strength, with Rahu/Ketu added
   * when they sit in a ruling planet's sign (nodes represent their dispositor).
   */
  planets: GrahaId[];
}

export interface KpChart {
  jdUt: number;
  utc: string;
  latitude: number;
  longitude: number;
  ayanamsa: AyanamsaId;
  ayanamsaValue: number;
  /** 'placidus' unless Placidus is undefined at this latitude (polar), then 'porphyry' */
  houseSystem: 'placidus' | 'porphyry';
  cusps: KpCusp[];
  planets: Record<GrahaId, KpPlanet>;
  significations: Record<GrahaId, KpSignification>;
  houseSignificators: KpHouseSignificators[];
  ruling: KpRulingPlanets;
}

// ---------------------------------------------------------------- sub table

export interface KpSubEntry {
  /** 1–249 */
  number: number;
  start: number;
  end: number;
  sign: GrahaId;
  star: GrahaId;
  sub: GrahaId;
  nakshatra: number;
}

const order = (from: GrahaId) => {
  const i = DASHA_ORDER.indexOf(from);
  return Array.from({ length: 9 }, (_, k) => DASHA_ORDER[(i + k) % 9]);
};

/** Divide an arc [start, start+span) in Vimshottari proportion starting from `from` */
function divide(start: number, span: number, from: GrahaId) {
  let s = start;
  return order(from).map((lord) => {
    const len = (span * DASHA_YEARS[lord]) / DASHA_TOTAL_YEARS;
    const seg = { lord, start: s, end: s + len };
    s += len;
    return seg;
  });
}

const EPS = 1e-9;

/**
 * The 249 KP subs of the zodiac. 27 × 9 = 243 subs, and the six that straddle
 * a sign boundary are split into two, giving the 249 numbers used in horary.
 */
export const KP_SUBS: KpSubEntry[] = (() => {
  const out: KpSubEntry[] = [];
  for (let n = 0; n < 27; n++) {
    const star = DASHA_ORDER[n % 9];
    for (const seg of divide(n * NAKSHATRA_SPAN, NAKSHATRA_SPAN, star)) {
      const pieces: [number, number][] = [];
      const boundary = (Math.floor(seg.start / 30 + EPS) + 1) * 30;
      if (seg.end > boundary + 1e-7) pieces.push([seg.start, boundary], [boundary, seg.end]);
      else pieces.push([seg.start, seg.end]);
      for (const [a, b] of pieces) {
        out.push({
          number: out.length + 1,
          start: a,
          end: b,
          sign: SIGN_LORDS[Math.floor(a / 30 + EPS)],
          star,
          sub: seg.lord,
          nakshatra: n + 1,
        });
      }
    }
  }
  return out;
})();

/** Sign, star, sub and sub-sub lords of a sidereal longitude */
export function kpLords(longitude: number): KpLords & { kpNumber: number; nakshatra: number } {
  const lon = norm360(longitude);
  const nIdx = Math.min(26, Math.floor(lon / NAKSHATRA_SPAN));
  const star = DASHA_ORDER[nIdx % 9];
  const subs = divide(nIdx * NAKSHATRA_SPAN, NAKSHATRA_SPAN, star);
  const sub = subs.find((s) => lon < s.end) ?? subs[8];
  const subSubs = divide(sub.start, sub.end - sub.start, sub.lord);
  const subSub = subSubs.find((s) => lon < s.end) ?? subSubs[8];
  const entry = KP_SUBS.find((e) => lon >= e.start - EPS && lon < e.end) ?? KP_SUBS[248];
  return {
    sign: SIGN_LORDS[signOf(lon) - 1],
    star,
    sub: sub.lord,
    subSub: subSub.lord,
    kpNumber: entry.number,
    nakshatra: nIdx + 1,
  };
}

function kpPoint(longitude: number): KpPoint {
  const lon = norm360(longitude);
  const l = kpLords(lon);
  const sign = signOf(lon);
  return {
    longitude: lon,
    sign,
    degreeInSign: lon - (sign - 1) * 30,
    nakshatra: l.nakshatra,
    lords: { sign: l.sign, star: l.star, sub: l.sub, subSub: l.subSub },
    kpNumber: l.kpNumber,
  };
}

// ---------------------------------------------------------------- chart

export interface KpInputs {
  jdUt: number;
  latitude: number;
  longitude: number;
  /** 12 sidereal cusp longitudes, house 1 first */
  cusps: number[];
  planets: Record<GrahaId, { longitude: number; retrograde: boolean }>;
  /** Weekday lord of the Vedic (sunrise-based) day */
  dayLord: GrahaId;
  ayanamsa: AyanamsaId;
  ayanamsaValue: number;
  houseSystem?: 'placidus' | 'porphyry';
}

const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const sortNum = (xs: number[]) => uniq(xs).sort((a, b) => a - b);

/** Bhava (1–12) containing a longitude, given 12 cusps */
export function bhavaOf(lon: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    const a = cusps[i];
    const span = norm360(cusps[(i + 1) % 12] - a);
    if (norm360(lon - a) < span) return i + 1;
  }
  return 1;
}

/** Assemble a KP chart from cusps and planet longitudes (pure, no ephemeris) */
export function buildKpChart(k: KpInputs): KpChart {
  const cusps: KpCusp[] = k.cusps.map((c, i) => ({ ...kpPoint(c), house: i + 1 }));
  const planets = {} as Record<GrahaId, KpPlanet>;
  for (const id of GRAHAS) {
    const p = k.planets[id];
    planets[id] = { ...kpPoint(p.longitude), id, retrograde: p.retrograde, house: bhavaOf(p.longitude, k.cusps) };
  }
  // Ownership in KP: a planet owns the houses whose cusp falls in its sign.
  const owned = (g: GrahaId) => cusps.filter((c) => c.lords.sign === g).map((c) => c.house);
  const occupied = (g: GrahaId) => [planets[g].house];

  const significations = {} as Record<GrahaId, KpSignification>;
  for (const id of GRAHAS) {
    const star = planets[id].lords.star;
    const levelA = occupied(star);
    const levelB = occupied(id);
    const levelC = owned(star);
    const levelD = owned(id);
    let agent: number[] = [];
    if (id === 'rahu' || id === 'ketu') {
      const lord = planets[id].lords.sign;
      agent = sortNum([...occupied(lord), ...owned(lord)]);
    }
    significations[id] = {
      planet: id,
      levelA,
      levelB,
      levelC: sortNum(levelC),
      levelD: sortNum(levelD),
      agent,
      houses: sortNum([...levelA, ...levelB, ...levelC, ...levelD, ...agent]),
    };
  }

  const houseSignificators: KpHouseSignificators[] = cusps.map((c) => {
    const occupants = GRAHAS.filter((g) => planets[g].house === c.house);
    const inStarOf = (lords: GrahaId[]) => GRAHAS.filter((g) => lords.includes(planets[g].lords.star));
    const owner = [c.lords.sign];
    const levelA = inStarOf(occupants);
    const levelC = inStarOf(owner);
    return {
      house: c.house,
      levelA,
      levelB: occupants,
      levelC,
      levelD: owner,
      all: uniq([...levelA, ...occupants, ...levelC, ...owner]),
    };
  });

  const asc = cusps[0].lords;
  const moon = planets.moon.lords;
  const base: GrahaId[] = [asc.sub, asc.star, asc.sign, moon.star, moon.sign, k.dayLord];
  const planetsRp = uniq(base);
  for (const node of ['rahu', 'ketu'] as const) {
    if (!planetsRp.includes(node) && planetsRp.includes(planets[node].lords.sign)) planetsRp.push(node);
  }
  const ruling: KpRulingPlanets = {
    dayLord: k.dayLord,
    lagnaSignLord: asc.sign,
    lagnaStarLord: asc.star,
    lagnaSubLord: asc.sub,
    moonSignLord: moon.sign,
    moonStarLord: moon.star,
    moonSubLord: moon.sub,
    planets: planetsRp,
  };

  return {
    jdUt: k.jdUt,
    utc: jdToIso(k.jdUt),
    latitude: k.latitude,
    longitude: k.longitude,
    ayanamsa: k.ayanamsa,
    ayanamsaValue: k.ayanamsaValue,
    houseSystem: k.houseSystem ?? 'placidus',
    cusps,
    planets,
    significations,
    houseSignificators,
    ruling,
  };
}

// ---------------------------------------------------------------- with the engine

const SEFLG_SIDEREAL = 65536;
const POLAR = 66.0;

export interface KpOptions {
  /** Default 'krishnamurti' */
  ayanamsa?: AyanamsaId;
  /** Default 'mean' (KP practitioners mostly use the mean node) */
  nodeType?: NodeType;
}

/** Placidus (or Porphyry above the polar circles) sidereal cusps at an instant */
export function kpCusps(engine: Engine, jdUt: number, latitude: number, longitude: number, ayanamsa: AyanamsaId = 'krishnamurti') {
  engine.ayanamsaAt(jdUt, ayanamsa); // selects the sidereal mode
  const system = Math.abs(latitude) < POLAR ? 'placidus' : 'porphyry';
  const h = engine.swe.houses_ex(jdUt, SEFLG_SIDEREAL, latitude, longitude, system === 'placidus' ? 'P' : 'O');
  const cusps = Array.from(h.cusps).slice(1, 13).map(norm360);
  return { cusps, system: system as 'placidus' | 'porphyry' };
}

/** The last sunrise at or before jdUt (null in polar day/night) */
export function sunriseBefore(engine: Engine, jdUt: number, latitude: number, longitude: number): number | null {
  try {
    let r = engine.sunriseSunset(jdUt - 1, latitude, longitude).sunrise;
    if (r === null) return null;
    if (r > jdUt) r = engine.sunriseSunset(jdUt - 2, latitude, longitude).sunrise;
    if (r === null) return null;
    const again = engine.sunriseSunset(r + 0.01, latitude, longitude).sunrise;
    return again !== null && again <= jdUt ? again : r;
  } catch {
    return null;
  }
}

/** Weekday (0 = Sunday) of a local civil date at an instant */
export function localWeekday(jdUt: number, timezone: string): number {
  return DateTime.fromMillis(jdToDate(jdUt).getTime(), { zone: timezone }).weekday % 7;
}

/** Weekday lord of the Vedic day (sunrise to sunrise) containing jdUt */
export function vedicDayLord(engine: Engine, jdUt: number, latitude: number, longitude: number, timezone: string): GrahaId {
  const ref = sunriseBefore(engine, jdUt, latitude, longitude) ?? jdUt;
  return VARA_LORDS[localWeekday(ref, timezone)];
}

/** KP chart for an instant and place */
export function kpChartAt(
  engine: Engine,
  jdUt: number,
  place: { latitude: number; longitude: number; timezone?: string },
  opts: KpOptions & { cuspJdUt?: number; cusps?: number[] } = {},
): KpChart {
  const ayanamsa = opts.ayanamsa ?? 'krishnamurti';
  const tz = place.timezone ?? timezoneAt(place.latitude, place.longitude);
  const { cusps, system } = opts.cusps
    ? { cusps: opts.cusps, system: 'placidus' as const }
    : kpCusps(engine, opts.cuspJdUt ?? jdUt, place.latitude, place.longitude, ayanamsa);
  const snap = engine.positionsAt(jdUt, { ayanamsa, nodeType: opts.nodeType ?? 'mean' });
  const planets = {} as KpInputs['planets'];
  for (const g of GRAHAS) planets[g] = { longitude: snap.planets[g].longitude, retrograde: snap.planets[g].retrograde };
  return buildKpChart({
    jdUt,
    latitude: place.latitude,
    longitude: place.longitude,
    cusps,
    planets,
    dayLord: vedicDayLord(engine, jdUt, place.latitude, place.longitude, tz),
    ayanamsa,
    ayanamsaValue: snap.ayanamsaValue,
    houseSystem: system,
  });
}

/** KP chart for a birth (local date/time at a place) */
export function computeKpChart(engine: Engine, input: BirthInput, opts: KpOptions = {}): KpChart {
  const { latitude, longitude } = input.place;
  const tz = input.place.timezone ?? timezoneAt(latitude, longitude);
  const t = localToUtc(input.date, input.time, tz, input.utcOffsetMinutes, longitude, input.calendar);
  return kpChartAt(engine, dateToJd(t.utc), { latitude, longitude, timezone: tz }, opts);
}

/** KP view of an already-computed natal chart (re-computed on KP ayanamsa + Placidus) */
export function kpFromChart(engine: Engine, chart: Chart, opts: KpOptions = {}): KpChart {
  const { latitude, longitude } = chart.meta.input.place;
  return kpChartAt(engine, chart.meta.jdUt, { latitude, longitude, timezone: chart.meta.timezone }, opts);
}

/**
 * The instant nearest `nearJd` (within one sidereal day) at which the KP
 * ascendant reaches `targetLon` at a place. Used for the 1–249 horary method.
 */
export function timeForAscendant(
  engine: Engine,
  targetLon: number,
  nearJd: number,
  latitude: number,
  longitude: number,
  ayanamsa: AyanamsaId = 'krishnamurti',
): number | null {
  const asc = (jd: number) => engine.ascendantAt(jd, latitude, longitude, ayanamsa);
  const diff = (jd: number) => {
    const d = norm360(asc(jd) - targetLon);
    return d > 180 ? d - 360 : d;
  };
  const step = 4 / 1440; // 4 minutes
  let best: number | null = null;
  const start = nearJd - 0.5;
  let prevJd = start;
  let prev = diff(start);
  for (let jd = start + step; jd <= nearJd + 0.5 + 1e-9; jd += step) {
    const cur = diff(jd);
    // the ascendant only moves forward, so a crossing is a - to + sign change with a small jump
    if (prev <= 0 && cur > 0 && cur - prev < 90) {
      let lo = prevJd;
      let hi = jd;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (diff(mid) <= 0) lo = mid;
        else hi = mid;
      }
      const root = (lo + hi) / 2;
      if (best === null || Math.abs(root - nearJd) < Math.abs(best - nearJd)) best = root;
    }
    prevJd = jd;
    prev = cur;
  }
  return best;
}
