import {
  EXALTATION,
  OWN_SIGNS,
  PLANET_NAMES,
  addSigns,
  angularDistance,
  dignityOf,
  houseFrom,
  jdToIso,
  naturalRelationship,
  norm360,
  signLord,
  signOf,
  vargaSign,
  type BirthPlace,
  type Chart,
  type Engine,
  type GrahaId,
  type SignNumber,
} from '@vedic/engine';
import {
  ASPECT_BY_DISTANCE,
  DEEPTAMSA,
  MUNTHA_QUALITY,
  NATURAL_BENEFICS,
  NATURAL_MALEFICS,
  PANCHA_VARGIYA_MAX,
  SIDEREAL_YEAR_DAYS,
  TAJIKA_PLANETS,
  TRI_RASHI_PATI,
  VIMSHOTTARI_ORDER,
  VIMSHOTTARI_YEARS,
  haddaLord,
  type TajikaPlanet,
} from './constants';
import type {
  LifeArea,
  LocalMoment,
  MuddaPeriod,
  Muntha,
  OfficeBearer,
  OfficeRole,
  PanchaVargiya,
  Saham,
  TajikaAspect,
  TajikaYoga,
  Varshaphal,
  VarshaphalOptions,
  YearLord,
} from './types';

const name = (p: GrahaId) => PLANET_NAMES[p];
const isTajika = (p: GrahaId): p is TajikaPlanet => (TAJIKA_PLANETS as GrahaId[]).includes(p);
const lordOf = (sign: SignNumber) => signLord(sign) as TajikaPlanet;
/** Signed difference a − b folded into (−180, 180] */
const signedDiff = (a: number, b: number) => {
  const d = norm360(a - b);
  return d > 180 ? d - 360 : d;
};

// ----------------------------------------------------------------- solar return

/**
 * Instant (JD UT) when the sidereal Sun returns to `target`, searched from a
 * first guess. Newton steps on the Sun's own speed converge to well under a
 * second of time in three or four iterations.
 */
export function solarReturnJd(
  engine: Engine,
  target: number,
  guessJd: number,
  opts: { ayanamsa?: Chart['meta']['ayanamsa']; nodeType?: Chart['meta']['nodeType'] } = {},
): number {
  let jd = guessJd;
  for (let i = 0; i < 30; i++) {
    const { longitude, speed } = engine.longitudeAt('sun', jd, opts);
    const diff = signedDiff(target, longitude);
    if (Math.abs(diff) < 1e-8) break;
    jd += diff / (speed > 0.5 ? speed : 0.9856);
  }
  return jd;
}

/**
 * Local civil date and time of a UTC instant in an IANA zone. Before standard
 * time, when the zone's offset is some city's mean time, the place's own Local
 * Mean Time is used, matching how the engine reads birth times.
 */
export function localMoment(utcIso: string, timezone: string, placeLongitude?: number): LocalMoment {
  const d = new Date(utcIso);
  const zoned = zonedParts(d, timezone);
  if (placeLongitude !== undefined && Math.abs(zoned.utcOffsetMinutes % 15) > 0) {
    const offset = placeLongitude * 4;
    const t = new Date(Math.round(d.getTime() / 1000) * 1000 + offset * 60000).toISOString();
    return { date: t.slice(0, 10), time: t.slice(11, 19), timezone, utcOffsetMinutes: offset };
  }
  return zoned;
}

