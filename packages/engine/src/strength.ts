/**
 * Shadbala (six-fold planetary strength) and Bhava Bala (house strength),
 * following Brihat Parashara Hora Shastra ch. 27 and the working rules in
 * B. V. Raman's "Graha and Bhava Balas".
 *
 * Every value is in virupas (shashtiamsas); 60 virupas = 1 rupa.
 * Only the seven visible grahas take Shadbala. Rahu and Ketu are left out,
 * as in the classical texts.
 *
 * Where the tradition offers more than one reading, the choice made here is
 * written next to the code. The module is pure: the engine gathers the
 * astronomy (declinations, heliocentric longitudes, sunrise) and hands it in.
 */
import { EXALTATION, MOOLATRIKONA, NATURAL_FRIENDS, OWN_SIGNS, SIGN_LORDS } from './constants';
import type { GrahaId, HouseNumber, SignNumber } from './types';
import { VARGAS } from './vargas';
import { angularDistance, houseFrom, norm360, signOf } from './zodiac';

export type ShadbalaPlanet = 'sun' | 'moon' | 'mars' | 'mercury' | 'jupiter' | 'venus' | 'saturn';
export const SHADBALA_PLANETS: ShadbalaPlanet[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];

/** BPHS 27: minimum total strength, in rupas, for a planet to count as strong */
export const SHADBALA_REQUIRED_RUPAS: Record<ShadbalaPlanet, number> = {
  sun: 6.5,
  moon: 6,
  mars: 5,
  mercury: 7,
  jupiter: 6.5,
  venus: 5.5,
  saturn: 5,
};

/** BPHS 27: minimums for four of the components, in virupas */
export const SHADBALA_COMPONENT_MINIMUMS: Record<ShadbalaPlanet, { sthana: number; dig: number; kala: number; cheshta: number }> = {
  sun: { sthana: 165, dig: 35, kala: 112, cheshta: 50 },
  moon: { sthana: 133, dig: 50, kala: 100, cheshta: 30 },
  mars: { sthana: 96, dig: 30, kala: 67, cheshta: 40 },
  mercury: { sthana: 165, dig: 35, kala: 112, cheshta: 50 },
  jupiter: { sthana: 165, dig: 35, kala: 112, cheshta: 50 },
  venus: { sthana: 133, dig: 50, kala: 100, cheshta: 30 },
  saturn: { sthana: 96, dig: 30, kala: 67, cheshta: 40 },
};

/** Naisargika (natural) strength: 60 × k / 7 in the order of luminosity */
export const NAISARGIKA_BALA: Record<ShadbalaPlanet, number> = {
  sun: 60,
  moon: (60 * 6) / 7,
  venus: (60 * 5) / 7,
  jupiter: (60 * 4) / 7,
  mercury: (60 * 3) / 7,
  mars: (60 * 2) / 7,
  saturn: 60 / 7,
};

/** The seven vargas of Saptavargaja Bala */
export const SAPTAVARGA = ['D1', 'D2', 'D3', 'D7', 'D9', 'D12', 'D30'] as const;
export type SaptavargaId = (typeof SAPTAVARGA)[number];

export type VargaRelation =
  | 'moolatrikona'
  | 'own'
  | 'great_friend'
  | 'friend'
  | 'neutral'
  | 'enemy'
  | 'great_enemy';

const RELATION_VIRUPAS: Record<VargaRelation, number> = {
  moolatrikona: 45,
  own: 30,
  great_friend: 22.5,
  friend: 15,
  neutral: 7.5,
  enemy: 3.75,
  great_enemy: 1.875,
};

// ---------------------------------------------------------------- input / output

