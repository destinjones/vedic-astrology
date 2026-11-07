/**
 * Vimshottari dasha (maha / antar / pratyantar, optionally deeper) with
 * favourability scoring of every period for a given natal chart.
 */
import { type NatalChart, type Planet, type Reason, type Scored } from './types';
import { DUSTHANA, EXALTATION, NATURAL_BENEFIC, SIGN_LORD, addDays, houseFrom, housesRuled, isCombust, ordinal, scored, signOf, signName } from './astro';
import {
  AVASTHA_FACTOR, COMPOUND_SCORE, baladiAvastha, compoundDignity, compoundRelation, lordship, moonIsWaxing, neechaBhanga, sambandha, type Lordship,
} from './classical';
import { PLANETS } from './types';

export const DASHA_ORDER: Planet[] = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
export const DASHA_YEARS: Record<Planet, number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};
/** Days per dasha year; matches the engine default (365.2425). Some traditions use 365.25 or 360. */
export const DEFAULT_YEAR_DAYS = 365.2425;

export const HOUSE_TOPICS: Record<number, string> = {
  1: 'self, body, vitality, direction', 2: 'wealth, family, speech, food',
  3: 'courage, siblings, effort, communication', 4: 'home, mother, property, inner peace',
  5: 'children, creativity, intellect, romance', 6: 'health issues, debts, rivals, service',
  7: 'partnership, marriage, clients', 8: 'transformation, crises, hidden matters, inheritance',
  9: 'luck, dharma, teachers, long travel', 10: 'career, status, public action',
  11: 'gains, networks, fulfilment of desires', 12: 'losses, expenses, foreign lands, retreat, moksha',
};

export interface DashaPeriod extends Scored {
  lord: Planet;
  /** Chain of lords from mahadasha down, e.g. ['Saturn','Mercury','Venus']. */
  path: Planet[];
  level: 1 | 2 | 3 | 4 | 5;
  start: Date;
  end: Date;
  /** Life areas activated (houses the lord rules and occupies). */
  themes: { house: number; topic: string; via: 'occupies' | 'rules' }[];
  children?: DashaPeriod[];
}

export interface DashaOptions {
  /** Number of levels to compute (1 maha .. 5 prana). Default 3. */
  depth?: 1 | 2 | 3 | 4 | 5;
  yearDays?: number;
}

const NAK_SPAN = 360 / 27;

export function moonNakshatra(moonLon: number) {
  const idx = Math.floor(moonLon / NAK_SPAN);
  const fraction = (moonLon - idx * NAK_SPAN) / NAK_SPAN;
  return { index: idx, lord: DASHA_ORDER[idx % 9], fraction };
}

/** House placement points from the lagna (BPHS 47-48 dasha results by placement). */
function placementReason(chart: NatalChart, p: Planet, house: number, rules: number[]): Reason | null {
  const malefic = isNaturalMalefic(chart, p);
  if (DUSTHANA.includes(house) && rules.some((h) => DUSTHANA.includes(h)) && !rules.includes(1)) {
    return { weight: 6, text: `lord of a dusthana placed in the ${ordinal(house)} (Viparita Raja Yoga: gain through adversity)` };
  }
  switch (house) {
    case 1: return { weight: 14, text: 'placed in the 1st house (kendra and trikona)' };
    case 4: case 7: return { weight: 10, text: `placed in the ${ordinal(house)} house (kendra)` };
    case 10: return { weight: 14, text: 'placed in the 10th house (strongest kendra)' };
    case 5: case 9: return { weight: 14, text: `placed in the ${ordinal(house)} house (trikona)` };
    case 11: return { weight: 9, text: 'placed in the 11th house (gains, upachaya)' };
    case 3: return { weight: malefic ? 7 : 0, text: `placed in the 3rd house (upachaya${malefic ? ', good for a malefic' : ''})` };
    case 2: return { weight: 3, text: 'placed in the 2nd house (resources)' };
    case 6: return malefic ? { weight: 4, text: 'malefic in the 6th house (upachaya: overcomes rivals)' } : { weight: -10, text: 'benefic in the 6th house (dusthana: health, debts, disputes)' };
    case 8: return { weight: -18, text: 'placed in the 8th house (dusthana: obstacles, sudden change)' };
    case 12: return { weight: -14, text: 'placed in the 12th house (dusthana: loss, expense, withdrawal)' };
  }
  return null;
}

