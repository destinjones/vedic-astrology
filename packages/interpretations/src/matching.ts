/**
 * Compatibility matching (kundali milan): the Ashtakoota guna milan out of 36,
 * plus a side-by-side Manglik comparison with the classical balancing rules.
 *
 * The eight kootas are read from each person's natal Moon: its sign (rashi),
 * its nakshatra and, for Vashya, its exact degree. The tables follow the
 * North Indian convention used by most panchangas and matching software.
 * Schools differ in a few cells (Vashya, Gana and the cancellation rules
 * especially); where they do, this file says which reading it uses.
 *
 * The classical tables are written for a groom and a bride. Three kootas
 * (Varna, Vashya and Gana) and the count direction of Tara depend on who sits
 * in which seat, so the API calls the two people `a` (the groom's seat) and
 * `b` (the bride's seat). Any couple can be matched, and `matchCharts(b, a)`
 * reads the same pair with the seats swapped.
 *
 * All explanatory text is original to this project.
 */
import { houseFromPlanet, houseOf, signDistance } from './chart-utils';
import { detectManglik } from './doshas';
import { getNakshatra } from './data/nakshatras';
import { PLANET_PROFILES } from './data/planets';
import { getSign, signLord } from './data/signs';
import type { ChartInput, DoshaResult, PlanetId, SignNumber } from './types';

// ------------------------------------------------------------------ types

export type KootaId = 'varna' | 'vashya' | 'tara' | 'yoni' | 'graha_maitri' | 'gana' | 'bhakoot' | 'nadi';

/** How well one koota scores, relative to its maximum. */
export type KootaQuality = 'full' | 'good' | 'partial' | 'none';

export interface KootaDosha {
  id: 'bhakoot' | 'nadi' | 'gana';
  name: string;
  /** True when one of the classical exceptions applies. */
  cancelled: boolean;
  /** The exceptions that apply, in plain words. */
  cancellations: string[];
  /** Why it matters and what the tradition suggests. */
  note: string;
}

export interface KootaResult {
  id: KootaId;
  /** Display name, e.g. "Graha Maitri" */
  name: string;
  /** Short English gloss, e.g. "Mental friendship" */
  gloss: string;
  /** What the koota is about, one line, for the score row. */
  area: string;
  /** What this koota measures and how it is worked out. */
  about: string;
  /** Points scored */
  points: number;
  /** Points available */
  max: number;
  quality: KootaQuality;
  /** Each person's category for this koota, e.g. { a: 'Deva', b: 'Rakshasa' } */
  values: { a: string; b: string };
  /** What this pair's result means, in plain words. */
  explanation: string;
  /** Set when the koota scores zero and carries a named dosha. */
  dosha?: KootaDosha;
}

export interface MatchPerson {
  moonSign: SignNumber;
  moonSignName: string;
  moonSignLord: PlanetId;
  nakshatra: number;
  nakshatraName: string;
  pada: number;
  varna: Varna;
  vashya: Vashya;
  yoni: Yoni;
  gana: Gana;
  nadi: Nadi;
}

export type ManglikStatus = 'neither' | 'both' | 'balanced' | 'mismatch';

export interface ManglikSide {
  /** Mars is in a Manglik house from the ascendant, Moon or Venus, before cancellations */
  marsInManglikHouse: boolean;
  /** Still counted as Manglik after the chart's own cancellations */
  manglik: boolean;
  /** The full dosha result from the shared detector */
  dosha: DoshaResult;
  /** Mars' house from the ascendant, the Moon and Venus */
  marsFrom: { ascendant: number; moon: number; venus: number };
  /** Malefics (Mars, Saturn, Rahu, Ketu) of this chart sitting in Manglik houses, used to balance the other partner */
  balancingMalefics: string[];
}

export interface ManglikComparison {
  a: ManglikSide;
  b: ManglikSide;
  status: ManglikStatus;
  /** One-line headline */
  headline: string;
  /** A paragraph explaining the outcome */
  summary: string;
  /** Balancing factors found (the dosha samya rule) */
  balancing: string[];
}

export type MatchBand = 'excellent' | 'very_good' | 'acceptable' | 'not_recommended';

