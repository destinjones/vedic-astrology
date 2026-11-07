import {
  DIGNITY_RANK,
  SIGN_LORDS,
  addSigns,
  dignityOf,
  houseFrom,
  jdToIso,
  norm360,
  signOf,
  vargaSign,
  type Chart,
  type GrahaId,
  type SignNumber,
} from '@vedic/engine';
import type {
  ArudhaId,
  ArudhaPada,
  CharaDasha,
  CharaDashaPeriod,
  CharaDashaYears,
  CharaKaraka,
  DualLordChoice,
  JaiminiOptions,
  KarakaId,
  KarakaScheme,
} from './types';

/** The minimum a Jaimini calculation needs: lagna sign, graha longitudes and the birth instant. */
export interface JaiminiInput {
  ascendantSign: SignNumber;
  /** Sidereal longitudes */
  planets: Record<GrahaId, number>;
  /** Birth, Julian day (UT) */
  birthJd: number;
}

const GRAHAS: GrahaId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];

export function inputFromChart(chart: Chart): JaiminiInput {
  const planets = {} as Record<GrahaId, number>;
  for (const g of GRAHAS) planets[g] = chart.planets[g].longitude;
  return { ascendantSign: chart.ascendant.sign, planets, birthJd: chart.meta.jdUt };
}

export const NAME = {
  sign: ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'],
  planet: {
    sun: 'Sun', moon: 'Moon', mars: 'Mars', mercury: 'Mercury', jupiter: 'Jupiter',
    venus: 'Venus', saturn: 'Saturn', rahu: 'Rahu', ketu: 'Ketu',
  } as Record<GrahaId, string>,
};
export const signName = (s: number) => NAME.sign[s - 1];

// ------------------------------------------------------------------ signs

export type SignQuality = 'movable' | 'fixed' | 'dual';
export const signQuality = (s: number): SignQuality => (['movable', 'fixed', 'dual'] as const)[(s - 1) % 3];

/**
 * Savya (odd-footed) signs count forward, apasavya (even-footed) signs count
 * backward. Aries, Taurus, Gemini, Libra, Scorpio and Sagittarius are savya.
 */
export const isSavya = (s: number) => [1, 2, 3, 7, 8, 9].includes(s);

/** Signs counted inclusively from `from` to `to` in a direction, 1–12. */
export function countSigns(from: number, to: number, direction: 'forward' | 'backward'): number {
  return direction === 'forward' ? houseFrom(from, to) : houseFrom(to, from);
}

// ------------------------------------------------------------------ rashi drishti

/**
 * Jaimini rashi drishti (sign aspects). Movable signs aspect the fixed signs
 * except the one next to them; fixed signs aspect the movable signs except the
 * one before them; dual signs aspect the other three dual signs. Planets cast
 * the aspects of the sign they occupy.
 */
export function rashiAspects(sign: number): SignNumber[] {
  const q = signQuality(sign);
  const all = Array.from({ length: 12 }, (_, i) => (i + 1) as SignNumber);
  if (q === 'movable') return all.filter((s) => signQuality(s) === 'fixed' && s !== addSigns(sign, 1));
  if (q === 'fixed') return all.filter((s) => signQuality(s) === 'movable' && s !== addSigns(sign, -1));
  return all.filter((s) => signQuality(s) === 'dual' && s !== sign);
}

export const signAspects = (from: number, to: number) => rashiAspects(from).includes(to as SignNumber);

/** Grahas whose sign aspects `sign` by rashi drishti. */
export function grahasAspecting(input: JaiminiInput, sign: number): GrahaId[] {
  return GRAHAS.filter((g) => signAspects(signOf(input.planets[g]), sign));
}

export const grahasIn = (input: JaiminiInput, sign: number): GrahaId[] =>
  GRAHAS.filter((g) => signOf(input.planets[g]) === sign);

// ------------------------------------------------------------------ lords

const CO_LORD: Partial<Record<number, GrahaId>> = { 8: 'ketu', 11: 'rahu' };

const degIn = (lon: number) => norm360(lon) % 30;

/**
 * Lord of a sign for Jaimini work. Scorpio and Aquarius have two lords
 * (Mars and Ketu, Saturn and Rahu); the stronger is chosen by the usual
 * sequence: a lord sitting in the sign gives way to the other; then the one
 * with more grahas beside it; then the better dignity; then the higher degree.
 */
