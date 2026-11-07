import SwissEph from 'swisseph-wasm';
import {
  COMBUSTION_ORB,
  ENGINE_VERSION,
  GRAHAS,
  MEAN_MOTION,
  MOVABLE_KARANAS,
  NAKSHATRAS,
  OUTER_PLANETS,
  PLANET_NAMES,
  SIGN_SLUGS,
  TITHI_NAMES,
  VARA_LORDS,
  VARA_NAMES,
  YOGA_NAMES,
  naturalRelationship,
} from './constants';
import { DEFAULT_DASHA_YEAR_DAYS, vimshottari } from './dasha';
import { ashtottari, ashtottariApplies, kalachakra, yogini } from './dashas';
import { dateToJd, jdToDate, jdToIso, localToUtc, timezoneAt } from './time';
import type {
  AyanamsaId,
  BirthInput,
  Chart,
  ChartOptions,
  Dignity,
  GrahaId,
  House,
  HouseSystem,
  NodeType,
  Panchanga,
  PlanetId,
  PlanetPosition,
  PlanetSnapshot,
  PointId,
  PositionsSnapshot,
  SignNumber,
  VargaChart,
  VargaId,
  VargaPlacement,
} from './types';
import { VARGAS, VARGA_IDS, vargaDegree } from './vargas';
import {
  addSigns,
  angularDistance,
  dignityOf,
  houseFrom,
  nakshatraOf,
  norm360,
  signLord,
  signOf,
  zodiacPosition,
} from './zodiac';

export const AYANAMSA_CODES: Record<AyanamsaId, number> = {
  fagan_bradley: 0,
  lahiri: 1,
  raman: 3,
  ushashashi: 4,
  krishnamurti: 5,
  yukteshwar: 7,
  jn_bhasin: 8,
  suryasiddhanta: 21,
  aryabhata: 23,
  true_chitra: 27,
  true_revati: 28,
  true_pushya: 29,
  true_mula: 35,
  galactic_center_mula: 36,
};

const HOUSE_CODES: Record<Exclude<HouseSystem, 'whole_sign'>, string> = {
  equal: 'A',
  sripati: 'S',
  placidus: 'P',
  koch: 'K',
  porphyry: 'O',
  campanus: 'C',
  regiomontanus: 'R',
};

const SE_IDS: Record<Exclude<PlanetId, 'rahu' | 'ketu'>, number> = {
  sun: 0,
  moon: 1,
  mercury: 2,
  venus: 3,
  mars: 4,
  jupiter: 5,
  saturn: 6,
  uranus: 7,
  neptune: 8,
  pluto: 9,
};
const SE_MEAN_NODE = 10;
const SE_TRUE_NODE = 11;
const SEFLG_SWIEPH = 2;
const SEFLG_MOSEPH = 4;
const SEFLG_SPEED = 256;
const SEFLG_SIDEREAL = 65536;
const SE_CALC_RISE = 1;
const SE_CALC_SET = 2;

/** Years with bundled Swiss Ephemeris files; outside we use Moshier (still arc-second level) */
const SWISS_RANGE: [number, number] = [dateToJd(new Date(Date.UTC(1800, 0, 1))), dateToJd(new Date(Date.UTC(2399, 11, 31)))];

export interface PositionOptions {
  ayanamsa?: AyanamsaId;
  nodeType?: NodeType;
  includeOuterPlanets?: boolean;
}

export interface Engine {
  /** Full natal chart */
  computeChart(input: BirthInput, options?: ChartOptions): Chart;
  /** Sidereal positions + speeds at any instant (transits, stations, timelines) */
  positionsAt(when: Date | string | number, options?: PositionOptions): PositionsSnapshot;
  /** Sidereal longitude + speed of one body (fast path for root finding) */
  longitudeAt(planet: PlanetId, jdUt: number, options?: PositionOptions): { longitude: number; speed: number };
  /** Sidereal ascendant at an instant and place */
  ascendantAt(jdUt: number, latitude: number, longitude: number, ayanamsa?: AyanamsaId): number;
  /** Ayanamsa value (degrees) */
  ayanamsaAt(jdUt: number, ayanamsa?: AyanamsaId): number;
  /** Next sunrise / sunset after jdUt at a place (null in polar day/night) */
  sunriseSunset(jdUt: number, latitude: number, longitude: number): { sunrise: number | null; sunset: number | null };
  /** Underlying swisseph-wasm instance for anything not wrapped here */
  readonly swe: SwissEph;
  close(): void;
}