export interface MatchResult {
  a: MatchPerson;
  b: MatchPerson;
  kootas: KootaResult[];
  /** Classical total, 0–36 */
  total: number;
  max: 36;
  /**
   * Total with the points of a cancelled Bhakoot or Nadi dosha restored, as
   * many astrologers read the match. A cancelled Gana dosha is noted but not
   * restored. The classical total stays the headline.
   */
  adjustedTotal: number;
  band: MatchBand;
  bandLabel: string;
  /** A short paragraph on the overall match */
  summary: string;
  /** Koota doshas present (Nadi, Bhakoot, Gana), cancelled or not */
  doshas: KootaDosha[];
  manglik: ManglikComparison;
  /** Caveats worth showing next to the score */
  notes: string[];
}

// ------------------------------------------------------------------ tables

export type Varna = 'Brahmin' | 'Kshatriya' | 'Vaishya' | 'Shudra';
export type Vashya = 'Chatushpada' | 'Manava' | 'Jalachara' | 'Vanachara' | 'Keeta';
export type Gana = 'Deva' | 'Manushya' | 'Rakshasa';
export type Nadi = 'Adi' | 'Madhya' | 'Antya';
export type Yoni =
  | 'Horse' | 'Elephant' | 'Sheep' | 'Serpent' | 'Dog' | 'Cat' | 'Rat'
  | 'Cow' | 'Buffalo' | 'Tiger' | 'Deer' | 'Monkey' | 'Mongoose' | 'Lion';

const VARNA_RANK: Record<Varna, number> = { Brahmin: 4, Kshatriya: 3, Vaishya: 2, Shudra: 1 };

/** Varna by Moon sign: water signs Brahmin, fire Kshatriya, earth Vaishya, air Shudra. */
export function varnaOf(sign: SignNumber): Varna {
  return (['Kshatriya', 'Vaishya', 'Shudra', 'Brahmin'] as const)[(sign - 1) % 4];
}

/** Vashya group by Moon sign, splitting Sagittarius and Capricorn at 15°. */
export function vashyaOf(sign: SignNumber, degreeInSign: number): Vashya {
  switch (sign) {
    case 1: case 2: return 'Chatushpada';
    case 3: case 6: case 7: case 11: return 'Manava';
    case 4: case 12: return 'Jalachara';
    case 5: return 'Vanachara';
    case 8: return 'Keeta';
    case 9: return degreeInSign < 15 ? 'Manava' : 'Chatushpada';
    case 10: return degreeInSign < 15 ? 'Chatushpada' : 'Jalachara';
  }
  return 'Manava';
}

const VASHYA_ORDER: Vashya[] = ['Chatushpada', 'Manava', 'Jalachara', 'Vanachara', 'Keeta'];
/** Rows: groom's seat, columns: bride's seat. Same order as VASHYA_ORDER. */
const VASHYA_TABLE = [
  [2, 1, 1, 0.5, 1],
  [1, 2, 0.5, 0, 1],
  [1, 0.5, 2, 1, 1],
  [0.5, 0, 1, 2, 0],
  [1, 1, 1, 0, 2],
];

/** Yoni animal of each nakshatra, 1 = Ashwini. */
const NAK_YONI: Yoni[] = [
  'Horse', 'Elephant', 'Sheep', 'Serpent', 'Serpent', 'Dog', 'Cat', 'Sheep', 'Cat',
  'Rat', 'Rat', 'Cow', 'Buffalo', 'Tiger', 'Buffalo', 'Tiger', 'Deer', 'Deer',
  'Dog', 'Monkey', 'Mongoose', 'Monkey', 'Lion', 'Horse', 'Lion', 'Cow', 'Elephant',
];
export const yoniOf = (nak: number): Yoni => NAK_YONI[nak - 1];

export const YONI_ORDER: Yoni[] = ['Horse', 'Elephant', 'Sheep', 'Serpent', 'Dog', 'Cat', 'Rat', 'Cow', 'Buffalo', 'Tiger', 'Deer', 'Monkey', 'Mongoose', 'Lion'];
/** The standard 14 × 14 yoni table (symmetric). 4 same animal, 0 sworn enemies. */
export const YONI_TABLE: number[][] = [
  [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1],
  [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0],
  [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1],
  [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2],
  [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1],
  [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1],
  [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2],
  [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1],
  [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1],
  [1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1],
  [3, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1],
  [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2],
  [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2],
  [1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 4],
];
const YONI_ENEMY: Partial<Record<Yoni, Yoni>> = {
  Horse: 'Buffalo', Buffalo: 'Horse', Elephant: 'Lion', Lion: 'Elephant', Sheep: 'Monkey', Monkey: 'Sheep',
  Serpent: 'Mongoose', Mongoose: 'Serpent', Dog: 'Deer', Deer: 'Dog', Cat: 'Rat', Rat: 'Cat', Cow: 'Tiger', Tiger: 'Cow',
};