export interface StrengthPlanetInput {
  /** Sidereal longitude */
  longitude: number;
  /** Ecliptic latitude, degrees (decides planetary war) */
  latitude: number;
  /**
   * Kranti (declination) of the planet's ecliptic point, degrees, north positive
   * (Ayana Bala). Classical tables use the tropical longitude only, not latitude.
   */
  declination: number;
  /** Tropical (sayana) longitude, for the Sun's cheshta kendra */
  tropicalLongitude: number;
  /** Sidereal heliocentric longitude (Cheshta Bala); unused for Sun and Moon */
  helioLongitude?: number;
}

export interface StrengthInput {
  planets: Record<ShadbalaPlanet, StrengthPlanetInput>;
  /** Signs of Rahu/Ketu, only to decide whether Mercury is joined by malefics */
  nodeSigns?: SignNumber[];
  ascendant: number;
  midheaven: number;
  /** Bhava madhya (mid-point) longitudes, index 0 = house 1 */
  bhavaMadhya: number[];
  /** Sign of each house, index 0 = house 1 */
  houseSigns: SignNumber[];
  jdUt: number;
  /** Sunrise that starts the Vedic day of birth, and the sunset and sunrise after it (JD UT) */
  sunrise: number;
  sunset: number;
  nextSunrise: number;
  /** Local apparent solar time at birth, hours 0–24 (0 = midnight) */
  apparentSolarHours: number;
  /** Julian Day Number of the civil date the Vedic day began on (for Ahargana) */
  vedicDayNumber: number;
}

export interface SthanaBala {
  uchcha: number;
  saptavargaja: number;
  ojayugma: number;
  kendradi: number;
  drekkana: number;
  total: number;
  /** Relationship with the sign lord in each of the seven vargas */
  vargas: Record<SaptavargaId, { sign: SignNumber; relation: VargaRelation; virupas: number }>;
}

export interface KalaBala {
  natonnata: number;
  paksha: number;
  tribhaga: number;
  abda: number;
  masa: number;
  vara: number;
  hora: number;
  ayana: number;
  yuddha: number;
  total: number;
}

export interface ShadbalaEntry {
  planet: ShadbalaPlanet;
  sthana: SthanaBala;
  dig: number;
  kala: KalaBala;
  /**
   * Motional strength. For the Sun and Moon it is shown for reference (and used in
   * Ishta/Kashta Phala) but not added again: BPHS doubles their Ayana and Paksha
   * Bala instead, which is how their cheshta enters the total.
   */
  cheshta: number;
  /** false for the Sun and Moon, see `cheshta` */
  cheshtaCounted: boolean;
  naisargika: number;
  drik: number;
  /** Sum of the six, virupas */
  total: number;
  /** total / 60 */
  rupas: number;
  requiredRupas: number;
  /** rupas / requiredRupas; 1 or more means the planet meets the classical minimum */
  ratio: number;
  strong: boolean;
  /** 1 = strongest by ratio */
  rank: number;
  /** Which of the four component minimums are met */
  componentMinimums: { sthana: boolean; dig: boolean; kala: boolean; cheshta: boolean };
  /** Ishta Phala (capacity for good) and Kashta Phala (for harm), 0–60 */
  ishtaPhala: number;
  kashtaPhala: number;
  /** In a planetary war at birth: who with, and whether this planet won */
  war?: { with: ShadbalaPlanet; won: boolean };
}

export interface ShadbalaContext {
  dayBirth: boolean;
  /** Within 24 minutes (one ghati) of sunrise or sunset */
  twilight: boolean;
  abdaLord: ShadbalaPlanet;
  masaLord: ShadbalaPlanet;
  varaLord: ShadbalaPlanet;
  horaLord: ShadbalaPlanet;
  /** Days since the start of Kali Yuga */
  ahargana: number;
  /** Moon's elongation from the Sun, 0–360 */
  moonElongation: number;
  mercuryBenefic: boolean;
}

export interface Shadbala {
  planets: Record<ShadbalaPlanet, ShadbalaEntry>;
  /** Strongest first, by ratio to the required minimum */
  order: ShadbalaPlanet[];
  context: ShadbalaContext;
}

