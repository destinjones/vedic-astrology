/**
 * Life areas and the natal promise for each.
 *
 * Every area points at one of the life-event kinds that the event checker and
 * birth-time rectification already use (`EVENT_SIGNIFICATIONS` in
 * @vedic/timing), so the houses, karakas and the dasha relevance test are the
 * same ones the rest of the app applies.
 */
import { DOSHA_SOURCES, HOUSES, READING_SOURCES, YOGA_SOURCES } from '@vedic/interpretations';
import {
  type LifeEventKind,
  type Planet,
  DUSTHANA,
  EVENT_SIGNIFICATIONS,
  HOUSE_TOPICS,
  KENDRA,
  NATURAL_BENEFIC,
  PLANETS,
  SIGN_LORD,
  TRIKONA,
  aspectedSigns,
  compoundDignity,
  houseFrom,
  lordStrength,
  ordinal,
  signName,
  signOf,
} from '@vedic/timing';
import { citeOf, joinList, type ConsultContext } from './context';

export type PointTone = 'good' | 'mixed' | 'hard';

/** One line an astrologer can read out, with the rule behind it. */
export interface Point {
  text: string;
  tone: PointTone;
  /** Classical source, e.g. "BPHS 36.1–3", where the rule has one. */
  source?: string;
}

export type AreaId = 'career' | 'marriage' | 'money' | 'health' | 'children' | 'home';

export interface LifeArea {
  id: AreaId;
  label: string;
  /** The life-event kind whose houses, karakas and relevance test this area uses. */
  kind: LifeEventKind;
  /** A short caution read before the points, where the topic needs one. */
  caution?: string;
}

/** Kinds whose timing windows are periods to watch rather than to hope for. */
export const WATCH_KINDS: LifeEventKind[] = ['illness', 'separation', 'financial-loss', 'job-loss', 'legal'];

/** Yoga families that speak to a particular area. Nabhasa, lunar and solar yogas describe the whole chart, so they stay in the snapshot. */
const AREA_YOGA_CATEGORIES = new Set(['raja', 'dhana', 'mahapurusha', 'parivartana', 'viparita', 'neecha-bhanga', 'arishta', 'spiritual', 'other']);

export const LIFE_AREAS: LifeArea[] = [
  { id: 'career', label: 'Career', kind: 'job' },
  { id: 'marriage', label: 'Marriage and partnership', kind: 'marriage' },
  { id: 'money', label: 'Money', kind: 'wealth' },
  { id: 'health', label: 'Health', kind: 'illness', caution: 'Read these as areas to look after, not a diagnosis. Anything medical belongs with a doctor.' },
  { id: 'children', label: 'Children', kind: 'childbirth' },
  { id: 'home', label: 'Home and property', kind: 'property' },
];

const DIGNITY_WORD: Record<string, string> = {
  exalted: 'exalted', moolatrikona: 'in its moolatrikona', own: 'in its own sign', great_friend: "in a great friend's sign",
  friend: "in a friend's sign", neutral: 'in a neutral sign', enemy: "in an enemy's sign", great_enemy: "in a great enemy's sign", debilitated: 'debilitated',
};

const placeWord = (h: number) =>
  KENDRA.includes(h) ? 'a kendra, where it can act' : TRIKONA.includes(h) ? 'a trikona, a house of fortune' : DUSTHANA.includes(h) ? 'a dusthana, which strains it' : h === 11 ? 'the house of gains' : 'a neutral house';

const toneFor = (value: number): PointTone => (value >= 12 ? 'good' : value <= -12 ? 'hard' : 'mixed');

/** Sign index of a house counted from the lagna. */
export const houseSign = (ctx: Pick<ConsultContext, 'ascSign'>, house: number) => (ctx.ascSign + house - 1) % 12;

export const houseLord = (ctx: Pick<ConsultContext, 'ascSign'>, house: number): Planet => SIGN_LORD[houseSign(ctx, house)];

/** Planets in a house, whole sign from the lagna. */
export function occupants(ctx: ConsultContext, house: number): Planet[] {
  const s = houseSign(ctx, house);
  return PLANETS.filter((p) => signOf(ctx.natal.planets[p].longitude) === s);
}

/** Planets casting a sign aspect (graha drishti) on a house. */
export function aspecting(ctx: ConsultContext, house: number): Planet[] {
  const s = houseSign(ctx, house);
  return PLANETS.filter((p) => {
    const ps = signOf(ctx.natal.planets[p].longitude);
    return ps !== s && aspectedSigns(p, ps).includes(s);
  });
}

const houseOf = (ctx: ConsultContext, p: Planet) => houseFrom(ctx.ascSign, signOf(ctx.natal.planets[p].longitude));

/** "Venus is exalted in Pisces in your 12th house". */
export function placementPhrase(ctx: ConsultContext, p: Planet): string {
  const s = signOf(ctx.natal.planets[p].longitude);
  const dig = p === 'Rahu' || p === 'Ketu' ? '' : `${DIGNITY_WORD[compoundDignity(ctx.natal, p)]} `;
  return `${p} is ${dig}in ${signName(s)} in your ${ordinal(houseOf(ctx, p))} house`;
}