const GANA_OF: Record<'deva' | 'manushya' | 'rakshasa', Gana> = { deva: 'Deva', manushya: 'Manushya', rakshasa: 'Rakshasa' };
export const ganaOf = (nak: number): Gana => GANA_OF[getNakshatra(nak).gana];
const GANA_ORDER: Gana[] = ['Deva', 'Manushya', 'Rakshasa'];
/** Rows: groom's seat, columns: bride's seat. A Rakshasa bride with a Deva groom is the classic 0. */
const GANA_TABLE = [
  [6, 6, 0],
  [5, 6, 0],
  [1, 0, 6],
];

/** Nadi runs in a zigzag through the nakshatras: Adi, Madhya, Antya, Antya, Madhya, Adi, … */
export function nadiOf(nak: number): Nadi {
  const i = (nak - 1) % 6;
  return (['Adi', 'Madhya', 'Antya', 'Antya', 'Madhya', 'Adi'] as const)[i];
}

const TARA_NAMES = ['Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyari', 'Sadhaka', 'Vadha', 'Mitra', 'Parama Mitra'];
const TARA_MEANING = ['birth star', 'wealth', 'danger', 'well-being', 'obstacles', 'achievement', 'harm', 'friend', 'best friend'];
/** Tara (1–9) of nakshatra `to` counted from nakshatra `from`. */
export const taraOf = (from: number, to: number): number => ((((to - from) % 27) + 27) % 27) % 9 + 1;
const taraGood = (t: number) => t !== 3 && t !== 5 && t !== 7;

type Rel = 'friend' | 'neutral' | 'enemy';
const relation = (of: PlanetId, toward: PlanetId): Rel => {
  if (of === toward) return 'friend';
  const p = PLANET_PROFILES[of];
  if (p.friends.includes(toward)) return 'friend';
  if (p.enemies.includes(toward)) return 'enemy';
  return 'neutral';
};

const nameOf = (p: PlanetId) => PLANET_PROFILES[p].name;
const signName = (s: number) => getSign(s).name;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function quality(points: number, max: number): KootaQuality {
  if (points >= max) return 'full';
  if (points <= 0) return 'none';
  return points / max >= 0.5 ? 'good' : 'partial';
}

// ------------------------------------------------------------------ static text

export const KOOTA_INFO: Record<KootaId, { name: string; gloss: string; area: string; max: number; about: string }> = {
  varna: {
    name: 'Varna', gloss: 'Temperament and calling', area: 'shared values and sense of purpose', max: 1,
    about: 'Varna sorts the Moon signs into four temperaments by element: water signs are Brahmin (reflective, learning), fire signs Kshatriya (protective, leading), earth signs Vaishya (building, trading) and air signs Shudra (serving, making). Here it says nothing about birth or caste. It asks whether the two people approach work, duty and growth in a way that lets them respect each other. The point is given when the groom’s seat is of the same or a more reflective temperament than the bride’s.',
  },
  vashya: {
    name: 'Vashya', gloss: 'Mutual attraction and influence', area: 'who leads, who follows, and the pull between you', max: 2,
    about: 'Vashya places each Moon sign in one of five natures: four-footed (Chatushpada), human (Manava), water-dwelling (Jalachara), wild (Vanachara, Leo) and insect (Keeta, Scorpio). Sagittarius and Capricorn are split at 15°. Natures that live easily together score well, and natures where one would prey on the other score low. It describes magnetism and how influence flows in the relationship.',
  },
  tara: {
    name: 'Tara', gloss: 'Destiny and well-being', area: 'luck, health and how each supports the other’s fortune', max: 3,
    about: 'Tara counts the nakshatras from one person’s Moon to the other’s, in both directions, and divides by nine. The remainder lands on one of nine taras. Vipat (3rd, danger), Pratyari (5th, obstacles) and Vadha (7th, harm) are the difficult ones. Each direction that avoids them earns 1.5 points, so it shows whether each person’s presence tends to help the other’s fortune.',
  },
  yoni: {
    name: 'Yoni', gloss: 'Physical and intimate harmony', area: 'intimacy, instinct and comfort with each other', max: 4,
    about: 'Every nakshatra has an animal symbol (yoni), fourteen in all. Two people with the same animal score the full four points. Friendly animals score well, and the seven pairs of sworn enemies (horse and buffalo, elephant and lion, sheep and monkey, serpent and mongoose, dog and deer, cat and rat, cow and tiger) score nothing. It describes instinctive and physical compatibility.',
  },
  graha_maitri: {
    name: 'Graha Maitri', gloss: 'Mental friendship', area: 'friendship, conversation and outlook', max: 5,
    about: 'Graha Maitri looks at the planets that rule the two Moon signs and asks whether they are natural friends. Two mutual friends (or the same planet) earn five points. Friendship falls as one or both lords are neutral or hostile. This is the koota for friendship, shared outlook and how easily the two minds meet, and many astrologers weigh it heavily.',
  },
  gana: {
    name: 'Gana', gloss: 'Nature and temperament', area: 'basic nature and everyday behaviour', max: 6,
    about: 'Each nakshatra belongs to a gana: Deva (gentle, idealistic), Manushya (human, practical, mixed) or Rakshasa (fierce, independent, intense). The same gana gives six points. Deva and Manushya blend well. Rakshasa with either of the others scores low, because the fierce temperament can overwhelm a gentler one. It shows how two natures behave together day to day.',
  },
  bhakoot: {
    name: 'Bhakoot', gloss: 'Love, family and prosperity', area: 'emotional bond, family life and shared finances', max: 7,
    about: 'Bhakoot (also Rashi Koota) counts the signs from one Moon to the other. The positions 2/12, 5/9 and 6/8 carry Bhakoot dosha and score zero; every other position scores the full seven. Classically 2/12 strains finances, 5/9 strains children and shared beliefs, and 6/8 brings friction and health worries. The dosha is cancelled when the two Moon signs share a lord or their lords are friends.',
  },
  nadi: {
    name: 'Nadi', gloss: 'Health and heredity', area: 'health, vitality and the next generation', max: 8,
    about: 'Nadi carries the most weight. The 27 nakshatras run in a zigzag through three nadis, named after the Ayurvedic constitutions: Adi (vata), Madhya (pitta) and Antya (kapha). Different nadis score eight points. The same nadi scores zero and is called Nadi dosha. It is linked to health, genetic compatibility and children, and it has well-known exceptions when the Moons share a sign or a nakshatra.',
  },
};

