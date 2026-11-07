/**
 * Vimshottari dasha (maha / antar / pratyantar, optionally deeper) with
 * favourability scoring of every period for a given natal chart.
 */
import { type NatalChart, type Planet, type Reason, type Scored } from './types';
import {
  DIGNITY_SCORE, DUSTHANA, KENDRA, NATURAL_BENEFIC, SIGN_LORD, TRIKONA, addDays, dignity, functionalNature, houseFrom, housesRuled, isCombust, ordinal, relation, scored, signOf, signName } from './astro';

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

/** Static strength of a planet as a dasha lord for this chart. */
export function lordStrength(chart: NatalChart, p: Planet): { value: number; reasons: Reason[] } {
  const asc = signOf(chart.ascendant);
  const pos = chart.planets[p];
  const s = signOf(pos.longitude);
  const house = houseFrom(asc, s);
  const reasons: Reason[] = [];

  const dig = dignity(p, pos.longitude);
  if (p === 'Rahu' || p === 'Ketu') {
    const disp = SIGN_LORD[s];
    const dd = dignity(disp, chart.planets[disp].longitude);
    reasons.push({ weight: DIGNITY_SCORE[dd] * 15, text: `${p} acts like its dispositor ${disp}, which is ${dd}` });
  }
  if (dig !== 'neutral') reasons.push({ weight: DIGNITY_SCORE[dig] * 30, text: `${p} is ${dig} in ${signName(s)}` });

  if (TRIKONA.includes(house) || KENDRA.includes(house)) {
    reasons.push({ weight: house === 1 || TRIKONA.includes(house) ? 16 : 12, text: `placed in the ${ordinal(house)} house (${KENDRA.includes(house) ? 'kendra' : 'trikona'})` });
  } else if (DUSTHANA.includes(house)) {
    const malefic = NATURAL_BENEFIC[p] < 0;
    // Viparita: dusthana lord in dusthana
    const lordsDusthana = housesRuled(p, asc).some((h) => DUSTHANA.includes(h));
    if (lordsDusthana) reasons.push({ weight: 4, text: `dusthana lord in the ${ordinal(house)}: Viparita-style results (gain after difficulty)` });
    else reasons.push({ weight: malefic && house === 6 ? 2 : -18, text: `placed in the ${ordinal(house)} house (dusthana)` });
  } else if (house === 3 || house === 11) {
    reasons.push({ weight: NATURAL_BENEFIC[p] < 0 ? 10 : 6, text: `placed in the ${ordinal(house)} house (upachaya, grows over time)` });
  } else if (house === 2) {
    reasons.push({ weight: 4, text: 'placed in the 2nd house (resources)' });
  }

  const fn = functionalNature(p, asc);
  if (Math.abs(fn.value) > 0.05) reasons.push({ weight: fn.value * 28, text: `functionally ${fn.value > 0 ? 'benefic' : 'malefic'} for ${signName(asc)} lagna: ${fn.note}` });
  reasons.push({ weight: NATURAL_BENEFIC[p] * 8, text: `natural ${NATURAL_BENEFIC[p] >= 0 ? 'benefic' : 'malefic'}` });

  const retro = pos.speed < 0 && p !== 'Rahu' && p !== 'Ketu';
  if (p !== 'Sun' && isCombust(p, pos.longitude, chart.planets.Sun.longitude, retro)) {
    reasons.push({ weight: -12, text: `combust (too close to the Sun), weakening its results` });
  }
  if (retro) reasons.push({ weight: 3, text: 'retrograde: strong (cheshta bala) but results come in a delayed, revisiting way' });

  // From the Moon too (Chandra lagna), half weight
  const fromMoon = houseFrom(signOf(chart.planets.Moon.longitude), s);
  if (p !== 'Moon') {
    if (DUSTHANA.includes(fromMoon)) reasons.push({ weight: -6, text: `${ordinal(fromMoon)} from the Moon (emotionally taxing)` });
    else if (KENDRA.includes(fromMoon) || TRIKONA.includes(fromMoon)) reasons.push({ weight: 5, text: `${ordinal(fromMoon)} from the Moon (supportive to the mind)` });
  }
  const value = reasons.reduce((a, r) => a + r.weight, 0);
  return { value, reasons };
}

function themesFor(chart: NatalChart, p: Planet): DashaPeriod['themes'] {
  const asc = signOf(chart.ascendant);
  const occ = houseFrom(asc, signOf(chart.planets[p].longitude));
  const out: DashaPeriod['themes'] = [{ house: occ, topic: HOUSE_TOPICS[occ], via: 'occupies' }];
  for (const h of housesRuled(p, asc)) if (h !== occ) out.push({ house: h, topic: HOUSE_TOPICS[h], via: 'rules' });
  return out;
}

/** Relationship between a sub-period lord and its parent lord. */
function pairReasons(chart: NatalChart, parent: Planet, child: Planet, w: number): Reason[] {
  if (parent === child) return [];
  const a = signOf(chart.planets[parent].longitude), b = signOf(chart.planets[child].longitude);
  const h = houseFrom(a, b);
  const out: Reason[] = [];
  if ([6, 8, 12].includes(h)) out.push({ weight: -14 * w, text: `${child} sits ${ordinal(h)} from ${parent} (shadashtaka/dwirdwadasha friction)` });
  else if ([1, 5, 9].includes(h)) out.push({ weight: 10 * w, text: `${child} is ${h === 1 ? 'conjunct' : `${ordinal(h)} (trine) from`} ${parent}: they cooperate` });
  else if ([4, 7, 10].includes(h)) out.push({ weight: 6 * w, text: `${child} is ${ordinal(h)} (kendra) from ${parent}: supportive` });
  else if ([3, 11].includes(h)) out.push({ weight: 4 * w, text: `${child} is ${ordinal(h)} from ${parent}: steady effort brings gains` });
  const rel = relation(parent, child);
  if (rel === 'enemy') out.push({ weight: -7 * w, text: `${parent} and ${child} are natural enemies` });
  else if (rel === 'friend') out.push({ weight: 5 * w, text: `${parent} and ${child} are natural friends` });
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
