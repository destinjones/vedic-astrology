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
import { conjunctionKey } from './data/conditions';
import { PLANET_PROFILES } from './data/planets';
import { PLANET_IN_NAKSHATRA_TEXT } from './data/generated/content';
import { detectDoshas } from './doshas';
import { localizer, type LocaleOptions } from './i18n/context';
import type { ChartInput, Dignity, DoshaResult, PlanetId, Reading, Tone, YogaResult } from './types';
import { PLANETS } from './types';
import { detectYogas } from './yogas';

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
// Every lookup takes an optional { locale }. Text comes from the language pack when
// it has been loaded (see loadLocale) and falls back to English otherwise.

export function getPlanetInSign(planet: PlanetId, sign: number, dignity?: Dignity, opts?: LocaleOptions): Reading {
  const L = localizer(opts?.locale);
  const s = L.sign(sign);
  const { summary, detail, strengths, challenges } = L.planetInSign(planet, s.number);
  const pr = L.planet(planet);
  const dig = dignity ?? naturalDignityFor(planet, s.number);
  const dt = L.dignity(dig);
  const score = clamp(dt.score);
  return {
    id: `sign:${planet}:${s.id}`,
    title: L.ph.signTitle(pr.name, s.name),
    summary,
    detail: [detail, L.ph.dignityLine(dt.label, dt.detail)],
    strengths,
    challenges,
    keywords: [...s.themes.slice(0, 2), ...pr.significations.slice(0, 2), dig],
    tone: toneOf(score),
    score,
  };
}

/** First two items joined the language's way ("a and b"). */
const two = (L: ReturnType<typeof localizer>, xs: string[]) => (xs.length >= 2 ? L.ph.and(xs[0], xs[1]) : (xs[0] ?? ''));

const naturalDignityFor = (planet: PlanetId, sign: number): Dignity => naturalDignity(planet, wrapSign(sign));

export function getPlanetInHouse(planet: PlanetId, house: number, opts?: LocaleOptions): Reading {
  const L = localizer(opts?.locale);
  const h = L.house(house);
  const { summary, detail, strengths, challenges, score } = L.planetInHouse(planet, h.number);
  const pr = L.planet(planet);
  return {
    id: `house:${planet}:${h.number}`,
    title: L.ph.houseTitle(pr.name, L.ord(h.number)),
    summary,
    detail: [detail, L.ph.houseDetail({ ord: L.ord(h.number), sanskrit: h.sanskrit, significations: h.significations.slice(0, 4).join(', '), planet: pr.name, essence: pr.essence })],
    strengths,
    challenges,
    keywords: [h.label, ...h.groups, pr.name.toLowerCase()],
    tone: toneOf(score),
    score,
  };
}

export function getPlanetInNakshatra(planet: PlanetId, nakshatra: number, pada?: number, opts?: LocaleOptions): Reading {
  const L = localizer(opts?.locale);
  const n = L.nakshatra(nakshatra);
  const pr = L.planet(planet);
  const lord = L.planet(n.lord);
  let relation: string;
  let relScore = 0;
  if (n.lord === planet) {
    relation = L.ph.nakRelOwn(pr.name);
    relScore = 1;
  } else if (pr.friends.includes(n.lord)) {
    relation = L.ph.nakRelFriend(lord.name, pr.name);
    relScore = 0.5;
  } else if (pr.enemies.includes(n.lord)) {
    relation = L.ph.nakRelEnemy(lord.name, pr.name, pr.essence, lord.essence);
    relScore = -0.5;
  } else {
    relation = L.ph.nakRelNeutral(lord.name, pr.name);
  }
  const ganaScore = n.gana === 'deva' ? 0.5 : n.gana === 'rakshasa' ? -0.5 : 0;
  const written = L.locale === 'en' ? PLANET_IN_NAKSHATRA_TEXT[planet]?.[n.number] : undefined;
  const score = written?.score ?? clamp(relScore + ganaScore);
  const padaLine = pada && pada >= 1 && pada <= 4 ? [L.ph.nakPada(pada, n.padas[pada - 1])] : [];
  if (written) {
    return {
      id: `nakshatra:${planet}:${n.id}${pada ? `:${pada}` : ''}`,
      title: L.ph.nakTitle(pr.name, n.name, pada),
      summary: written.summary,
      detail: [...written.detail, ...padaLine],
      strengths: written.strengths,
      challenges: written.challenges,
      keywords: [...n.keywords, n.gana, n.motivation],
      tone: toneOf(score),
      score,
    };
  }
  const detail = [
    L.ph.nakColours(n.name, L.lens(planet, PLANET_LENS[planet]), n.description),
    L.ph.nakRuled({ lord: lord.name, deity: n.deity, symbol: n.symbol, shakti: n.shakti, relation }),
    L.ph.nakWorks({ planet: pr.name, high: pr.highExpression, gifts: two(L, n.gifts), shadows: two(L, n.shadows), low: pr.lowExpression }),
  ];
  detail.push(...padaLine);
  return {
    id: `nakshatra:${planet}:${n.id}${pada ? `:${pada}` : ''}`,
    title: L.ph.nakTitle(pr.name, n.name, pada),
    summary: L.ph.nakSummary({ planet: pr.name, nak: n.name, essence: pr.essence, nature: n.nature, keywords: two(L, n.keywords) }),
    detail,
    strengths: n.gifts,
    challenges: n.shadows,
    keywords: [...n.keywords, n.gana, n.motivation],
    tone: toneOf(score),
    score,
  };
}