// ------------------------------------------------------------------ person

function moonDegree(chart: ChartInput): number {
  const l = chart.planets.moon.longitude;
  return (((l % 30) + 30) % 30);
}

export function matchPerson(chart: ChartInput): MatchPerson {
  const moon = chart.planets.moon;
  const nak = moon.nakshatra;
  return {
    moonSign: moon.sign,
    moonSignName: signName(moon.sign),
    moonSignLord: signLord(moon.sign),
    nakshatra: nak,
    nakshatraName: getNakshatra(nak).name,
    pada: moon.pada,
    varna: varnaOf(moon.sign),
    vashya: vashyaOf(moon.sign, moonDegree(chart)),
    yoni: yoniOf(nak),
    gana: ganaOf(nak),
    nadi: nadiOf(nak),
  };
}

// ------------------------------------------------------------------ kootas

const koota = (id: KootaId, points: number, values: { a: string; b: string }, explanation: string, dosha?: KootaDosha): KootaResult => {
  const i = KOOTA_INFO[id];
  return { id, name: i.name, gloss: i.gloss, area: i.area, about: i.about, points, max: i.max, quality: quality(points, i.max), values, explanation, dosha };
};

function varnaKoota(a: MatchPerson, b: MatchPerson): KootaResult {
  const ok = VARNA_RANK[a.varna] >= VARNA_RANK[b.varna];
  const text = a.varna === b.varna
    ? `Both Moons share the ${a.varna} temperament, so you tend to want the same things from work and duty.`
    : ok
      ? `The groom’s seat (${a.varna}) is the more reflective temperament, which the tradition reads as a steady fit: each can respect how the other works.`
      : `The bride’s seat (${b.varna}) is the more reflective temperament. The tradition withholds the point, reading it as different senses of purpose that need conscious respect. It is the smallest koota, worth a single point.`;
  return koota('varna', ok ? 1 : 0, { a: a.varna, b: b.varna }, text);
}

