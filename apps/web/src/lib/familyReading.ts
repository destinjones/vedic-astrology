/**
 * How charts in one family relate. Reuses the comparison (synastry) and
 * matching readings from @vedic/interpretations and adds the classical bhava
 * links a family reading looks at: the house of the person in focus that
 * stands for each relative (the 5th for children, the 7th for a spouse, and
 * so on), and whether the relative's Lagna or Moon sign falls there.
 * Pure functions, no storage.
 */
import { getNakshatra, getSign, matchCharts, synastry } from '@vedic/interpretations';
import type { ChartInput, CrossContact, HouseOverlay, MatchResult, PlanetId, SignRelation } from '@vedic/interpretations';
import type { Relation } from './family';

export interface FamilyMember {
  id: string;
  name: string;
  chart: ChartInput;
}

/** Houses that stand for each relative, counted from the Lagna and from the Moon. */
export const RELATION_HOUSES: Record<Relation, { houses: number[]; why: string }> = {
  spouse: { houses: [7], why: 'the 7th house is the spouse' },
  child: { houses: [5], why: 'the 5th house is children' },
  father: { houses: [9], why: 'the 9th house is the father (the 10th in some southern texts)' },
  mother: { houses: [4], why: 'the 4th house is the mother' },
  parent: { houses: [4, 9], why: 'the 4th house is the mother and the 9th the father' },
  sibling: { houses: [3, 11], why: 'the 3rd house is younger siblings and the 11th elder ones' },
  other: { houses: [], why: '' },
};

export interface BhavaLink {
  /** Which of the relative's points: their Lagna or their Moon sign. */
  point: 'Lagna' | 'Moon';
  /** House of the focus chart it lands in. */
  house: number;
  /** Counted from the focus person's Lagna or Moon. */
  from: 'Lagna' | 'Moon';
  text: string;
}

export interface PairReading {
  relation: Relation;
  moon: SignRelation;
  lagna: SignRelation;
  /** Classical links between the relative's chart and the house that stands for them. */
  bhava: BhavaLink[];
  /** The closest cross-chart contacts, strongest first. */
  contacts: CrossContact[];
  /** The relative's planets that land most kindly and most awkwardly in the focus person's houses. */
  supportive: HouseOverlay[];
  needsCare: HouseOverlay[];
  /** Synastry's summary lines; only shown for a spouse, since they are written for partners. */
  highlights: string[];
  /** -10 to +10, not a verdict. */
  balance: number;
  /** Ashtakoota and Manglik, for a spouse only. */
  match?: Pick<MatchResult, 'total' | 'max' | 'adjustedTotal' | 'band' | 'bandLabel' | 'summary'> & { manglik: string };
}

const signDist = (from: number, to: number) => ((((to - from) % 12) + 12) % 12) + 1;
const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

/** Where the relative's Lagna and Moon sign fall in the focus chart's houses that stand for this relation. */
export function bhavaLinks(focus: FamilyMember, rel: FamilyMember, relation: Relation): BhavaLink[] {
  const houses = RELATION_HOUSES[relation].houses;
  const out: BhavaLink[] = [];
  const points: [BhavaLink['point'], number][] = [['Lagna', rel.chart.ascendantSign], ['Moon', rel.chart.planets.moon.sign]];
  const bases: [BhavaLink['from'], number][] = [['Lagna', focus.chart.ascendantSign], ['Moon', focus.chart.planets.moon.sign]];
  for (const [point, sign] of points) {
    for (const [from, base] of bases) {
      const house = signDist(base, sign);
      if (!houses.includes(house)) continue;
      out.push({
        point, house, from,
        text: `${rel.name}'s ${point === 'Lagna' ? 'Lagna' : 'Moon'} is ${getSign(sign).name}, the ${ordinal(house)} sign from ${focus.name}'s ${from}: ${RELATION_HOUSES[relation].why}, so this is a classical mark of the bond.`,
      });
    }
  }
  return out;
}

const overlayScore = (o: HouseOverlay) => o.score;