export interface BhavaBalaEntry {
  house: HouseNumber;
  sign: SignNumber;
  lord: ShadbalaPlanet;
  /** Shadbala total of the house lord */
  adhipati: number;
  dig: number;
  drishti: number;
  total: number;
  rupas: number;
  /** 1 = strongest house */
  rank: number;
  signType: 'nara' | 'jalachara' | 'keeta' | 'chatushpada';
}

export interface ChartStrength {
  shadbala: Shadbala;
  /** Index 0 = house 1 */
  bhavaBala: BhavaBalaEntry[];
}

// ---------------------------------------------------------------- helpers

/** Disc diameters (Surya Siddhanta, via Raman) used to scale Yuddha Bala */
const DISC_DIAMETER: Record<ShadbalaPlanet, number> = {
  sun: 0,
  moon: 0,
  mars: 9.4,
  mercury: 6.6,
  jupiter: 190.4,
  venus: 16.6,
  saturn: 158,
};

/** Weekday lords, 0 = Sunday */
const WEEKDAY_LORDS: ShadbalaPlanet[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];
/** Chaldean order for planetary hours */
const HORA_ORDER: ShadbalaPlanet[] = ['sun', 'venus', 'mercury', 'moon', 'saturn', 'jupiter', 'mars'];
/**
 * Day count origin for Ahargana. Kali Yuga began at the midnight that opened
 * Friday 18 Feb 3102 BCE (JDN 588466); counting days inclusively, as Raman's
 * worked example does, puts day 0 on the Thursday before.
 */
export const KALI_EPOCH_JDN = 588465;

const weekdayOfJdn = (jdn: number) => (((jdn + 1) % 7) + 7) % 7;

/** BPHS drishti (aspect value, 0–60) of a planet onto a point `d` degrees ahead of it */
export function drishtiValue(from: ShadbalaPlanet, d: number): number {
  d = norm360(d);
  let v: number;
  if (d < 30) v = 0;
  else if (d < 60) v = (d - 30) / 2;
  else if (d < 90) v = d - 60 + 15;
  else if (d < 120) v = (120 - d) / 2 + 30;
  else if (d < 150) v = 150 - d;
  else if (d < 180) v = (d - 150) * 2;
  else if (d < 300) v = (300 - d) / 2;
  else v = 0;
  // Special aspects: Mars 4th and 8th, Jupiter 5th and 9th, Saturn 3rd and 10th
  if (from === 'mars' && ((d >= 90 && d < 120) || (d >= 210 && d < 240))) v += 15;
  if (from === 'jupiter' && ((d >= 120 && d < 150) || (d >= 240 && d < 270))) v += 30;
  if (from === 'saturn' && ((d >= 60 && d < 90) || (d >= 270 && d < 300))) v += 45;
  return v;
}

/** Compound (panchadha) relationship of `planet` toward `lord`, temporal part from D1 signs */
function compound(planet: ShadbalaPlanet, lord: GrahaId, d1Sign: (g: GrahaId) => SignNumber): VargaRelation {
  const r = NATURAL_FRIENDS[planet];
  const natural = r.friends.includes(lord) ? 1 : r.enemies.includes(lord) ? -1 : 0;
  const dist = houseFrom(d1Sign(planet), d1Sign(lord));
  const temporal = [2, 3, 4, 10, 11, 12].includes(dist) ? 1 : -1;
  return (['great_enemy', 'enemy', 'neutral', 'friend', 'great_friend'] as const)[natural + temporal + 2];
}

/** Bhava dig bala sign class. Sagittarius and Capricorn change class at 15°. */
function signClass(lon: number): BhavaBalaEntry['signType'] {
  const s = signOf(lon);
  const firstHalf = norm360(lon) % 30 < 15;
  if ([3, 6, 7, 11].includes(s) || (s === 9 && firstHalf)) return 'nara';
  if ([4, 12].includes(s) || (s === 10 && !firstHalf)) return 'jalachara';
  if (s === 8) return 'keeta';
  return 'chatushpada';
}