function vashyaKoota(a: MatchPerson, b: MatchPerson): KootaResult {
  const pts = VASHYA_TABLE[VASHYA_ORDER.indexOf(a.vashya)][VASHYA_ORDER.indexOf(b.vashya)];
  const lbl = (v: Vashya) => ({ Chatushpada: 'four-footed', Manava: 'human', Jalachara: 'water', Vanachara: 'wild', Keeta: 'insect' })[v];
  const text = a.vashya === b.vashya
    ? `Both Moons are of the ${lbl(a.vashya)} (${a.vashya}) nature: a natural, even pull with influence that flows both ways.`
    : pts >= 1
      ? `${a.vashya} (${lbl(a.vashya)}) and ${b.vashya} (${lbl(b.vashya)}) live alongside each other comfortably. There is attraction, though one person may lead more often.`
      : pts > 0
        ? `${a.vashya} (${lbl(a.vashya)}) and ${b.vashya} (${lbl(b.vashya)}) are only loosely drawn together. Attraction may need tending, and it helps to agree openly who leads in what.`
        : `${a.vashya} (${lbl(a.vashya)}) and ${b.vashya} (${lbl(b.vashya)}) are a predator and prey pairing in the classical image. It can show as one person dominating, so balance of power deserves attention.`;
  return koota('vashya', pts, { a: a.vashya, b: b.vashya }, text);
}

function taraKoota(a: MatchPerson, b: MatchPerson): KootaResult {
  const tA = taraOf(b.nakshatra, a.nakshatra); // groom's star counted from the bride's
  const tB = taraOf(a.nakshatra, b.nakshatra); // bride's star counted from the groom's
  const pts = (taraGood(tA) ? 1.5 : 0) + (taraGood(tB) ? 1.5 : 0);
  const d = (t: number) => `${TARA_NAMES[t - 1]} (${TARA_MEANING[t - 1]})`;
  const both = `Counting from the bride’s seat, the groom’s star is ${d(tA)}. Counting from the groom’s seat, the bride’s star is ${d(tB)}.`;
  const text = pts === 3
    ? `${both} Both directions are favourable, so each tends to support the other’s luck and health.`
    : pts > 0
      ? `${both} One direction is favourable and one is not, so the support runs more strongly one way.`
      : `${both} Neither direction is favourable. The tradition advises care with each other’s health and timing.`;
  return koota('tara', pts, { a: `${a.nakshatraName} → ${TARA_NAMES[tB - 1]}`, b: `${b.nakshatraName} → ${TARA_NAMES[tA - 1]}` }, text);
}

function yoniKoota(a: MatchPerson, b: MatchPerson): KootaResult {
  const pts = YONI_TABLE[YONI_ORDER.indexOf(a.yoni)][YONI_ORDER.indexOf(b.yoni)];
  const text = a.yoni === b.yoni
    ? `Both nakshatras carry the ${a.yoni} yoni, the strongest instinctive match: the same rhythms and the same needs.`
    : YONI_ENEMY[a.yoni] === b.yoni
      ? `${a.yoni} and ${b.yoni} are sworn enemies in the yoni table. The tradition reads this as instinctive friction, so patience and tenderness in private life matter more than usual.`
      : pts >= 3
        ? `${a.yoni} and ${b.yoni} are friendly animals. Physical and instinctive harmony comes easily.`
        : pts === 2
          ? `${a.yoni} and ${b.yoni} are neutral to each other. Intimacy is workable and grows with familiarity.`
          : `${a.yoni} and ${b.yoni} are unfriendly animals. Instincts can clash, so it helps to talk about needs openly.`;
  return koota('yoni', pts, { a: a.yoni, b: b.yoni }, text);
}

function grahaMaitriKoota(a: MatchPerson, b: MatchPerson): KootaResult {
  const la = a.moonSignLord, lb = b.moonSignLord;
  const r1 = relation(la, lb), r2 = relation(lb, la);
  let pts: number;
  if (la === lb) pts = 5;
  else {
    const key = [r1, r2].sort().join('+');
    pts = ({ 'friend+friend': 5, 'friend+neutral': 4, 'neutral+neutral': 3, 'enemy+friend': 1, 'enemy+neutral': 0.5, 'enemy+enemy': 0 } as Record<string, number>)[key];
  }
  const rel = (x: PlanetId, y: PlanetId, r: Rel) => `${nameOf(x)} is ${r === 'friend' ? 'a friend' : r === 'enemy' ? 'an enemy' : 'neutral'} to ${nameOf(y)}`;
  const text = la === lb
    ? `Both Moon signs are ruled by ${nameOf(la)}. Your minds work by the same rules, which is the best possible friendship score.`
    : `${a.moonSignName} is ruled by ${nameOf(la)} and ${b.moonSignName} by ${nameOf(lb)}. ${rel(la, lb, r1)}, and ${rel(lb, la, r2).charAt(0).toLowerCase() + rel(lb, la, r2).slice(1)}. ` +
      (pts >= 4 ? 'You are likely to be good friends who enjoy talking and see the world in compatible ways.'
        : pts >= 3 ? 'Friendship is cordial rather than instant. Shared interests will do a lot of the work.'
          : pts >= 1 ? 'One mind warms to the other more than the reverse. Make room for different opinions.'
            : 'The two ruling planets are not friendly, so outlooks can clash. Respecting the other’s way of thinking is the work here.');
  return koota('graha_maitri', pts, { a: `${a.moonSignName} (${nameOf(la)})`, b: `${b.moonSignName} (${nameOf(lb)})` }, text);
}

