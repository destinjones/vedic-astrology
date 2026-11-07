import {
  aspectsSign,
  dignityOf,
  houseOf,
  housesRuledBy,
  lordOfHouse,
  naturalDignity,
  signDistance,
  wrapSign,
} from './chart-utils';
import { ASPECT_FLAVOR, COMBUST_TEXT, CONJUNCTIONS, DIGNITY_TEXT, RETROGRADE_TEXT, SPECIAL_ASPECT_NOTES, conjunctionKey } from './data/conditions';
import { HOUSE_LORD_IN } from './data/houseLords';
import { getHouse } from './data/houses';
import { getNakshatra } from './data/nakshatras';
import { PLANET_IN_HOUSE } from './data/planetInHouse';
import { PLANET_IN_SIGN } from './data/planetInSign';
import { PLANET_PROFILES } from './data/planets';
import { getSign } from './data/signs';
import { detectDoshas } from './doshas';
import type { ChartInput, Dignity, DoshaResult, PlanetId, Reading, Tone, YogaResult } from './types';
import { PLANETS } from './types';
import { detectYogas } from './yogas';

const ord = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const clamp = (x: number) => Math.max(-3, Math.min(3, Math.round(x * 10) / 10));
export const toneOf = (score: number): Tone => (score >= 1 ? 'benefic' : score <= -1 ? 'challenging' : 'mixed');

/** Lens each planet brings to a nakshatra. */
const PLANET_LENS: Record<PlanetId, string> = {
  sun: 'your sense of purpose and how you seek recognition',
  moon: 'your emotional nature, instincts and inner comfort (this is your janma nakshatra, the most personal star in the chart)',
  mars: 'how you act, compete and defend what matters',
  mercury: 'how you think, learn and speak',
  jupiter: 'what you believe, how you grow and where grace reaches you',
  venus: 'what you love, value and find beautiful',
  saturn: 'where you must be patient, responsible and disciplined',
  rahu: 'what you hunger for and chase in this life',
  ketu: 'what you have already mastered and are learning to release',
};

// ------------------------------------------------------------------ lookups

export function getPlanetInSign(planet: PlanetId, sign: number, dignity?: Dignity): Reading {
  const s = getSign(sign);
  const [summary, detail, strengths, challenges] = PLANET_IN_SIGN[planet][s.number - 1];
  const pr = PLANET_PROFILES[planet];
  const dig = dignity ?? naturalDignityFor(planet, s.number);
  const score = clamp(DIGNITY_TEXT[dig].score);
  return {
    id: `sign:${planet}:${s.id}`,
    title: `${pr.name} in ${s.name}`,
    summary,
    detail: [detail, `${DIGNITY_TEXT[dig].label}: ${DIGNITY_TEXT[dig].detail}`],
    strengths,
    challenges,
    keywords: [...s.themes.slice(0, 2), ...pr.significations.slice(0, 2), dig],
    tone: toneOf(score),
    score,
  };
}

const naturalDignityFor = (planet: PlanetId, sign: number): Dignity => naturalDignity(planet, wrapSign(sign));

export function getPlanetInHouse(planet: PlanetId, house: number): Reading {
  const h = getHouse(house);
  const [summary, detail, strengths, challenges, score] = PLANET_IN_HOUSE[planet][h.number - 1];
  const pr = PLANET_PROFILES[planet];
  return {
    id: `house:${planet}:${h.number}`,
    title: `${pr.name} in the ${ord(h.number)} house`,
    summary,
    detail: [detail, `The ${ord(h.number)} house (${h.sanskrit}) governs ${h.significations.slice(0, 4).join(', ')}. ${pr.name} brings ${pr.essence} to these matters.`],
    strengths,
    challenges,
    keywords: [h.label, ...h.groups, pr.name.toLowerCase()],
    tone: toneOf(score),
    score,
  };
}