function isNaturalMalefic(chart: NatalChart, p: Planet): boolean {
  if (p === 'Moon') return !moonIsWaxing(chart);
  return NATURAL_BENEFIC[p] < 0;
}

/**
 * Static strength of a planet as a dasha lord for this chart, following the
 * Parashari dasha-results principles (see docs/SCORING.md).
 */
export function lordStrength(chart: NatalChart, p: Planet): { value: number; reasons: Reason[] } {
  const asc = signOf(chart.ascendant);
  const pos = chart.planets[p];
  const s = signOf(pos.longitude);
  const house = houseFrom(asc, s);
  const reasons: Reason[] = [];
  const node = p === 'Rahu' || p === 'Ketu';

  if (node) {
    // BPHS 47: Rahu and Ketu give the results of their dispositor and of the planets they join.
    const disp = SIGN_LORD[s];
    const dd = compoundDignity(chart, disp);
    const dl = lordship(disp, asc, chart);
    reasons.push({ weight: (COMPOUND_SCORE[dd] * 0.5) + dl.value * 15, text: `${p} acts for its dispositor ${disp} (${dd.replace('_', ' ')}, ${dl.notes.join(', ')})` });
    for (const q of PLANETS) {
      if (q === p || q === 'Rahu' || q === 'Ketu' || signOf(chart.planets[q].longitude) !== s) continue;
      const ql = lordship(q, asc, chart);
      reasons.push({ weight: ql.value * 12, text: `${p} is conjunct ${q} (${ql.notes.join(', ')}) and carries its results` });
    }
    if (EXALTATION[p] === s) reasons.push({ weight: 12, text: `${p} exalted in ${signName(s)}` });
    else if (EXALTATION[p] !== undefined && (EXALTATION[p]! + 6) % 12 === s) reasons.push({ weight: -12, text: `${p} debilitated in ${signName(s)}` });
  } else {
    const dig = compoundDignity(chart, p);
    let w = COMPOUND_SCORE[dig];
    let text = `${p} is ${dig.replace('_', ' ')}${['exalted', 'debilitated', 'own', 'moolatrikona'].includes(dig) ? '' : ' (compound relation with its sign lord)'} in ${signName(s)}`;
    if (dig === 'debilitated') {
      const nb = neechaBhanga(chart, p);
      if (nb) { w = -8; text += `, but debilitation is cancelled (neecha bhanga: ${nb})`; }
    }
    if (w !== 0) reasons.push({ weight: w, text });
  }

  const ls = lordship(p, asc, chart);
  const place = placementReason(chart, p, house, ls.houses);
  if (place && place.weight !== 0) reasons.push(place);

  if (!node && Math.abs(ls.value) > 0.05) {
    reasons.push({ weight: ls.value * 30, text: `functionally ${ls.value > 0 ? 'benefic' : 'malefic'} for ${signName(asc)} lagna: ${ls.notes.join(', ')}` });
  }
  const nat = p === 'Moon' ? (moonIsWaxing(chart) ? 0.4 : -0.2) : NATURAL_BENEFIC[p];
  reasons.push({ weight: nat * 8, text: p === 'Moon' ? `${moonIsWaxing(chart) ? 'waxing Moon (natural benefic)' : 'waning Moon (weak, natural malefic)'}` : `natural ${nat >= 0 ? 'benefic' : 'malefic'}` });

  const retro = pos.speed < 0 && !node;
  if (p !== 'Sun' && !node && isCombust(p, pos.longitude, chart.planets.Sun.longitude, retro)) {
    reasons.push({ weight: -10, text: 'combust (too close to the Sun): its results are weakened' });
  }
  if (retro) reasons.push({ weight: 4, text: 'retrograde: strong in motional strength (cheshta bala), results come in a revisiting way' });

  // From the Moon (Chandra lagna), lighter weight
  const fromMoon = houseFrom(signOf(chart.planets.Moon.longitude), s);
  if (p !== 'Moon') {
    if ([6, 8, 12].includes(fromMoon)) reasons.push({ weight: -5, text: `${ordinal(fromMoon)} from the Moon (taxing for the mind)` });
    else if ([1, 4, 5, 7, 9, 10].includes(fromMoon)) reasons.push({ weight: 4, text: `${ordinal(fromMoon)} from the Moon (supports the mind)` });
  }

  // Baladi avastha scales how fully the good can be delivered (BPHS 45).
  if (!node) {
    const av = baladiAvastha(pos.longitude);
    const f = AVASTHA_FACTOR[av];
    if (f < 1) {
      const pos = reasons.filter((r) => r.weight > 0).reduce((a, r) => a + r.weight, 0);
      const cut = -pos * (1 - f) * 0.35;
      if (cut < -0.5) reasons.push({ weight: cut, text: `${AVASTHA_LABEL[av]} avastha (${Math.round(f * 100)}% capacity): good results come only partly` });
    }
  }
  const value = reasons.reduce((a, r) => a + r.weight, 0);
  return { value, reasons };
}