function ganaKoota(a: MatchPerson, b: MatchPerson, maitri: number, bhakoot: number): KootaResult {
  const pts = GANA_TABLE[GANA_ORDER.indexOf(a.gana)][GANA_ORDER.indexOf(b.gana)];
  const text = a.gana === b.gana
    ? `Both are ${a.gana} gana. Your basic natures are alike, so everyday life tends to flow.`
    : pts >= 5
      ? `${a.gana} and ${b.gana} blend well: one brings idealism and the other practicality.`
      : `${a.gana} and ${b.gana} are very different temperaments. ${a.gana === 'Rakshasa' || b.gana === 'Rakshasa' ? 'The Rakshasa side is fierce and independent, and can feel overwhelming to the other.' : ''} Clear agreements and patience help.`;
  let dosha: KootaDosha | undefined;
  if (pts <= 1) {
    const c: string[] = [];
    if (maitri >= 4) c.push('the Moon-sign lords are friendly (Graha Maitri is strong)');
    if (bhakoot === 7) c.push('Bhakoot scores in full');
    dosha = {
      id: 'gana', name: 'Gana dosha', cancelled: c.length > 0, cancellations: c,
      note: 'Gana dosha points to clashing temperaments. Many astrologers set it aside when the Moon-sign lords are friends or Bhakoot is clean, because those show the minds and the emotional bond still meet.',
    };
  }
  return koota('gana', pts, { a: a.gana, b: b.gana }, text, dosha);
}

function bhakootKoota(a: MatchPerson, b: MatchPerson): KootaResult {
  const d1 = signDistance(a.moonSign, b.moonSign);
  const d2 = signDistance(b.moonSign, a.moonSign);
  const pair = [d1, d2].sort((x, y) => x - y).join('/');
  const bad = ['2/12', '5/9', '6/8'].includes(pair);
  const pts = bad ? 0 : 7;
  const pairName = pair === '1/1' ? 'the same sign' : `${pair.replace('/', ' and ')} from each other`;
  const meaning: Record<string, string> = {
    '2/12': 'The 2/12 position is classically linked to money worries and a sense that one person gives more than they get.',
    '5/9': 'The 5/9 position is classically linked to differences over children, beliefs or how to live, although some schools count it as harmless.',
    '6/8': 'The 6/8 position is the hardest. It is classically linked to friction, disputes and health worries in the household.',
  };
  const text = bad
    ? `Your Moon signs (${a.moonSignName} and ${b.moonSignName}) are ${pairName}. ${meaning[pair]}`
    : `Your Moon signs (${a.moonSignName} and ${b.moonSignName}) are ${pairName}, a favourable position for affection, family life and shared prosperity.`;
  let dosha: KootaDosha | undefined;
  if (bad) {
    const c: string[] = [];
    if (a.moonSignLord === b.moonSignLord) c.push(`both Moon signs are ruled by ${nameOf(a.moonSignLord)}`);
    else if (relation(a.moonSignLord, b.moonSignLord) === 'friend' && relation(b.moonSignLord, a.moonSignLord) === 'friend')
      c.push(`the Moon-sign lords ${nameOf(a.moonSignLord)} and ${nameOf(b.moonSignLord)} are mutual friends`);
    if (a.nadi !== b.nadi && c.length) c.push('the nadis differ, so Nadi is clean');
    dosha = {
      id: 'bhakoot', name: 'Bhakoot dosha', cancelled: c.length > 0, cancellations: c,
      note: 'Bhakoot dosha is one of the two heavy doshas in matching. The tradition cancels it when the two Moon signs share a ruling planet or the rulers are mutual friends, because the emotional bond is then protected.',
    };
  }
  return koota('bhakoot', pts, { a: a.moonSignName, b: b.moonSignName }, text, dosha);
}