const STRONG_HOUSE: Record<BhavaBalaEntry['signType'], number> = { nara: 1, jalachara: 4, keeta: 7, chatushpada: 10 };

const round = (x: number, p = 2) => Math.round(x * 10 ** p) / 10 ** p;

// ---------------------------------------------------------------- Shadbala

export function computeStrength(input: StrengthInput): ChartStrength {
  const P = input.planets;
  const d1Sign = (g: GrahaId) => signOf(P[g as ShadbalaPlanet].longitude);
  const elong = norm360(P.moon.longitude - P.sun.longitude);
  const phase = angularDistance(P.moon.longitude, P.sun.longitude); // 0 new … 180 full
  const waxing = elong < 180;

  // Mercury turns malefic when it shares a sign with the Sun, Mars, Saturn or a node
  // and with no Jupiter or Venus (Raman's example counts Mercury with the Sun as malefic).
  const mercSign = d1Sign('mercury');
  const maleficWithMercury =
    [P.sun, P.mars, P.saturn].some((p) => signOf(p.longitude) === mercSign) || (input.nodeSigns ?? []).includes(mercSign);
  const beneficWithMercury = [P.jupiter, P.venus].some((p) => signOf(p.longitude) === mercSign);
  const mercuryBenefic = !maleficWithMercury || beneficWithMercury;
  const isBenefic = (g: ShadbalaPlanet) =>
    g === 'jupiter' || g === 'venus' || (g === 'mercury' && mercuryBenefic) || (g === 'moon' && waxing);

  // Day and night
  const { jdUt, sunrise, sunset, nextSunrise } = input;
  const dayBirth = jdUt >= sunrise && jdUt < sunset;
  const ghati = 24 / 1440; // 24 minutes in days
  const twilight = Math.abs(jdUt - sunrise) < ghati || Math.abs(jdUt - sunset) < ghati || Math.abs(jdUt - nextSunrise) < ghati;

  // Lords of year, month, day and hour
  const ahargana = input.vedicDayNumber - KALI_EPOCH_JDN;
  const abdaLord = WEEKDAY_LORDS[weekdayOfJdn(KALI_EPOCH_JDN + 360 * Math.floor(ahargana / 360))];
  const masaLord = WEEKDAY_LORDS[weekdayOfJdn(KALI_EPOCH_JDN + 30 * Math.floor(ahargana / 30))];
  const weekday = weekdayOfJdn(input.vedicDayNumber);
  const varaLord = WEEKDAY_LORDS[weekday];
  // Horas are one hour each, counted from sunrise, the first ruled by the day lord.
  const horaIndex = Math.max(0, Math.floor((jdUt - sunrise) * 24));
  const horaLord = HORA_ORDER[(HORA_ORDER.indexOf(varaLord) + horaIndex) % 7];

  // Tribhaga: thirds of the day (Mercury, Sun, Saturn) and of the night (Moon, Venus, Mars)
  let tribhagaLord: ShadbalaPlanet;
  if (dayBirth) {
    const third = Math.min(2, Math.floor(((jdUt - sunrise) / (sunset - sunrise)) * 3));
    tribhagaLord = (['mercury', 'sun', 'saturn'] as const)[third];
  } else {
    // The Vedic day starts at the sunrise before birth, so a night birth falls after its sunset.
    const third = Math.max(0, Math.min(2, Math.floor(((jdUt - sunset) / (nextSunrise - sunset)) * 3)));
    tribhagaLord = (['moon', 'venus', 'mars'] as const)[third];
  }

  // Distance of the birth moment from local apparent midnight, 0–12 hours
  const lat = norm360(input.apparentSolarHours * 15) / 15;
  const fromMidnight = lat <= 12 ? lat : 24 - lat;

  const pre: Record<ShadbalaPlanet, Omit<ShadbalaEntry, 'total' | 'rupas' | 'ratio' | 'strong' | 'rank' | 'ishtaPhala' | 'kashtaPhala'>> =
    {} as never;

  for (const g of SHADBALA_PLANETS) {
    const p = P[g];
    const lon = p.longitude;
    const sign = signOf(lon);
    const deg = norm360(lon) % 30;

    // --- Sthana bala
    const ex = EXALTATION[g]!;
    const debPoint = norm360((ex.sign - 1) * 30 + ex.degree + 180);
    const uchcha = angularDistance(lon, debPoint) / 3;

    const vargas = {} as SthanaBala['vargas'];
    let saptavargaja = 0;
    for (const v of SAPTAVARGA) {
      const vs = VARGAS[v].sign(lon);
      let relation: VargaRelation;
      const mt = MOOLATRIKONA[g]!;
      // Moolatrikona counts only in the rasi, by degree; in other vargas the sign counts as own.
      if (v === 'D1' && mt[0] === sign && deg >= mt[1] && deg < mt[2]) relation = 'moolatrikona';
      else if (OWN_SIGNS[g].includes(vs)) relation = 'own';
      else relation = compound(g, SIGN_LORDS[vs - 1], d1Sign);
      vargas[v] = { sign: vs, relation, virupas: RELATION_VIRUPAS[relation] };
      saptavargaja += RELATION_VIRUPAS[relation];
    }

    const navSign = VARGAS.D9.sign(lon);
    const evenLover = g === 'moon' || g === 'venus';
    const ojayugma = ((sign % 2 === 0) === evenLover ? 15 : 0) + ((navSign % 2 === 0) === evenLover ? 15 : 0);

    // Counted by sign from the lagna sign, as in Raman's worked example
    const h = houseFrom(signOf(input.ascendant), sign);
    const kendradi = [1, 4, 7, 10].includes(h) ? 60 : [2, 5, 8, 11].includes(h) ? 30 : 15;

    const decanate = Math.min(2, Math.floor(deg / 10));
    const decanateFor: Record<ShadbalaPlanet, number> = { sun: 0, mars: 0, jupiter: 0, mercury: 1, saturn: 1, moon: 2, venus: 2 };
    const drekkana = decanate === decanateFor[g] ? 15 : 0;

    const sthana: SthanaBala = {
      uchcha,
      saptavargaja,
      ojayugma,
      kendradi,
      drekkana,
      total: uchcha + saptavargaja + ojayugma + kendradi + drekkana,
      vargas,
    };

    // --- Dig bala: distance from the point where the planet is powerless
    const weak =
      g === 'sun' || g === 'mars'
        ? input.midheaven + 180 // strong at MC, weak at IC
        : g === 'jupiter' || g === 'mercury'
          ? input.ascendant + 180 // strong at the ascendant
          : g === 'moon' || g === 'venus'
            ? input.midheaven // strong at IC
            : input.ascendant; // Saturn strong at the descendant
    const dig = angularDistance(lon, weak) / 3;

    // --- Kala bala
    const natonnata = g === 'mercury' ? 60 : g === 'sun' || g === 'jupiter' || g === 'venus' ? fromMidnight * 5 : 60 - fromMidnight * 5;
    let paksha = isBenefic(g) || g === 'moon' ? phase / 3 : (180 - phase) / 3;
    if (g === 'moon') paksha *= 2; // BPHS doubles the Moon's paksha bala
    const tribhaga = g === 'jupiter' || g === tribhagaLord ? 60 : 0;
    const abda = g === abdaLord ? 15 : 0;
    const masa = g === masaLord ? 30 : 0;
    const vara = g === varaLord ? 45 : 0;
    const hora = g === horaLord ? 60 : 0;
    const dec = p.declination;
    const kranti = g === 'moon' || g === 'saturn' ? -dec : g === 'mercury' ? Math.abs(dec) : dec;
    let ayana = Math.max(0, Math.min(60, ((24 + kranti) * 60) / 48));
    if (g === 'sun') ayana *= 2; // BPHS doubles the Sun's ayana bala

    // --- Cheshta bala
    let cheshta: number;
    if (g === 'sun') {
      // Raman: cheshta kendra = sayana longitude + 90°
      const ck = norm360(p.tropicalLongitude + 90);
      cheshta = (ck > 180 ? 360 - ck : ck) / 3;
    } else if (g === 'moon') cheshta = phase / 3;
    else {
      // Cheshta kendra = seeghrocha − (mean + true) / 2. The true heliocentric
      // longitude stands in for the mean planet (outer planets) and for the
      // seeghrocha (Mercury, Venus); the Sun stands in for the mean Sun.
      const helio = p.helioLongitude ?? lon;
      const inner = g === 'mercury' || g === 'venus';
      const seeghrocha = inner ? helio : P.sun.longitude;
      const mean = inner ? P.sun.longitude : helio;
      let d = norm360(lon - mean);
      if (d > 180) d -= 360;
      const avg = norm360(mean + d / 2);
      cheshta = angularDistance(seeghrocha, avg) / 3;
    }

    pre[g] = {
      planet: g,
      sthana,
      dig,
      kala: { natonnata, paksha, tribhaga, abda, masa, vara, hora, ayana, yuddha: 0, total: 0 },
      cheshta,
      cheshtaCounted: g !== 'sun' && g !== 'moon',
      naisargika: NAISARGIKA_BALA[g],
      drik: 0,
      requiredRupas: SHADBALA_REQUIRED_RUPAS[g],
      componentMinimums: { sthana: false, dig: false, kala: false, cheshta: false },
    };
  }

  // --- Yuddha: planetary war between Mars, Mercury, Jupiter, Venus, Saturn within 1°
  const kalaSum = (k: KalaBala) => k.natonnata + k.paksha + k.tribhaga + k.abda + k.masa + k.vara + k.hora + k.ayana;
  const warriors: ShadbalaPlanet[] = ['mars', 'mercury', 'jupiter', 'venus', 'saturn'];
  for (let i = 0; i < warriors.length; i++) {
    for (let j = i + 1; j < warriors.length; j++) {
      const a = warriors[i];
      const b = warriors[j];
      if (angularDistance(P[a].longitude, P[b].longitude) >= 1) continue;
      // Raman: the planet with the smaller longitude wins. The difference of
      // (sthana + dig + kala up to hora) is divided by the difference of the
      // discs' diameters and moved from the loser to the winner.
      const ahead = norm360(P[b].longitude - P[a].longitude) < 180; // b is past a
      const [win, lose] = ahead ? [a, b] : [b, a];
      const base = (g: ShadbalaPlanet) =>
        pre[g].sthana.total + pre[g].dig + kalaSum(pre[g].kala) - pre[g].kala.ayana;
      const discs = Math.abs(DISC_DIAMETER[win] - DISC_DIAMETER[lose]) || 1;
      const diff = Math.abs(base(win) - base(lose)) / discs;
      pre[win].kala.yuddha += diff;
      pre[lose].kala.yuddha -= diff;
      pre[win].war = { with: lose, won: true };
      pre[lose].war = { with: win, won: false };
    }
  }

  // --- Drik bala: a quarter of benefic aspects minus a quarter of malefic ones
  for (const g of SHADBALA_PLANETS) {
    let sum = 0;
    for (const q of SHADBALA_PLANETS) {
      if (q === g) continue;
      const v = drishtiValue(q, P[g].longitude - P[q].longitude);
      sum += isBenefic(q) ? v : -v;
    }
    pre[g].drik = sum / 4;
  }

  const entries = {} as Record<ShadbalaPlanet, ShadbalaEntry>;
  for (const g of SHADBALA_PLANETS) {
    const e = pre[g];
    e.kala.total = kalaSum(e.kala) + e.kala.yuddha;
    const total = e.sthana.total + e.dig + e.kala.total + (e.cheshtaCounted ? e.cheshta : 0) + e.naisargika + e.drik;
    const min = SHADBALA_COMPONENT_MINIMUMS[g];
    const uchcha = e.sthana.uchcha;
    entries[g] = {
      ...e,
      total,
      rupas: total / 60,
      ratio: total / 60 / e.requiredRupas,
      strong: total / 60 >= e.requiredRupas,
      rank: 0,
      componentMinimums: {
        sthana: e.sthana.total >= min.sthana,
        dig: e.dig >= min.dig,
        kala: e.kala.total >= min.kala,
        cheshta: e.cheshta >= min.cheshta,
      },
      ishtaPhala: Math.sqrt(uchcha * e.cheshta),
      kashtaPhala: Math.sqrt(Math.max(0, 60 - uchcha) * Math.max(0, 60 - e.cheshta)),
    };
  }
  const order = [...SHADBALA_PLANETS].sort((a, b) => entries[b].ratio - entries[a].ratio);
  order.forEach((g, i) => (entries[g].rank = i + 1));

  // ---------------------------------------------------------------- Bhava Bala
  const bhavaBala: BhavaBalaEntry[] = [];
  for (let i = 0; i < 12; i++) {
    const house = (i + 1) as HouseNumber;
    const madhya = input.bhavaMadhya[i];
    const sign = input.houseSigns[i];
    const lord = SIGN_LORDS[sign - 1] as ShadbalaPlanet;
    const adhipati = entries[lord].total;

    const signType = signClass(madhya);
    const k = norm360((house - STRONG_HOUSE[signType]) * 30) / 30;
    const dig = (6 - Math.min(k, 12 - k)) * 10;

    // A quarter of each aspect, except Jupiter's and Mercury's, which count in
    // full; for houses Mercury is always a full benefic.
    let drishti = 0;
    for (const q of SHADBALA_PLANETS) {
      const v = drishtiValue(q, madhya - P[q].longitude);
      const share = q === 'jupiter' || q === 'mercury' ? v : v / 4;
      drishti += isBenefic(q) || q === 'mercury' ? share : -share;
    }

    const total = adhipati + dig + drishti;
    bhavaBala.push({ house, sign, lord, adhipati, dig, drishti, total, rupas: total / 60, rank: 0, signType });
  }
  [...bhavaBala].sort((a, b) => b.total - a.total).forEach((b, i) => (b.rank = i + 1));

  // Tidy the floats for serialisation
  for (const g of SHADBALA_PLANETS) {
    const e = entries[g];
    for (const k of ['uchcha', 'saptavargaja', 'ojayugma', 'kendradi', 'drekkana', 'total'] as const) e.sthana[k] = round(e.sthana[k]);
    for (const k of Object.keys(e.kala) as (keyof KalaBala)[]) e.kala[k] = round(e.kala[k]);
    e.dig = round(e.dig);
    e.cheshta = round(e.cheshta);
    e.naisargika = round(e.naisargika);
    e.drik = round(e.drik);
    e.total = round(e.total);
    e.rupas = round(e.rupas, 3);
    e.ratio = round(e.ratio, 3);
    e.ishtaPhala = round(e.ishtaPhala);
    e.kashtaPhala = round(e.kashtaPhala);
  }
  for (const b of bhavaBala) {
    b.adhipati = round(b.adhipati);
    b.dig = round(b.dig);
    b.drishti = round(b.drishti);
    b.total = round(b.total);
    b.rupas = round(b.rupas, 3);
  }

  return {
    shadbala: {
      planets: entries,
      order,
      context: {
        dayBirth,
        twilight,
        abdaLord,
        masaLord,
        varaLord,
        horaLord,
        ahargana,
        moonElongation: round(elong),
        mercuryBenefic,
      },
    },
    bhavaBala,
  };
}