export interface HouseFacts {
  house: number;
  /** "career, status, public action" */
  topic: string;
  signName: string;
  lord: Planet;
  lordHouse: number;
  occupants: Planet[];
  aspectedBy: Planet[];
  /** Sarvashtakavarga points in the house's sign; 28 is average. */
  sav: number;
}

export function houseFacts(ctx: ConsultContext, house: number): HouseFacts {
  const lord = houseLord(ctx, house);
  return {
    house,
    topic: HOUSE_TOPICS[house],
    signName: signName(houseSign(ctx, house)),
    lord,
    lordHouse: houseOf(ctx, lord),
    occupants: occupants(ctx, house),
    aspectedBy: aspecting(ctx, house),
    sav: ctx.av.sav[houseSign(ctx, house)],
  };
}

const benefic = (p: Planet) => NATURAL_BENEFIC[p] > 0;

/**
 * The natal promise of a life area: the main house's lord, what sits in and
 * aspects the house, the karakas, the house's sarvashtakavarga, and any yoga
 * or dosha that falls on its houses.
 */
export function natalPromise(ctx: ConsultContext, kind: LifeEventKind): Point[] {
  const sig = EVENT_SIGNIFICATIONS[kind];
  if (!sig.houses.length) return [];
  const main = sig.houses[0];
  const f = houseFacts(ctx, main);
  const out: Point[] = [];
  const houseName = HOUSES[main - 1]?.sanskrit ? ` (${HOUSES[main - 1].sanskrit})` : '';

  // the house lord: dignity and placement
  const ls = lordStrength(ctx.natal, f.lord);
  out.push({
    text: `Your ${ordinal(main)}${houseName} lord: ${placementPhrase(ctx, f.lord)}, ${placeWord(f.lordHouse)}.`,
    tone: toneFor(ls.value),
    source: citeOf(READING_SOURCES.houseLord),
  });

  // occupants
  if (f.occupants.length) {
    const good = f.occupants.filter(benefic), bad = f.occupants.filter((p) => !benefic(p));
    const tone: PointTone = good.length && !bad.length ? 'good' : bad.length && !good.length ? 'hard' : 'mixed';
    out.push({ text: `${joinList(f.occupants)} ${f.occupants.length === 1 ? 'sits' : 'sit'} in the ${ordinal(main)} itself, so ${f.occupants.length === 1 ? 'it colours' : 'they colour'} ${f.topic.split(',')[0].trim()} directly.`, tone });
  } else {
    out.push({ text: `The ${ordinal(main)} house is empty, so its lord ${f.lord} carries the topic.`, tone: 'mixed' });
  }

  // aspects
  const aspGood = f.aspectedBy.filter(benefic), aspBad = f.aspectedBy.filter((p) => !benefic(p));
  if (aspGood.includes('Jupiter')) out.push({ text: `Jupiter aspects the ${ordinal(main)}, which protects it.`, tone: 'good', source: citeOf(READING_SOURCES.aspect) });
  if (aspBad.some((p) => p === 'Saturn' || p === 'Mars')) {
    const who = aspBad.filter((p) => p === 'Saturn' || p === 'Mars');
    out.push({ text: `${joinList(who)} ${who.length === 1 ? 'aspects' : 'aspect'} the ${ordinal(main)}: expect pressure and delays before results.`, tone: 'hard', source: citeOf(READING_SOURCES.aspect) });
  }

  // karakas
  for (const k of sig.karakas.slice(0, 2)) {
    if (k === f.lord) continue;
    const ks = lordStrength(ctx.natal, k);
    out.push({ text: `${placementPhrase(ctx, k)}; it is the natural karaka here.`, tone: toneFor(ks.value) });
  }

  // sarvashtakavarga of the house
  out.push({
    text: `The ${ordinal(main)} has ${f.sav} sarvashtakavarga points (28 is average)${f.sav >= 30 ? ', a well-supported house' : f.sav <= 24 ? ', a house that needs effort' : ''}.`,
    tone: f.sav >= 30 ? 'good' : f.sav <= 24 ? 'hard' : 'mixed',
    source: 'BPHS 66–72',
  });

  // yogas and doshas on the area's houses (main and the next one)
  const houses = new Set(sig.houses.slice(0, 2));
  let yogas = 0;
  for (const y of ctx.report.yogas) {
    if (yogas >= 3) break;
    if (!y.houses.some((h) => houses.has(h)) || y.strength === 'weak' || !AREA_YOGA_CATEGORIES.has(y.category)) continue;
    out.push({ text: `${y.name}: ${y.reason}`, tone: y.category === 'arishta' ? 'hard' : 'good', source: citeOf(YOGA_SOURCES[y.id]) });
    yogas++;
  }
  for (const d of ctx.report.doshas) {
    if (!d.present || d.severity === 'cancelled' || d.severity === 'low') continue;
    const relevant = d.houses.some((h) => houses.has(h)) || (d.id === 'manglik' && kind === 'marriage');
    if (relevant) out.push({ text: `${d.name}: ${d.reason}`, tone: 'hard', source: citeOf(DOSHA_SOURCES[d.id]) });
  }
  return out;
}