/** Reads one relative's chart against the person in focus. */
export function readPair(focus: FamilyMember, rel: FamilyMember, relation: Relation): PairReading {
  const s = synastry({ name: focus.name, chart: focus.chart }, { name: rel.name, chart: rel.chart });
  // bInA: the relative's planets in the focus person's houses
  const ranked = [...s.bInA].sort((a, b) => overlayScore(b) - overlayScore(a));
  const reading: PairReading = {
    relation,
    moon: s.moon,
    lagna: s.lagna,
    bhava: bhavaLinks(focus, rel, relation),
    contacts: [...s.contacts].sort((a, b) => b.weight - a.weight).slice(0, 4),
    supportive: ranked.filter((o) => o.score > 0).slice(0, 2),
    needsCare: ranked.filter((o) => o.score < 0).reverse().slice(0, 2),
    highlights: relation === 'spouse' ? s.highlights : [],
    balance: s.balance,
  };
  if (relation === 'spouse') {
    const m = matchCharts(focus.chart, rel.chart);
    reading.match = { total: m.total, max: m.max, adjustedTotal: m.adjustedTotal, band: m.band, bandLabel: m.bandLabel, summary: m.summary, manglik: m.manglik.headline };
  }
  return reading;
}

export interface FamilyTheme {
  kind: 'moon-sign' | 'lagna' | 'nakshatra' | 'placement' | 'lagna-moon';
  title: string;
  text: string;
  /** Member ids that share it. */
  members: string[];
}

const PLANET_NAME: Record<PlanetId, string> = {
  sun: 'Sun', moon: 'Moon', mars: 'Mars', mercury: 'Mercury', jupiter: 'Jupiter', venus: 'Venus', saturn: 'Saturn', rahu: 'Rahu', ketu: 'Ketu',
};
const SLOW: PlanetId[] = ['jupiter', 'saturn', 'rahu', 'ketu'];
const FAST: PlanetId[] = ['sun', 'mercury', 'venus', 'mars'];

const names = (ms: FamilyMember[]) => {
  const n = ms.map((m) => m.name);
  return n.length <= 2 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
};

function groupBy(ms: FamilyMember[], key: (m: FamilyMember) => number): Map<number, FamilyMember[]> {
  const g = new Map<number, FamilyMember[]>();
  for (const m of ms) g.set(key(m), [...(g.get(key(m)) ?? []), m]);
  return g;
}

/**
 * Signs, nakshatras and placements that repeat through the family. Jupiter,
 * Saturn and the nodes move slowly, so people born within a year or two share
 * them by default; those only count when the births are far apart.
 */
export function familyThemes(members: FamilyMember[], births?: Record<string, string>): FamilyTheme[] {
  if (members.length < 2) return [];
  const out: FamilyTheme[] = [];
  const add = (kind: FamilyTheme['kind'], ms: FamilyMember[], title: string, text: string) => out.push({ kind, title, text, members: ms.map((m) => m.id) });

  for (const [sign, ms] of groupBy(members, (m) => m.chart.planets.moon.sign)) {
    if (ms.length < 2) continue;
    add('moon-sign', ms, `Moon in ${getSign(sign).name}`, `${names(ms)} share a Moon sign, so their emotional rhythms and instincts tend to be familiar to each other.`);
  }
  for (const [sign, ms] of groupBy(members, (m) => m.chart.ascendantSign)) {
    if (ms.length < 2) continue;
    add('lagna', ms, `${getSign(sign).name} rising`, `${names(ms)} share a Lagna, so they meet life with a similar temperament and outlook.`);
  }
  for (const [nak, ms] of groupBy(members, (m) => m.chart.planets.moon.nakshatra)) {
    if (ms.length < 2) continue;
    add('nakshatra', ms, `Moon in ${getNakshatra(nak).name}`, `${names(ms)} were born under the same nakshatra, a close tie that families often notice.`);
  }
  // one person's Lagna sign is another's Moon sign: a strong, often-quoted family echo
  for (const a of members) {
    const echo = members.filter((b) => b !== a && b.chart.planets.moon.sign === a.chart.ascendantSign && b.chart.ascendantSign !== a.chart.ascendantSign);
    if (echo.length) add('lagna-moon', [a, ...echo], `${a.name}'s Lagna echoed`, `${names(echo)} ${echo.length > 1 ? 'have' : 'has'} the Moon in ${getSign(a.chart.ascendantSign).name}, which is ${a.name}'s rising sign.`);
  }
  const years = births ? members.map((m) => Number((births[m.id] ?? '').slice(0, 4))).filter(Number.isFinite) : [];
  const spread = years.length === members.length ? Math.max(...years) - Math.min(...years) : 0;
  const planets = spread >= 3 ? [...FAST, ...SLOW] : FAST;
  const need = Math.max(2, Math.ceil(members.length / 2));
  for (const p of planets) {
    for (const [sign, ms] of groupBy(members, (m) => m.chart.planets[p].sign)) {
      if (ms.length < need) continue;
      add('placement', ms, `${PLANET_NAME[p]} in ${getSign(sign).name}`, `${names(ms)} all have ${PLANET_NAME[p]} in ${getSign(sign).name}, a placement that runs through the family.`);
    }
  }
  return out;
}