function nadiKoota(a: MatchPerson, b: MatchPerson): KootaResult {
  const same = a.nadi === b.nadi;
  const label = (n: Nadi) => `${n} (${({ Adi: 'vata', Madhya: 'pitta', Antya: 'kapha' })[n]})`;
  const text = same
    ? `Both Moons fall in the ${label(a.nadi)} nadi. The tradition treats two people of the same constitution as too alike for the next generation, and this is the heaviest single dosha in matching.`
    : `${label(a.nadi)} and ${label(b.nadi)} are different nadis. Your constitutions complement each other, which the tradition reads as good for health and for children.`;
  let dosha: KootaDosha | undefined;
  if (same) {
    const c: string[] = [];
    if (a.moonSign === b.moonSign && a.nakshatra !== b.nakshatra) c.push('both Moons are in the same sign but in different nakshatras');
    if (a.nakshatra === b.nakshatra && a.moonSign !== b.moonSign) c.push('both Moons are in the same nakshatra but in different signs');
    if (a.nakshatra === b.nakshatra && a.moonSign === b.moonSign && a.pada !== b.pada) c.push('both Moons are in the same nakshatra but different padas (accepted by many, not all)');
    if (a.moonSign !== b.moonSign && a.moonSignLord === b.moonSignLord) c.push(`both Moon signs are ruled by ${nameOf(a.moonSignLord)}`);
    dosha = {
      id: 'nadi', name: 'Nadi dosha', cancelled: c.length > 0, cancellations: c,
      note: 'Nadi dosha is the most serious dosha in Ashtakoota and is linked to health and children. It is traditionally cancelled when the Moons share a sign but not a nakshatra, share a nakshatra but not a sign, or share a ruling planet. Remedies traditionally include the Maha Mrityunjaya mantra and charity.',
    };
  }
  return koota('nadi', same ? 0 : 8, { a: a.nadi, b: b.nadi }, text, dosha);
}

// ------------------------------------------------------------------ manglik

const MANGLIK_HOUSES = [1, 2, 4, 7, 8, 12];