export function getHouseLordIn(lordOf: number, placedIn: number, planet?: PlanetId, opts?: LocaleOptions): Reading {
  const L = localizer(opts?.locale);
  const a = L.house(lordOf);
  const b = L.house(placedIn);
  const { summary, detail, score } = L.houseLord(a.number, b.number);
  const rel = signDistance(a.number, b.number);
  return {
    id: `lord:${a.number}:${b.number}`,
    title: L.ph.lordTitle(L.ord(a.number), L.ord(b.number), planet ? L.planetName(planet) : undefined),
    summary,
    detail: [detail, L.ph.lordCarried({ aOrd: L.ord(a.number), aLabel: a.label, bOrd: L.ord(b.number), bLabel: b.label, rel, relOrd: L.ord(rel) })],
    strengths: [],
    challenges: [],
    keywords: [a.label, b.label],
    tone: toneOf(score),
    score,
  };
}

export function getRetrograde(planet: PlanetId, opts?: LocaleOptions): Reading {
  const L = localizer(opts?.locale);
  const t = L.retrograde(planet);
  return { id: `retro:${planet}`, title: L.ph.retroTitle(L.planetName(planet)), summary: t.summary, detail: [t.detail], strengths: t.strengths, challenges: t.challenges, keywords: L.ph.keywords.retrograde, tone: 'mixed', score: 0 };
}

export function getConjunction(a: PlanetId, b: PlanetId, opts?: LocaleOptions): Reading | null {
  const L = localizer(opts?.locale);
  const k = conjunctionKey(a, b);
  const c = L.conjunction(k);
  if (!c) return null;
  return { id: `conj:${k}`, title: L.ph.conjTitle(L.planetName(a), L.planetName(b)), summary: c[0], detail: [c[1]], strengths: [], challenges: [], keywords: L.ph.keywords.conjunction, tone: toneOf(c[2]), score: c[2] };
}

export function getAspect(planet: PlanetId, distance: number, targetHouse: number, opts?: LocaleOptions): Reading {
  const L = localizer(opts?.locale);
  const h = L.house(targetHouse);
  const pr = L.planet(planet);
  const special = L.specialAspect(planet, distance);
  const benefic = pr.nature === 'benefic' ? 1 : pr.nature === 'malefic' ? -1 : 0;
  const flavor = L.aspectFlavor(planet);
  return {
    id: `aspect:${planet}:${distance}:${h.number}`,
    title: L.ph.aspectTitle(pr.name, L.ord(h.number)),
    summary: L.ph.aspectSummary({ planet: pr.name, distOrd: L.ord(distance), flavor, label: h.label }),
    detail: [special ?? L.ph.aspectDefault({ planet: pr.name, ord: L.ord(h.number), flavor, significations: h.significations.slice(0, 3).join(', ') })],
    strengths: [],
    challenges: [],
    keywords: L.ph.keywords.aspect,
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

export function interpretChart(chart: ChartInput, opts?: LocaleOptions): ChartInterpretation {
  const L = localizer(opts?.locale);
  const planets = {} as Record<PlanetId, PlanetReport>;
  const placements: Reading[] = [];
  const houseLords: Reading[] = [];

  for (let h = 1; h <= 12; h++) {
    const lord = lordOfHouse(chart, h);
    houseLords.push(getHouseLordIn(h, houseOf(chart, lord), lord, opts));
  }

  for (const p of PLANETS) {
    const pos = chart.planets[p];
    const dignity = dignityOf(chart, p);
    const house = houseOf(chart, p);
    const sign = getPlanetInSign(p, pos.sign, dignity, opts);
    const houseR = getPlanetInHouse(p, house, opts);
    const nak = getPlanetInNakshatra(p, pos.nakshatra, pos.pada, opts);
    const lordships = housesRuledBy(chart, p).map((h) => getHouseLordIn(h, house, p, opts));
    const retrograde = pos.retrograde && p !== 'rahu' && p !== 'ketu' ? getRetrograde(p, opts) : undefined;
    const combust = pos.combust ? L.combust(p) : undefined;
    const conjunctions = PLANETS.filter((q) => q !== p && chart.planets[q].sign === pos.sign)
      .map((q) => getConjunction(p, q, opts))
      .filter((x): x is Reading => !!x);
    const aspects = PLANET_PROFILES[p].aspects.map((d) => {
      const targetSign = ((pos.sign - 1 + d - 1) % 12) + 1;
      return getAspect(p, d, signDistance(chart.ascendantSign, targetSign), opts);
    });
    const score = clamp(sign.score * 0.4 + houseR.score * 0.4 + nak.score * 0.2 - (pos.combust ? 1 : 0));
    planets[p] = { planet: p, dignity, sign, house: houseR, nakshatra: nak, lordships, retrograde, combust, conjunctions, aspects, score, tone: toneOf(score) };
    placements.push(sign, houseR, nak, ...(retrograde ? [retrograde] : []));
  }
  // Dedupe conjunction readings into placements
  const seen = new Set<string>();
  for (const p of PLANETS) for (const c of planets[p].conjunctions) if (!seen.has(c.id)) { seen.add(c.id); placements.push(c); }

  const yogas = detectYogas(chart, opts);
  const doshas = detectDoshas(chart, opts);
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