function zonedParts(d: Date, timezone: string): LocalMoment {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}:${parts.second}`;
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const utcOffsetMinutes = Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
  return { date, time, timezone, utcOffsetMinutes };
}

// ----------------------------------------------------------------- strength

const RELATION_SHARE = { own: 1, friend: 0.5, neutral: 0.25, enemy: 0.125 } as const;
function share(planet: TajikaPlanet, lord: TajikaPlanet) {
  if (planet === lord) return RELATION_SHARE.own;
  return RELATION_SHARE[naturalRelationship(planet, lord)];
}

/**
 * Pancha-vargiya bala, the five-fold Tajika strength: sign (30), exaltation
 * (20), hadda (15), drekkana (10) and navamsa (5), summed and divided by 4.
 * Friendship uses the natural (naisargika) relationships.
 */
export function panchaVargiya(planet: TajikaPlanet, longitude: number): PanchaVargiya {
  const sign = signOf(longitude);
  const deg = norm360(longitude) - (sign - 1) * 30;
  const kshetra = PANCHA_VARGIYA_MAX.kshetra * (OWN_SIGNS[planet].includes(sign) ? 1 : share(planet, lordOf(sign)));
  const ex = EXALTATION[planet]!;
  const exLon = (ex.sign - 1) * 30 + ex.degree;
  const uchcha = PANCHA_VARGIYA_MAX.uchcha * (1 - angularDistance(longitude, exLon) / 180);
  const hl = haddaLord(sign, deg);
  const hadda = PANCHA_VARGIYA_MAX.hadda * share(planet, hl);
  const d3 = vargaSign(longitude, 'D3');
  const drekkana = PANCHA_VARGIYA_MAX.drekkana * (OWN_SIGNS[planet].includes(d3) ? 1 : share(planet, lordOf(d3)));
  const d9 = vargaSign(longitude, 'D9');
  const navamsa = PANCHA_VARGIYA_MAX.navamsa * (OWN_SIGNS[planet].includes(d9) ? 1 : share(planet, lordOf(d9)));
  const raw = kshetra + uchcha + hadda + drekkana + navamsa;
  const total = raw / 4;
  const grade = total >= 15 ? 'full' : total >= 10 ? 'medium' : total >= 5 ? 'little' : 'none';
  return { planet, kshetra, uchcha, hadda, drekkana, navamsa, raw, total, grade, haddaLord: hl };
}

// ----------------------------------------------------------------- aspects

interface Body { id: TajikaPlanet; longitude: number; sign: SignNumber; deg: number; speed: number }

function aspectBetween(A: Body, B: Body): TajikaAspect | null {
  const distance = houseFrom(A.sign, B.sign);
  const kind = ASPECT_BY_DISTANCE[distance];
  const orb = (DEEPTAMSA[A.id] + DEEPTAMSA[B.id]) / 2;
  const [f, s] = Math.abs(A.speed) >= Math.abs(B.speed) ? [A, B] : [B, A];
  if (!kind) {
    // Bhavishyat (future) Ithasala: the quicker planet is about to cross into a sign
    // that aspects the slower one, and the degree gap across the boundary is within orb.
    if (f.speed <= 0 || f.speed <= s.speed) return null;
    const nd = houseFrom(addSigns(f.sign, 1), s.sign);
    const nk = ASPECT_BY_DISTANCE[nd];
    const gap = 30 - f.deg + s.deg;
    if (!nk || gap > orb || s.deg > f.deg) return null;
    return {
      a: A.id, b: B.id, kind: nk, distance, gap, orb, withinOrb: true, faster: f.id,
      applying: true, relation: 'ithasala', phase: 'bhavishyat',
    };
  }
  const gapSigned = s.deg - f.deg;
  const gap = Math.abs(gapSigned);
  const rate = s.speed - f.speed;
  const applying = gap < 1e-9 ? true : gapSigned * rate < 0;
  const withinOrb = gap <= orb;
  const relation = !withinOrb ? 'none' : applying ? 'ithasala' : 'ishrafa';
  return {
    a: A.id, b: B.id, kind, distance, gap, orb, withinOrb, faster: f.id, applying, relation,
    phase: relation === 'ithasala' ? (gap <= 1 ? 'purna' : 'vartamana') : undefined,
  };
}

/** Tajika aspect from a planet's sign onto a sign (conjunction counts) */
const aspectsSign = (from: SignNumber, to: SignNumber) => ASPECT_BY_DISTANCE[houseFrom(from, to)] !== undefined;

// ----------------------------------------------------------------- sahams

type Pt = 'sun' | 'moon' | 'mars' | 'mercury' | 'jupiter' | 'venus' | 'saturn' | 'asc' | 'punya' | 'lagnaLord' | 'cusp2' | 'lord2' | 'cusp9' | 'lord9' | 'sunSignLord' | 'moonSignLord';
interface SahamDef {
  id: string; name: string; sanskrit: string; signifies: string;
  day: [Pt, Pt, Pt];
  /** Swap the first two at night */
  reverse: boolean;
  /** Night formula when it is not a simple swap */
  night?: [Pt, Pt, Pt];
}
const PT_LABEL: Record<Pt, string> = {
  sun: 'Sun', moon: 'Moon', mars: 'Mars', mercury: 'Mercury', jupiter: 'Jupiter', venus: 'Venus', saturn: 'Saturn',
  asc: 'Lagna', punya: 'Punya Saham', lagnaLord: 'Lagna lord', cusp2: '2nd cusp', lord2: '2nd lord', cusp9: '9th cusp', lord9: '9th lord',
  sunSignLord: "lord of the Sun's sign", moonSignLord: "lord of the Moon's sign",
};
export const SAHAM_DEFS: SahamDef[] = [
  { id: 'punya', name: 'Fortune', sanskrit: 'Punya', signifies: 'good fortune, merit and the general luck of the year', day: ['moon', 'sun', 'asc'], reverse: true },
  { id: 'vidya', name: 'Learning', sanskrit: 'Vidya', signifies: 'study, skills and examinations', day: ['sun', 'moon', 'asc'], reverse: true },
  { id: 'yashas', name: 'Fame', sanskrit: 'Yashas', signifies: 'reputation, recognition and credit for your work', day: ['jupiter', 'punya', 'asc'], reverse: true },
  { id: 'mitra', name: 'Friends', sanskrit: 'Mitra', signifies: 'friends, allies and helpful contacts', day: ['jupiter', 'punya', 'venus'], reverse: true },
  { id: 'mahatmya', name: 'Greatness', sanskrit: 'Mahatmya', signifies: 'dignity, standing and acts that earn respect', day: ['punya', 'mars', 'asc'], reverse: true },
  { id: 'asha', name: 'Hopes', sanskrit: 'Asha', signifies: 'wishes and the hopes you carry into the year', day: ['saturn', 'venus', 'asc'], reverse: true },
  { id: 'samartha', name: 'Capability', sanskrit: 'Samartha', signifies: 'drive, competence and the power to get things done', day: ['mars', 'lagnaLord', 'asc'], reverse: true },
  { id: 'bhratri', name: 'Siblings', sanskrit: 'Bhratri', signifies: 'brothers, sisters and close peers', day: ['jupiter', 'saturn', 'asc'], reverse: false },
  { id: 'gaurava', name: 'Respect', sanskrit: 'Gaurava', signifies: 'honour, titles and the regard of seniors', day: ['jupiter', 'moon', 'sun'], reverse: true },
  { id: 'pitri', name: 'Father', sanskrit: 'Pitri', signifies: 'the father and paternal figures', day: ['saturn', 'sun', 'asc'], reverse: true },
  { id: 'matri', name: 'Mother', sanskrit: 'Matri', signifies: 'the mother and nurturing at home', day: ['moon', 'venus', 'asc'], reverse: true },
  { id: 'putra', name: 'Children', sanskrit: 'Putra', signifies: 'children, conception and creative offspring', day: ['jupiter', 'moon', 'asc'], reverse: true },
  { id: 'jeeva', name: 'Vitality', sanskrit: 'Jeeva', signifies: 'life force and staying power', day: ['saturn', 'jupiter', 'asc'], reverse: true },
  { id: 'karma', name: 'Work', sanskrit: 'Karma', signifies: 'work, career moves and duties', day: ['mars', 'mercury', 'asc'], reverse: true },
  { id: 'roga', name: 'Illness', sanskrit: 'Roga', signifies: 'health matters that ask for care', day: ['asc', 'moon', 'asc'], reverse: false },
  { id: 'kali', name: 'Strife', sanskrit: 'Kali', signifies: 'quarrels, rivals and contests', day: ['jupiter', 'mars', 'asc'], reverse: true },
  { id: 'vivaha', name: 'Marriage', sanskrit: 'Vivaha', signifies: 'marriage, engagement and committed partnership', day: ['venus', 'saturn', 'asc'], reverse: false },
  { id: 'artha', name: 'Wealth', sanskrit: 'Artha', signifies: 'money, savings and possessions', day: ['cusp2', 'lord2', 'asc'], reverse: false },
  { id: 'paradesa', name: 'Travel abroad', sanskrit: 'Paradesa', signifies: 'long journeys and time in other lands', day: ['cusp9', 'lord9', 'asc'], reverse: false },
  { id: 'karyasiddhi', name: 'Success', sanskrit: 'Karyasiddhi', signifies: 'whether undertakings reach completion', day: ['saturn', 'sun', 'sunSignLord'], reverse: false, night: ['saturn', 'moon', 'moonSignLord'] },
];

/**
 * A − B + C. When C does not fall between B and A (counting forward from B),
 * one sign (30°) is added, as Tajika Neelakanthi prescribes.
 */
export function sahamLongitude(a: number, b: number, c: number): { longitude: number; addedSign: boolean } {
  const between = norm360(c - b) < norm360(a - b);
  const longitude = norm360(a - b + c + (between ? 0 : 30));
  return { longitude, addedSign: !between };
}

// ----------------------------------------------------------------- mudda dasha

/**
 * Mudda (Vimshottari varsha) dasha: the nine Vimshottari periods compressed
 * into one solar year, starting from the lord of the nakshatra `age` places
 * on from the birth star, with the same elapsed fraction as the natal dasha.
 */
export function muddaDasha(natal: Chart, age: number, startJd: number, endJd: number): MuddaPeriod[] {
  const yearLen = endJd - startJd;
  const startIdx = (VIMSHOTTARI_ORDER.indexOf(natal.dasha.startLord) + age) % 9;
  const len = (l: GrahaId) => (yearLen * VIMSHOTTARI_YEARS[l]) / 120;
  const first = VIMSHOTTARI_ORDER[startIdx];
  let t = startJd - natal.dasha.elapsedFraction * len(first);
  const out: MuddaPeriod[] = [];
  const clip = (lord: GrahaId, level: 1 | 2, a: number, b: number): MuddaPeriod | null => {
    const s = Math.max(a, startJd);
    const e = Math.min(b, endJd);
    if (e - s < 1e-6) return null;
    return { lord, level, start: jdToIso(s), end: jdToIso(e), startJd: s, endJd: e, days: e - s };
  };
  for (let i = 0; i < 10 && t < endJd; i++) {
    const lord = VIMSHOTTARI_ORDER[(startIdx + i) % 9];
    const L = len(lord);
    const p = clip(lord, 1, t, t + L);
    if (p) {
      const kids: MuddaPeriod[] = [];
      let u = t;
      const li = VIMSHOTTARI_ORDER.indexOf(lord);
      for (let j = 0; j < 9; j++) {
        const sub = VIMSHOTTARI_ORDER[(li + j) % 9];
        const sl = (L * VIMSHOTTARI_YEARS[sub]) / 120;
        const c = clip(sub, 2, u, u + sl);
        if (c) kids.push(c);
        u += sl;
      }
      p.children = kids;
      out.push(p);
    }
    t += L;
  }
  return out;
}

// ----------------------------------------------------------------- main

const ROLE_LABEL: Record<OfficeRole, string> = {
  janma_lagna_lord: 'Lord of the birth lagna',
  varsha_lagna_lord: 'Lord of the annual lagna',
  muntha_lord: 'Lord of the Muntha',
  tri_rashi_pati: 'Tri-rashi pati',
  dina_ratri_pati: 'Dina-ratri pati',
};

const AREAS: { id: string; name: string; house: number }[] = [
  { id: 'wealth', name: 'Money and savings', house: 2 },
  { id: 'home', name: 'Home, property and vehicles', house: 4 },
  { id: 'children', name: 'Children, romance and studies', house: 5 },
  { id: 'partnership', name: 'Marriage and partnerships', house: 7 },
  { id: 'fortune', name: 'Luck, teachers and long journeys', house: 9 },
  { id: 'career', name: 'Career and status', house: 10 },
  { id: 'gains', name: 'Income and wishes fulfilled', house: 11 },
];

/** Completed years at the start of a calendar year's return */
export function ageForYear(natal: Chart, year: number) {
  return year - Number(natal.meta.input.date.slice(0, 4));
}

/**
 * Cast the Tajika annual chart (Varshaphal) for one year of life.
 * The return is found to a fraction of a second on the engine's own Sun, with
 * the natal chart's ayanamsa and node settings.
 */
export function computeVarshaphal(engine: Engine, natal: Chart, options: VarshaphalOptions = {}): Varshaphal {
  const age = options.age ?? (options.year !== undefined ? ageForYear(natal, options.year) : ageForYear(natal, new Date().getUTCFullYear()));
  if (!Number.isInteger(age) || age < 0) throw new Error('The annual chart needs a whole number of completed years, from 0 up');
  const eo = { ayanamsa: natal.meta.ayanamsa, nodeType: natal.meta.nodeType };
  const target = natal.planets.sun.longitude;
  const returnJd = age === 0 ? natal.meta.jdUt : solarReturnJd(engine, target, natal.meta.jdUt + age * SIDEREAL_YEAR_DAYS, eo);
  const nextReturnJd = solarReturnJd(engine, target, natal.meta.jdUt + (age + 1) * SIDEREAL_YEAR_DAYS, eo);
  const returnUtc = jdToIso(returnJd);

  const basePlace: BirthPlace = options.place ?? natal.meta.input.place;
  const timezone = basePlace.timezone ?? (options.place ? undefined : natal.meta.timezone);
  const iso = new Date(Math.round((returnJd - 2440587.5) * 86400000)).toISOString();
  const chart = engine.computeChart(
    {
      date: iso.slice(0, 10),
      time: iso.slice(11, 23),
      utcOffsetMinutes: 0,
      name: natal.meta.input.name,
      place: { ...basePlace, timezone },
    },
    {
      ayanamsa: natal.meta.ayanamsa,
      nodeType: natal.meta.nodeType,
      houseSystem: 'whole_sign',
      vargas: ['D1', 'D3', 'D9'],
      dashaLevels: 1,
    },
  );
  const tz = chart.meta.timezone;
  const place = { ...basePlace, timezone: tz };

  // Day or night: the Sun above the horizon sits in the half of the ecliptic from the descendant to the ascendant.
  const ascLon = chart.ascendant.longitude;
  const isDayChart = norm360(chart.planets.sun.longitude - ascLon) >= 180;
  const lagnaSign = chart.ascendant.sign;
  const lagnaLord = lordOf(lagnaSign);
  const house = (s: SignNumber) => houseFrom(lagnaSign, s);

  const bodies = {} as Record<TajikaPlanet, Body>;
  for (const id of TAJIKA_PLANETS) {
    const p = chart.planets[id];
    bodies[id] = { id, longitude: p.longitude, sign: p.sign, deg: p.degreeInSign, speed: p.speed };
  }
  const strengths = {} as Record<TajikaPlanet, PanchaVargiya>;
  for (const id of TAJIKA_PLANETS) strengths[id] = panchaVargiya(id, chart.planets[id].longitude);

  // Muntha: one sign a year from the birth lagna
  const munthaSign = addSigns(natal.ascendant.sign, age);
  const munthaLord = lordOf(munthaSign);
  const muntha: Muntha = {
    sign: munthaSign,
    house: house(munthaSign),
    lord: munthaLord,
    quality: MUNTHA_QUALITY[house(munthaSign)],
    lordHouse: chart.planets[munthaLord].house,
    lordStrength: strengths[munthaLord].total,
    with: (Object.keys(chart.planets) as GrahaId[]).filter((g) => chart.planets[g].sign === munthaSign),
    aspectedByBenefics: NATURAL_BENEFICS.filter((g) => aspectsSign(bodies[g].sign, munthaSign)),
    aspectedByMalefics: NATURAL_MALEFICS.filter((g) => aspectsSign(bodies[g].sign, munthaSign)),
  };

  // The five office-bearers
  const dayNight = isDayChart ? 'day' : 'night';
  const offices: [OfficeRole, TajikaPlanet][] = [
    ['janma_lagna_lord', lordOf(natal.ascendant.sign)],
    ['varsha_lagna_lord', lagnaLord],
    ['muntha_lord', munthaLord],
    ['tri_rashi_pati', TRI_RASHI_PATI[dayNight][lagnaSign - 1]],
    ['dina_ratri_pati', lordOf(isDayChart ? chart.planets.sun.sign : chart.planets.moon.sign)],
  ];
  const officeBearers: OfficeBearer[] = offices.map(([role, planet]) => ({
    role,
    label: ROLE_LABEL[role],
    planet,
    strength: strengths[planet].total,
    aspectsLagna: aspectsSign(bodies[planet].sign, lagnaSign),
  }));
  const yearLord = chooseYearLord(officeBearers, strengths, chart, house, !!options.moonCanRuleYear);

  // Aspects between all pairs
  const aspects: TajikaAspect[] = [];
  for (let i = 0; i < TAJIKA_PLANETS.length; i++)
    for (let j = i + 1; j < TAJIKA_PLANETS.length; j++) {
      const a = aspectBetween(bodies[TAJIKA_PLANETS[i]], bodies[TAJIKA_PLANETS[j]]);
      if (a) aspects.push(a);
    }
  const pair = (x: TajikaPlanet, y: TajikaPlanet) => aspects.find((a) => (a.a === x && a.b === y) || (a.a === y && a.b === x));

  const yogas = findYogas(chart, bodies, aspects, pair, house, { lagnaLord, yearLord: yearLord.planet, munthaLord });
  const areas = AREAS.map((ar) => lifeArea(ar, lordOf(addSigns(lagnaSign, ar.house - 1)), lagnaLord, bodies, strengths, pair));
  for (const ar of areas) {
    if (ar.link === 'nakta' || ar.link === 'yamaya') {
      const via = ar.linkVia!;
      yogas.push({
        id: ar.link,
        name: ar.link === 'nakta' ? 'Nakta' : 'Yamaya',
        tone: 'good',
        planets: [ar.lagnaLord, ar.karyesha, via],
        area: ar.name,
        why: ar.link === 'nakta'
          ? `${name(ar.lagnaLord)} (lagna lord) and ${name(ar.karyesha)} (lord of house ${ar.house}) do not meet, but the quicker ${name(via)} is within orb of both and carries light between them.`
          : `${name(ar.lagnaLord)} (lagna lord) and ${name(ar.karyesha)} (lord of house ${ar.house}) do not meet, but the slower ${name(via)} is within orb of both and gathers their light.`,
        meaning: ar.link === 'nakta'
          ? `${ar.name}: what you want arrives through a go-between, such as an agent, a friend or a colleague, rather than by your own direct effort.`
          : `${ar.name}: an older or more senior person, or an institution, brings the matter together for you.`,
      });
    }
  }

  const ORDER: TajikaYoga['id'][] = ['ikkavala', 'induvara', 'ithasala', 'kamboola', 'nakta', 'yamaya', 'duhphali_kuttha', 'ishrafa', 'radda', 'manau'];
  yogas.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

  // Sahams
  const pt = (p: Pt): number => {
    switch (p) {
      case 'asc': return ascLon;
      case 'punya': return sahamPoint('punya');
      case 'lagnaLord': return chart.planets[lagnaLord].longitude;
      case 'cusp2': return norm360(ascLon + 30);
      case 'cusp9': return norm360(ascLon + 240);
      case 'lord2': return chart.planets[lordOf(addSigns(lagnaSign, 1))].longitude;
      case 'lord9': return chart.planets[lordOf(addSigns(lagnaSign, 8))].longitude;
      case 'sunSignLord': return chart.planets[lordOf(chart.planets.sun.sign)].longitude;
      case 'moonSignLord': return chart.planets[lordOf(chart.planets.moon.sign)].longitude;
      default: return chart.planets[p].longitude;
    }
  };
  const formulaOf = (d: SahamDef): [Pt, Pt, Pt] => {
    if (isDayChart) return d.day;
    if (d.night) return d.night;
    return d.reverse ? [d.day[1], d.day[0], d.day[2]] : d.day;
  };
  function sahamPoint(id: string) {
    const d = SAHAM_DEFS.find((x) => x.id === id)!;
    const [a, b, c] = formulaOf(d);
    return sahamLongitude(pt(a), pt(b), pt(c)).longitude;
  }
  const sahams: Saham[] = SAHAM_DEFS.map((d) => {
    let [a, b, c] = formulaOf(d);
    // Samartha: when Mars itself rules the lagna, the formula becomes Jupiter − Mars + Lagna.
    if (d.id === 'samartha' && lagnaLord === 'mars') {
      const swap = (p: Pt): Pt => (p === 'mars' ? 'jupiter' : p === 'lagnaLord' ? 'mars' : p);
      [a, b, c] = [swap(a), swap(b), swap(c)];
    }
    const r = sahamLongitude(pt(a), pt(b), pt(c));
    const sign = signOf(r.longitude);
    const lord = lordOf(sign);
    const h = house(sign);
    const lordAspects = aspectsSign(bodies[lord].sign, sign);
    const ls = strengths[lord].total;
    const verdict: Saham['verdict'] = ls >= 10 && lordAspects && ![6, 8, 12].includes(h)
      ? 'supported'
      : (ls < 10 && !lordAspects) || ([6, 8, 12].includes(h) && ls < 10) ? 'strained' : 'mixed';
    const label = (p: Pt) => PT_LABEL[p];
    return {
      id: d.id, name: d.name, sanskrit: d.sanskrit, signifies: d.signifies,
      formula: `${label(a)} − ${label(b)} + ${label(c)}`,
      longitude: r.longitude, sign, degreeInSign: r.longitude - (sign - 1) * 30, house: h,
      lord, lordStrength: ls, lordAspects, addedSign: r.addedSign, verdict,
    };
  });

  const mudda = muddaDasha(natal, age, returnJd, nextReturnJd);

  const fromNatalLagna = houseFrom(natal.ascendant.sign, lagnaSign);
  const { score, reasons } = yearScore({ muntha, yearLord, yogas, fromNatalLagna, lagnaLord, pair });

  return {
    age,
    year: new Date(returnUtc).getUTCFullYear(),
    returnJd,
    returnUtc,
    returnLocal: localMoment(returnUtc, tz, place.longitude),
    nextReturnJd,
    nextReturnUtc: jdToIso(nextReturnJd),
    natalSunLongitude: target,
    returnSunLongitude: chart.planets.sun.longitude,
    place,
    chart,
    natal,
    isDayChart,
    lagna: { sign: lagnaSign, degreeInSign: chart.ascendant.degreeInSign, lord: lagnaLord, fromNatalLagna },
    muntha,
    strengths,
    officeBearers,
    yearLord,
    aspects,
    yogas,
    areas,
    sahams,
    mudda,
    score,
    scoreReasons: reasons,
  };
}

function chooseYearLord(
  bearers: OfficeBearer[],
  strengths: Record<TajikaPlanet, PanchaVargiya>,
  chart: Chart,
  house: (s: SignNumber) => number,
  moonCanRule: boolean,
): YearLord {
  const unique = [...new Set(bearers.map((b) => b.planet))];
  const rolesOf = (p: TajikaPlanet) => bearers.filter((b) => b.planet === p).map((b) => b.role);
  const aspecting = unique.filter((p) => bearers.find((b) => b.planet === p)!.aspectsLagna);
  let pool = aspecting.length ? aspecting : unique;
  let moonNote = '';
  if (!moonCanRule && pool.includes('moon')) {
    const rest = pool.filter((p) => p !== 'moon');
    const fallback = unique.filter((p) => p !== 'moon');
    const strongestMoon = pool.every((p) => strengths.moon.total >= strengths[p].total);
    if (rest.length) pool = rest;
    else if (fallback.length) pool = fallback;
    if (strongestMoon && pool[0] !== 'moon') moonNote = ' The Moon scored highest, but Tajika does not give her the lordship of the year, so it passes on.';
  }
  const ranked = [...pool].sort(
    (x, y) => strengths[y].total - strengths[x].total || rolesOf(y).length - rolesOf(x).length,
  );
  const planet = ranked[0];
  const s = strengths[planet];
  const roles = rolesOf(planet);
  const p = chart.planets[planet];
  const reason = aspecting.length
    ? `${aspecting.length === 1 ? 'Only' : 'Of the office-bearers that see the annual lagna,'} ${name(planet)} ${aspecting.length === 1 ? 'of the five office-bearers sees the annual lagna' : `is the strongest at ${s.total.toFixed(1)} of 20`}.${moonNote}`
    : `None of the five office-bearers sees the annual lagna, so the strongest of them, ${name(planet)} at ${s.total.toFixed(1)} of 20, takes the year.${moonNote}`;
  return {
    planet, strength: s.total, grade: s.grade, house: house(p.sign), sign: p.sign, roles, reason,
    retrograde: p.retrograde, combust: p.combust,
  };
}

function lifeArea(
  ar: { id: string; name: string; house: number },
  karyesha: TajikaPlanet,
  lagnaLord: TajikaPlanet,
  bodies: Record<TajikaPlanet, Body>,
  strengths: Record<TajikaPlanet, PanchaVargiya>,
  pair: (x: TajikaPlanet, y: TajikaPlanet) => TajikaAspect | undefined,
): LifeArea {
  const base = { id: ar.id, name: ar.name, house: ar.house, karyesha, lagnaLord };
  const L = name(lagnaLord);
  const K = name(karyesha);
  if (karyesha === lagnaLord) {
    const st = strengths[lagnaLord].total;
    return { ...base, link: 'same_planet', verdict: st >= 10 ? 'promising' : 'workable',
      why: `${L} rules both the annual lagna and house ${ar.house}, so this area rests on you, and ${L} is ${st >= 10 ? 'strong enough to carry it' : 'only moderately strong this year'}.` };
  }
  const direct = pair(lagnaLord, karyesha);
  if (direct?.relation === 'ithasala') {
    const exact = direct.phase === 'purna' ? ' almost exactly' : direct.phase === 'bhavishyat' ? ' as it crosses into the next sign' : '';
    return { ...base, link: 'ithasala', verdict: 'promising',
      why: `${name(direct.faster)} is applying${exact} to ${name(direct.faster === lagnaLord ? karyesha : lagnaLord)} (${direct.gap.toFixed(1)}° apart, orb ${direct.orb.toFixed(1)}°): Ithasala between the lagna lord and the lord of house ${ar.house}, the classic sign that the matter comes to pass this year.` };
  }
  // Nakta (transfer by a quicker planet) and Yamaya (collection by a slower one)
  const lSpeed = Math.abs(bodies[lagnaLord].speed);
  const kSpeed = Math.abs(bodies[karyesha].speed);
  for (const c of TAJIKA_PLANETS) {
    if (c === lagnaLord || c === karyesha) continue;
    const a1 = pair(c, lagnaLord);
    const a2 = pair(c, karyesha);
    if (!a1?.withinOrb || !a2?.withinOrb || a1.phase === 'bhavishyat' || a2.phase === 'bhavishyat') continue;
    const cs = Math.abs(bodies[c].speed);
    if (cs > lSpeed && cs > kSpeed) return { ...base, link: 'nakta', linkVia: c, verdict: 'workable',
      why: `${L} and ${K} do not meet, but ${name(c)}, quicker than both, is within orb of each and carries the light between them (Nakta). Expect help from a go-between.` };
    if (cs < lSpeed && cs < kSpeed && a1.applying && a2.applying) return { ...base, link: 'yamaya', linkVia: c, verdict: 'workable',
      why: `${L} and ${K} do not meet, but both apply to the slower ${name(c)}, which gathers their light (Yamaya). A senior person or an institution brings it together.` };
  }
  if (direct?.relation === 'ishrafa') return { ...base, link: 'ishrafa', verdict: 'slow',
    why: `${L} and ${K} are separating (Ishrafa, ${direct.gap.toFixed(1)}° past exact). The moment for this matter has just gone by, so it needs fresh effort or waits for a later year.` };
  if (direct && direct.kind) return { ...base, link: 'aspect', verdict: 'workable',
    why: `${L} and ${K} see each other by a ${direct.kind}, but are ${direct.gap.toFixed(1)}° apart, outside their ${direct.orb.toFixed(1)}° orb. The link is there without urgency, so results follow steady work.` };
  return { ...base, link: 'none', verdict: 'slow',
    why: `${L} (lagna lord) and ${K} (lord of house ${ar.house}) do not aspect each other, and no third planet joins them. This area is quiet this year, not a main theme.` };
}

function findYogas(
  chart: Chart,
  bodies: Record<TajikaPlanet, Body>,
  aspects: TajikaAspect[],
  pair: (x: TajikaPlanet, y: TajikaPlanet) => TajikaAspect | undefined,
  house: (s: SignNumber) => number,
  keys: { lagnaLord: TajikaPlanet; yearLord: TajikaPlanet; munthaLord: TajikaPlanet },
): TajikaYoga[] {
  const out: TajikaYoga[] = [];
  const houses = TAJIKA_PLANETS.map((p) => house(bodies[p].sign));
  if (houses.every((h) => [1, 2, 4, 5, 7, 8, 10, 11].includes(h)))
    out.push({ id: 'ikkavala', name: 'Ikkavala', tone: 'good', planets: [...TAJIKA_PLANETS],
      why: 'All seven planets stand in angles (1, 4, 7, 10) or the houses that follow them (2, 5, 8, 11), and none in the falling houses.',
      meaning: 'A year of rising fortune: plans gain backing, money and standing improve, and effort pays off visibly.' });
  if (houses.every((h) => [3, 6, 9, 12].includes(h)))
    out.push({ id: 'induvara', name: 'Induvara', tone: 'hard', planets: [...TAJIKA_PLANETS],
      why: 'All seven planets stand in the falling houses (3, 6, 9, 12).',
      meaning: 'A year that asks for patience: support is thin, so consolidate, care for health and avoid big gambles.' });

  const keySet = new Set([keys.lagnaLord, keys.yearLord, keys.munthaLord]);
  const roleName = (p: TajikaPlanet) => {
    const r: string[] = [];
    if (p === keys.lagnaLord) r.push('lagna lord');
    if (p === keys.yearLord) r.push('year lord');
    if (p === keys.munthaLord) r.push('Muntha lord');
    return r.length ? `${name(p)} (${r.join(', ')})` : name(p);
  };
  const weak = (p: TajikaPlanet) => {
    const c = chart.planets[p];
    const reasons: string[] = [];
    if (c.retrograde) reasons.push('retrograde');
    if (c.combust) reasons.push('combust');
    if (dignityOf(p, c.longitude) === 'debilitated') reasons.push('debilitated');
    return reasons;
  };
  const dignified = (p: TajikaPlanet) => {
    const d = dignityOf(p, chart.planets[p].longitude);
    return d === 'exalted' || d === 'own' || d === 'moolatrikona';
  };

  for (const a of aspects) {
    if (a.relation === 'none' || (!keySet.has(a.a) && !keySet.has(a.b))) continue;
    const slow = a.faster === a.a ? a.b : a.a;
    if (a.relation === 'ithasala') {
      const phase = a.phase === 'purna' ? 'Purna (exact) ' : a.phase === 'bhavishyat' ? 'Bhavishyat (coming) ' : '';
      out.push({ id: 'ithasala', name: `${phase}Ithasala`, tone: 'good', planets: [a.faster, slow],
        why: `${roleName(a.faster)} is applying to ${roleName(slow)} by ${a.kind}, ${a.gap.toFixed(1)}° apart within a ${a.orb.toFixed(1)}° orb.`,
        meaning: `The matters these two rule move toward completion this year${a.kind === 'square' || a.kind === 'opposition' ? ', though through friction, since the aspect is inimical' : ''}.` });
      const w = [...weak(a.faster).map((r) => `${name(a.faster)} is ${r}`), ...weak(slow).map((r) => `${name(slow)} is ${r}`)];
      if (w.length)
        out.push({ id: 'radda', name: 'Radda', tone: 'hard', planets: [a.faster, slow],
          why: `The Ithasala of ${name(a.faster)} and ${name(slow)} is weakened: ${w.join(' and ')}.`,
          meaning: 'A promise that is made and then falters: agreements may be reversed, so get them in writing and follow through.' });
      if (dignified(slow) && strengthLow(a.faster, chart))
        out.push({ id: 'duhphali_kuttha', name: 'Duhphali-kuttha', tone: 'mixed', planets: [a.faster, slow],
          why: `The slower ${name(slow)} is in its own or exaltation sign while the quicker ${name(a.faster)} is poorly placed.`,
          meaning: 'Success comes, but only because the stronger party carries it; expect to rely on others.' });
      const moonLink = a.faster !== 'moon' && slow !== 'moon' && [pair('moon', a.faster), pair('moon', slow)].some((x) => x?.relation === 'ithasala');
      if (moonLink)
        out.push({ id: 'kamboola', name: 'Kamboola', tone: 'good', planets: [a.faster, slow, 'moon'],
          why: `The Moon also applies to one of the pair, adding her support to the Ithasala of ${name(a.faster)} and ${name(slow)}.`,
          meaning: 'The promise of the Ithasala is strengthened: results come more easily and with goodwill.' });
      for (const m of ['mars', 'saturn'] as TajikaPlanet[]) {
        if (m === a.faster || m === slow) continue;
        const x = pair(m, a.faster);
        if (x && x.withinOrb && (x.kind === 'square' || x.kind === 'opposition'))
          out.push({ id: 'manau', name: 'Manau', tone: 'hard', planets: [a.faster, slow, m],
            why: `${name(m)} throws an inimical ${x.kind} within orb onto ${name(a.faster)}, cutting across the Ithasala.`,
            meaning: 'A rival or an obstacle interferes with what the Ithasala promises; protect the plan from third parties.' });
      }
    } else {
      out.push({ id: 'ishrafa', name: 'Ishrafa', tone: 'mixed', planets: [a.faster, slow],
        why: `${roleName(a.faster)} has passed ${roleName(slow)} by ${a.gap.toFixed(1)}° and is separating (${a.kind}).`,
        meaning: 'What these two rule has peaked or passed: finish old business rather than starting new ventures on it.' });
    }
  }
  return out;
}

function strengthLow(p: TajikaPlanet, chart: Chart) {
  const d = dignityOf(p, chart.planets[p].longitude);
  return d === 'debilitated' || d === 'enemy' || d === 'great_enemy' || chart.planets[p].combust;
}

function yearScore(x: {
  muntha: Muntha;
  yearLord: YearLord;
  yogas: TajikaYoga[];
  fromNatalLagna: number;
  lagnaLord: TajikaPlanet;
  pair: (a: TajikaPlanet, b: TajikaPlanet) => TajikaAspect | undefined;
}) {
  const reasons: { text: string; points: number }[] = [];
  const add = (points: number, text: string) => { if (points) reasons.push({ points, text }); };
  const mq = x.muntha.quality;
  add(mq === 'excellent' ? 20 : mq === 'good' ? 8 : -15, `Muntha in house ${x.muntha.house} (${mq})`);
  add(x.muntha.lordStrength >= 10 ? 6 : -6, `Muntha lord ${name(x.muntha.lord)} ${x.muntha.lordStrength >= 10 ? 'strong' : 'weak'} (${x.muntha.lordStrength.toFixed(1)}/20)`);
  add(Math.min(8, x.muntha.aspectedByBenefics.length * 3), 'Benefics see the Muntha');
  add(-Math.min(8, x.muntha.aspectedByMalefics.length * 3), 'Malefics see the Muntha');
  const g = x.yearLord.grade;
  add(g === 'full' ? 20 : g === 'medium' ? 8 : g === 'little' ? -6 : -15, `Year lord ${name(x.yearLord.planet)} has ${g} strength (${x.yearLord.strength.toFixed(1)}/20)`);
  if ([6, 8, 12].includes(x.yearLord.house)) add(-8, `Year lord in house ${x.yearLord.house}`);
  else if ([1, 4, 7, 10, 5, 9, 11].includes(x.yearLord.house)) add(5, `Year lord in house ${x.yearLord.house}`);
  if (x.yearLord.combust) add(-6, 'Year lord combust');
  if (x.yearLord.retrograde) add(-4, 'Year lord retrograde');
  if (x.yogas.some((y) => y.id === 'ikkavala')) add(12, 'Ikkavala yoga');
  if (x.yogas.some((y) => y.id === 'induvara')) add(-12, 'Induvara yoga');
  if (x.lagnaLord !== x.yearLord.planet && x.pair(x.lagnaLord, x.yearLord.planet)?.relation === 'ithasala') add(10, 'Ithasala between lagna lord and year lord');
  add(-Math.min(10, x.yogas.filter((y) => y.id === 'radda' || y.id === 'manau').length * 4), 'Broken or obstructed Ithasalas');
  if (x.fromNatalLagna === 8) add(-10, 'Annual lagna is the 8th sign from the birth lagna');
  const score = Math.max(-100, Math.min(100, Math.round(reasons.reduce((s, r) => s + r.points, 0) * 1.4)));
  return { score, reasons };
}

export { isTajika };