const AVASTHA_LABEL: Record<string, string> = { bala: 'infant (bala)', kumara: 'adolescent (kumara)', yuva: 'adult (yuva)', vriddha: 'old (vriddha)', mrita: 'dead (mrita)' };

function themesFor(chart: NatalChart, p: Planet): DashaPeriod['themes'] {
  const asc = signOf(chart.ascendant);
  const occ = houseFrom(asc, signOf(chart.planets[p].longitude));
  const out: DashaPeriod['themes'] = [{ house: occ, topic: HOUSE_TOPICS[occ], via: 'occupies' }];
  for (const h of housesRuled(p, asc)) if (h !== occ) out.push({ house: h, topic: HOUSE_TOPICS[h], via: 'rules' });
  return out;
}

/**
 * Relationship between a sub-period lord and its parent lord (BPHS 51-56,
 * antardasha results): position counted from the major lord, compound
 * friendship, and sambandha between a kendra lord and a trikona lord (raja yoga).
 */
function pairReasons(chart: NatalChart, parent: Planet, child: Planet, w: number): Reason[] {
  if (parent === child) return [];
  const a = signOf(chart.planets[parent].longitude), b = signOf(chart.planets[child].longitude);
  const h = houseFrom(a, b);
  const out: Reason[] = [];
  if ([6, 8, 12].includes(h)) out.push({ weight: -14 * w, text: `${child} sits ${ordinal(h)} from ${parent} (6/8/12 from the main lord: friction)` });
  else if (h === 1) out.push({ weight: 8 * w, text: `${child} is conjunct ${parent}: they work together` });
  else if ([5, 9].includes(h)) out.push({ weight: 10 * w, text: `${child} is ${ordinal(h)} (trine) from ${parent}: harmonious` });
  else if ([4, 7, 10].includes(h)) out.push({ weight: 7 * w, text: `${child} is ${ordinal(h)} (kendra) from ${parent}: supportive` });
  else if (h === 11) out.push({ weight: 8 * w, text: `${child} is 11th from ${parent}: gains` });
  else if (h === 3) out.push({ weight: 2 * w, text: `${child} is 3rd from ${parent}: effort needed` });
  const rel = compoundRelation(chart, child, parent);
  const rw: Record<string, number> = { great_friend: 8, friend: 4, neutral: 0, enemy: -5, great_enemy: -9 };
  if (rw[rel]) out.push({ weight: rw[rel] * w, text: `${child} is a ${rel.replace('_', ' ')} of ${parent} (natural + temporal relationship)` });
  const asc = signOf(chart.ascendant);
  const lp = lordship(parent, asc, chart), lc = lordship(child, asc, chart);
  const kendra = (l: Lordship) => l.houses.some((x) => [1, 4, 7, 10].includes(x));
  const trikona = (l: Lordship) => l.houses.some((x) => [1, 5, 9].includes(x));
  const rel2 = sambandha(chart, parent, child);
  if (rel2 && ((kendra(lp) && trikona(lc)) || (trikona(lp) && kendra(lc)))) {
    out.push({ weight: (rel2 === 'aspect' ? 8 : 14) * w, text: `${parent} and ${child} link a kendra and a trikona by ${rel2} (raja yoga in this period)` });
  }
  return out;
}