let shared: Promise<Engine> | null = null;

/**
 * Load the Swiss Ephemeris WASM and return an engine. Calls share one
 * instance unless `fresh` is true. All engine methods are synchronous.
 */
export function createEngine(opts: { fresh?: boolean } = {}): Promise<Engine> {
  if (!opts.fresh && shared) return shared;
  const p = (async () => {
    const swe = new SwissEph();
    await swe.initSwissEph();
    return makeEngine(swe);
  })();
  if (!opts.fresh) {
    shared = p;
    p.catch(() => {
      shared = null;
    });
  }
  return p;
}

function toJd(when: Date | string | number): number {
  if (typeof when === 'number') return when;
  const d = typeof when === 'string' ? new Date(when) : when;
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${String(when)}`);
  return dateToJd(d);
}

function makeEngine(swe: SwissEph): Engine {
  let currentSid = -1;
  const setSid = (a: AyanamsaId) => {
    const code = AYANAMSA_CODES[a];
    if (code === undefined) throw new Error(`Unknown ayanamsa "${a}"`);
    if (code !== currentSid) {
      swe.set_sid_mode(code, 0, 0);
      currentSid = code;
    }
  };
  const epheFlag = (jd: number) => (jd >= SWISS_RANGE[0] && jd <= SWISS_RANGE[1] ? SEFLG_SWIEPH : SEFLG_MOSEPH);

  function raw(planet: PlanetId, jd: number, nodeType: NodeType, sidereal: boolean) {
    const flags = epheFlag(jd) | SEFLG_SPEED | (sidereal ? SEFLG_SIDEREAL : 0);
    if (planet === 'rahu' || planet === 'ketu') {
      const r = swe.calc_ut(jd, nodeType === 'true' ? SE_TRUE_NODE : SE_MEAN_NODE, flags);
      const lon = planet === 'ketu' ? norm360(r[0] + 180) : norm360(r[0]);
      return { lon, lat: planet === 'ketu' ? -r[1] : r[1], dist: r[2], speed: r[3] };
    }
    const r = swe.calc_ut(jd, SE_IDS[planet], flags);
    return { lon: norm360(r[0]), lat: r[1], dist: r[2], speed: r[3] };
  }

  const ayanamsaAt = (jd: number, a: AyanamsaId = 'lahiri') => {
    setSid(a);
    return swe.get_ayanamsa_ut(jd);
  };

  function houseData(jd: number, lat: number, lon: number, a: AyanamsaId, system: HouseSystem) {
    setSid(a);
    const code = system === 'whole_sign' ? 'A' : HOUSE_CODES[system];
    const h = swe.houses_ex(jd, SEFLG_SIDEREAL, lat, lon, code);
    return { asc: norm360(h.ascmc[0]), mc: norm360(h.ascmc[1]), cusps: Array.from(h.cusps).slice(1, 13).map(norm360) };
  }

  function sunriseSunset(jd: number, lat: number, lon: number) {
    const geo = [lon, lat, 0];
    const rise = swe.rise_trans(jd, 0, '', SEFLG_SWIEPH, SE_CALC_RISE, geo, 1013.25, 15);
    const set = swe.rise_trans(jd, 0, '', SEFLG_SWIEPH, SE_CALC_SET, geo, 1013.25, 15);
    return { sunrise: rise ? rise[0] : null, sunset: set ? set[0] : null };
  }

  function positionsAt(when: Date | string | number, o: PositionOptions = {}): PositionsSnapshot {
    const jd = toJd(when);
    const a = o.ayanamsa ?? 'lahiri';
    setSid(a);
    const ids: PlanetId[] = [...GRAHAS, ...(o.includeOuterPlanets ? OUTER_PLANETS : [])];
    const planets = {} as PositionsSnapshot['planets'];
    for (const id of ids) {
      const r = raw(id, jd, o.nodeType ?? 'mean', true);
      const z = zodiacPosition(r.lon);
      const snap: PlanetSnapshot = {
        id,
        longitude: z.longitude,
        sign: z.sign,
        degreeInSign: z.degreeInSign,
        nakshatra: z.nakshatra,
        pada: z.pada,
        speed: r.speed,
        retrograde: isRetro(id, r.speed),
        latitude: r.lat,
      };
      (planets as Record<string, PlanetSnapshot>)[id] = snap;
    }
    return { utc: jdToIso(jd), jdUt: jd, ayanamsaValue: swe.get_ayanamsa_ut(jd), planets };
  }

  function computeChart(input: BirthInput, options: ChartOptions = {}): Chart {
    const opts = {
      ayanamsa: options.ayanamsa ?? 'lahiri',
      houseSystem: options.houseSystem ?? 'whole_sign',
      nodeType: options.nodeType ?? 'mean',
      includeOuterPlanets: options.includeOuterPlanets ?? false,
      vargas: options.vargas ?? VARGA_IDS,
      dashaLevels: options.dashaLevels ?? 3,
      dashaYearDays: options.dashaYearDays ?? DEFAULT_DASHA_YEAR_DAYS,
    } satisfies ChartMeta_Options;

    const { latitude, longitude } = input.place;
    if (!(latitude >= -90 && latitude <= 90)) throw new Error('Latitude must be between -90 and 90');
    if (!(longitude >= -180 && longitude <= 180)) throw new Error('Longitude must be between -180 and 180');
    const timezone = input.place.timezone ?? timezoneAt(latitude, longitude);
    const t = localToUtc(input.date, input.time, timezone, input.utcOffsetMinutes, longitude);
    const jd = dateToJd(t.utc);
    const jdEt = jd + swe.deltat(jd);
    setSid(opts.ayanamsa);
    const ayanamsaValue = swe.get_ayanamsa_ut(jd);

    const hd = houseData(jd, latitude, longitude, opts.ayanamsa, opts.houseSystem);
    const ascZ = zodiacPosition(hd.asc);
    const ascSign = ascZ.sign;

    // Planets
    const ids: PlanetId[] = [...GRAHAS, ...(opts.includeOuterPlanets ? OUTER_PLANETS : [])];
    const sun = raw('sun', jd, opts.nodeType, true);
    const rawById = {} as Record<PlanetId, ReturnType<typeof raw>>;
    for (const id of ids) rawById[id] = id === 'sun' ? sun : raw(id, jd, opts.nodeType, true);
    const tropical = (id: PlanetId) => raw(id, jd, opts.nodeType, false).lon;

    const houseOf = (lon: number): SignNumber => {
      if (opts.houseSystem === 'whole_sign') return houseFrom(ascSign, signOf(lon));
      // Bhava: house n spans cusp n .. cusp n+1
      for (let i = 0; i < 12; i++) {
        const a = hd.cusps[i];
        const b = hd.cusps[(i + 1) % 12];
        const span = norm360(b - a);
        if (norm360(lon - a) < span) return (i + 1) as SignNumber;
      }
      return 1;
    };

    const planets = {} as Record<PlanetId, PlanetPosition>;
    for (const id of ids) {
      const r = rawById[id];
      const z = zodiacPosition(r.lon);
      const retrograde = isRetro(id, r.speed);
      const dSun = angularDistance(r.lon, sun.lon);
      const orb = COMBUSTION_ORB[id as GrahaId];
      planets[id] = {
        ...z,
        id,
        name: PLANET_NAMES[id],
        latitude: r.lat,
        distance: r.dist,
        speed: r.speed,
        tropicalLongitude: tropical(id),
        house: houseOf(r.lon),
        retrograde,
        combust: orb ? dSun < (retrograde ? orb.retro : orb.direct) : false,
        distanceFromSun: dSun,
        signLord: signLord(z.sign),
        stationary: id !== 'rahu' && id !== 'ketu' && Math.abs(r.speed) < MEAN_MOTION[id] * 0.1,
      };
    }
    // Compound (panchadha) dignity for the nine grahas
    for (const id of GRAHAS) {
      const p = planets[id];
      p.dignity = compoundDignity(id, p.longitude, (g) => planets[g].sign);
    }

    // Houses
    const houses: House[] = [];
    for (let n = 1; n <= 12; n++) {
      const sign =
        opts.houseSystem === 'whole_sign' ? addSigns(ascSign, n - 1) : signOf(hd.cusps[n - 1]);
      const cusp = opts.houseSystem === 'whole_sign' ? (sign - 1) * 30 : hd.cusps[n - 1];
      houses.push({
        number: n as SignNumber,
        sign,
        signSlug: SIGN_SLUGS[sign - 1],
        cusp,
        lord: signLord(sign),
        occupants: ids.filter((id) => planets[id].house === n),
      });
    }

    // Vargas
    const vargas: Partial<Record<VargaId, VargaChart>> = {};
    for (const vid of opts.vargas) {
      const def = VARGAS[vid];
      if (!def) throw new Error(`Unsupported varga ${vid}`);
      const vAscSign = def.sign(hd.asc);
      const place = (lon: number): VargaPlacement => {
        const s = def.sign(lon);
        return {
          sign: s,
          signSlug: SIGN_SLUGS[s - 1],
          house: houseFrom(vAscSign, s),
          degreeInSign: vargaDegree(lon, def.division),
        };
      };
      const vPlanets: Partial<Record<PlanetId, VargaPlacement>> = {};
      const signs = Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [i + 1, [] as PointId[]]),
      ) as Record<SignNumber, PointId[]>;
      signs[vAscSign].push('asc');
      const vargottama: PlanetId[] = [];
      for (const id of ids) {
        const pl = place(planets[id].longitude);
        vPlanets[id] = pl;
        signs[pl.sign].push(id);
        if (vid !== 'D1' && pl.sign === planets[id].sign) vargottama.push(id);
      }
      vargas[vid] = {
        id: vid,
        division: def.division,
        name: def.name,
        ascendant: place(hd.asc),
        planets: vPlanets,
        signs,
        vargottama,
      };
    }

    const dasha = vimshottari(planets.moon.longitude, jd, {
      levels: opts.dashaLevels,
      yearDays: opts.dashaYearDays,
    });
    const dashaOpts = { levels: opts.dashaLevels, yearDays: opts.dashaYearDays };
    const ashtottariDasha = ashtottari(planets.moon.longitude, jd, dashaOpts);
    ashtottariDasha.applicable = ashtottariApplies(
      ascSign,
      planets[signLord(ascSign)].sign,
      planets.rahu.sign,
    );
    const dashas = {
      yogini: yogini(planets.moon.longitude, jd, dashaOpts),
      ashtottari: ashtottariDasha,
      kalachakra: kalachakra(planets.moon.longitude, jd, dashaOpts),
    };

    const panchanga = computePanchanga(jd, planets.sun.longitude, planets.moon.longitude, latitude, longitude, timezone, t.utcOffsetMinutes);

    return {
      meta: {
        name: input.name,
        input,
        options: opts,
        timezone,
        utcOffsetMinutes: t.utcOffsetMinutes,
        localMeanTime: t.localMeanTime,
        utc: t.utc.toISOString(),
        jdUt: jd,
        jdEt,
        ayanamsa: opts.ayanamsa,
        ayanamsaName: swe.get_ayanamsa_name(AYANAMSA_CODES[opts.ayanamsa]),
        ayanamsaValue,
        houseSystem: opts.houseSystem,
        nodeType: opts.nodeType,
        ephemeris: epheFlag(jd) === SEFLG_SWIEPH ? 'swiss' : 'moshier',
        engineVersion: ENGINE_VERSION,
      },
      ascendant: { ...ascZ, id: 'asc', signLord: signLord(ascSign) },
      midheaven: zodiacPosition(hd.mc),
      planets: planets as Chart['planets'],
      houses,
      vargas,
      dasha,
      dashas,
      panchanga,
    };
  }

  function computePanchanga(
    jd: number,
    sunLon: number,
    moonLon: number,
    lat: number,
    lon: number,
    timezone: string,
    offsetMin: number,
  ): Panchanga {
    const elong = norm360(moonLon - sunLon);
    const tithi = Math.floor(elong / 12) + 1;
    const paksha = tithi <= 15 ? 'shukla' : 'krishna';
    const tithiName =
      tithi === 15 ? 'Purnima' : tithi === 30 ? 'Amavasya' : TITHI_NAMES[(tithi - 1) % 15];
    const yoga = Math.floor(norm360(sunLon + moonLon) / (360 / 27)) + 1;
    const karana = Math.floor(elong / 6) + 1; // 1..60
    let karanaName: string;
    if (karana === 1) karanaName = 'Kimstughna';
    else if (karana >= 58) karanaName = ['Shakuni', 'Chatushpada', 'Naga'][karana - 58];
    else karanaName = MOVABLE_KARANAS[(karana - 2) % 7];

    // Vedic day runs sunrise to sunrise: find the sunrise at or before birth.
    let sunrise: number | null = null;
    let sunset: number | null = null;
    try {
      const prev = sunriseSunset(jd - 1, lat, lon);
      const next = sunriseSunset(jd, lat, lon);
      if (prev.sunrise !== null) {
        sunrise = prev.sunrise;
        if (next.sunrise !== null && next.sunrise <= jd) sunrise = next.sunrise;
        if (sunrise > jd) sunrise = null;
      }
      if (sunrise !== null) {
        const s = sunriseSunset(sunrise, lat, lon);
        sunset = s.sunset;
      }
    } catch {
      /* polar latitudes: leave undefined */
    }
    const ref = sunrise ?? jd;
    const localMs = jdToDate(ref).getTime() + offsetMin * 60000;
    const vara = new Date(localMs).getUTCDay();
    void timezone;
    const nk = nakshatraOf(moonLon);
    return {
      tithi,
      tithiName,
      paksha,
      vara,
      varaName: VARA_NAMES[vara],
      varaLord: VARA_LORDS[vara],
      nakshatra: nk.info.number,
      nakshatraName: NAKSHATRAS[nk.info.number - 1].name,
      yoga,
      yogaName: YOGA_NAMES[yoga - 1],
      karana,
      karanaName,
      sunrise: sunrise !== null ? jdToIso(sunrise) : undefined,
      sunset: sunset !== null ? jdToIso(sunset) : undefined,
    };
  }

  return {
    computeChart,
    positionsAt,
    longitudeAt(planet, jd, o = {}) {
      setSid(o.ayanamsa ?? 'lahiri');
      const r = raw(planet, jd, o.nodeType ?? 'mean', true);
      return { longitude: r.lon, speed: r.speed };
    },
    ascendantAt(jd, lat, lon, a = 'lahiri') {
      return houseData(jd, lat, lon, a, 'equal').asc;
    },
    ayanamsaAt,
    sunriseSunset,
    swe,
    close: () => {
      swe.close();
      if (shared) shared = null;
    },
  };
}

type ChartMeta_Options = Chart['meta']['options'];

/** Nodes are always retrograde in mean motion; true node can briefly go direct */
function isRetro(id: PlanetId, speed: number) {
  if (id === 'sun' || id === 'moon') return false;
  return speed < 0;
}

/**
 * Panchadha (compound) relationship dignity: natural relationship with the sign
 * lord combined with the temporal one (lord in 2,3,4,10,11,12 from the planet
 * = temporal friend). Exaltation / moolatrikona / own / debilitation win.
 */
export function compoundDignity(
  planet: GrahaId,
  lon: number,
  signOfGraha: (g: GrahaId) => SignNumber,
): Dignity {
  const base = dignityOf(planet, lon);
  if (base === 'exalted' || base === 'debilitated' || base === 'moolatrikona' || base === 'own')
    return base;
  const lord = signLord(signOf(lon));
  const natural = naturalRelationship(planet, lord);
  const dist = houseFrom(signOf(lon), signOfGraha(lord));
  const temporalFriend = [2, 3, 4, 10, 11, 12].includes(dist);
  const score = (natural === 'friend' ? 1 : natural === 'enemy' ? -1 : 0) + (temporalFriend ? 1 : -1);
  return (['great_enemy', 'enemy', 'neutral', 'friend', 'great_friend'] as const)[score + 2];
}