function manglikSide(chart: ChartInput): ManglikSide {
  const dosha = detectManglik(chart);
  const marsFrom = {
    ascendant: houseOf(chart, 'mars'),
    moon: houseFromPlanet(chart, 'moon', 'mars'),
    venus: houseFromPlanet(chart, 'venus', 'mars'),
  };
  const inHouse = MANGLIK_HOUSES.includes(marsFrom.ascendant) || MANGLIK_HOUSES.includes(marsFrom.moon) || MANGLIK_HOUSES.includes(marsFrom.venus);
  const balancingMalefics: string[] = [];
  for (const p of ['mars', 'saturn', 'rahu', 'ketu'] as PlanetId[]) {
    const fromAsc = houseOf(chart, p);
    const fromMoon = houseFromPlanet(chart, 'moon', p);
    const where: string[] = [];
    if (MANGLIK_HOUSES.includes(fromAsc)) where.push(`${ordinal(fromAsc)} from the ascendant`);
    if (p !== 'mars' && MANGLIK_HOUSES.includes(fromMoon)) where.push(`${ordinal(fromMoon)} from the Moon`);
    if (where.length) balancingMalefics.push(`${nameOf(p)} in the ${where.join(' and ')}`);
  }
  return { marsInManglikHouse: inHouse, manglik: dosha.present, dosha, marsFrom, balancingMalefics };
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function compareManglik(a: ChartInput, b: ChartInput): ManglikComparison {
  const A = manglikSide(a), B = manglikSide(b);
  const balancing: string[] = [];
  let status: ManglikStatus;
  let headline: string;
  let summary: string;
  if (!A.manglik && !B.manglik) {
    status = 'neither';
    const softened = [A, B].filter((s) => s.marsInManglikHouse).length;
    headline = 'Neither chart carries an active Manglik dosha';
    summary = softened
      ? 'Mars does sit in a Manglik house in ' + (softened === 2 ? 'both charts' : 'one chart') + ', but the chart’s own cancellations remove the dosha. There is no Mars imbalance between you.'
      : 'Mars is outside the Manglik houses in both charts, so there is no Mars imbalance between you.';
  } else if (A.manglik && B.manglik) {
    status = 'both';
    headline = 'Both are Manglik, so the dosha cancels out';
    summary = 'When both partners have Mars in a Manglik house, the tradition says the fire is evenly matched and the dosha is neutralised. Both bring the same intensity and independence, and neither is overwhelmed by the other.';
  } else {
    const [M, other] = A.manglik ? [A, B] : [B, A];
    const who = A.manglik ? 'the groom’s seat' : 'the bride’s seat';
    for (const m of other.balancingMalefics) balancing.push(m);
    if (balancing.length) {
      status = 'balanced';
      headline = `Only ${who} is Manglik, but the other chart balances it`;
      summary = `Mars is active in ${who}’s chart (${M.dosha.reason.replace(/\.$/, '')}). The other chart has ${balancing.join('; ')}. Under the dosha samya (balancing) rule, a malefic in the same sensitive houses of the partner’s chart absorbs the Mars heat, so most astrologers accept the match.`;
    } else {
      status = 'mismatch';
      headline = `Only ${who} is Manglik`;
      summary = `Mars is active in ${who}’s chart (${M.dosha.reason.replace(/\.$/, '')}) and the other chart has no balancing malefic in those houses. Traditionally this is the case that calls for care: a remedy before marriage, or a closer look at the whole chart. Many astrologers also relax the rule after age 28, or when Mars is weak by sign.`;
    }
  }
  return { a: A, b: B, status, headline, summary, balancing };
}

// ------------------------------------------------------------------ match

const BANDS: { min: number; band: MatchBand; label: string; text: string }[] = [
  { min: 33, band: 'excellent', label: 'Excellent match', text: 'An exceptional score. The tradition sees this as a rare and blessed pairing.' },
  { min: 25, band: 'very_good', label: 'Very good match', text: 'A strong score. Most kootas line up, and the tradition approves the match warmly.' },
  { min: 18, band: 'acceptable', label: 'Acceptable match', text: 'A workable score. 18 is the classical pass mark, so the match is accepted, with some areas to tend consciously.' },
  { min: 0, band: 'not_recommended', label: 'Below the classical pass mark', text: 'Below 18 of 36, which the tradition does not recommend without a closer look. Cancellations, the Manglik picture and the full charts can change that judgement.' },
];

/**
 * Match two charts. `a` sits in the groom's seat of the classical tables and
 * `b` in the bride's seat.
 */
export function matchCharts(a: ChartInput, b: ChartInput): MatchResult {
  const A = matchPerson(a), B = matchPerson(b);
  const varna = varnaKoota(A, B);
  const vashya = vashyaKoota(A, B);
  const tara = taraKoota(A, B);
  const yoni = yoniKoota(A, B);
  const maitri = grahaMaitriKoota(A, B);
  const bhakoot = bhakootKoota(A, B);
  const gana = ganaKoota(A, B, maitri.points, bhakoot.points);
  const nadi = nadiKoota(A, B);
  const kootas = [varna, vashya, tara, yoni, maitri, gana, bhakoot, nadi];
  const total = kootas.reduce((s, k) => s + k.points, 0);
  const adjustedTotal = kootas.reduce((s, k) => s + (k.dosha?.cancelled && k.dosha.id !== 'gana' ? k.max : k.points), 0);
  const band = BANDS.find((x) => total >= x.min)!;
  const doshas = kootas.map((k) => k.dosha).filter((d): d is KootaDosha => !!d);
  const manglik = compareManglik(a, b);

  const strong = kootas.filter((k) => k.quality === 'full').map((k) => k.name);
  const weak = kootas.filter((k) => k.quality === 'none').map((k) => k.name);
  const parts = [`${fmt(total)} of 36 gunas. ${band.text}`];
  if (strong.length) parts.push(`Full marks in ${list(strong)}.`);
  if (weak.length) parts.push(`Nothing scored in ${list(weak)}.`);
  const live = doshas.filter((d) => !d.cancelled);
  const cancelled = doshas.filter((d) => d.cancelled);
  if (cancelled.length) parts.push(`${list(cancelled.map((d) => d.name))} ${cancelled.length > 1 ? 'are' : 'is'} cancelled by a classical exception${adjustedTotal !== total ? ` (${fmt(adjustedTotal)} of 36 if the restored Bhakoot or Nadi points are counted)` : ''}.`);
  if (live.length) parts.push(`${list(live.map((d) => d.name))} ${live.length > 1 ? 'remain' : 'remains'} active.`);

  const notes = [
    'Ashtakoota reads only the two Moons. A full match also compares the 7th houses, Venus, the dasha periods and the overall strength of both charts.',
    'The classical tables seat one person as the groom and one as the bride. Varna, Vashya, Gana and the direction of Tara depend on the seats, so swapping them can change the score slightly.',
    'A birth time that is off by an hour or two can move the Moon into the next nakshatra, which changes several kootas at once.',
  ];
  return {
    a: A, b: B, kootas, total, max: 36, adjustedTotal,
    band: band.band, bandLabel: band.label, summary: parts.join(' '),
    doshas, manglik, notes,
  };
}

function list(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}