export function jaiminiLord(input: JaiminiInput, sign: number): DualLordChoice {
  const main = SIGN_LORDS[sign - 1];
  const co = CO_LORD[sign];
  if (!co) return { lord: main };
  const a = main, b = co;
  const sa = signOf(input.planets[a]), sb = signOf(input.planets[b]);
  const inA = sa === sign, inB = sb === sign;
  const both = `${NAME.planet[a]} and ${NAME.planet[b]}`;
  if (inA && !inB) return { lord: b, reason: `${NAME.planet[a]} sits in ${signName(sign)} itself, so ${NAME.planet[b]} rules it here` };
  if (inB && !inA) return { lord: a, reason: `${NAME.planet[b]} sits in ${signName(sign)} itself, so ${NAME.planet[a]} rules it here` };
  if (inA && inB) return { lord: a, reason: `${both} both sit in ${signName(sign)}` };
  const company = (g: GrahaId) => grahasIn(input, signOf(input.planets[g])).length - 1;
  const ca = company(a), cb = company(b);
  if (ca !== cb) {
    const w = ca > cb ? a : b;
    return { lord: w, reason: `${NAME.planet[w]} has more grahas with it than ${NAME.planet[w === a ? b : a]}` };
  }
  const ra = DIGNITY_RANK[dignityOf(a, input.planets[a])], rb = DIGNITY_RANK[dignityOf(b, input.planets[b])];
  if (ra !== rb) {
    const w = ra > rb ? a : b;
    return { lord: w, reason: `${NAME.planet[w]} has the better sign dignity` };
  }
  const w = degIn(input.planets[a]) >= degIn(input.planets[b]) ? a : b;
  return { lord: w, reason: `${both} are otherwise equal, and ${NAME.planet[w]} is further through its sign` };
}

// ------------------------------------------------------------------ chara karakas

export const KARAKA_INFO: Record<KarakaId, { name: string; signifies: string }> = {
  AK: { name: 'Atmakaraka', signifies: 'the self, the soul’s main lesson' },
  AmK: { name: 'Amatyakaraka', signifies: 'career, counsel and the means to act' },
  BK: { name: 'Bhratrikaraka', signifies: 'siblings, courage and teachers' },
  MK: { name: 'Matrikaraka', signifies: 'mother, home, schooling and comfort' },
  PiK: { name: 'Pitrikaraka', signifies: 'father and elders' },
  PK: { name: 'Putrakaraka', signifies: 'children, students and creativity' },
  GK: { name: 'Gnatikaraka', signifies: 'rivals, illness, debts and kin disputes' },
  DK: { name: 'Darakaraka', signifies: 'spouse and close partners' },
};

const ORDER: Record<KarakaScheme, KarakaId[]> = {
  8: ['AK', 'AmK', 'BK', 'MK', 'PiK', 'PK', 'GK', 'DK'],
  7: ['AK', 'AmK', 'BK', 'MK', 'PK', 'GK', 'DK'],
};

/**
 * Chara (movable) karakas: grahas ranked by how far they have travelled
 * through their sign, the furthest becoming Atmakaraka. In the 8-karaka scheme
 * Rahu joins, measured backward (30° minus its degree) because it moves
 * retrograde. Ketu is never a chara karaka.
 */
export function charaKarakas(input: JaiminiInput, scheme: KarakaScheme = 8): CharaKaraka[] {
  const pool: GrahaId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];
  if (scheme === 8) pool.push('rahu');
  const ranked = pool
    .map((planet) => {
      const d = degIn(input.planets[planet]);
      return { planet, degree: planet === 'rahu' ? 30 - d : d };
    })
    .sort((x, y) => y.degree - x.degree);
  return ORDER[scheme].map((id, i) => {
    const r = ranked[i];
    const sign = signOf(input.planets[r.planet]);
    return {
      id,
      ...KARAKA_INFO[id],
      planet: r.planet,
      degree: r.degree,
      sign,
      house: houseFrom(input.ascendantSign, sign),
      margin: i < ranked.length - 1 ? r.degree - ranked[i + 1].degree : Infinity,
    };
  });
}

/** Karakamsa: the navamsa (D9) sign of the Atmakaraka. */
export function karakamsa(input: JaiminiInput, ak: GrahaId): SignNumber {
  return vargaSign(input.planets[ak], 9);
}

// ------------------------------------------------------------------ arudha padas

const PADA_NAMES: Record<ArudhaId, string> = {
  AL: 'Arudha Lagna', A2: 'Dhana pada', A3: 'Vikrama pada', A4: 'Sukha pada', A5: 'Mantra pada',
  A6: 'Shatru pada', A7: 'Dara pada', A8: 'Mrityu pada', A9: 'Bhagya pada', A10: 'Rajya pada',
  A11: 'Labha pada', UL: 'Upapada',
};
const PADA_IDS: ArudhaId[] = ['AL', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'UL'];

/**
 * Arudha pada of a house: count from the house to its lord, then the same
 * number again from the lord. When that lands in the house itself or the 7th
 * from it, the pada moves to the 10th sign from there.
 */