export function getPlanetInNakshatra(planet: PlanetId, nakshatra: number, pada?: number): Reading {
  const n = getNakshatra(nakshatra);
  const pr = PLANET_PROFILES[planet];
  const lord = PLANET_PROFILES[n.lord];
  let relation: string;
  let relScore = 0;
  if (n.lord === planet) {
    relation = `${pr.name} rules this nakshatra, so it acts with full authority and the nakshatra’s themes are pronounced.`;
    relScore = 1;
  } else if (pr.friends.includes(n.lord)) {
    relation = `The nakshatra lord ${lord.name} is a friend of ${pr.name}, so the two cooperate and results flow easily.`;
    relScore = 0.5;
  } else if (pr.enemies.includes(n.lord)) {
    relation = `The nakshatra lord ${lord.name} is unfriendly to ${pr.name}, so expect some inner tension between ${pr.essence} and ${lord.essence}.`;
    relScore = -0.5;
  } else {
    relation = `The nakshatra lord ${lord.name} is neutral to ${pr.name}; results depend on ${lord.name}’s own placement in the chart.`;
  }
  const ganaScore = n.gana === 'deva' ? 0.5 : n.gana === 'rakshasa' ? -0.5 : 0;
  const score = clamp(relScore + ganaScore);
  const detail = [
    `${n.name} colours ${PLANET_LENS[planet]}. ${n.description}`,
    `Ruled by ${lord.name} and presided over by ${n.deity}, its symbol is ${n.symbol} and it grants ${n.shakti}. ${relation}`,
    `When ${pr.name} works well here you see ${pr.highExpression}, expressed through ${n.gifts.slice(0, 2).join(' and ')}. When it struggles, watch for ${n.shadows.slice(0, 2).join(' and ')}, along with ${pr.lowExpression}.`,
  ];
  if (pada && pada >= 1 && pada <= 4) detail.push(`Pada ${pada}: ${n.padas[pada - 1]}`);
  return {
    id: `nakshatra:${planet}:${n.id}${pada ? `:${pada}` : ''}`,
    title: `${pr.name} in ${n.name}${pada ? ` (pada ${pada})` : ''}`,
    summary: `${pr.name} in ${n.name} expresses ${pr.essence} in a ${n.nature} way, focused on ${n.keywords.slice(0, 2).join(' and ')}.`,
    detail,
    strengths: n.gifts,
    challenges: n.shadows,
    keywords: [...n.keywords, n.gana, n.motivation],
    tone: toneOf(score),
    score,
  };
}

export function getHouseLordIn(lordOf: number, placedIn: number, planet?: PlanetId): Reading {
  const a = getHouse(lordOf);
  const b = getHouse(placedIn);
  const [summary, detail, score] = HOUSE_LORD_IN[a.number - 1][b.number - 1];
  const rel = signDistance(a.number, b.number);
  return {
    id: `lord:${a.number}:${b.number}`,
    title: `Lord of the ${ord(a.number)} in the ${ord(b.number)}${planet ? ` (${PLANET_PROFILES[planet].name})` : ''}`,
    summary,
    detail: [
      detail,
      `The matters of the ${ord(a.number)} house (${a.label}) are carried into the ${ord(b.number)} house (${b.label}). Counted from its own house, the lord sits ${rel === 1 ? 'at home' : `in the ${ord(rel)} position`}, so ${a.label} is experienced through ${b.label}.`,
    ],
    strengths: [],
    challenges: [],
    keywords: [a.label, b.label],
    tone: toneOf(score),
    score,
  };
}

export function getRetrograde(planet: PlanetId): Reading {
  const t = RETROGRADE_TEXT[planet];
  return { id: `retro:${planet}`, title: `${PLANET_PROFILES[planet].name} retrograde`, summary: t.summary, detail: [t.detail], strengths: t.strengths, challenges: t.challenges, keywords: ['retrograde', 'vakri'], tone: 'mixed', score: 0 };
}

export function getConjunction(a: PlanetId, b: PlanetId): Reading | null {
  const k = conjunctionKey(a, b);
  const c = CONJUNCTIONS[k];
  if (!c) return null;
  return { id: `conj:${k}`, title: `${PLANET_PROFILES[a].name} conjunct ${PLANET_PROFILES[b].name}`, summary: c[0], detail: [c[1]], strengths: [], challenges: [], keywords: ['conjunction', 'yuti'], tone: toneOf(c[2]), score: c[2] };
}