const LEVEL_WEIGHTS: Record<number, number[]> = {
  1: [1], 2: [0.55, 0.45], 3: [0.4, 0.35, 0.25], 4: [0.35, 0.3, 0.2, 0.15], 5: [0.3, 0.27, 0.2, 0.13, 0.1],
};

export function computeVimshottari(chart: NatalChart, opts: DashaOptions = {}): DashaPeriod[] {
  const depth = opts.depth ?? 3;
  const yd = opts.yearDays ?? DEFAULT_YEAR_DAYS;
  const nak = moonNakshatra(chart.planets.Moon.longitude);

  const startIdx = DASHA_ORDER.indexOf(nak.lord);
  const firstElapsedDays = nak.fraction * DASHA_YEARS[nak.lord] * yd;
  let cursor = addDays(chart.birth, -firstElapsedDays);

  const raw = (path: Planet[], start: Date, totalDays: number): RawDasha => {
    const lord = path[path.length - 1];
    const node: RawDasha = { path, start, end: addDays(start, totalDays) };
    if (path.length < depth) {
      node.children = [];
      let c = start;
      const i0 = DASHA_ORDER.indexOf(lord);
      for (let k = 0; k < 9; k++) {
        const sub = DASHA_ORDER[(i0 + k) % 9];
        const d = (totalDays * DASHA_YEARS[sub]) / 120;
        node.children.push(raw([...path, sub], c, d));
        c = addDays(c, d);
      }
    }
    return node;
  };

  const mahas: RawDasha[] = [];
  for (let k = 0; k < 9; k++) {
    const lord = DASHA_ORDER[(startIdx + k) % 9];
    const days = DASHA_YEARS[lord] * yd;
    mahas.push(raw([lord], cursor, days));
    cursor = addDays(cursor, days);
  }
  return scoreDashaTree(chart, mahas);
}

/** An unscored dasha node: what any Vimshottari implementation (e.g. the engine's) can supply. */
export interface RawDasha {
  path: Planet[];
  start: Date;
  end: Date;
  children?: RawDasha[];
}

/** Attach favourability scores, reasons and themes to a dasha tree. */
export function scoreDashaTree(chart: NatalChart, tree: RawDasha[]): DashaPeriod[] {
  const cache = new Map<Planet, ReturnType<typeof lordStrength>>();
  const strength = (p: Planet) => {
    if (!cache.has(p)) cache.set(p, lordStrength(chart, p));
    return cache.get(p)!;
  };
  const score = (node: RawDasha): DashaPeriod => {
    const { path } = node;
    const level = path.length as DashaPeriod['level'];
    const lord = path[path.length - 1];
    const weights = LEVEL_WEIGHTS[level];
    const reasons: Reason[] = [];
    path.forEach((p, i) => {
      for (const r of strength(p).reasons) {
        reasons.push({ weight: r.weight * weights[i], text: level === 1 ? r.text : `[${p}] ${r.text}` });
      }
      if (i > 0) reasons.push(...pairReasons(chart, path[i - 1], p, weights[i] * 1.6));
    });
    const period: DashaPeriod = { ...scored(reasons, 70), lord, path, level, start: node.start, end: node.end, themes: themesFor(chart, lord) };
    if (node.children) period.children = node.children.map(score);
    return period;
  };
  return tree.map(score);
}

/** Flatten to a given level. */
export function flattenDashas(mahas: DashaPeriod[], level: 1 | 2 | 3 | 4 | 5): DashaPeriod[] {
  const out: DashaPeriod[] = [];
  const walk = (p: DashaPeriod) => {
    if (p.level === level) out.push(p);
    else p.children?.forEach(walk);
  };
  mahas.forEach(walk);
  return out;
}

/** The running period chain at an instant, from maha down. */
export function activeDashas(mahas: DashaPeriod[], at: Date): DashaPeriod[] {
  const chain: DashaPeriod[] = [];
  let list: DashaPeriod[] | undefined = mahas;
  while (list) {
    const hit: DashaPeriod | undefined = list.find((p) => p.start <= at && at < p.end);
    if (!hit) break;
    chain.push(hit);
    list = hit.children;
  }
  return chain;
}