export function arudhaOf(input: JaiminiInput, houseSign: number): Omit<ArudhaPada, 'id' | 'ofHouse' | 'name' | 'house'> {
  const { lord } = jaiminiLord(input, houseSign);
  const lordSign = signOf(input.planets[lord]);
  const n = houseFrom(houseSign, lordSign);
  let sign = addSigns(lordSign, n - 1);
  let exception = false;
  if (sign === houseSign || sign === addSigns(houseSign, 6)) {
    sign = addSigns(sign, 9);
    exception = true;
  }
  return { houseSign: houseSign as SignNumber, lord, lordSign, sign, exception };
}

export function arudhaPadas(input: JaiminiInput): ArudhaPada[] {
  return PADA_IDS.map((id, i) => {
    const houseSign = addSigns(input.ascendantSign, i);
    const a = arudhaOf(input, houseSign);
    return { id, ofHouse: i + 1, name: PADA_NAMES[id], ...a, house: houseFrom(input.ascendantSign, a.sign) };
  });
}

// ------------------------------------------------------------------ chara dasha

export const DEFAULT_YEAR_DAYS = 365.2425;

/**
 * First-cycle years of a sign's chara dasha (K. N. Rao's method): count from
 * the sign to its lord, forward for savya signs and backward for the others,
 * and take one less than the count. A lord in its own sign gives 12 years. An
 * exalted lord adds a year, a debilitated one takes a year away.
 */
export function charaDashaYears(input: JaiminiInput, sign: number): CharaDashaYears {
  const { lord, reason } = jaiminiLord(input, sign);
  const lordSign = signOf(input.planets[lord]);
  const direction = isSavya(sign) ? 'forward' : 'backward';
  const count = countSigns(sign, lordSign, direction);
  let years = count === 1 ? 12 : count - 1;
  const dig = dignityOf(lord, input.planets[lord]);
  const adjustment = count === 1 ? 0 : dig === 'exalted' ? 1 : dig === 'debilitated' ? -1 : 0;
  years = Math.max(1, Math.min(12, years + adjustment));
  return { sign: sign as SignNumber, lord, lordSign, count, direction, adjustment, years, lordReason: reason };
}

export function charaDasha(input: JaiminiInput, opts: JaiminiOptions = {}): CharaDasha {
  const yearDays = opts.yearDays ?? DEFAULT_YEAR_DAYS;
  const span = opts.dashaSpanYears ?? 120;
  const asc = input.ascendantSign;
  const direction = isSavya(addSigns(asc, 8)) ? 'forward' : 'backward';
  const step = direction === 'forward' ? 1 : -1;
  const order = Array.from({ length: 12 }, (_, i) => addSigns(asc, i * step));
  const firstYears = new Map(order.map((s) => [s, charaDashaYears(input, s)]));
  const yearsBySign = order.map((s) => firstYears.get(s)!);

  const periods: CharaDashaPeriod[] = [];
  let jd = input.birthJd;
  const endJd = input.birthJd + span * yearDays;
  for (let cycle = 1; jd < endJd && cycle < 20; cycle++) {
    for (const sign of order) {
      if (jd >= endJd) break;
      const y1 = firstYears.get(sign)!.years;
      const years = cycle % 2 === 1 ? y1 : 12 - y1;
      if (years <= 0) continue;
      const end = jd + years * yearDays;
      const md: CharaDashaPeriod = {
        sign, level: 1, cycle, years, startJd: jd, endJd: end, start: jdToIso(jd), end: jdToIso(end), path: [sign],
      };
      md.children = antardashas(md, yearDays);
      periods.push(md);
      jd = end;
    }
  }
  return { system: 'chara', direction, order, yearsBySign, yearDays, periods };
}

/**
 * Twelve equal antardashas. They start from the sign after the mahadasha
 * sign, forward for savya signs and backward for the others, so the
 * mahadasha sign's own sub-period comes last.
 */
function antardashas(md: CharaDashaPeriod, yearDays: number): CharaDashaPeriod[] {
  const step = isSavya(md.sign) ? 1 : -1;
  const years = md.years / 12;
  const out: CharaDashaPeriod[] = [];
  let jd = md.startJd;
  for (let i = 1; i <= 12; i++) {
    const sign = addSigns(md.sign, i * step);
    const end = i === 12 ? md.endJd : jd + years * yearDays;
    out.push({ sign, level: 2, cycle: md.cycle, years, startJd: jd, endJd: end, start: jdToIso(jd), end: jdToIso(end), path: [md.sign, sign] });
    jd = end;
  }
  return out;
}

export function charaDashaAt(dasha: CharaDasha, when: Date | string = new Date()) {
  const t = +new Date(when);
  const md = dasha.periods.find((p) => +new Date(p.start) <= t && t < +new Date(p.end));
  const ad = md?.children?.find((p) => +new Date(p.start) <= t && t < +new Date(p.end));
  return { mahadasha: md, antardasha: ad };
}