export function getAspect(planet: PlanetId, distance: number, targetHouse: number): Reading {
  const h = getHouse(targetHouse);
  const pr = PLANET_PROFILES[planet];
  const special = SPECIAL_ASPECT_NOTES[planet]?.[distance];
  const benefic = pr.nature === 'benefic' ? 1 : pr.nature === 'malefic' ? -1 : 0;
  return {
    id: `aspect:${planet}:${distance}:${h.number}`,
    title: `${pr.name} aspects the ${ord(h.number)} house`,
    summary: `${pr.name}’s ${ord(distance)} aspect ${ASPECT_FLAVOR[planet]} ${h.label}.`,
    detail: [special ?? `Every planet aspects the 7th from itself. ${pr.name} looks across at the ${ord(h.number)} house and ${ASPECT_FLAVOR[planet]} its affairs: ${h.significations.slice(0, 3).join(', ')}.`],
    strengths: [],
    challenges: [],
    keywords: ['drishti', 'aspect'],
    tone: toneOf(benefic),
    score: benefic,
  };
}

// ------------------------------------------------------------------ whole chart

export interface PlanetReport {
  planet: PlanetId;
  dignity: Dignity;
  sign: Reading;
  house: Reading;
  nakshatra: Reading;
  lordships: Reading[];
  retrograde?: Reading;
  combust?: string;
  conjunctions: Reading[];
  aspects: Reading[];
  /** Combined score for quick sorting/colouring. */
  score: number;
  tone: Tone;
}

export interface ChartInterpretation {
  planets: Record<PlanetId, PlanetReport>;
  /** Flat list of every placement reading, for search or a single list view. */
  placements: Reading[];
  houseLords: Reading[];
  yogas: YogaResult[];
  doshas: DoshaResult[];
  /** Highlights: strongest and most challenging factors. */
  highlights: { strengths: Reading[]; challenges: Reading[] };
}

export function interpretChart(chart: ChartInput): ChartInterpretation {
  const planets = {} as Record<PlanetId, PlanetReport>;
  const placements: Reading[] = [];
  const houseLords: Reading[] = [];

  for (let h = 1; h <= 12; h++) {
    const lord = lordOfHouse(chart, h);
    houseLords.push(getHouseLordIn(h, houseOf(chart, lord), lord));
  }

  for (const p of PLANETS) {
    const pos = chart.planets[p];
    const dignity = dignityOf(chart, p);
    const house = houseOf(chart, p);
    const sign = getPlanetInSign(p, pos.sign, dignity);
    const houseR = getPlanetInHouse(p, house);
    const nak = getPlanetInNakshatra(p, pos.nakshatra, pos.pada);
    const lordships = housesRuledBy(chart, p).map((h) => getHouseLordIn(h, house, p));
    const retrograde = pos.retrograde && p !== 'rahu' && p !== 'ketu' ? getRetrograde(p) : undefined;
    const combust = pos.combust ? COMBUST_TEXT[p] : undefined;
    const conjunctions = PLANETS.filter((q) => q !== p && chart.planets[q].sign === pos.sign)
      .map((q) => getConjunction(p, q))
      .filter((x): x is Reading => !!x);
    const aspects = PLANET_PROFILES[p].aspects.map((d) => {
      const targetSign = ((pos.sign - 1 + d - 1) % 12) + 1;
      return getAspect(p, d, signDistance(chart.ascendantSign, targetSign));
    });
    const score = clamp(sign.score * 0.4 + houseR.score * 0.4 + nak.score * 0.2 - (pos.combust ? 1 : 0));
    planets[p] = { planet: p, dignity, sign, house: houseR, nakshatra: nak, lordships, retrograde, combust, conjunctions, aspects, score, tone: toneOf(score) };
    placements.push(sign, houseR, nak, ...(retrograde ? [retrograde] : []));
  }
  // Dedupe conjunction readings into placements
  const seen = new Set<string>();
  for (const p of PLANETS) for (const c of planets[p].conjunctions) if (!seen.has(c.id)) { seen.add(c.id); placements.push(c); }

  const yogas = detectYogas(chart);
  const doshas = detectDoshas(chart);
  const all = [...placements, ...houseLords];
  const highlights = {
    strengths: [...all].sort((a, b) => b.score - a.score).slice(0, 8),
    challenges: [...all].sort((a, b) => a.score - b.score).slice(0, 8),
  };
  return { planets, placements, houseLords, yogas, doshas, highlights };
}

/** Which planets aspect a given house (sign-based graha drishti). */
export function aspectsOnHouse(chart: ChartInput, house: number): PlanetId[] {
  const sign = ((chart.ascendantSign - 1 + house - 1) % 12) + 1;
  return PLANETS.filter((p) => aspectsSign(chart, p, sign));
}
